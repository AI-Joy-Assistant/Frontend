/**
 * 싱글톤 WebSocket 서비스
 * 앱 전체에서 단일 WebSocket 연결만 유지
 * [FIX] 하트비트, AppState 대응, 재연결 이벤트 추가
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
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

    // [NEW] 하트비트 관련
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private pongTimeout: NodeJS.Timeout | null = null;
    private lastPongReceived: number = 0;
    private static readonly HEARTBEAT_INTERVAL_MS = 25000; // 25초마다 ping
    private static readonly PONG_TIMEOUT_MS = 10000; // 10초 내 pong 없으면 dead

    // [NEW] AppState 관련
    private appStateSubscription: any = null;
    private lastAppState: AppStateStatus = 'active';

    private constructor() {
        // [NEW] AppState 변경 감지 등록
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }

    static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    // [NEW] 앱 상태 변경 핸들러
    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        console.log(`[WS:Global] AppState 변경: ${this.lastAppState} → ${nextAppState}`);

        if (this.lastAppState.match(/inactive|background/) && nextAppState === 'active') {
            // 앱이 foreground로 돌아옴
            console.log('[WS:Global] 📱 앱이 foreground로 복귀 - WebSocket 상태 체크');

            if (this.userId) {
                if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    // 연결이 끊어진 상태 → 즉시 재연결
                    console.log('[WS:Global] 연결 끊어짐 감지 - 즉시 재연결');
                    this.forceReconnect();
                } else {
                    // 연결은 살아있지만 즉시 ping 보내서 확인
                    this.sendPing();
                }
            }
        } else if (nextAppState.match(/inactive|background/)) {
            // 앱이 백그라운드로 → 하트비트 중지 (배터리 절약)
            this.stopHeartbeat();
        }

        this.lastAppState = nextAppState;
    };

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
                    this.lastPongReceived = Date.now();

                    // [NEW] 하트비트 시작
                    this.startHeartbeat();

                    resolve();
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // [NEW] pong 응답 처리
                        if (data.type === 'pong') {
                            this.lastPongReceived = Date.now();
                            if (this.pongTimeout) {
                                clearTimeout(this.pongTimeout);
                                this.pongTimeout = null;
                            }
                            return; // pong은 구독자에게 전달하지 않음
                        }

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

                    // [NEW] 하트비트 중지
                    this.stopHeartbeat();

                    // 재연결 (3초 후) - 더 빠른 복구
                    if (this.userId) {
                        this.reconnectTimeout = setTimeout(() => {
                            if (this.userId) {
                                console.log('[WS:Global] 재연결 시도...');
                                this.connect(this.userId).then(() => {
                                    // [NEW] 재연결 성공 시 모든 구독자에게 알림
                                    this.notifyReconnected();
                                });
                            }
                        }, 3000);
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

    // [NEW] 강제 재연결 (기존 연결을 닫고 새로 연결)
    private forceReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopHeartbeat();

        // 기존 연결 정리
        if (this.ws) {
            this.ws.onclose = null; // 재연결 루프 방지
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            try { this.ws.close(); } catch (e) { /* ignore */ }
            this.ws = null;
        }

        this.isConnecting = false;
        this.connectionPromise = null;

        if (this.userId) {
            console.log('[WS:Global] 🔄 강제 재연결...');
            this.connect(this.userId).then(() => {
                this.notifyReconnected();
            }).catch(e => {
                console.error('[WS:Global] 강제 재연결 실패:', e);
            });
        }
    }

    // [NEW] 하트비트 시작
    private startHeartbeat(): void {
        this.stopHeartbeat(); // 기존 것 정리
        this.heartbeatInterval = setInterval(() => {
            this.sendPing();
        }, WebSocketService.HEARTBEAT_INTERVAL_MS);
        console.log('[WS:Global] 💓 하트비트 시작 (25초 간격)');
    }

    // [NEW] 하트비트 중지
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    // [NEW] Ping 전송
    private sendPing(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ type: 'ping' }));

                // pong 응답 타임아웃 설정
                if (this.pongTimeout) clearTimeout(this.pongTimeout);
                this.pongTimeout = setTimeout(() => {
                    console.warn('[WS:Global] ⚠️ Pong 타임아웃 - 연결 dead 판정, 재연결');
                    this.forceReconnect();
                }, WebSocketService.PONG_TIMEOUT_MS);
            } catch (e) {
                console.error('[WS:Global] Ping 전송 실패:', e);
                this.forceReconnect();
            }
        } else {
            console.warn('[WS:Global] Ping 전송 불가 - 연결 상태:', this.ws?.readyState);
            if (this.userId) {
                this.forceReconnect();
            }
        }
    }

    // [NEW] 재연결 알림 (구독자들에게 reconnected 이벤트 전달)
    private notifyReconnected(): void {
        console.log('[WS:Global] 🔄 재연결 완료 - 구독자에게 알림');
        const reconnectData = { type: 'reconnected', timestamp: new Date().toISOString() };
        this.subscriptions.forEach(sub => {
            if (sub.types.includes('reconnected') || sub.types.includes('*')) {
                try {
                    sub.handler(reconnectData);
                } catch (e) {
                    console.error(`[WS:Global] 재연결 핸들러 오류 (${sub.id}):`, e);
                }
            }
        });
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
        this.stopHeartbeat();

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
