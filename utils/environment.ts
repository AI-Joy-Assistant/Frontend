import { Platform } from 'react-native';

// 프로덕션 배포 URL (Cloud Run 직접 사용)
const PRODUCTION_URL = 'https://api.joyner.co.kr';

/**
 * 현재 실행 환경에 맞는 백엔드 URL 반환
 * - Web: localhost 사용
 * - Mobile: Cloud Run URL 사용
 */
export const getBackendUrl = (): string => {
    // 모바일은 배포된 서버 사용 (Google OAuth redirect URI 때문)
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
        return PRODUCTION_URL;
    }

    // 웹 개발 환경
    if (Platform.OS === 'web') {
        return 'http://localhost:8000';
    }
    return PRODUCTION_URL;
};

/**
 * 현재 플랫폼이 웹인지 확인
 */
export const isWeb = (): boolean => {
    return Platform.OS === 'web';
};

/**
 * 현재 플랫폼이 모바일인지 확인
 */
export const isMobile = (): boolean => {
    return Platform.OS === 'ios' || Platform.OS === 'android';
};
