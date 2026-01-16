import { Platform } from 'react-native';
import { getBackendUrl } from '../utils/environment';

export const API_BASE = getBackendUrl();

// WebSocket URL (http:// → ws://, https:// → wss://)
const getWsBase = () => {
    const httpBase = getBackendUrl();
    return httpBase.replace('http://', 'ws://').replace('https://', 'wss://');
};

export const WS_BASE = getWsBase();


