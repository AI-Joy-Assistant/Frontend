import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE } from '../constants/config';

// 문자열 정규화 (공백 제거 + 소문자 통일)
const normalize = (str: string) => {
  if (!str) return '';
  return str
    .replace(/\s+/g, '')
    .replace(/ /g, '')
    .toLowerCase();
};

const findFriendByName = (
  friends: { id: string; name: string }[],
  targetUserName: string
) => {
  if (!targetUserName) return null;
  const normTarget = normalize(targetUserName);
  return (
    friends.find((f) => {
      const normName = normalize(f.name);
      return normName.includes(normTarget) || normTarget.includes(normName);
    }) || null
  );
};

interface AgentMessage {
  id: string;
  message: string;
  agentName: string;
  timestamp: string;
  isMyAgent: boolean;
}

interface AgentChatRoom {
  id: string; // other user id 또는 파생 키
  agentNames: string[];
  lastMessage: string;
  lastMessageTime: string;
  status: 'pending' | 'completed' | 'in_progress';
}

// 백엔드 응답 타입 (필요한 필드만 정의)
interface BackendChatRoom {
  participants: string[]; // uuid string[]
  last_message?: string;
  last_message_time?: string; // ISO datetime
  participant_names: string[]; // 참가자 이름들 (현재 사용자 포함 가능)
}

interface BackendMessage {
  id: string;
  send_id: string;
  receive_id: string;
  message: string;
  message_type: string;
  created_at: string; // ISO datetime
}

const A2AScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentChat, setCurrentChat] = useState<string>('채팅방을 선택하세요');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<AgentChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('나');
  const [myAgentName, setMyAgentName] = useState<string>('내 비서');
  const [otherAgentName, setOtherAgentName] = useState<string>('상대 비서');
  const [friendMap, setFriendMap] = useState<Record<string, string>>({});

  // participants에서 otherUserId를 구하기 위해, 방 id(파생) -> otherUserId 매핑 저장
  const [roomOtherUserMap, setRoomOtherUserMap] = useState<Record<string, string>>({});

  // 백엔드 연동: 현재 사용자 정보
  const fetchMe = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return null;
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const me = await response.json();
        setCurrentUserId(me.id || null);
        setCurrentUserName(me.name || '나');
        setMyAgentName(`${me.name || '나'}봇`);
        return me.id || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Agent 간 채팅방 목록 가져오기 (백엔드 연동)
  const fetchAgentChatRooms = async () => {
    try {
      console.log('🔄 [A2A] fetchAgentChatRooms start');
      setLoading(true);
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ [A2A] 토큰 없음, 방 목록 불러오지 않음');
        setChatRooms([]);
        return;
      }
      // 현재 사용자 정보가 없으면 먼저 가져오기
      let userId = currentUserId;
      if (!userId) {
        userId = await fetchMe();
      }
      if (!userId) {
        console.log('❌ [A2A] userId 없음, 방 목록 중단');
        setChatRooms([]);
        return;
      }

      // 친구 맵 미리 확보 (이름 매핑용)
      let localFriendMap = friendMap;
      try {
        const friendsResp = await fetch(`${API_BASE}/chat/friends`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (friendsResp.ok) {
          console.log('✅ [A2A] 친구 목록 조회 성공');
          const friendsData = await friendsResp.json();
          const map: Record<string, string> = {};
          (friendsData?.friends || []).forEach((f: { id: string; name: string }) => {
            map[f.id] = f.name;
          });
          setFriendMap(map);
          localFriendMap = map;
        }
      } catch (e) {
        // 이름 매핑 실패 시 무시
        console.log('⚠️ [A2A] 친구 목록 조회 실패, 이름 매핑 생략:', e);
      }

      // A2A 세션 목록 기반으로 방 목록 구성
      const res = await fetch(`${API_BASE}/a2a/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        console.log('❌ [A2A] 세션 목록 조회 실패 status:', res.status);
        setChatRooms([]);
        return;
      }
      const data = await res.json();
      const sessions = data?.sessions || [];
      console.log('📋 [A2A] 세션 수:', sessions.length);

      const otherMap: Record<string, string> = {};

      const mapped: AgentChatRoom[] = sessions.map((session: any) => {
        const otherUserId = session.initiator_user_id === userId
          ? session.target_user_id
          : session.initiator_user_id;
        const roomId = session.id;
        otherMap[roomId] = otherUserId;
        const otherName = localFriendMap[otherUserId] || '대화상대';

        return {
          id: roomId,
          agentNames: [otherName],
          lastMessage: '',
          lastMessageTime: '',
          status: session.status === 'completed'
            ? 'completed'
            : session.status === 'in_progress'
              ? 'in_progress'
              : 'pending',
        } as AgentChatRoom;
      });

      setRoomOtherUserMap(otherMap);
      setChatRooms(mapped);
    } catch (error) {
      console.error('❌ [A2A] 채팅방 목록 가져오기 오류:', error);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  };

  // 선택된 채팅방의 Agent 간 대화 가져오기 (백엔드 연동)
  const fetchAgentMessages = async (roomId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ fetchAgentMessages: 토큰 없음');
        setMessages([]);
        return;
      }
      // currentUserId가 없으면 먼저 가져오기
      let userId = currentUserId;
        if (!userId) {
          console.log('⚠️ currentUserId 없음, fetchMe 실행');
          userId = await fetchMe();
        }

        if (!userId) {
          console.log('❌ 사용자 ID를 가져올 수 없습니다.');
          setMessages([]);
        return;
      }

      console.log('🔍 fetchAgentMessages 시작:', { roomId });

      // 세션 정보 조회
      const sessionRes = await fetch(`${API_BASE}/a2a/session/${roomId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!sessionRes.ok) {
        console.log('❌ 세션 조회 실패:', sessionRes.status);
        setMessages([]);
        return;
      }
      const sessionData = await sessionRes.json();
      const otherUserId = sessionData.initiator_user_id === userId
        ? sessionData.target_user_id
        : sessionData.initiator_user_id;
      setRoomOtherUserMap(prev => ({ ...prev, [roomId]: otherUserId }));

      const friendlyName = friendMap[otherUserId] || otherAgentName || '상대';
      setOtherAgentName(`${friendlyName}봇`);

      // 메시지 조회
      const a2aRes = await fetch(`${API_BASE}/a2a/session/${roomId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!a2aRes.ok) {
        console.log('❌ A2A 메시지 조회 실패:', a2aRes.status);
        setMessages([]);
        return;
      }
      const a2aData = await a2aRes.json();
      const a2aMessages = a2aData?.messages || [];
      console.log('📨 A2A 메시지 개수:', a2aMessages.length);

      if (a2aMessages.length === 0) {
        console.log('⚠️ A2A 메시지가 없습니다.');
        setMessages([]);
        return;
      }

      const mapped: AgentMessage[] = a2aMessages.map((m: any) => {
        let messageText = '';
        
        // 백엔드에서 반환하는 메시지 형식에 맞게 파싱
        // a2a_message 테이블의 message 필드는 JSONB이므로 객체일 수 있음
        if (m.message) {
          if (typeof m.message === 'string') {
            messageText = m.message;
          } else if (typeof m.message === 'object') {
            // message 객체 내부의 text 필드 추출
            messageText = m.message.text || m.message.message || m.message.content || '';
            // text가 없으면 전체 객체를 문자열로 변환
            if (!messageText) {
              try {
                messageText = JSON.stringify(m.message);
              } catch {
                messageText = String(m.message);
              }
            }
          } else {
            messageText = String(m.message);
          }
        }
        
        // message가 비어있으면 기본 메시지
        if (!messageText.trim()) {
          messageText = '[메시지 없음]';
        }

        // sender_user_id와 receiver_user_id 확인
        const isMyAgent = m.sender_user_id === userId || m.sender_user_id === currentUserId;
        const agentName = isMyAgent ? myAgentName : `${friendlyName}봇`;

        console.log('📝 메시지 파싱:', {
          id: m.id,
          sender: m.sender_user_id,
          receiver: m.receiver_user_id,
          messageType: m.message_type || m.type,
          message: messageText.substring(0, 50),
          isMyAgent
        });

        return {
          id: String(m.id || `${Date.now()}-${Math.random()}`),
          message: messageText,
          agentName: agentName,
          timestamp: m.created_at || new Date().toISOString(),
          isMyAgent: isMyAgent,
        };
      });
      setMessages(mapped);
    } catch (error) {
      console.error('❌ Agent 대화 가져오기 오류:', error);
      setMessages([]);
    }
  };

  // 채팅방 삭제 공통 함수 (롱프레스/버튼 공용)
  const deleteChatRoom = async (roomId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const otherId = (roomId && roomOtherUserMap[roomId]) || roomId;
      const res = await fetch(`${API_BASE}/chat/rooms/${otherId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        // UI 즉시 반영
        setSelectedRoomId(null);
        setMessages([]);
        setChatRooms(prev => prev.filter(r => r.id !== roomId));
        // 맵 정리
        setRoomOtherUserMap(prev => {
          const copy = { ...prev }; delete copy[roomId]; return copy;
        });
        // 서버 재조회로 최종 동기화
        fetchAgentChatRooms();
      } else {
        Alert.alert('오류', '채팅방 삭제에 실패했습니다.');
      }
    } catch (e) {
      Alert.alert('오류', '채팅방 삭제 중 문제가 발생했습니다.');
    }
  };

  // 새로운 Agent 작업 시작 -> 백엔드가 전체 시뮬레이션 자동 진행
  const startNewAgentTask = async (targetUserName: string, taskDescription: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }
      
      // 1) 친구 목록에서 이름으로 friend_id 찾기
      const friendsResp = await fetch(`${API_BASE}/chat/friends`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!friendsResp.ok) {
        Alert.alert('오류', '친구 목록 조회에 실패했습니다.');
        return;
      }
      const friendsData = await friendsResp.json();
      const friends: { id: string; name: string }[] = friendsData?.friends || [];
      const friend = findFriendByName(friends, targetUserName);
      if (!friend) {
        Alert.alert('오류', `${targetUserName}님을 친구에서 찾을 수 없습니다.`);
        return;
      }

      // 2) A2A 세션 시작 (백엔드가 전체 시뮬레이션 자동 진행)
      const summary = taskDescription ? `${targetUserName}와 ${taskDescription}` : `${targetUserName}와 약속`;
      const sessionRes = await fetch(`${API_BASE}/a2a/session/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_id: friend.id,
          intent: 'schedule',
          summary: summary,
          time_window: { duration_minutes: 60 },
        }),
      });

      if (!sessionRes.ok) {
        const errorData = await sessionRes.json().catch(() => ({ detail: 'A2A 세션 시작 실패' }));
        Alert.alert('오류', errorData.detail || 'A2A 세션 시작에 실패했습니다.');
        return;
      }

      const sessionData = await sessionRes.json();
      
      if (sessionData.event) {
        Alert.alert('성공', '에이전트 간 일정 조율이 완료되었습니다!');
      } else {
        Alert.alert('안내', '공통으로 비는 시간을 찾지 못했습니다.');
      }

      // 방 목록 갱신 및 메시지 새로고침
      fetchAgentChatRooms();
      if (selectedRoomId) fetchAgentMessages(selectedRoomId);
    } catch (error) {
      console.error('❌ Agent 작업 시작 오류:', error);
      Alert.alert('오류', 'Agent 작업 시작 중 오류가 발생했습니다.');
    }
  };

  // 화면이 포커스될 때마다 채팅방 목록 새로고침
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        // 사용자 정보를 먼저 확보한 뒤 방 목록을 가져와 ID/이름 매핑 정확도 보장
        await fetchMe();
        await fetchAgentChatRooms();
      })();
    }, [])
  );

  // selectedRoomId가 변경되면 메시지 자동 로드
  useEffect(() => {
    if (selectedRoomId) {
      console.log('🔄 selectedRoomId 변경됨, 메시지 로드 시작:', selectedRoomId, 'currentUserId:', currentUserId);
      // currentUserId가 없으면 fetchMe를 먼저 실행
      if (!currentUserId) {
        fetchMe().then(() => {
          // fetchMe 완료 후 메시지 로드
          if (selectedRoomId) {
            fetchAgentMessages(selectedRoomId);
          }
        });
      } else {
        fetchAgentMessages(selectedRoomId);
      }
    }
  }, [selectedRoomId]);

  const renderMessage = ({ item }: { item: AgentMessage }) => (
    <View style={[
      styles.messageContainer,
      item.isMyAgent ? styles.myMessage : styles.otherMessage
    ]}>
      <View style={[
        styles.messageBubble,
        item.isMyAgent ? styles.myBubble : styles.otherBubble
      ]}>
        <Text style={styles.agentName}>
          {item.agentName}
        </Text>
        <Text style={[
          styles.messageText,
          item.isMyAgent ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.message}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    </View>
  );

  const renderChatRoom = ({ item }: { item: AgentChatRoom }) => (
    <TouchableOpacity 
      style={styles.chatRoomItem}
      onPress={() => {
        setSelectedRoomId(item.id);
        setCurrentChat(item.agentNames.join(', '));
        // 선택된 방의 상대 에이전트 이름 설정 (리스트에 현재 사용자 제외된 이름들이 들어있음)
        const firstOtherName = (item.agentNames && item.agentNames[0]) ? item.agentNames[0] : '상대';
        setOtherAgentName(`${firstOtherName}봇`);
        fetchAgentMessages(item.id);
      }}
      onLongPress={() => {
        Alert.alert(
          '채팅방 삭제',
          `${item.agentNames.join(', ')} 방의 대화를 삭제할까요?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: async () => {
              deleteChatRoom(item.id);
            } }
          ]
        );
      }}
    >
      <View style={styles.chatRoomIcon}>
        <Ionicons name="people" size={24} color="#4A90E2" />
      </View>
      <View style={styles.chatRoomContent}>
        <Text style={styles.chatRoomTitle}>
          {item.agentNames.join(', ')}
        </Text>
        <Text style={styles.chatRoomLastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            item.status === 'completed' ? styles.completedStatus :
            item.status === 'in_progress' ? styles.inProgressStatus :
            styles.pendingStatus
          ]} />
          <Text style={styles.statusText}>
            {item.status === 'completed' ? '완료' :
             item.status === 'in_progress' ? '진행중' : '대기중'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.chatRoomTime}>
          {item.lastMessageTime}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              '채팅방 삭제',
              `${item.agentNames.join(', ')} 방의 대화를 삭제할까요?`,
              [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive', onPress: () => deleteChatRoom(item.id) }
              ]
            );
          }}
          style={styles.deleteIconButton}
        >
          <Ionicons name="trash" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
        <View style={styles.searchContainer}>
          <Text style={styles.headerTitle}>{currentChat}</Text>
        </View>
      </View>

      {/* AI 봇들 간 대화 영역 */}
      <View style={styles.chatArea}>
        <View style={styles.chatAreaHeader}>
          <Text style={styles.chatAreaTitle}>AI 비서 간 대화</Text>
        </View>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* 채팅방 목록 */}
      <View style={styles.chatRoomsSection}>
        <View style={styles.chatRoomsHeader}>
          <Text style={styles.chatRoomsTitle}>채팅방 목록</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={fetchAgentChatRooms} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#4A90E2" />
            </TouchableOpacity>
          </View>
        </View>
        
        {loading ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="hourglass" size={40} color="#ccc" />
            <Text style={styles.emptyStateText}>Agent 대화방을 불러오는 중...</Text>
          </View>
        ) : chatRooms.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>Agent 간 대화가 없습니다.</Text>
            <Text style={styles.emptyStateSubText}>Agent들이 협업할 작업을 시작해보세요!</Text>
          </View>
        ) : (
          <FlatList
            data={chatRooms}
            renderItem={renderChatRoom}
            keyExtractor={(item) => item.id}
            style={styles.chatRoomsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* 하단 네비게이션 */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="home" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Chat')}
        >
          <Ionicons name="chatbubble" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Friends')}
        >
          <Ionicons name="people" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, styles.activeNavItem]}
          onPress={() => navigation.navigate('A2A')}
        >
          <Ionicons name="person" size={24} color="#4A90E2" />
          <Text style={[styles.navText, styles.activeNavText]}>A2A</Text>
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
};

export default A2AScreen;

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
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#0F111A',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatAreaHeader: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 8,
  },
  chatAreaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  myBubble: {
    backgroundColor: '#4A90E2',
  },
  otherBubble: {
    backgroundColor: '#6B7280',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  agentName: {
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  chatRoomsSection: {
    flex: 1,
    backgroundColor: '#1F2937',
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#374151',
  },
  chatRoomsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  newTaskButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  chatRoomsTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  chatRoomsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  chatRoomIcon: {
    marginRight: 12,
  },
  chatRoomContent: {
    flex: 1,
  },
  chatRoomTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatRoomLastMessage: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  chatRoomTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  deleteIconButton: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  pendingStatus: {
    backgroundColor: '#FFC107', // 대기 상태
  },
  inProgressStatus: {
    backgroundColor: '#4CAF50', // 진행 중 상태
  },
  completedStatus: {
    backgroundColor: '#66BB6A', // 완료 상태
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
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
});
