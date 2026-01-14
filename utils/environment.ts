import { Platform } from 'react-native';
import { DEV_IP_ADDRESS, BACKEND_PORT } from '../constants/private';

// 프로덕션 배포 URL (실제 서버 URL로 변경)
const PRODUCTION_URL = 'https://api.joyner.app';

/**
 * 현재 실행 환경에 맞는 백엔드 URL 반환
 * - Web: localhost 사용
 * - Mobile: private.ts의 IP 주소 사용 (gitignored)
 */
export const getBackendUrl = (): string => {
    // 프로덕션 환경이면 배포된 서버 사용
    if (process.env.NODE_ENV === 'production') {
        return PRODUCTION_URL;
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:8000';
    }
    // 모바일 환경 (iOS, Android)
    // private.ts에서 IP 주소를 가져옴 (네트워크 변경 시 private.ts만 수정)
    return `http://${DEV_IP_ADDRESS}:${BACKEND_PORT}`;
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
