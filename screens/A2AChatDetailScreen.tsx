import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../constants/config';
import AgentStatusCard, { AgentStatus } from '../components/AgentStatusCard';

type A2AChatDetailRouteProp = RouteProp<RootStackParamList, 'A2AChatDetail'>;

// 헬퍼 함수
const formatTimestamp = (isoString: string) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const hours = kstDate.getUTCHours().toString().padStart(2, '0');
        const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) { return ''; }
};

interface AgentMessage {
    id: string;
    message: string;
    agentName: string;
    timestamp: string;
    senderId?: string;
    isMyAgent: boolean; // 화면단에서 판단
}

const A2AChatDetailScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<A2AChatDetailRouteProp>();
    const { sessionId, title } = route.params;

    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [myAgentName, setMyAgentName] = useState<string>('내 비서');
    const [friendMap, setFriendMap] = useState<Record<string, string>>({});

    // AgentStatusCard용 상태
    const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
    const [currentStep, setCurrentStep] = useState<number>(0);

    // 폴링을 위한 ref
    const myIdRef = useRef<string | null>(null);
    const friendMapRef = useRef<Record<string, string>>({});

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const init = async () => {
                // 1. 내 정보와 친구 정보 먼저 로드 (최초 1회)
                if (!myIdRef.current) {
                    const myId = await fetchMe();
                    myIdRef.current = myId;
                }

                // 친구 맵은 매번 갱신해도 되지만, 성능상 체크
                if (Object.keys(friendMapRef.current).length === 0) {
                    const fMap = await fetchFriendsMap();
                    friendMapRef.current = fMap || {};
                }

                // 2. 메시지 로드 (내 ID가 필요함)
                if (myIdRef.current && isActive) {
                    await fetchAgentMessages(sessionId, myIdRef.current, friendMapRef.current, true);
                }
            };

            init();

            // 3. 폴링 설정 (3초마다)
            const interval = setInterval(() => {
                if (myIdRef.current && isActive) {
                    fetchAgentMessages(sessionId, myIdRef.current, friendMapRef.current, false);
                }
            }, 3000);

            return () => {
                isActive = false;
                clearInterval(interval);
            };
        }, [sessionId])
    );

    const fetchMe = async () => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return null;
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const me = await response.json();
                const myId = me.id;
                setCurrentUserId(myId);
                setMyAgentName(`${me.name || '나'}봇`);
                return myId;
            }
        } catch (e) { console.error(e); }
        return null;
    };

    const fetchFriendsMap = async () => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return {};
            const res = await fetch(`${API_BASE}/chat/friends`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, string> = {};
                (data?.friends || []).forEach((f: any) => {
                    map[f.id] = f.name;
                });
                setFriendMap(map);
                return map;
            }
        } catch (e) { console.error(e); }
        return {};
    };

    const fetchAgentMessages = async (sid: string, myId: string, fMap: Record<string, string>, showLoading: boolean = false) => {
        if (showLoading) setLoadingMessages(true);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${sid}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                const rawMessages = data.messages || [];

                // 메시지 가공
                const mapped: AgentMessage[] = rawMessages.map((m: any) => {
                    const isMine = m.sender_user_id === myId;

                    let senderName = '알 수 없음';
                    if (isMine) senderName = myAgentName; // state 업데이트 전일 수 있으나 fetchMe 후 호출하므로 안전
                    else senderName = (fMap[m.sender_user_id] || '상대') + '봇';

                    let text = '';
                    if (typeof m.message === 'string') text = m.message;
                    else if (m.message?.text) text = m.message.text;
                    else text = JSON.stringify(m.message);

                    return {
                        id: m.id,
                        message: text,
                        agentName: senderName,
                        timestamp: m.created_at,
                        senderId: m.sender_user_id,
                        isMyAgent: isMine
                    };
                });
                setMessages(mapped);

                // 진행 상황(Status Card) 추출 로직
                const statuses: AgentStatus[] = [];
                let maxStep = 0;
                let isFinalStep = false;

                rawMessages.forEach((m: any) => {
                    const msgObj = m.message || {};
                    if (msgObj.step && msgObj.text) {
                        statuses.push({
                            step: msgObj.step,
                            message: msgObj.text,
                            isActive: false,
                            isCompleted: true
                        });
                        if (msgObj.step > maxStep) maxStep = msgObj.step;
                        if (m.message_type === 'final' || msgObj.step >= 9) {
                            isFinalStep = true;
                        }
                    }
                });
                // 중복 제거 및 정렬
                const uniqueStatuses = statuses
                    .filter((v, i, a) => a.findIndex(t => (t.step === v.step)) === i)
                    .sort((a, b) => a.step - b.step);

                const finalStatuses = uniqueStatuses.map((s) => ({
                    ...s,
                    isActive: !isFinalStep && s.step === maxStep,
                    isCompleted: isFinalStep || s.step < maxStep
                }));

                setAgentStatuses(finalStatuses);
                setCurrentStep(uniqueStatuses.findIndex(s => s.step === maxStep));
            }
        } catch (e) {
            console.error('fetchMessages error:', e);
        } finally {
            if (showLoading) setLoadingMessages(false);
        }
    };

    const renderMessage = ({ item }: { item: AgentMessage }) => (
        <View style={[
            styles.messageContainer,
            item.isMyAgent ? styles.myMessage : styles.otherMessage
        ]}>
            <View style={[
                styles.messageBubble,
                item.isMyAgent ? styles.myBubble : styles.otherBubble
            ]}>
                <Text style={styles.agentName}>{item.agentName}</Text>
                <Text style={[
                    styles.messageText,
                    item.isMyAgent ? styles.myMessageText : styles.otherMessageText
                ]}>{item.message}</Text>
                <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
            </View>
        </View>
    );

    const flatListRef = useRef<FlatList>(null);

    return (
        <SafeAreaView style={styles.container}>
            {/* 헤더 (뒤로가기 버튼 포함) */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>
                <View style={{ width: 32 }} />
            </View>

            {/* 대화 영역 */}
            <View style={styles.chatArea}>
                {!loadingMessages && agentStatuses.length > 0 && (
                    <View style={styles.statusCardContainer}>
                        <AgentStatusCard statuses={agentStatuses} currentStep={currentStep} />
                    </View>
                )}

                {loadingMessages ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color="#4A90E2" />
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        style={styles.messagesList}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={
                            <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
                                대화 내용이 없습니다.
                            </Text>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default A2AChatDetailScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F111A' },
    header: {
        backgroundColor: '#0F111A',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#374151',
        height: 60
    },
    backButton: { padding: 4, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    chatArea: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    messagesList: { flex: 1 },
    statusCardContainer: { marginBottom: 10 },
    messageContainer: { marginVertical: 4, flexDirection: 'row' },
    myMessage: { justifyContent: 'flex-end' },
    otherMessage: { justifyContent: 'flex-start' },
    messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
    myBubble: { backgroundColor: '#4A90E2' },
    otherBubble: { backgroundColor: '#374151' },
    messageText: { fontSize: 15, lineHeight: 20 },
    myMessageText: { color: '#fff' },
    otherMessageText: { color: '#fff' },
    agentName: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
    timestamp: { fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end', marginTop: 2 },
});