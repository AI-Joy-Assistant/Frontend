import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Modal,
    Animated
} from 'react-native';
import { MessageCircle, CheckCircle2, XCircle, AlertCircle, Bot } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';

interface NegotiationMessage {
    id: string;
    type: 'PROPOSE' | 'ACCEPT' | 'REJECT' | 'COUNTER' | 'INFO' | 'NEED_HUMAN' | 'START' | 'END' | 'ERROR';
    sender_name: string;
    round?: number;
    proposal?: {
        date: string;
        time: string;
        location?: string;
        activity?: string;
    };
    message: string;
    timestamp?: string;
}

interface Props {
    sessionId: string;
    visible: boolean;
    onClose: () => void;
    onNeedHumanDecision: (lastProposal: any) => void;
    onAgreementReached: (proposal: any) => void;
}

const COLORS = {
    primaryMain: '#3730A3',
    primaryLight: '#818CF8',
    primaryDark: '#0E004E',
    primaryBg: '#EEF2FF',
    neutral100: '#F3F4F6',
    neutral200: '#E5E7EB',
    neutral400: '#9CA3AF',
    neutral500: '#6B7280',
    neutral600: '#4B5563',
    neutralSlate: '#1F2937',
    white: '#FFFFFF',
    green500: '#22C55E',
    red500: '#EF4444',
    amber500: '#F59E0B',
};

const RealTimeNegotiationView: React.FC<Props> = ({
    sessionId,
    visible,
    onClose,
    onNeedHumanDecision,
    onAgreementReached
}) => {
    const [messages, setMessages] = useState<NegotiationMessage[]>([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [status, setStatus] = useState<'connecting' | 'negotiating' | 'agreed' | 'need_human' | 'error'>('connecting');
    const [currentRound, setCurrentRound] = useState(0);
    const [lastProposal, setLastProposal] = useState<any>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation for active negotiation
    useEffect(() => {
        if (status === 'negotiating') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [status]);

    useEffect(() => {
        if (!visible || !sessionId) return;

        let eventSource: any = null;

        const connectSSE = async () => {
            try {
                const token = await AsyncStorage.getItem('accessToken');
                if (!token) {
                    setStatus('error');
                    return;
                }

                setIsConnecting(true);
                setMessages([]);

                // SSE 연결 (웹 환경)
                const url = `${API_BASE}/a2a/session/${sessionId}/negotiate/stream`;

                // React Native에서는 EventSource를 직접 사용할 수 없으므로 fetch로 스트림 처리
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/event-stream',
                    },
                });

                if (!response.ok) {
                    throw new Error('SSE 연결 실패');
                }

                setIsConnecting(false);
                setStatus('negotiating');

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('스트림 리더 없음');
                }

                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                handleSSEMessage(data);
                            } catch (e) {
                                console.error('SSE 파싱 오류:', e);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('SSE 연결 오류:', error);
                setStatus('error');
                setIsConnecting(false);
            }
        };

        connectSSE();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [visible, sessionId]);

    const handleSSEMessage = (data: any) => {
        if (data.type === 'START') {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'START',
                sender_name: '시스템',
                message: data.message
            }]);
        } else if (data.type === 'END') {
            if (data.status === 'agreed') {
                setStatus('agreed');
                onAgreementReached(lastProposal);
            } else if (data.status === 'need_human') {
                setStatus('need_human');
                onNeedHumanDecision(lastProposal);
            }
        } else if (data.type === 'ERROR') {
            setStatus('error');
        } else {
            // 일반 협상 메시지
            const msg: NegotiationMessage = {
                id: data.id || Date.now().toString(),
                type: data.type,
                sender_name: data.sender_name,
                round: data.round,
                proposal: data.proposal,
                message: data.message,
                timestamp: data.timestamp
            };
            setMessages(prev => [...prev, msg]);

            if (data.round) {
                setCurrentRound(data.round);
            }
            if (data.proposal) {
                setLastProposal(data.proposal);
            }
        }

        // 자동 스크롤
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const getMessageIcon = (type: string) => {
        switch (type) {
            case 'ACCEPT':
                return <CheckCircle2 size={16} color={COLORS.green500} />;
            case 'REJECT':
                return <XCircle size={16} color={COLORS.red500} />;
            case 'COUNTER':
                return <MessageCircle size={16} color={COLORS.amber500} />;
            case 'NEED_HUMAN':
                return <AlertCircle size={16} color={COLORS.amber500} />;
            default:
                return <Bot size={16} color={COLORS.primaryMain} />;
        }
    };

    const getMessageBubbleStyle = (type: string) => {
        switch (type) {
            case 'ACCEPT':
                return { backgroundColor: '#DCFCE7', borderLeftColor: COLORS.green500 };
            case 'REJECT':
                return { backgroundColor: '#FEE2E2', borderLeftColor: COLORS.red500 };
            case 'COUNTER':
                return { backgroundColor: '#FEF3C7', borderLeftColor: COLORS.amber500 };
            case 'NEED_HUMAN':
                return { backgroundColor: '#FEF3C7', borderLeftColor: COLORS.amber500 };
            case 'START':
            case 'INFO':
                return { backgroundColor: COLORS.neutral100, borderLeftColor: COLORS.neutral400 };
            default:
                return { backgroundColor: COLORS.primaryBg, borderLeftColor: COLORS.primaryMain };
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Animated.View style={[
                                styles.statusDot,
                                status === 'negotiating' && { transform: [{ scale: pulseAnim }] },
                                status === 'agreed' && { backgroundColor: COLORS.green500 },
                                status === 'error' && { backgroundColor: COLORS.red500 },
                            ]} />
                            <Text style={styles.headerTitle}>
                                {status === 'connecting' && '연결 중...'}
                                {status === 'negotiating' && `AI 협상 진행 중 (라운드 ${currentRound}/5)`}
                                {status === 'agreed' && '합의 완료! 🎉'}
                                {status === 'need_human' && '결정이 필요해요'}
                                {status === 'error' && '오류 발생'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Messages */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                    >
                        {isConnecting && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={COLORS.primaryMain} />
                                <Text style={styles.loadingText}>AI 에이전트 연결 중...</Text>
                            </View>
                        )}

                        {messages.map((msg, index) => (
                            <View
                                key={msg.id || index}
                                style={[
                                    styles.messageBubble,
                                    getMessageBubbleStyle(msg.type)
                                ]}
                            >
                                <View style={styles.messageHeader}>
                                    {getMessageIcon(msg.type)}
                                    <Text style={styles.senderName}>{msg.sender_name}</Text>
                                    {msg.round && (
                                        <Text style={styles.roundBadge}>R{msg.round}</Text>
                                    )}
                                </View>
                                <Text style={styles.messageText}>{msg.message}</Text>
                                {msg.proposal && (
                                    <View style={styles.proposalBox}>
                                        <Text style={styles.proposalText}>
                                            📅 {msg.proposal.date} {msg.proposal.time}
                                            {msg.proposal.location && ` | 📍 ${msg.proposal.location}`}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    {status === 'need_human' && (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                AI가 5라운드 내에 합의하지 못했어요. 직접 결정해주세요!
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        minHeight: '60%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral200,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primaryMain,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.neutralSlate,
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        fontSize: 18,
        color: COLORS.neutral500,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 32,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.neutral500,
        fontSize: 14,
    },
    messageBubble: {
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    senderName: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.neutral600,
    },
    roundBadge: {
        marginLeft: 8,
        fontSize: 10,
        backgroundColor: COLORS.neutral200,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        color: COLORS.neutral600,
    },
    messageText: {
        fontSize: 14,
        color: COLORS.neutralSlate,
        lineHeight: 20,
    },
    proposalBox: {
        marginTop: 8,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 8,
    },
    proposalText: {
        fontSize: 13,
        color: COLORS.neutral600,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral200,
        backgroundColor: COLORS.neutral100,
    },
    footerText: {
        fontSize: 14,
        color: COLORS.neutral600,
        textAlign: 'center',
    },
});

export default RealTimeNegotiationView;
