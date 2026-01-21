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

    // Pending 요청 조회
    fetchPendingRequests: async (force = false): Promise<PendingRequest[]> => {
        if (!force && isCacheValid() && state.pendingRequests !== undefined && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 히트 - pendingRequests');
            return state.pendingRequests;
        }

        // 첫 로딩 시에만 skeleton 표시
        if (!state.initialLoadDone) {
            state = { ...state, loadingPending: true };
            emitChange();
        }

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
                state = {
                    ...state,
                    pendingRequests: data.requests || [],
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

    // 알림 조회
    fetchNotifications: async (force = false): Promise<Notification[]> => {
        if (!force && isCacheValid() && state.notifications !== undefined && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 히트 - notifications');
            return state.notifications;
        }

        // 첫 로딩 시에만 skeleton 표시
        if (!state.initialLoadDone) {
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

    // 모든 데이터 한 번에 조회 (캐시 유효하면 스킵)
    fetchAll: async (force = false): Promise<void> => {
        if (!force && isCacheValid() && state.initialLoadDone) {
            console.log('[HomeStore] 캐시 유효 - fetchAll 스킵');
            return;
        }

        state = { ...state, loading: true };
        emitChange();

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

    // 캐시 상태 확인 (디버그용)
    getCacheAge: (): number | null => {
        if (!state.lastFetchedAt) return null;
        return Date.now() - state.lastFetchedAt;
    },
};
