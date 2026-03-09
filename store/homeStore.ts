import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';

type Listener = () => void;

// 인터페이스 정의
interface PendingRequest {
    id: string;
    thread_id: string;
    title: string;
    summary?: string;
    initiator_id: string;
    initiator_name: string;
    initiator_avatar: string;
    participant_count: number;
    proposed_date?: string;
    proposed_time?: string;
    location?: string;
    status: string;
    created_at: string;
    reschedule_requested_at?: string;
    type?: 'new' | 'reschedule';
}

interface Notification {
    id: string;
    type: 'schedule_rejected' | 'friend_request' | 'friend_accepted' | 'general';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    metadata?: Record<string, unknown>;
}

interface CurrentUser {
    id: string;
    name?: string;
    email?: string;
    picture?: string;
}

interface HomeState {
    pendingRequests: PendingRequest[];
    notifications: Notification[];
    currentUser: CurrentUser | null;
    loading: boolean;
    loadingPending: boolean;  // Skeleton UI 지원
    loadingNotifications: boolean;  // Skeleton UI 지원
    initialLoadDone: boolean;  // 첫 로딩 완료 여부
    lastFetchedAt: number | null;
}

// 상태 초기값
let state: HomeState = {
    pendingRequests: [],
    notifications: [],
    currentUser: null,
    loading: false,
    loadingPending: true,  // 초기에는 로딩중
    loadingNotifications: true,  // 초기에는 로딩중
    initialLoadDone: false,
    lastFetchedAt: null,
};

const listeners = new Set<Listener>();
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

// [FIX] 로컬에서 추가된 임시 카드 추적 (서버 refresh 시 보존용)
const locallyAddedRequests = new Map<string, { request: PendingRequest; addedAt: number }>();
const LOCAL_CARD_TTL = 30_000; // 30초 후 자동 만료

function emitChange() {
    listeners.forEach(listener => listener());
}

function isCacheValid(): boolean {
    if (!state.lastFetchedAt) return false;
    return Date.now() - state.lastFetchedAt < CACHE_TTL;
}

export const homeStore = {
    // React useSyncExternalStore 호환
    getSnapshot: (): HomeState => state,

    subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // [SWR] Pending 요청 조회 - 캐시된 데이터 즉시 반환, 백그라운드 갱신
    fetchPendingRequests: async (force = false): Promise<PendingRequest[]> => {
        if (!force && isCacheValid() && state.pendingRequests !== undefined && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 히트 - pendingRequests');
            return state.pendingRequests;
        }

        // [SWR] 첫 로딩(데이터 없음)일 때만 skeleton 표시, 이후에는 기존 데이터 유지
        const isFirstLoad = !state.initialLoadDone && state.pendingRequests.length === 0;
        if (isFirstLoad) {
            state = { ...state, loadingPending: true };
            emitChange();
        }
        // 기존 데이터가 있으면 loadingPending을 false로 유지 → 빈 화면 방지

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.pendingRequests;

            console.log('[HomeStore] API 호출 - fetchPendingRequests');
            const response = await fetch(`${API_BASE}/a2a/pending-requests`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // [FIX] 거절된 요청은 클라이언트에서도 즉시 필터링
                const filteredRequests = (data.requests || []).filter(
                    (r: PendingRequest) => r.status?.toLowerCase() !== 'rejected'
                );

                // [FIX] 로컬 임시 카드 보존: 서버에 아직 없으면 병합
                const serverIds = new Set(filteredRequests.map((r: PendingRequest) => r.id));
                const now = Date.now();
                const survivingLocalCards: PendingRequest[] = [];
                locallyAddedRequests.forEach((entry, id) => {
                    if (!serverIds.has(id) && (now - entry.addedAt < LOCAL_CARD_TTL)) {
                        survivingLocalCards.push(entry.request);
                    } else {
                        // 서버에 존재하거나 만료됨 → 추적 제거
                        locallyAddedRequests.delete(id);
                    }
                });

                const mergedRequests = [...survivingLocalCards, ...filteredRequests];
                console.log(`[HomeStore] fetchPendingRequests 완료: 서버 ${filteredRequests.length}개 + 로컬 임시 ${survivingLocalCards.length}개`);

                state = {
                    ...state,
                    pendingRequests: mergedRequests,
                    loadingPending: false,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[HomeStore] fetchPendingRequests 에러:', error);
            state = { ...state, loadingPending: false };
            emitChange();
        }

        return state.pendingRequests;
    },

    // [SWR] 알림 조회 - 캐시된 데이터 즉시 반환, 백그라운드 갱신
    fetchNotifications: async (force = false): Promise<Notification[]> => {
        if (!force && isCacheValid() && state.notifications !== undefined && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 히트 - notifications');
            return state.notifications;
        }

        // [SWR] 첫 로딩(데이터 없음)일 때만 skeleton 표시
        const isFirstLoad = !state.initialLoadDone && state.notifications.length === 0;
        if (isFirstLoad) {
            state = { ...state, loadingNotifications: true };
            emitChange();
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.notifications;

            console.log('[HomeStore] API 호출 - fetchNotifications');
            const response = await fetch(`${API_BASE}/chat/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                state = {
                    ...state,
                    notifications: data.notifications || [],
                    loadingNotifications: false,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[HomeStore] fetchNotifications 에러:', error);
            state = { ...state, loadingNotifications: false };
            emitChange();
        }

        return state.notifications;
    },

    // 현재 사용자 조회
    fetchCurrentUser: async (force = false): Promise<CurrentUser | null> => {
        if (!force && isCacheValid() && state.currentUser !== null) {
            console.log('[HomeStore] 캐시 히트 - currentUser');
            return state.currentUser;
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.currentUser;

            console.log('[HomeStore] API 호출 - fetchCurrentUser');
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                state = {
                    ...state,
                    currentUser: data,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[HomeStore] fetchCurrentUser 에러:', error);
        }

        return state.currentUser;
    },

    // [SWR] 모든 데이터 한 번에 조회 - 캐시 유효하면 스킵, stale이면 백그라운드 갱신
    fetchAll: async (force = false): Promise<void> => {
        if (!force && isCacheValid() && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 유효 - fetchAll 스킵');
            return;
        }

        // [SWR] 최초 로딩일 때만 loading=true (기존 데이터 있으면 로딩 표시 안 함)
        const isFirstLoad = !state.initialLoadDone;
        if (isFirstLoad) {
            state = { ...state, loading: true };
            emitChange();
        }

        await Promise.all([
            homeStore.fetchPendingRequests(force),
            homeStore.fetchNotifications(force),
            homeStore.fetchCurrentUser(force),
        ]);

        state = { ...state, loading: false, initialLoadDone: true };
        emitChange();
    },

    // 캐시 무효화 (WebSocket 이벤트 시 호출)
    invalidate: (): void => {
        console.log('[HomeStore] 캐시 무효화');
        state = { ...state, lastFetchedAt: null };
        emitChange();
    },

    // 강제 새로고침
    refresh: async (): Promise<void> => {
        console.log('[HomeStore] 강제 새로고침');
        await homeStore.fetchAll(true);
    },

    // 로딩 상태
    isLoading: (): boolean => state.loading,

    // 현재 사용자 ID 반환
    getCurrentUserId: (): string | null => state.currentUser?.id || null,

    // [NEW] 단건 조회 - 상세 페이지 initialData용
    getRequestById: (id: string): PendingRequest | undefined => {
        return state.pendingRequests.find(r => r.id === id);
    },

    // [NEW] 부분 업데이트 - WebSocket 이벤트 시 개별 항목만 업데이트
    addPendingRequest: (request: PendingRequest): void => {
        // 중복 방지
        if (state.pendingRequests.some(r => r.id === request.id)) return;
        console.log('[HomeStore] 부분 추가 - pendingRequest:', request.id);
        // [FIX] 로컬 추적에 등록 → 서버 refresh 시 보존
        locallyAddedRequests.set(request.id, { request, addedAt: Date.now() });
        state = {
            ...state,
            pendingRequests: [request, ...state.pendingRequests],
        };
        emitChange();
    },

    removePendingRequest: (id: string): void => {
        const before = state.pendingRequests.length;
        const filtered = state.pendingRequests.filter(r => r.id !== id);
        if (filtered.length < before) {
            console.log('[HomeStore] 부분 제거 - pendingRequest:', id);
            state = { ...state, pendingRequests: filtered };
            emitChange();
        }
    },

    updatePendingRequest: (id: string, partial: Partial<PendingRequest>): void => {
        const idx = state.pendingRequests.findIndex(r => r.id === id);
        if (idx === -1) return;
        console.log('[HomeStore] 부분 업데이트 - pendingRequest:', id);
        const updated = [...state.pendingRequests];
        updated[idx] = { ...updated[idx], ...partial };
        state = { ...state, pendingRequests: updated };
        emitChange();
    },

    addNotification: (notification: Notification): void => {
        // 중복 방지
        if (state.notifications.some(n => n.id === notification.id)) return;
        console.log('[HomeStore] 부분 추가 - notification:', notification.id);
        state = {
            ...state,
            notifications: [notification, ...state.notifications],
        };
        emitChange();
    },

    // 캐시 상태 확인 (디버그용)
    getCacheAge: (): number | null => {
        if (!state.lastFetchedAt) return null;
        return Date.now() - state.lastFetchedAt;
    },

    // 전체 상태 초기화 (로그아웃 시 호출)
    reset: (): void => {
        console.log('[HomeStore] 상태 초기화');
        state = {
            pendingRequests: [],
            notifications: [],
            currentUser: null,
            loading: false,
            loadingPending: true,
            loadingNotifications: true,
            initialLoadDone: false,
            lastFetchedAt: null,
        };
        emitChange();
    },
};
