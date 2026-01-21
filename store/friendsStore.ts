import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';

type Listener = () => void;

// 인터페이스 정의
interface FriendRequest {
    id: string;
    from_user: {
        id: string;
        name: string;
        email: string;
        picture?: string;
    };
    status: string;
    created_at: string;
}

interface Friend {
    id: string;
    friend: {
        id: string;
        name: string;
        email: string;
        picture?: string;
    };
    created_at: string;
}

interface UserInfo {
    name: string;
    email: string;
    handle?: string;
    id?: string;
    picture?: string;
}

interface FriendsState {
    friends: Friend[];
    friendRequests: FriendRequest[];
    userInfo: UserInfo | null;
    loading: boolean;
    loadingFriends: boolean;
    loadingRequests: boolean;
    initialLoadDone: boolean;
    lastFetchedAt: number | null;
}

// 상태 초기값
let state: FriendsState = {
    friends: [],
    friendRequests: [],
    userInfo: null,
    loading: false,
    loadingFriends: true,
    loadingRequests: true,
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

export const friendsStore = {
    // React useSyncExternalStore 호환
    getSnapshot: (): FriendsState => state,

    subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // 친구 목록 조회
    fetchFriends: async (force = false): Promise<Friend[]> => {
        if (!force && isCacheValid() && state.friends.length > 0 && state.initialLoadDone) {
            console.log('[FriendsStore] 캐시 히트 - friends');
            return state.friends;
        }

        if (!state.initialLoadDone) {
            state = { ...state, loadingFriends: true };
            emitChange();
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.friends;

            console.log('[FriendsStore] API 호출 - fetchFriends');
            const response = await fetch(`${API_BASE}/friends/list`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                state = {
                    ...state,
                    friends: data.friends || [],
                    loadingFriends: false,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[FriendsStore] fetchFriends 에러:', error);
            state = { ...state, loadingFriends: false };
            emitChange();
        }

        return state.friends;
    },

    // 친구 요청 목록 조회
    fetchFriendRequests: async (force = false): Promise<FriendRequest[]> => {
        if (!force && isCacheValid() && state.friendRequests !== undefined && state.initialLoadDone) {
            console.log('[FriendsStore] 캐시 히트 - friendRequests');
            return state.friendRequests;
        }

        if (!state.initialLoadDone) {
            state = { ...state, loadingRequests: true };
            emitChange();
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.friendRequests;

            console.log('[FriendsStore] API 호출 - fetchFriendRequests');
            const response = await fetch(`${API_BASE}/friends/requests`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
            });

            if (response.ok) {
                const data = await response.json();
                state = {
                    ...state,
                    friendRequests: data.requests || [],
                    loadingRequests: false,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[FriendsStore] fetchFriendRequests 에러:', error);
            state = { ...state, loadingRequests: false };
            emitChange();
        }

        return state.friendRequests;
    },

    // 사용자 정보 조회
    fetchUserInfo: async (force = false): Promise<UserInfo | null> => {
        if (!force && isCacheValid() && state.userInfo !== null) {
            console.log('[FriendsStore] 캐시 히트 - userInfo');
            return state.userInfo;
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return state.userInfo;

            console.log('[FriendsStore] API 호출 - fetchUserInfo');
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                state = {
                    ...state,
                    userInfo: data,
                    lastFetchedAt: Date.now(),
                };
                emitChange();
            }
        } catch (error) {
            console.error('[FriendsStore] fetchUserInfo 에러:', error);
        }

        return state.userInfo;
    },

    // 모든 데이터 한 번에 조회 (캐시 유효하면 스킵)
    fetchAll: async (force = false): Promise<void> => {
        if (!force && isCacheValid() && state.initialLoadDone) {
            console.log('[FriendsStore] 캐시 유효 - fetchAll 스킵');
            return;
        }

        state = { ...state, loading: true };
        emitChange();

        await Promise.all([
            friendsStore.fetchFriends(force),
            friendsStore.fetchFriendRequests(force),
            friendsStore.fetchUserInfo(force),
        ]);

        state = { ...state, loading: false, initialLoadDone: true };
        emitChange();
    },

    // 캐시 무효화 (WebSocket 이벤트 시 호출)
    invalidate: (): void => {
        console.log('[FriendsStore] 캐시 무효화');
        state = { ...state, lastFetchedAt: null };
        emitChange();
    },

    // 강제 새로고침
    refresh: async (): Promise<void> => {
        console.log('[FriendsStore] 강제 새로고침');
        await friendsStore.fetchAll(true);
    },

    // 친구 요청 로컬 업데이트 (낙관적 업데이트용)
    removeRequest: (requestId: string): void => {
        state = {
            ...state,
            friendRequests: state.friendRequests.filter(r => r.id !== requestId),
        };
        emitChange();
    },

    // 친구 목록에 추가 (수락 시)
    addFriend: (friend: Friend): void => {
        state = {
            ...state,
            friends: [friend, ...state.friends],
        };
        emitChange();
    },

    // 친구 삭제
    removeFriend: (friendId: string): void => {
        state = {
            ...state,
            friends: state.friends.filter(f => f.friend.id !== friendId),
        };
        emitChange();
    },

    // 로딩 상태
    isLoading: (): boolean => state.loading,

    // 캐시 상태 확인 (디버그용)
    getCacheAge: (): number | null => {
        if (!state.lastFetchedAt) return null;
        return Date.now() - state.lastFetchedAt;
    },
};
