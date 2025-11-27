import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../constants/config";
import ProposalCard, { Proposal } from "../components/ProposalCard";

export default function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [messages, setMessages] = useState<Array<{
    sender: string;
    text: string;
    needsApproval?: boolean;
    proposal?: any;
    threadId?: string;
    sessionIds?: string[];
    approvalStatus?: {
      approvedBy: string[];
      totalParticipants: number;
    };
    isApproved?: boolean;
    isRejected?: boolean;
    allApproved?: boolean;
    shouldShowProposalCard?: boolean;
    timestamp?: string;
  }>>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<FlatList>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isAtBottom = useRef(true);

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return null;

      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const userData = await res.json();
        return userData.id || null;
      }
      return null;
    } catch (error) {
      console.error("사용자 ID 가져오기 오류:", error);
      return null;
    }
  };

  // 채팅 기록 불러오기
  const loadChatHistory = async (showLoadingUI = true) => {
    try {
      if (showLoadingUI) setLoading(true);
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        if (showLoadingUI) setLoading(false);
        return;
      }

      const userId = await getCurrentUserId();
      if (userId) {
        setCurrentUserId(userId);
      }

      const res = await fetch(`${API_BASE}/chat/history`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // [401 인증 만료 처리]
      if (res.status === 401) {
        console.log("인증 토큰 만료됨 - 폴링 중단");
        if (showLoadingUI) setLoading(false);
        await AsyncStorage.removeItem("accessToken");
        // 필요 시 로그인 화면 이동: navigation.reset(...)
        return;
      }

      if (!res.ok) {
        console.log("채팅 기록 조회 실패:", res.status);
        if (showLoadingUI) setLoading(false);
        return;
      }

      const chatLogs = await res.json();

      const loadedMessages: Array<{
        sender: string;
        text: string;
        needsApproval?: boolean;
        proposal?: any;
        threadId?: string;
        sessionIds?: string[];
        approvalStatus?: {
          approvedBy: string[];
          totalParticipants: number;
        };
        isApproved?: boolean;
        isRejected?: boolean;
        allApproved?: boolean;
        shouldShowProposalCard?: boolean;
        timestamp?: string;
        id?: string;
      }> = [];

      if (Array.isArray(chatLogs)) {
        chatLogs.forEach((log: any) => {
          // 사용자 메시지
          if (log.request_text) {
            if (log.message_type === "schedule_approval_response") {
              const metadata = log.metadata || {};
              const approved = metadata.approved;
              const proposal = metadata.proposal || {};

              if (approved) {
                loadedMessages.push({
                  sender: "user",
                  text: log.request_text,
                  timestamp: log.created_at,
                });
              } else {
                const proposalText = proposal.date && proposal.time
                    ? `${proposal.date} ${proposal.time} 일정을 거절했습니다.`
                    : "일정을 거절했습니다.";
                loadedMessages.push({
                  sender: "user",
                  text: proposalText,
                  timestamp: log.created_at,
                });
              }
            } else {
              loadedMessages.push({
                sender: "user",
                text: log.request_text,
                timestamp: log.created_at,
              });
            }
          }
          // AI 응답
          if (log.response_text) {
            // [✅ 수정] schedule_approval 타입은 무조건 카드 데이터로만 변환 (텍스트 렌더링 방지)
            if (log.message_type === 'schedule_approval') {
              const metadata = log.metadata || {};
              const approvedByList = metadata.approved_by_list || [];
              if (metadata.approved_by && !approvedByList.includes(metadata.approved_by)) {
                approvedByList.push(metadata.approved_by);
              }
              const currentUserApproved = currentUserId && approvedByList.includes(currentUserId);
              const allApproved = metadata.all_approved === true;

              const isRejected = !!metadata.rejected_by || metadata.status === 'rejected';
              const needsApproval = !currentUserApproved && !isRejected && !allApproved;

              loadedMessages.push({
                sender: "ai",
                text: log.response_text, // 텍스트 데이터는 있지만 렌더링에선 무시됨
                needsApproval: needsApproval,
                proposal: metadata.proposal,
                threadId: metadata.thread_id,
                sessionIds: metadata.session_ids || [],
                approvalStatus: {
                  approvedBy: approvedByList,
                  totalParticipants: metadata.proposal?.participants?.length || 2
                },
                isApproved: currentUserApproved || allApproved,
                isRejected: isRejected,
                allApproved: allApproved,
                shouldShowProposalCard: true, // 이 플래그가 중요
                timestamp: log.created_at,
                id: log.id // 키 중복 방지용
              });
            }
            else {
              // 일반 메시지 (ai_response, system 등)
              loadedMessages.push({
                sender: "ai",
                text: log.response_text,
                timestamp: log.created_at,
                id: log.id
              });
            }
          }
        });

        // 시간순 정렬
        loadedMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeA - timeB;
        });
        // 2. [✅ 핵심 수정] 중복 카드 제거 (같은 일정은 최신 상태 하나만 보여주기)
        const uniqueMessages: typeof loadedMessages = [];
        const processedThreadIds = new Set<string>();

        // 배열을 뒤에서부터(최신부터) 검사
        for (let i = loadedMessages.length - 1; i >= 0; i--) {
          const msg = loadedMessages[i];
          
          // 카드형 메시지인 경우
          if (msg.shouldShowProposalCard && msg.threadId) {
            if (processedThreadIds.has(msg.threadId)) {
              // 이미 더 최신의 카드가 있으므로, 이 옛날 카드는 숨김(건너뜀)
              continue; 
            } else {
              // 최신 카드이므로 등록
              processedThreadIds.add(msg.threadId);
              uniqueMessages.unshift(msg); // 앞에 추가 (순서 유지)
            }
          } else {
            // 일반 메시지는 무조건 추가
            uniqueMessages.unshift(msg);
          }
        }
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }

    } catch (error) {
      console.error("채팅 기록 불러오기 오류:", error);
    } finally {
      if (showLoadingUI) setLoading(false);
    }
  };

  // [✅ 수정] useFocusEffect를 사용하여 화면이 보일 때만 폴링 동작
  useFocusEffect(
      React.useCallback(() => {
        loadChatHistory(true);
        const interval = setInterval(() => {
          loadChatHistory(false);
        }, 3000);
        return () => clearInterval(interval);
      }, [currentUserId])
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    // 맨 아래에 있는지 여부 판단 (오차 범위 20px)
    isAtBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput("");
    // 사용자 메시지는 즉시 추가하고 스크롤 내림
    setMessages((prev) => [...prev, { sender: "user", text: userText, timestamp: new Date().toISOString() }]);
    isAtBottom.current = true; // 내가 보냈으니 맨 아래로

    const token = await AsyncStorage.getItem("accessToken");
    const res = await fetch(`${API_BASE}/chat/chat`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, date: pendingDate ?? undefined }),
    });

    if (!res.ok) {
      if (res.status === 401) return; // 401이면 자동 폴링에서 처리됨
      const errorData = await res.json().catch(() => ({ detail: '서버 오류가 발생했습니다.' }));
      addMessage("system", `❌ 오류: ${errorData.detail || '알 수 없는 오류'}`);
      return;
    }

    const response = await res.json();
    const data = response.data || response;

    const aiResponse = data.ai_response || data.response;
    const scheduleInfo = data.schedule_info || {};
    const intent = scheduleInfo.intent;
    const hasScheduleRequest = scheduleInfo.has_schedule_request || false;
    const calendarEvent = data.calendar_event;
    const needsApproval = scheduleInfo.needs_approval || false;
    const proposal = scheduleInfo.proposal;
    const threadId = scheduleInfo.thread_id;
    const sessionIds = scheduleInfo.session_ids || [];

    if (aiResponse) {
      if (needsApproval && proposal) {
        addMessage("ai", aiResponse, true, proposal, threadId, sessionIds);
      } else {
        addMessage("ai", aiResponse);
      }
    }
  };

  // 메시지 UI 추가
  const addMessage = (
      sender: string,
      text: string,
      needsApproval?: boolean,
      proposal?: any,
      threadId?: string,
      sessionIds?: string[]
  ) => {
    setMessages((prev) => [...prev, {
      sender,
      text,
      needsApproval,
      proposal,
      threadId,
      sessionIds,
      timestamp: new Date().toISOString()
    }]);
  };

  // 승인 처리
  const handleScheduleApproval = async (approved: boolean, proposal: any, threadId: string, sessionIds: string[]) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const res = await fetch(`${API_BASE}/chat/approve-schedule`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thread_id: threadId,
          session_ids: sessionIds,
          approved: approved,
          proposal: proposal
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: '승인 처리 실패' }));
        addMessage("system", `❌ 오류: ${errorData.detail || '승인 처리 실패'}`);
        return;
      }

      const result = await res.json();

      setMessages((prev) =>
          prev.map((msg) => {
            if (!msg.proposal) return msg;

            const matchesThreadId = threadId && msg.threadId === threadId;
            const matchesSessionIds = msg.sessionIds && sessionIds &&
                msg.sessionIds.length > 0 && sessionIds.length > 0 &&
                msg.sessionIds.some(sid => sessionIds.includes(sid));

            const proposalMatches = proposal && msg.proposal &&
                proposal.date === msg.proposal.date &&
                proposal.time === msg.proposal.time;

            if (proposalMatches && (matchesThreadId || matchesSessionIds)) {
              const updatedApprovalStatus = result.all_approved !== undefined ? {
                approvedBy: result.approved_by_list || [],
                totalParticipants: msg.approvalStatus?.totalParticipants || 2,
              } : msg.approvalStatus;

              return {
                ...msg,
                needsApproval: false,
                isApproved: approved || result.all_approved,
                isRejected: !approved && !result.all_approved,
                allApproved: result.all_approved || false,
                approvalStatus: updatedApprovalStatus,
              };
            }
            return msg;
          })
      );

      if (approved) {
        addMessage("ai", result.message || "일정이 확정되어 모든 참여자 캘린더에 추가되었습니다.");
      } else {
        addMessage("ai", result.message || "일정이 거절되었습니다. 재조율을 진행합니다.");
      }
    } catch (error) {
      console.error("승인 처리 오류:", error);
      addMessage("system", "❌ 승인 처리 중 오류가 발생했습니다.");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const hasProposal = item.proposal && (item.proposal.date || item.proposal.time);
    const canShowProposal = item.shouldShowProposalCard || (hasProposal && (item.needsApproval || item.isApproved || item.isRejected));

    if (canShowProposal) {
      const threadId = item.threadId || (item.sessionIds && item.sessionIds.length > 0 ? item.sessionIds[0] : null);
      const sessionIds = item.sessionIds || [];

      return (
          <View style={styles.messageItem}>
            <ProposalCard
                proposal={item.proposal as Proposal}
                onApprove={(proposal) => handleScheduleApproval(true, proposal, threadId, sessionIds)}
                onReject={(proposal) => handleScheduleApproval(false, proposal, threadId, sessionIds)}
                approvalStatus={item.approvalStatus}
                isApproved={item.isApproved}
                isRejected={item.isRejected}
                timestamp={item.timestamp}
            />
          </View>
      );
    }

    return (
        <View
            style={[
              styles.messageItem,
              item.sender === "user" ? styles.userMessage : styles.aiMessage,
            ]}
        >
          <Text style={[
            styles.messageText,
            item.sender === "user" ? styles.userMessageText : styles.aiMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.timestampText,
            item.sender === "user" ? styles.userTimestamp : styles.aiTimestamp
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
    );
  };

  return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>AI 채팅</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {loading ? (
              <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#4A90E2" /></View>
          ) : (
              <FlatList
                  ref={scrollRef}
                  data={messages}
                  keyExtractor={(item, index) => item.id || index.toString()} // id 사용 권장
                  renderItem={renderItem}
                  contentContainerStyle={[styles.messagesContainer, messages.length > 0 && styles.messagesContainerWithContent]}
                  showsVerticalScrollIndicator={false}

                  // [✅ 수정] 스크롤 로직 변경
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onContentSizeChange={() => {
                    // 사용자가 맨 아래에 있을 때만 자동 스크롤
                    if (scrollRef.current && messages.length > 0 && isAtBottom.current) {
                      scrollRef.current.scrollToEnd({ animated: false });
                    }
                  }}

                  ListEmptyComponent={
                    <View style={styles.emptyContainer}><Text style={styles.emptyText}>아직 대화가 없습니다.</Text></View>
                  }
              />
          )}
          <View style={styles.inputContainer}>
            <TextInput value={input} onChangeText={setInput} placeholder="메시지를 입력하세요" placeholderTextColor="#9CA3AF" style={styles.input} />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}><Text style={styles.sendButtonText}>전송</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <View style={styles.bottomNavigation}>
          <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="home" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
            <Ionicons name="chatbubble" size={24} color="#4A90E2" />
            <Text style={[styles.navText, styles.activeNavText]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('Friends')}
          >
            <Ionicons name="people" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('A2A')}
          >
            <Ionicons name="person" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>A2A</Text>
          </TouchableOpacity>
          <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('User')}
          >
            <Ionicons name="person-circle" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>User</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    height: '100%',
  },
  header: {
    backgroundColor: '#0F111A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
    height: 60,
  },
  backButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  chatContainer: {
    flex: 1,
    padding: 12,
  },
  messagesContainer: {
    paddingVertical: 8,
  },
  messagesContainerWithContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    borderColor: '#374151',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    color: '#fff',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#0F111A',
    borderTopColor: '#374151',
    borderTopWidth: 2,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavItem: {
    // 활성 상태 스타일
  },
  navText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  activeNavText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  messageItem: {
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    maxWidth: '75%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90E2',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2937',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});