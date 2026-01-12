import { Platform } from 'react-native';

/**
 * 현재 실행 환경에 맞는 백엔드 URL 반환
 * - Web: localhost 사용
 * - Mobile: 개발 서버의 IP 주소 사용
 */
export const getBackendUrl = (): string => {
    if (Platform.OS === 'web') {
        return 'http://localhost:8000';
    }
    // 모바일 환경 (iOS, Android)
    // 개발 시에는 컴퓨터의 IP 주소 사용
    return 'http://192.168.0.100:8000';
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
