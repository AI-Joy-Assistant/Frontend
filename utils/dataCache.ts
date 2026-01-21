/**
 * 간단한 인메모리 캐시 유틸리티
 * 화면 전환 시 데이터를 즉시 보여주기 위한 캐싱
 * 
 * 전략: Stale-While-Revalidate
 * 1. 캐시가 있으면 즉시 반환
 * 2. 백그라운드에서 새 데이터 fetch (선택적)
 */

type CacheEntry<T> = {
    data: T;
    timestamp: number;
    expiresIn: number; // ms
};

class DataCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private pendingRequests: Set<string> = new Set(); // 중복 요청 방지

    /**
     * 캐시에 데이터 저장
     * @param key 캐시 키
     * @param data 저장할 데이터
     * @param expiresIn 만료 시간 (ms), 기본 5분
     */
    set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn,
        });
        this.pendingRequests.delete(key); // 요청 완료
    }

    /**
     * 캐시에서 데이터 가져오기
     * 만료된 데이터도 반환하되, isStale 플래그로 구분
     */
    get<T>(key: string): { data: T | null; isStale: boolean; exists: boolean } {
        const entry = this.cache.get(key);

        if (!entry) {
            return { data: null, isStale: true, exists: false };
        }

        const isStale = Date.now() - entry.timestamp > entry.expiresIn;
        return { data: entry.data as T, isStale, exists: true };
    }

    /**
     * 요청이 이미 진행 중인지 확인 (중복 요청 방지)
     */
    isPending(key: string): boolean {
        return this.pendingRequests.has(key);
    }

    /**
     * 요청 시작 마킹
     */
    markPending(key: string): void {
        this.pendingRequests.add(key);
    }

    /**
     * 특정 키의 캐시 삭제
     */
    invalidate(key: string): void {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
    }

    /**
     * 특정 프리픽스로 시작하는 모든 캐시 삭제
     */
    invalidateByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
        for (const key of this.pendingRequests) {
            if (key.startsWith(prefix)) {
                this.pendingRequests.delete(key);
            }
        }
    }

    /**
     * 모든 캐시 삭제
     */
    clear(): void {
        this.cache.clear();
        this.pendingRequests.clear();
    }
}

// 싱글톤 인스턴스
export const dataCache = new DataCache();

// 캐시 키 상수
export const CACHE_KEYS = {
    // 친구 관련
    FRIENDS_LIST: 'friends:list',
    FRIEND_REQUESTS: 'friends:requests',

    // 채팅 관련
    CHAT_SESSIONS: 'chat:sessions',
    CHAT_DEFAULT_SESSION: 'chat:defaultSession',
    CHAT_HISTORY: (sessionId: string) => `chat:history:${sessionId}`,

    // 사용자 관련
    USER_ME: 'user:me',

    // 캘린더 관련
    CALENDAR_EVENTS: (date: string) => `calendar:events:${date}`,

    // 알림 관련
    NOTIFICATIONS: 'notifications',
};
