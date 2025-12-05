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
  Modal,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Tab } from "../types";
import BottomNav from "../components/BottomNav";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../constants/config";
import ProposalCard, { Proposal } from "../components/ProposalCard";
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Sparkles, X, Search, Check } from 'lucide-react-native';
import { COLORS } from '../constants/Colors';

interface Friend {
  id: string;
  friend: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
  created_at: string;
}

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
  const inputRef = useRef<TextInput>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const isAtBottom = useRef(true);

  const toggleFriendSelection = (id: string) => {
    setSelectedFriends(prev => {
      if (prev.includes(id)) {
        return prev.filter(fid => fid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_BASE}/friends/list`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };
  const [userName, setUserName] = useState("User");

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserName(data.name || data.nickname || "User");
      }
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchUserProfile();
  }, []);

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";

    // ISO 문자열에 타임존 정보('Z' 또는 '+/-HH:mm')가 없으면 UTC로 간주하여 'Z' 추가
    let timeValue = isoString;
    if (!isoString.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(isoString)) {
      timeValue += 'Z';
    }

    const date = new Date(timeValue);
    const now = new Date();

    const isToday = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return timeStr;
    } else {
      // 날짜 포맷: M월 D일 오전/오후 h:mm
      const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
      return `${dateStr} ${timeStr}`;
    }
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

      if (res.status === 401) {
        console.log("인증 토큰 만료됨 - 폴링 중단");
        if (showLoadingUI) setLoading(false);
        await AsyncStorage.removeItem("accessToken");
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
                text: log.response_text,
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
                shouldShowProposalCard: true,
                timestamp: log.created_at,
                id: log.id
              });
            }
            else {
              loadedMessages.push({
                sender: "ai",
                text: log.response_text,
                timestamp: log.created_at,
                id: log.id
              });
            }
          }
        });

        loadedMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeA - timeB;
        });

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
    const paddingToBottom = 100;
    isAtBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput("");
    // 메시지 전송 후 선택된 친구 초기화 (선택 사항)
    // setSelectedFriends([]);
    // 사용자 메시지는 즉시 추가하고 스크롤 내림
    setMessages((prev) => [...prev, { sender: "user", text: userText, timestamp: new Date().toISOString() }]);
    isAtBottom.current = true;
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    const token = await AsyncStorage.getItem("accessToken");
    const res = await fetch(`${API_BASE}/chat/chat`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        date: pendingDate ?? undefined,
        selected_friends: selectedFriends.length > 0 ? selectedFriends : undefined
      }),
    });

    if (!res.ok) {
      if (res.status === 401) return;
      const errorData = await res.json().catch(() => ({ detail: '서버 오류가 발생했습니다.' }));
      addMessage("system", `❌ 오류: ${errorData.detail || '알 수 없는 오류'}`);
      return;
    }

    const response = await res.json();
    const data = response.data || response;

    const aiResponse = data.ai_response || data.response;
    const scheduleInfo = data.schedule_info || {};
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


    return (
      <View
        style={[
          styles.messageItem,
          item.sender === "user" ? styles.userMessage : styles.aiMessage,
        ]}
      >
        {/* 👇 AI 로고(아바타) 완전히 제거 */}

        <View style={[
          styles.messageBubble,
          item.sender === 'user' ? styles.userBubble : styles.aiBubble
        ]}>
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
      </View>
    );
  };

  // [✅ 추가] 키보드 상태 감지
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = import("react-native").then(({ Keyboard }) => {
      const showSubscription = Keyboard.addListener(keyboardShowEvent, () => {
        setKeyboardVisible(true);
      });
      const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
        setKeyboardVisible(false);
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    });
  }, []);

  // ... (existing code)

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.primaryLight, COLORS.primaryMain]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerDecor} />
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Image
              source={require('../assets/images/ai agent.png')}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>{userName}님의 비서</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} // 필요 시 조정
      >
        {loading && messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primaryMain} />
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderItem}
            contentContainerStyle={[styles.messagesContainer, messages.length > 0 && styles.messagesContainerWithContent]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (scrollRef.current && messages.length > 0 && isAtBottom.current) {
                scrollRef.current.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}><Text style={styles.emptyText}>아직 대화가 없습니다.</Text></View>
            }
            style={{ flex: 1 }}
          />
        )}

        <View style={[
          styles.inputWrapper,
          { paddingBottom: isKeyboardVisible ? 10 : (Platform.OS === 'ios' ? 90 : 80) }
        ]}>
          {/* Friend Selection Area */}
          <View style={styles.friendSelectionArea}>
            <TouchableOpacity
              onPress={() => setShowFriendModal(true)}
              style={styles.friendSelectButton}
            >
              <Text style={styles.friendSelectButtonText}>친구 선택</Text>
            </TouchableOpacity>

            <FlatList
              data={selectedFriends}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const friendData = friends.find(f => f.friend.id === item);
                if (!friendData) return null;
                return (
                  <View style={styles.selectedFriendChip}>
                    <Image source={{ uri: friendData.friend.picture || 'https://picsum.photos/150' }} style={styles.chipAvatar} />
                    <Text style={styles.chipName}>{friendData.friend.name}</Text>
                    <TouchableOpacity onPress={() => toggleFriendSelection(item)}>
                      <X size={12} color={COLORS.neutral400} />
                    </TouchableOpacity>
                  </View>
                );
              }}
              style={styles.selectedFriendsList}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="AI에게 메시지 보내기..."
              placeholderTextColor={COLORS.neutral400}
              style={[
                styles.input,
                // @ts-ignore
                Platform.OS === 'web' && { outlineStyle: 'none' }
              ]}
              underlineColorAndroid="transparent"
              selectionColor={COLORS.primaryMain}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!input.trim()}
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            >
              <Send size={18} color={input.trim() ? 'white' : COLORS.neutral400} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomNav activeTab={Tab.CHAT} />

      <Modal
        visible={showFriendModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFriendModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>친구 선택</Text>
                    <Text style={styles.modalSubtitle}>일정을 잡을 친구를 선택하세요</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowFriendModal(false)}>
                    <X size={24} color={COLORS.neutral400} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearch}>
                  <Search size={18} color={COLORS.neutral400} style={styles.modalSearchIcon} />
                  <TextInput
                    placeholder="친구 검색"
                    placeholderTextColor={COLORS.neutral400}
                    style={styles.modalSearchInput}
                    value={friendSearchQuery}
                    onChangeText={setFriendSearchQuery}
                  />
                </View>

                <FlatList
                  data={friends.filter(f =>
                    friendSearchQuery === '' ||
                    f.friend.name.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
                    f.friend.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
                  )}
                  keyExtractor={(item) => item.friend.id}
                  renderItem={({ item }) => {
                    const isSelected = selectedFriends.includes(item.friend.id);
                    return (
                      <TouchableOpacity
                        onPress={() => toggleFriendSelection(item.friend.id)}
                        style={[styles.friendListItem, isSelected && styles.friendListItemSelected]}
                      >
                        <View style={styles.friendListInfo}>
                          <View style={styles.friendListAvatarContainer}>
                            <Image source={{ uri: item.friend.picture || 'https://picsum.photos/150' }} style={styles.friendListAvatar} />

                          </View>
                          <View>
                            <Text style={[styles.friendListName, isSelected && styles.friendListNameSelected]}>{item.friend.name}</Text>
                            <Text style={styles.friendListEmail}>{item.friend.email}</Text>
                          </View>
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Check size={14} color="white" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.friendList}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    onPress={() => setShowFriendModal(false)}
                    style={styles.modalDoneButton}
                  >
                    <Text style={styles.modalDoneButtonText}>
                      완료 {selectedFriends.length > 0 && `(${selectedFriends.length})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutralLight,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  headerDecor: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    backgroundColor: 'white',
    opacity: 0.1,
    borderRadius: 64,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerIconImage: {
    width: 26,
    height: 26,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  messagesContainerWithContent: {
    flexGrow: 1,
  },
  messageItem: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: COLORS.primaryMain,
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'white',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: COLORS.neutralSlate,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimestamp: {
    color: COLORS.neutral400,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  loadingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    height: 40,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neutral400,
    marginHorizontal: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.neutral400,
    fontSize: 16,
    fontWeight: '500',
  },
  inputWrapper: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
    paddingBottom: Platform.OS === 'ios' ? 90 : 80,
    paddingTop: 12,
  },
  friendSelectionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  friendSelectButton: {
    backgroundColor: COLORS.neutral100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  friendSelectButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.neutral500,
  },
  selectedFriendsList: {
    flexGrow: 0,
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  chipName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.neutral500,
    marginRight: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: COLORS.neutralLight,
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  input: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.neutralSlate,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMain,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.neutral200,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    display: 'none',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%',
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandle: {
    width: 48,
    height: 6,
    backgroundColor: COLORS.neutral200,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.neutral500,
  },
  modalSearch: {
    marginHorizontal: 24,
    marginBottom: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  modalSearchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  modalSearchInput: {
    backgroundColor: COLORS.neutralLight,
    borderRadius: 16,
    paddingLeft: 44,
    paddingRight: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.neutralSlate,
  },
  friendList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  friendListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  friendListItemSelected: {
    backgroundColor: COLORS.primaryBg,
  },
  friendListInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendListAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  friendListAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  statusOnline: {
    backgroundColor: COLORS.success,
  },
  statusOffline: {
    backgroundColor: COLORS.neutral300,
  },
  friendListName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
    marginBottom: 2,
  },
  friendListNameSelected: {
    color: COLORS.primaryMain,
  },
  friendListEmail: {
    fontSize: 12,
    color: COLORS.neutral400,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primaryMain,
    borderColor: COLORS.primaryMain,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  modalDoneButton: {
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalDoneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
