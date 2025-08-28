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
  const [currentChat, setCurrentChat] = useState<string>('Agent 대화를 선택하세요');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<AgentChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Agent 간 채팅방 목록 가져오기
  const fetchAgentChatRooms = async () => {
    try {
      setLoading(true);
      
      // AsyncStorage에서 토큰 가져오기
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      console.log('🔍 Agent 채팅방 목록 요청 중...');
      const response = await fetch('http://localhost:3000/chat/agent-rooms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Agent 채팅방 목록 가져오기 성공:', data);
        
        // 백엔드 응답을 프론트엔드 형식으로 변환
        const formattedRooms = data.agent_rooms?.map((room: any, index: number) => ({
          id: room.id || `agent_room_${index}`,
          agentNames: room.agent_names || room.participants,
          lastMessage: room.last_message || 'Agent 간 대화가 없습니다',
          lastMessageTime: room.last_message_time ? 
            new Date(room.last_message_time).toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '시간 없음',
          status: room.status || 'pending'
        })) || [];
        
        setChatRooms(formattedRooms);
      } else {
        console.log('❌ Agent 채팅방 목록 가져오기 실패:', response.status);
        setChatRooms([]);
      }
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
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      console.log('🔍 Agent 대화 요청 중...', roomId);
      const response = await fetch(`http://localhost:3000/chat/agent-messages/${roomId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Agent 대화 가져오기 성공:', data);
        
        const formattedMessages = data.messages?.map((msg: any) => ({
          id: msg.id,
          message: msg.message,
          agentName: msg.agent_name,
          timestamp: msg.timestamp,
          isMyAgent: msg.is_my_agent || false
        })) || [];
        
        setMessages(formattedMessages);
      } else {
        console.log('❌ Agent 대화 가져오기 실패:', response.status);
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
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      console.log('🔍 새로운 Agent 작업 시작...', targetUserName, taskDescription);
      const response = await fetch('http://localhost:3000/chat/start-agent-task', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_name: targetUserName,
          task_description: taskDescription
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Agent 작업 시작 성공:', data);
        Alert.alert('성공', 'Agent 간 협업이 시작되었습니다!');
        
        // Agent 대화방 목록 새로고침
        fetchAgentChatRooms();
      } else {
        const errorData = await response.json();
        console.log('❌ Agent 작업 시작 실패:', response.status, errorData);
        Alert.alert('오류', errorData.error || 'Agent 작업 시작에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ Agent 작업 시작 오류:', error);
      Alert.alert('오류', 'Agent 작업 시작 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchAgentChatRooms();
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
        setCurrentChat(item.agentNames.join(' ↔ '));
        fetchAgentMessages(item.id);
      }}
    >
      <View style={styles.chatRoomIcon}>
        <Ionicons name="people" size={24} color="#4A90E2" />
      </View>
      <View style={styles.chatRoomContent}>
        <Text style={styles.chatRoomTitle}>
          {item.agentNames.join(' ↔ ')}
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

      {/* 채팅 메시지 영역 */}
      <View style={styles.chatArea}>
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
          <Text style={styles.chatRoomsTitle}>Agent 대화방</Text>
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
          onPress={() => navigation.navigate('A2A')}
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
          onPress={() => navigation.navigate('Chat')}
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
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  menuButton: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#0F111A',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#4A90E2',
  },
  otherBubble: {
    backgroundColor: '#6B7280',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  agentName: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
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

export default A2AScreen;
