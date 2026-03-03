import { useState, useCallback } from 'react';

/**
 * Pull-to-refresh 기능을 위한 커스텀 훅
 * @param refreshFn 새로고침 시 실행할 비동기 함수
 * @returns refreshing 상태와 onRefresh 핸들러
 */
export const useRefresh = (refreshFn: () => Promise<void>) => {
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshFn();
        } catch (error) {
            console.error('[useRefresh] Refresh failed:', error);
        } finally {
            setRefreshing(false);
        }
    }, [refreshFn]);

    return { refreshing, onRefresh };
};

/**
 * 여러 함수를 동시에 새로고침하는 훅
 * @param refreshFns 새로고침 시 실행할 비동기 함수 배열
 * @returns refreshing 상태와 onRefresh 핸들러
 */
export const useMultiRefresh = (refreshFns: (() => Promise<void> | void)[]) => {
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all(refreshFns.map(fn => fn()));
        } catch (error) {
            console.error('[useMultiRefresh] Refresh failed:', error);
        } finally {
            setRefreshing(false);
        }
    }, [refreshFns]);

    return { refreshing, onRefresh };
};
