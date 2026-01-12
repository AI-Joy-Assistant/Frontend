import { Platform } from 'react-native';
import { DEV_API_URL } from './private';

// 웹에서는 localhost, 모바일에서는 환경 변수 또는 개발 서버 IP 사용
const getApiBase = () => {
    if (Platform.OS === 'web') {
        return 'http://localhost:8000';
    }
    // 모바일에서는 환경 변수가 없으면 개발 서버 IP 사용
    return process.env.EXPO_PUBLIC_API_BASE || DEV_API_URL;
};

export const API_BASE = getApiBase();

// WebSocket URL (http:// → ws://, https:// → wss://)
const getWsBase = () => {
    const httpBase = getApiBase();
    return httpBase.replace('http://', 'ws://').replace('https://', 'wss://');
};

export const WS_BASE = getWsBase();
