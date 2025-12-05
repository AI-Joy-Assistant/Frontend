import { Platform } from 'react-native';

// 웹에서는 localhost, 모바일에서는 환경 변수 또는 localhost 사용
const getApiBase = () => {
    if (Platform.OS === 'web') {
        return 'http://localhost:8000';
    }
    // 모바일에서는 환경 변수가 없으면 localhost 사용
    return process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8000';
};

export const API_BASE = getApiBase();


