import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { RootStackParamList } from '../types';

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
      
      // AsyncStorage에서 토큰 가져오기
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      console.log('🔍 채팅방 목록 요청 중...');
      const response = await fetch('http://localhost:3000/chat/rooms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ 채팅방 목록 가져오기 성공:', data);
        
        // 백엔드 응답을 프론트엔드 형식으로 변환
        const formattedRooms = data.chat_rooms?.map((room: any, index: number) => ({
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
        console.log('❌ 채팅방 목록 가져오기 실패:', response.status);
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
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentChat}</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="white" />
        </TouchableOpacity>
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
          <Ionicons name="chatbubble" size={24} color="#3B82F6" />
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
        <TouchableOpacity style={styles.navItem}>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: height * 0.35,
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    marginVertical: 4,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#4A90E2',
  },
  otherBubble: {
    backgroundColor: '#ecf0f1',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#2c3e50',
  },
  chatRoomsSection: {
    flex: 1,
    backgroundColor: '#34495e',
    paddingTop: 16,
  },
  chatRoomsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chatRoomsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#bdc3c7',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubText: {
    color: '#95a5a6',
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
    borderBottomColor: '#2c3e50',
  },
  chatRoomIcon: {
    marginRight: 12,
  },
  chatRoomContent: {
    flex: 1,
  },
  chatRoomTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatRoomLastMessage: {
    color: '#bdc3c7',
    fontSize: 14,
  },
  chatRoomTime: {
    color: '#95a5a6',
    fontSize: 12,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#0F111A',
    borderTopColor: '#374151',
    borderTopWidth: 1,
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
    color: '#3B82F6',
    fontWeight: '600',
  },
});

export default ChatScreen; 