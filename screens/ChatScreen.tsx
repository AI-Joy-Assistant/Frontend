// app/screens/ChatScreen.tsx

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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../constants/config";

export default function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [messages, setMessages] = useState<Array<{ 
    sender: string; 
    text: string; 
    needsApproval?: boolean;
    proposal?: any;
    threadId?: string;
    sessionIds?: string[];
  }>>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<FlatList>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null); // ask_time 흐름 용 상태
  const [loading, setLoading] = useState(false);

  // 채팅 기록 불러오기
  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/chat/history`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.log("채팅 기록 조회 실패:", res.status);
        setLoading(false);
        return;
      }

      const chatLogs = await res.json();
      
      // chat_log 형식을 messages 형식으로 변환
      const loadedMessages: Array<{ 
        sender: string; 
        text: string; 
        needsApproval?: boolean;
        proposal?: any;
        threadId?: string;
        sessionIds?: string[];
      }> = [];
      
      if (Array.isArray(chatLogs)) {
        chatLogs.forEach((log: any) => {
          // 사용자 메시지 (일반 메시지 또는 승인/거절 응답)
          if (log.request_text) {
            // 승인/거절 응답인 경우 맥락을 포함한 메시지로 표시
            if (log.message_type === "schedule_approval_response") {
              const metadata = log.metadata || {};
              const approved = metadata.approved;
              const proposal = metadata.proposal || {};
              
              if (approved) {
                // 승인한 경우
                loadedMessages.push({
                  sender: "user",
                  text: log.request_text, // "예"
                });
              } else {
                // 거절한 경우 - 맥락을 포함한 메시지로 표시
                const proposalText = proposal.date && proposal.time 
                  ? `${proposal.date} ${proposal.time} 일정을 거절했습니다.`
                  : "일정을 거절했습니다.";
                loadedMessages.push({
                  sender: "user",
                  text: proposalText,
                });
              }
            } else {
              // 일반 사용자 메시지
              loadedMessages.push({
                sender: "user",
                text: log.request_text,
              });
            }
          }
          // AI 응답
          if (log.response_text) {
            // 승인 요청 메시지인지 확인
            const isApprovalRequest = log.message_type === "schedule_approval" || log.message_type === "schedule_approval_request";
            const isRejectionMessage = log.message_type === "schedule_rejection";
            const metadata = log.metadata || {};
            
            // metadata.needs_approval이 명시적으로 false가 아니고, approved_by와 rejected_by가 없으면 승인 필요
            const needsApproval = isApprovalRequest && 
                                 metadata.needs_approval !== false && 
                                 !metadata.approved_by &&
                                 !metadata.rejected_by;
            
            loadedMessages.push({
              sender: "ai",
              text: log.response_text,
              needsApproval: needsApproval,
              proposal: metadata.proposal,
              threadId: metadata.thread_id,
              sessionIds: metadata.session_ids,
            });
          }
        });
      }

      setMessages(loadedMessages);
    } catch (error) {
      console.error("채팅 기록 불러오기 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 화면이 포커스될 때마다 채팅 기록 불러오기
  useFocusEffect(
    React.useCallback(() => {
      loadChatHistory();
    }, [])
  );

  // 스크롤 자동 하단 이동 (메시지 로드 후)
  useEffect(() => {
    if (scrollRef.current && messages.length > 0 && !loading) {
      // 로딩이 완료된 후 스크롤
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [messages, loading]);

  // 메시지 전송
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");

    // 사용자 메시지 표시
    addMessage("user", userText);

    const token = await AsyncStorage.getItem("accessToken");

    const res = await fetch(`${API_BASE}/chat/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userText,
        date: pendingDate ?? undefined,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: '서버 오류가 발생했습니다.' }));
      addMessage("system", `❌ 오류: ${errorData.detail || '알 수 없는 오류'}`);
      return;
    }

    const response = await res.json();
    const data = response.data || response; // 백엔드가 {data: {...}} 형식으로 반환할 수 있음

    // 백엔드 응답 형식에 맞게 처리
    const aiResponse = data.ai_response || data.response;
    const scheduleInfo = data.schedule_info || {};
    const intent = scheduleInfo.intent;
    const hasScheduleRequest = scheduleInfo.has_schedule_request || false;
    const calendarEvent = data.calendar_event;
    const needsApproval = scheduleInfo.needs_approval || false;
    const proposal = scheduleInfo.proposal;
    const threadId = scheduleInfo.thread_id;
    const sessionIds = scheduleInfo.session_ids || [];

    // AI 응답이 있으면 항상 표시
    if (aiResponse) {
      if (needsApproval && proposal) {
        // 승인 필요 메시지
        addMessage("ai", aiResponse, true, proposal, threadId, sessionIds);
      } else {
        addMessage("ai", aiResponse);
      }
    }

    // 일정 관련 추가 처리
    if (hasScheduleRequest) {
      // A2A 세션이 시작된 경우 (응답 메시지에 이미 포함됨)
      if (aiResponse && aiResponse.includes("A2A")) {
        // A2A 화면으로 자동 이동 가능(옵션)
        // navigation.navigate("A2A");
      }
      // 캘린더 이벤트가 생성된 경우
      else if (calendarEvent) {
        // 이미 ai_response에 일정 추가 메시지가 포함되어 있음
      }
    }

    // 디버깅용 로그
    console.log("Chat 응답:", {
      aiResponse,
      intent,
      hasScheduleRequest,
      hasCalendarEvent: !!calendarEvent
    });
  };

  // 메시지 UI 렌더링
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
      sessionIds 
    }]);
  };

  // 일정 승인/거절 처리
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

  const renderItem = ({ item }: { item: any }) => (
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
      
      {/* 승인/거절 버튼 */}
      {item.needsApproval && item.proposal && (
        <View style={styles.approvalButtons}>
          <TouchableOpacity
            style={[styles.approvalButton, styles.approveButton]}
            onPress={() => handleScheduleApproval(true, item.proposal, item.threadId, item.sessionIds)}
          >
            <Text style={styles.approvalButtonText}>예</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approvalButton, styles.rejectButton]}
            onPress={() => handleScheduleApproval(false, item.proposal, item.threadId, item.sessionIds)}
          >
            <Text style={styles.approvalButtonText}>아니오</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
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

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>채팅 기록을 불러오는 중...</Text>
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(_, idx) => idx.toString()}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.messagesContainer,
              messages.length > 0 && styles.messagesContainerWithContent
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              // 내용 크기가 변경될 때마다 하단으로 스크롤
              if (scrollRef.current && messages.length > 0) {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: false });
                }, 50);
              }
            }}
            onLayout={() => {
              // 레이아웃이 완료되면 하단으로 스크롤
              if (scrollRef.current && messages.length > 0) {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: false });
                }, 100);
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>아직 대화가 없습니다.</Text>
                <Text style={styles.emptySubText}>메시지를 입력해보세요!</Text>
              </View>
            }
          />
        )}

        {/* 입력창 */}
        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={styles.sendButton}
          >
            <Text style={styles.sendButtonText}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 하단 네비게이션 */}
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
  approvalButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  approvalButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#4A90E2',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  approvalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
