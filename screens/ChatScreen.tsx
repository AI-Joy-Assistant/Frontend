import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { chatApi } from '../lib/api';

const { width, height } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  message: string;
  isFromMe: boolean;
  timestamp: string;
}

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
}

const ChatScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentChat, setCurrentChat] = useState<string>('채팅을 선택하세요');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 채팅방 목록 가져오기
  const fetchChatRooms = async () => {
    try {
      setLoading(true);

      console.log('🔍 채팅방 목록 요청 중...');
      const result = await chatApi.getRooms();

      if (result.success && result.data) {
        console.log('✅ 채팅방 목록 가져오기 성공:', result.data);
        
        // 백엔드 응답을 프론트엔드 형식으로 변환
        const chatRoomsData = result.data as any;
        const formattedRooms = chatRoomsData.chat_rooms?.map((room: any, index: number) => ({
          id: `room_${index}`,
          participants: room.participant_names || room.participants,
          lastMessage: room.last_message || '메시지가 없습니다',
          lastMessageTime: room.last_message_time ? 
            new Date(room.last_message_time).toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '시간 없음'
        })) || [];
        
        setChatRooms(formattedRooms);
      } else {
        console.log('❌ 채팅방 목록 가져오기 실패:', result.error);
        setChatRooms([]);
      }
    } catch (error) {
      console.error('❌ 채팅방 목록 가져오기 오류:', error);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[
      styles.messageContainer,
      item.isFromMe ? styles.myMessage : styles.otherMessage
    ]}>
      <View style={[
        styles.messageBubble,
        item.isFromMe ? styles.myBubble : styles.otherBubble
      ]}>
        <Text style={[
          styles.messageText,
          item.isFromMe ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.message}
        </Text>
      </View>
    </View>
  );

  const renderChatRoom = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity 
      style={styles.chatRoomItem}
      onPress={() => setCurrentChat(item.participants.join(', '))}
    >
      <View style={styles.chatRoomIcon}>
        <Ionicons name="chatbubbles" size={24} color="#4A90E2" />
      </View>
      <View style={styles.chatRoomContent}>
        <Text style={styles.chatRoomTitle}>
          {item.participants.join(', ')}
        </Text>
        <Text style={styles.chatRoomLastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
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
          <Text style={styles.chatRoomsTitle}>채팅방</Text>
          <TouchableOpacity onPress={fetchChatRooms} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#4A90E2" />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="hourglass" size={40} color="#ccc" />
            <Text style={styles.emptyStateText}>채팅방을 불러오는 중...</Text>
          </View>
        ) : chatRooms.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>채팅이 없습니다.</Text>
            <Text style={styles.emptyStateSubText}>친구들과 대화를 시작해보세요!</Text>
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
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>A2A</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('MyPage')}
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
    padding: 8,
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

export default ChatScreen;
