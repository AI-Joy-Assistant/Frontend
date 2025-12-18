import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';

type Listener = () => void;

let unreadCount = 0;
let lastReadAt: string | null = null;
let isReading = false; // 읽는 중 플래그 (폴링 방지)
let lastMarkAsReadTime = 0; // 마지막 markAsRead 호출 시간
let initialized = false; // 초기화 완료 여부
const listeners = new Set<Listener>();

const LAST_READ_KEY = 'chat_last_read_at';
const COOLDOWN_MS = 5000; // markAsRead 후 5초 동안은 폴링 스킵

// 초기 로딩
const initialize = async () => {
    try {
        const saved = await AsyncStorage.getItem(LAST_READ_KEY);

        // 이미 markAsRead가 호출되어 더 최신 값이 있으면 덮어쓰지 않음
        if (lastReadAt !== null) {
            console.log('[BadgeStore] 초기화 스킵 - 이미 더 최신 lastReadAt 있음:', lastReadAt);
            initialized = true;
            return;
        }

        if (saved) {
            lastReadAt = saved;
            console.log('[BadgeStore] 초기화 - 저장된 lastReadAt:', saved);
        } else {
            // 처음 설치 시 현재 시간으로 초기화
            const now = new Date().toISOString();
            lastReadAt = now;
            await AsyncStorage.setItem(LAST_READ_KEY, now);
            console.log('[BadgeStore] 초기화 - 새로 생성:', now);
        }
        initialized = true;
    } catch (e) {
        console.error('Failed to load last read time', e);
        initialized = true;
    }
};

initialize();

export const badgeStore = {
    getSnapshot: () => unreadCount,

    subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // 서버에서 안 읽은 개수 가져오기
    fetchUnreadCount: async () => {
        const timeSinceMarkAsRead = Date.now() - lastMarkAsReadTime;

        // 읽는 중이면 폴링 스킵 (읽음 처리 직후 덮어쓰기 방지)
        if (isReading) {
            console.log('[BadgeStore] ⏸️ Skipping - isReading is true');
            return;
        }

        // markAsRead 호출 후 5초 이내면 스킵 (화면 전환 시 race condition 방지)
        if (timeSinceMarkAsRead < COOLDOWN_MS) {
            console.log(`[BadgeStore] ⏸️ Skipping - cooldown (${timeSinceMarkAsRead}ms / ${COOLDOWN_MS}ms)`);
            return;
        }

        try {
            if (!lastReadAt) {
                console.log('[BadgeStore] ⚠️ No lastReadAt set');
                return;
            }

            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;

            console.log('[BadgeStore] 🔍 Fetching with lastReadAt:', lastReadAt);

            const res = await fetch(`${API_BASE}/chat/unread-count?last_read_at=${encodeURIComponent(lastReadAt)}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'bypass-tunnel-reminder': 'true',
                }
            });

            if (res.ok) {
                const data = await res.json();
                const count = data.count || 0;
                console.log('[BadgeStore] 📬 Server returned count:', count);

                if (unreadCount !== count) {
                    unreadCount = count;
                    emitChange();
                }
            }
        } catch (e) {
            console.error('Failed to fetch unread count', e);
        }
    },

    // 읽음 처리 (채팅 화면 들어올 때 & 나갈 때 호출)
    markAsRead: async () => {
        try {
            // 즉시 상태 업데이트 (동기적으로!)
            isReading = true;
            lastMarkAsReadTime = Date.now();
            unreadCount = 0;

            // 현재 시간으로 lastReadAt 갱신
            const newReadAt = new Date().toISOString();
            lastReadAt = newReadAt;

            console.log('[BadgeStore] ✅ Mark as read. New lastReadAt:', newReadAt);
            emitChange(); // 즉시 UI 업데이트

            // 비동기로 저장 (실패해도 메모리에는 이미 갱신됨)
            await AsyncStorage.setItem(LAST_READ_KEY, newReadAt);

            // 5초 후에 폴링 다시 허용
            setTimeout(() => {
                isReading = false;
                console.log('[BadgeStore] 🔓 Polling re-enabled after cooldown');
            }, COOLDOWN_MS);
        } catch (e) {
            isReading = false;
            console.error('Failed to mark as read', e);
        }
    },

    // 강제로 0으로 설정
    clearBadge: () => {
        unreadCount = 0;
        lastMarkAsReadTime = Date.now();
        emitChange();
        console.log('[BadgeStore] 🧹 Badge cleared');
    },

    // [NEW] AsyncStorage를 현재 시간으로 강제 리셋
    forceResetLastReadAt: async () => {
        try {
            const now = new Date().toISOString();
            lastReadAt = now;
            unreadCount = 0;
            isReading = true;
            lastMarkAsReadTime = Date.now();

            await AsyncStorage.setItem(LAST_READ_KEY, now);
            emitChange();

            console.log('[BadgeStore] 🔄 Force reset lastReadAt to:', now);

            setTimeout(() => {
                isReading = false;
            }, COOLDOWN_MS);
        } catch (e) {
            console.error('Failed to force reset lastReadAt', e);
        }
    },

    // 디버그: 현재 lastReadAt 값 확인
    getLastReadAt: () => lastReadAt,

    // 강제 설정 (테스트용)
    setCount: (count: number) => {
        unreadCount = count;
        emitChange();
    }
};

function emitChange() {
    listeners.forEach(listener => listener());
}
