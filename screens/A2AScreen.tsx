import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AgentMessage {
  id: string;
  message: string;
  agentName: string;
  timestamp: string;
  isMyAgent: boolean;
}

interface AgentChatRoom {
  id: string;
  agentNames: string[];
  lastMessage: string;
  lastMessageTime: string;
  status: 'pending' | 'completed' | 'in_progress';
}

const A2AScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentChat, setCurrentChat] = useState<string>('채팅방을 선택하세요');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<AgentChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentScenario, setCurrentScenario] = useState<'initial' | 'reschedule'>('initial');

  // 초기 시나리오 2: AI 봇들 간의 약속 조율 대화
  const initialScenarioMessages: AgentMessage[] = [
    {
      id: '1',
      message: '이번주 금요일 저녁에 7시에 조수연님이 약속을 요청했습니다.',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
    {
      id: '2',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '3',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '4',
      message: '민서님은 금요일 저녁 7시 가능합니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '5',
      message: '저도 가능합니다. 장소는 성신여대역 어떠세요?',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '6',
      message: '네, 괜찮습니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '7',
      message: '일정 확정 채팅 전달하겠습니다.',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
  ];

  // 재조율 시나리오 5: AI 봇들 간의 재조율 대화 (이전 대화 포함)
  const rescheduleScenarioMessages: AgentMessage[] = [
    // 이전 대화 기록 (첫 번째 약속 요청)
    {
      id: '1',
      message: '이번주 금요일 저녁에 7시에 조수연님이 약속을 요청했습니다.',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
    {
      id: '2',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '3',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '4',
      message: '민서님은 금요일 저녁 7시 가능합니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '5',
      message: '저도 가능합니다. 장소는 성신여대역 어떠세요?',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '6',
      message: '네, 괜찮습니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '7',
      message: '일정 확정 채팅 전달하겠습니다.',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
    // 재조율 대화 (민서봇이 거절 메시지 전송)
    {
      id: '8',
      message: '민서님이 일정을 거절했습니다. 민서님이 8월 30일 오후 5시로 요청했습니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '9',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '10',
      message: '사용자의 일정을 확인 중입니다…',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
    {
      id: '11',
      message: '규민님 가능합니다.',
      agentName: '규민봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
    {
      id: '12',
      message: '수연님 가능합니다.',
      agentName: '수연봇',
      timestamp: new Date().toISOString(),
      isMyAgent: true,
    },
    {
      id: '13',
      message: '일정 확정 채팅 전달하겠습니다.',
      agentName: '민서봇',
      timestamp: new Date().toISOString(),
      isMyAgent: false,
    },
  ];

  // 하드코딩된 채팅방 목록 (하나만)
  const hardcodedChatRooms: AgentChatRoom[] = [
    {
      id: 'room_1',
      agentNames: ['민서', '규민'],
      lastMessage: '약속 조율 대화방',
      lastMessageTime: '19:00',
      status: 'completed',
    },
  ];

  // Agent 간 채팅방 목록 가져오기
  const fetchAgentChatRooms = async () => {
    try {
      setLoading(true);
      
      // 하드코딩된 데이터 사용
      setChatRooms(hardcodedChatRooms);
      
    } catch (error) {
      console.error('❌ Agent 채팅방 목록 가져오기 오류:', error);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  };

  // 선택된 채팅방의 Agent 간 대화 가져오기
  const fetchAgentMessages = async (roomId: string) => {
    try {
      if (roomId === 'room_1') {
        // Chat 화면의 상태를 확인하여 적절한 시나리오 표시
        const chatStatus = await AsyncStorage.getItem('chatAppointmentStatus');
        
        if (chatStatus === 'accepted') {
          // 사용자가 승인한 경우 - 성공 시나리오 (재조율 후 두 번째 약속 확정)
          setMessages(rescheduleScenarioMessages);
          setCurrentScenario('reschedule');
        } else if (chatStatus === 'rejected') {
          // 사용자가 거절한 경우 - 재조율 시나리오
          setMessages(rescheduleScenarioMessages);
          setCurrentScenario('reschedule');
        } else {
          // 기본 시나리오 (사용자가 아직 응답하지 않은 상태)
          setMessages(initialScenarioMessages);
          setCurrentScenario('initial');
        }
      } else {
        setMessages([]);
      }
      
    } catch (error) {
      console.error('❌ Agent 대화 가져오기 오류:', error);
      setMessages([]);
    }
  };

  // 새로운 Agent 작업 시작
  const startNewAgentTask = async (targetUserName: string, taskDescription: string) => {
    try {
      Alert.alert('성공', 'Agent 간 협업이 시작되었습니다!');
      
      // 새로운 채팅방 추가
      const newRoom: AgentChatRoom = {
        id: `room_${Date.now()}`,
        agentNames: [targetUserName],
        lastMessage: taskDescription,
        lastMessageTime: new Date().toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        status: 'in_progress',
      };
      
      setChatRooms(prev => [newRoom, ...prev]);
      
    } catch (error) {
      console.error('❌ Agent 작업 시작 오류:', error);
      Alert.alert('오류', 'Agent 작업 시작 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchAgentChatRooms();
    // 초기에는 메시지 표시하지 않음
  }, []);

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
        fetchAgentMessages(item.id);
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
      <Text style={styles.chatRoomTime}>
        {item.lastMessageTime}
      </Text>
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
            <TouchableOpacity 
              style={styles.newTaskButton}
              onPress={() => {
                Alert.prompt(
                  '새로운 Agent 작업',
                  '대상 사용자 이름과 작업을 입력하세요 (예: 귬모와 27일 저녁에 약속 잡아줘)',
                  [
                    { text: '취소', style: 'cancel' },
                    { 
                      text: '시작', 
                      onPress: (taskDescription) => {
                        if (taskDescription) {
                          // 사용자 이름과 작업 분리
                          const parts = taskDescription.split('와');
                          if (parts.length >= 2) {
                            const targetUserName = parts[0].trim();
                            const task = parts.slice(1).join('와').trim();
                            startNewAgentTask(targetUserName, task);
                          } else {
                            Alert.alert('입력 오류', '올바른 형식으로 입력해주세요. (예: 귬모와 27일 저녁에 약속 잡아줘)');
                          }
                        }
                      }
                    }
                  ],
                  'plain-text'
                );
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.newTaskButtonText}>새 작업</Text>
            </TouchableOpacity>
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
