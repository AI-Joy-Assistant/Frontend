import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';
import { A2ALog } from '../types';

type Listener = () => void;

interface A2AState {
    logs: A2ALog[];
    currentUserId: string | null;
    loading: boolean;
    lastFetchedAt: number | null;
}

// 상태 초기값
let state: A2AState = {
    logs: [],
    currentUserId: null,
    loading: false,
    lastFetchedAt: null,
};

const listeners = new Set<Listener>();
const CACHE_TTL = 3 * 60 * 1000; // 3분 (A2A는 더 자주 갱신 필요)

function emitChange() {
    listeners.forEach(listener => listener());
}

function isCacheValid(): boolean {
    if (!state.lastFetchedAt) return false;
    return Date.now() - state.lastFetchedAt < CACHE_TTL;
}

// 시간 형식 변환 함수
function formatTimeRange(date: string | undefined, time: string | undefined): string {
    if (!date && !time) return "미정";

    const now = new Date();
    const currentYear = now.getFullYear();

    let formattedDate = date || '';
    let formattedTime = time || '';

    // MM월 DD일 형식 → YYYY-MM-DD
    if (date) {
        const koreanMatch = date.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (koreanMatch) {
            const month = String(koreanMatch[1]).padStart(2, '0');
            const day = String(koreanMatch[2]).padStart(2, '0');
            formattedDate = `${currentYear}-${month}-${day}`;
        }
    }

    // 오전/오후 HH시 → HH:MM
    if (time) {
        const timeMatch = time.match(/(오전|오후)\s*(\d{1,2})시/);
        if (timeMatch) {
            let hour = parseInt(timeMatch[2]);
            if (timeMatch[1] === '오후' && hour !== 12) hour += 12;
            if (timeMatch[1] === '오전' && hour === 12) hour = 0;
            formattedTime = `${String(hour).padStart(2, '0')}:00`;
        }
    }

    return `${formattedDate} ${formattedTime}`.trim() || "미정";
}

export const a2aStore = {
    // React useSyncExternalStore 호환
    getSnapshot: (): A2AState => state,

    subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // 현재 사용자 ID 설정 (세션 필터링에 필요)
    setCurrentUserId: (userId: string | null): void => {
        if (state.currentUserId !== userId) {
            state = { ...state, currentUserId: userId };
            emitChange();
        }
    },

    getCurrentUserId: (): string | null => state.currentUserId,

    // A2A 로그 조회
    fetchLogs: async (force = false): Promise<A2ALog[]> => {
        if (!force && isCacheValid() && state.logs.length > 0) {
            console.log('[A2AStore] 캐시 히트 - logs');
            return state.logs;
        }

        if (!state.currentUserId) {
            console.log('[A2AStore] currentUserId 없음 - 스킵');
            return state.logs;
        }

        state = { ...state, loading: true };
        emitChange();

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                state = { ...state, loading: false };
                emitChange();
                return state.logs;
            }

            console.log('[A2AStore] API 호출 - fetchLogs');
            const response = await fetch(`${API_BASE}/a2a/sessions`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const mappedLogs: A2ALog[] = data.sessions
                    .filter((session: any) => {
                        const leftParticipants = session.details?.left_participants || [];
                        return !leftParticipants.includes(state.currentUserId);
                    })
                    .map((session: any) => ({
                        id: session.id,
                        title: session.summary || session.title || session.details?.purpose || "일정 조율",
                        status: session.status === 'completed' ? 'COMPLETED'
                            : session.status === 'rejected' ? 'REJECTED'
                                : 'IN_PROGRESS',
                        summary: session.participant_names?.join(', ') || "참여자 없음",
                        timeRange: (() => {
                            const d = session.details || {};
                            const durationNights = d.duration_nights || 0;
                            const date = d.proposedDate || d.requestedDate || d.date || '';

                            if (durationNights >= 1 && date) {
                                try {
                                    let startDateStr = date;
                                    const now = new Date();
                                    const currentYear = now.getFullYear();

                                    const koreanMatch = date.match(/(\d{1,2})월\s*(\d{1,2})일/);
                                    if (koreanMatch) {
                                        const month = String(koreanMatch[1]).padStart(2, '0');
                                        const day = String(koreanMatch[2]).padStart(2, '0');
                                        startDateStr = `${currentYear}-${month}-${day}`;
                                    }

                                    const startDateObj = new Date(startDateStr);
                                    if (!isNaN(startDateObj.getTime())) {
                                        const endDateObj = new Date(startDateObj);
                                        endDateObj.setDate(startDateObj.getDate() + durationNights);

                                        const formatDate = (dt: Date) => {
                                            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        };

                                        return `${formatDate(startDateObj)} ~ ${formatDate(endDateObj)}`;
                                    }
                                } catch (e) {
                                    return date;
                                }
                            }

                            const time = d.proposedTime || d.requestedTime || d.time || '';
                            return formatTimeRange(date, time);
                        })(),
                        createdAt: session.created_at,
                        details: session.details,
                        initiator_user_id: session.initiator_user_id
                    }));

                state = {
                    ...state,
                    logs: mappedLogs,
                    loading: false,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            } else {
                state = { ...state, loading: false };
                emitChange();
            }
        } catch (error) {
            console.error('[A2AStore] fetchLlogs 에러:', error);
            state = { ...state, loading: false };
            emitChange();
        }

        return state.logs;
    },

    // 캐시 무효화 (WebSocket 이벤트 시 호출)
    invalidate: (): void => {
        console.log('[A2AStore] 캐시 무효화');
        state = { ...state, lastFetchedAt: null };
        emitChange();
    },

    // 강제 새로고침
    refresh: async (): Promise<void> => {
        console.log('[A2AStore] 강제 새로고침');
        await a2aStore.fetchLogs(true);
    },

    // 로딩 상태
    isLoading: (): boolean => state.loading,

    // 캐시 상태 확인 (디버그용)
    getCacheAge: (): number | null => {
        if (!state.lastFetchedAt) return null;
        return Date.now() - state.lastFetchedAt;
    },
};
