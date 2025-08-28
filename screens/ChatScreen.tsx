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
import { router } from 'expo-router';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // 사용자 닉네임 가져오기 및 채팅 기록 로드
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
    loadChatHistory();
  }, []);

  // 한국 시간으로 Date 객체 생성하는 함수
  const getKoreanTime = () => {
    return new Date(); // 이미 한국 시간이므로 그대로 사용
  };

  // 채팅 기록 로드 함수
  const loadChatHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('인증 토큰이 없습니다.');
        return;
      }

      const response = await fetch('http://localhost:3000/chat/history', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const chatHistory: Message[] = [];
        
        // 대화 기록을 시간순으로 정렬하여 메시지 배열 생성
        data.forEach((log: any) => {
          if (log.request_text) {
            chatHistory.push({
              id: `user_${log.id}`,
              text: log.request_text,
              isUser: true,
              timestamp: new Date(log.created_at), // UTC 시간을 자동으로 로컬 시간으로 변환
            });
          }
          if (log.response_text) {
            chatHistory.push({
              id: `ai_${log.id}`,
              text: log.response_text,
              isUser: false,
              timestamp: new Date(log.created_at), // UTC 시간을 자동으로 로컬 시간으로 변환
            });
          }
        });

        // 시간순으로 정렬
        chatHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setMessages(chatHistory);
      }
    } catch (error) {
      console.error('채팅 기록 로드 오류:', error);
    }
  };

  // ChatGPT API 호출
  const callChatGPTAPI = async (userMessage: string) => {
    setIsLoading(true);
    
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      // Agent 간 협업이 필요한지 확인
      const isAgentCollaborationRequest = checkAgentCollaborationRequest(userMessage);
      
      if (isAgentCollaborationRequest) {
        // Agent 간 협업 시작
        await startAgentCollaboration(userMessage, token);
      } else {
        // 일반 ChatGPT 응답
        const response = await fetch('http://localhost:3000/chat/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.status}`);
        }

        const data = await response.json();
        
        const aiMessage: Message = {
          id: Date.now().toString() + '_ai',
          text: data.ai_response || '죄송합니다. 응답을 생성할 수 없습니다.',
          isUser: false,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, aiMessage]);
      }
      
    } catch (error) {
      console.error('ChatGPT API 호출 오류:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString() + '_ai',
        text: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent 간 협업 요청인지 확인
  const checkAgentCollaborationRequest = (message: string): boolean => {
    const collaborationKeywords = ['와', '과', '랑', '이랑'];
    const scheduleKeywords = ['약속', '일정', '만나', '미팅', '회의', '점심', '저녁', '오후', '오전'];
    
    // 다른 사용자와의 협업 요청인지 확인
    const hasCollaborationKeyword = collaborationKeywords.some(keyword => message.includes(keyword));
    const hasScheduleKeyword = scheduleKeywords.some(keyword => message.includes(keyword));
    
    return hasCollaborationKeyword && hasScheduleKeyword;
  };

  // Agent 간 협업 시작
  const startAgentCollaboration = async (userMessage: string, token: string) => {
    try {
      // 사용자 이름과 작업 분리
      const parts = userMessage.split('와');
      if (parts.length >= 2) {
        const targetUserName = parts[0].trim();
        const task = parts.slice(1).join('와').trim();
        
        // Agent 간 협업 시작
        const response = await fetch('http://localhost:3000/chat/start-agent-task', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target_user_name: targetUserName,
            task_description: task
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // 협업 시작 메시지
          const startMessage: Message = {
            id: Date.now().toString() + '_ai_start',
            text: `🤖 ${targetUserName}의 Agent와 협업을 시작합니다...`,
            isUser: false,
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, startMessage]);
          
          // 잠시 후 협업 결과 표시
          setTimeout(() => {
            const resultMessage: Message = {
              id: Date.now().toString() + '_ai_result',
              text: data.message || 'Agent 간 협업이 완료되었습니다.',
              isUser: false,
              timestamp: new Date(),
            };
            
            setMessages(prev => [...prev, resultMessage]);
            
            // Agent 간 대화 내용 표시
            if (data.agent_messages) {
              const agentAMessage: Message = {
                id: Date.now().toString() + '_agent_a',
                text: `👤 ${userNickname}의 Agent: ${data.agent_messages.agent_a}`,
                isUser: false,
                timestamp: new Date(),
              };
              
              const agentBMessage: Message = {
                id: Date.now().toString() + '_agent_b',
                text: `👤 ${targetUserName}의 Agent: ${data.agent_messages.agent_b}`,
                isUser: false,
                timestamp: new Date(),
              };
              
              const finalResultMessage: Message = {
                id: Date.now().toString() + '_final_result',
                text: `📋 최종 결과: ${data.agent_messages.final_result}`,
                isUser: false,
                timestamp: new Date(),
              };
              
              setMessages(prev => [...prev, agentAMessage, agentBMessage, finalResultMessage]);
            }
            
            // 일정이 추가된 경우 알림
            if (data.schedule_info && data.schedule_info.schedule_created) {
              const scheduleMessage: Message = {
                id: Date.now().toString() + '_schedule',
                text: `📅 일정이 Google Calendar에 추가되었습니다!`,
                isUser: false,
                timestamp: new Date(),
              };
              
              setMessages(prev => [...prev, scheduleMessage]);
            }
          }, 2000);
          
        } else {
          const errorData = await response.json();
          const errorMessage: Message = {
            id: Date.now().toString() + '_ai_error',
            text: errorData.error || 'Agent 간 협업 시작에 실패했습니다.',
            isUser: false,
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // 형식이 맞지 않는 경우 일반 응답
        const response = await fetch('http://localhost:3000/chat/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (response.ok) {
          const data = await response.json();
          
          const aiMessage: Message = {
            id: Date.now().toString() + '_ai',
            text: data.ai_response || '죄송합니다. 응답을 생성할 수 없습니다.',
            isUser: false,
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Agent 협업 오류:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString() + '_ai_error',
        text: 'Agent 간 협업 중 오류가 발생했습니다.',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(), // 현재 시간
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // ChatGPT API 호출
    await callChatGPTAPI(userMessage.text);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    // 시간 포맷팅 개선 (한국 시간 기준)
    const fmtKST = new Intl.DateTimeFormat('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: 'Asia/Seoul'
    });

    const formatTime = (date: Date) => {
      const now = new Date();                 // UTC 기준 timestamp
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      if (diffMin < 1) return '방금 전';
      if (diffMin < 60) return `${diffMin}분 전`;
      if (diffMin < 1440) return `${Math.floor(diffMin/60)}시간 전`;
      return fmtKST.format(date);             // 출력은 KST로
    };

    return (
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
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>{userNickname}님의 JOY</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            <Text style={styles.loadingText}>ChatGPT가 응답을 생성하고 있습니다...</Text>
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
              size={18} 
              color={(!inputText.trim() || isLoading) ? "#6B7280" : "white"} 
              style={{ 
                transform: [{ rotate: '-45deg' }],
                marginLeft: 1,
                marginTop: -1
              }}
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
              style={[styles.navItem, styles.activeNavItem]}
              onPress={() => navigation.navigate('A2A')}
          >
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
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Chat')}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;

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
    alignItems: 'center',
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
    paddingVertical: 8,
    marginRight: 8,
    color: 'white',
    fontSize: 16,
    maxHeight: 80,
    minHeight: 36,
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
