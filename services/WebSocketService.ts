/**
 * 싱글톤 WebSocket 서비스
 * 앱 전체에서 단일 WebSocket 연결만 유지
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_BASE } from '../constants/config';

type MessageHandler = (data: any) => void;

interface Subscription {
    id: string;
    types: string[];  // 구독할 메시지 타입 (예: ['a2a_request', 'a2a_rejected'])
    handler: MessageHandler;
}

class WebSocketService {
    private static instance: WebSocketService;
    private ws: WebSocket | null = null;
    private userId: string | null = null;
    private subscriptions: Subscription[] = [];
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnecting: boolean = false;
    private connectionPromise: Promise<void> | null = null;

    private constructor() { }

    static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    /**
     * WebSocket 연결 초기화 (앱 시작 시 한 번만 호출)
     */
    async connect(userId: string): Promise<void> {
        // 이미 같은 유저로 연결되어 있거나 연결 중이면 스킵
        if (this.ws && this.userId === userId) {
            const state = this.ws.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
                console.log(`[WS:Global] 이미 연결됨/연결중 (state=${state}), 스킵`);
                return this.connectionPromise || Promise.resolve();
            }
        }

        // 다른 곳에서 연결 시도 중이면 해당 promise 반환
        if (this.isConnecting && this.connectionPromise) {
            console.log('[WS:Global] 다른 곳에서 연결 중, 기존 promise 반환');
            return this.connectionPromise;
        }

        this.userId = userId;
        this.isConnecting = true;

        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                // 기존 연결 정리 (CLOSED 또는 CLOSING 상태인 경우)
                if (this.ws) {
                    const state = this.ws.readyState;
                    if (state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
                        this.ws.onclose = null;
                        this.ws.onopen = null;
                        this.ws.onerror = null;
                        this.ws.onmessage = null;
                        this.ws = null;
                    } else {
                        // OPEN 또는 CONNECTING 상태면 그대로 사용
                        console.log('[WS:Global] 기존 연결 재사용');
                        this.isConnecting = false;
                        resolve();
                        return;
                    }
                }

                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }

                console.log('[WS:Global] 새 연결 시도:', `${WS_BASE}/ws/${userId}`);
                const ws = new WebSocket(`${WS_BASE}/ws/${userId}`);

                ws.onopen = () => {
                    console.log('[WS:Global] ✅ 연결 성공');
                    this.isConnecting = false;
                    resolve();
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[WS:Global] 메시지 수신:', data.type);

                        // 모든 구독자에게 메시지 전달
                        this.subscriptions.forEach(sub => {
                            if (sub.types.includes(data.type) || sub.types.includes('*')) {
                                try {
                                    sub.handler(data);
                                } catch (e) {
                                    console.error(`[WS:Global] 핸들러 오류 (${sub.id}):`, e);
                                }
                            }
                        });
                    } catch (e) {
                        console.error('[WS:Global] 메시지 파싱 오류:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('[WS:Global] 오류:', error);
                    // 오류 시에도 isConnecting은 유지 - onclose에서 처리
                };

                ws.onclose = () => {
                    console.log('[WS:Global] 연결 종료');
                    this.ws = null;
                    this.isConnecting = false;
                    this.connectionPromise = null;

                    // 재연결 (5초 후) - 모바일 환경에서 더 빠른 복구
                    if (this.userId) {
                        this.reconnectTimeout = setTimeout(() => {
                            if (this.userId) {
                                console.log('[WS:Global] 재연결 시도...');
                                this.connect(this.userId);
                            }
                        }, 5000);
                    }
                };

                this.ws = ws;
            } catch (e) {
                console.error('[WS:Global] 연결 실패:', e);
                this.isConnecting = false;
                this.connectionPromise = null;
                reject(e);
            }
        });

        return this.connectionPromise;
    }

    /**
     * 메시지 구독 등록
     * @returns unsubscribe 함수
     */
    subscribe(id: string, types: string[], handler: MessageHandler): () => void {
        // 중복 구독 방지
        const existingIndex = this.subscriptions.findIndex(s => s.id === id);
        if (existingIndex >= 0) {
            this.subscriptions[existingIndex] = { id, types, handler };
        } else {
            this.subscriptions.push({ id, types, handler });
        }

        console.log(`[WS:Global] 구독 등록: ${id} (${types.join(', ')})`);

        // unsubscribe 함수 반환
        return () => {
            this.subscriptions = this.subscriptions.filter(s => s.id !== id);
            console.log(`[WS:Global] 구독 해제: ${id}`);
        };
    }

    /**
     * 연결 해제 (앱 종료 시 호출)
     */
    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.onclose = null;  // 재연결 방지
            this.ws.close();
            this.ws = null;
        }

        this.userId = null;
        this.subscriptions = [];
        console.log('[WS:Global] 연결 해제됨');
    }

    /**
     * 연결 상태 확인
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

export default WebSocketService.getInstance();
