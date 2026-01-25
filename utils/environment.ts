import { Platform } from 'react-native';

// 프로덕션 배포 URL (Cloud Run 직접 사용)
const PRODUCTION_URL = 'https://api.joyner.co.kr';

/**
 * 현재 실행 환경에 맞는 백엔드 URL 반환
 * - Web: localhost 사용
 * - Mobile: Cloud Run URL 사용
 */
export const getBackendUrl = (): string => {
    // 1. 프로덕션 빌드(배포됨) 상태라면 무조건 운영 서버 사용
    if (!__DEV__) {
        return PRODUCTION_URL;
    }

    // 2. 모바일 (개발 중에도 편의를 위해 운영 서버 사용 중)
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
        return PRODUCTION_URL;
    }

    // 3. 웹 개발 환경 (로컬 서버 사용)
    if (Platform.OS === 'web') {
        return 'https://api.joyner.co.kr';
        // return 'http://localhost:8000';
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
