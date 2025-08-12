import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const A2AScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // 사용자 닉네임 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const response = await fetch('http://localhost:3000/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const userData = await response.json();
            setUserNickname(userData.name || '사용자');
          }
        }
      } catch (error) {
        console.error('사용자 정보 조회 오류:', error);
        setUserNickname('사용자');
      }
    };

    fetchUserInfo();
  }, []);

  // AI 응답 시뮬레이션
  const simulateAIResponse = async (userMessage: string) => {
    setIsLoading(true);
    
    // 실제 AI API 호출을 시뮬레이션
    setTimeout(() => {
      const aiResponses = [
        "안녕하세요! 무엇을 도와드릴까요?",
        "흥미로운 질문이네요. 더 자세히 설명해주세요.",
        "그것에 대해 생각해보겠습니다. 다른 관점에서도 살펴볼 수 있어요.",
        "좋은 아이디어입니다! 함께 발전시켜보는 건 어떨까요?",
        "도움이 필요하시면 언제든 말씀해주세요.",
        "그것에 대해 더 알고 싶어요. 구체적인 예시가 있나요?",
        "흥미로운 주제네요! 다른 각도에서 접근해보는 것도 좋을 것 같아요.",
        "당신의 생각이 정말 독창적이에요. 더 발전시켜보세요!",
        "그런 질문을 하다니 정말 좋네요. 함께 탐구해보죠.",
        "당신의 관점이 정말 흥미로워요. 더 이야기해주세요."
      ];
      
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      
      const aiMessage: Message = {
        id: Date.now().toString() + '_ai',
        text: randomResponse,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000); // 1-3초 랜덤 지연
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // AI 응답 생성
    await simulateAIResponse(userMessage.text);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.isUser ? styles.userMessageText : styles.aiMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{userNickname}님의 JOY</Text>
          </View>
        </View>

        {/* 메시지 목록 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* 로딩 인디케이터 */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>AI가 응답을 생성하고 있습니다...</Text>
          </View>
        )}

        {/* 입력 영역 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(!inputText.trim() || isLoading) ? "#6B7280" : "white"} 
            />
          </TouchableOpacity>
        </View>

        {/* 하단 탭바 */}
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
          <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
            <Ionicons name="person" size={24} color="#3B82F6" />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default A2AScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
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
    padding: 10,
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
  messagesList: {
    flex: 1,
    backgroundColor: '#0F111A',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#374151',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: 'white',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F111A',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    color: 'white',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
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
    color: '#3B82F6',
    fontWeight: '600',
  },
});
