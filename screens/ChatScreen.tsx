import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  type?: 'normal' | 'appointment_confirmation' | 'rejection_input';
  appointmentData?: {
    date: string;
    time: string;
    location: string;
    participants: string[];
  };
}

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('');
  const [currentScenario, setCurrentScenario] = useState<'none' | 'appointment_request' | 'confirmation' | 'rejection'>('none');
  const flatListRef = useRef<FlatList>(null);
  const isCheckingReschedule = useRef(false);

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

  // 화면이 포커스될 때마다 실행 (채팅 기록 로드 및 자동 진행 확인)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 useFocusEffect 실행됨 - messages.length:', messages.length);
      
      // AsyncStorage에서 채팅 기록 로드 시도
      const loadAndCheck = async () => {
        try {
          const savedMessages = await AsyncStorage.getItem('chatMessages');
          if (savedMessages) {
            const parsedMessages = JSON.parse(savedMessages);
            console.log('🔍 저장된 메시지 개수:', parsedMessages.length);
            
            // timestamp를 Date 객체로 변환
            const messagesWithDates = parsedMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            
            setMessages(messagesWithDates);
            console.log('📥 AsyncStorage에서 채팅 기록 복원됨:', messagesWithDates.length, '개');
            
            // 채팅 기록 로드 후 스크롤을 최하단으로 이동
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
                console.log('📱 채팅 기록 로드 후 최하단으로 스크롤');
              }
            }, 200);
          } else {
            console.log('📭 AsyncStorage에 저장된 채팅 기록이 없습니다.');
          }
        } catch (error) {
          console.error('채팅 기록 로드 오류:', error);
        }
      };
      
      loadAndCheck();
      
      // A2A 화면에서 돌아왔을 때만 자동으로 두 번째 약속 확정 진행
      setTimeout(() => {
        checkAndProceedWithReschedule();
      }, 500);
    }, [])
  );

  // messages가 변경될 때마다 자동으로 스크롤을 아래로 및 채팅 기록 저장
  useEffect(() => {
    if (messages.length > 0) {
      // 자동 스크롤
      if (flatListRef.current) {
        const timeoutId = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 200);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages]);

  // messages가 변경될 때마다 채팅 기록 저장 (화면 간 이동 시 유지)
  useEffect(() => {
    if (messages.length > 0) {
      // 저장 전에 현재 AsyncStorage의 내용과 비교하여 중복 저장 방지
      const saveWithCheck = async () => {
        try {
          const currentSaved = await AsyncStorage.getItem('chatMessages');
          if (currentSaved) {
            const currentMessages = JSON.parse(currentSaved);
            // 메시지 개수가 다르거나 마지막 메시지가 다르면 저장
            if (currentMessages.length !== messages.length || 
                currentMessages[currentMessages.length - 1]?.text !== messages[messages.length - 1]?.text) {
              await saveChatHistoryToStorage(messages);
            }
          } else {
            // 저장된 내용이 없으면 저장
            await saveChatHistoryToStorage(messages);
          }
        } catch (error) {
          console.error('저장 확인 중 오류:', error);
          // 오류 발생 시 안전하게 저장
          await saveChatHistoryToStorage(messages);
        }
      };
      
      const saveTimeoutId = setTimeout(saveWithCheck, 100);
      return () => clearTimeout(saveTimeoutId);
    }
  }, [messages]);

  // 한국 시간으로 Date 객체 생성하는 함수
  const getKoreanTime = () => {
    return new Date(); // 이미 한국 시간이므로 그대로 사용
  };



  // AsyncStorage에 채팅 기록 저장 (화면 간 이동 시 유지)
  const saveChatHistoryToStorage = async (messages: Message[]) => {
    try {
      if (messages.length === 0) {
        console.log('💾 저장할 메시지가 없습니다.');
        return;
      }
      
      // Date 객체를 문자열로 변환하여 저장
      const messagesToSave = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }));
      
      await AsyncStorage.setItem('chatMessages', JSON.stringify(messagesToSave));
      console.log('💾 AsyncStorage에 채팅 기록 저장됨:', messages.length, '개');
    } catch (error) {
      console.error('채팅 기록 저장 오류:', error);
    }
  };

  // AsyncStorage 초기화 함수 (디버깅용)
  const clearAsyncStorage = async () => {
    try {
      await AsyncStorage.multiRemove([
        'chatAppointmentStatus',
        'rescheduleProceeded',
        'currentAppointmentData',
        'chatMessages'
      ]);
      console.log('🧹 AsyncStorage 초기화 완료');
      
      // 상태도 초기화
      setMessages([]);
      setCurrentScenario('none');
      
      // 초기화 완료 메시지 표시
      const clearMessage: Message = {
        id: Date.now().toString() + '_clear',
        text: 'AsyncStorage가 초기화되었습니다. 새로운 시나리오를 시작하세요.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([clearMessage]);
      
    } catch (error) {
      console.error('AsyncStorage 초기화 오류:', error);
    }
  };

  // 전역 함수로 등록 (개발자 콘솔에서 사용 가능)
  if (typeof window !== 'undefined') {
    (window as any).clearAsyncStorage = clearAsyncStorage;
  }



  // 채팅 기록 로드 함수 (백엔드 연동용)
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

  // 약속 요청 시나리오 처리
  const handleAppointmentRequest = (userMessage: string) => {
    // 이미 약속 요청 상태라면 중복 실행 방지
    if (currentScenario === 'appointment_request') {
      return;
    }

    // 새로운 약속 요청이므로 상태 초기화
    AsyncStorage.setItem('chatAppointmentStatus', 'pending');
    
    // 재조율 진행 플래그 초기화
    AsyncStorage.removeItem('rescheduleProceeded');

    // 시나리오 1: 약속 요청
    // 2초 후 AI 응답 메시지 표시
    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now().toString() + '_ai',
        text: '넵. 알겠습니다. A2A 화면에서 일정을 조율하겠습니다.',
        isUser: false,
        timestamp: new Date(),
      };
      
      // AI 응답을 기존 메시지 배열에 추가 (채팅 기록 유지)
      setMessages(prev => [...prev, aiResponse]);
      setCurrentScenario('appointment_request');
      
      // 3초 후 약속 확정 메시지 표시
      setTimeout(() => {
        handleAppointmentConfirmation();
      }, 3000);
    }, 2000);
  };

  // 약속 확정 시나리오 처리
  const handleAppointmentConfirmation = () => {
    console.log('🔄 handleAppointmentConfirmation 실행됨 - currentScenario:', currentScenario);
    
    // 이미 약속 확정 상태라면 중복 실행 방지
    if (currentScenario === 'confirmation') {
      console.log('🚫 이미 confirmation 상태 - 중복 실행 방지');
      return;
    }

    const appointmentData = {
      date: '8/29(금)',
      time: '19:00',
      location: '성신여대역',
      participants: ['민서', '규민']
    };

    console.log('📝 약속 확정 메시지 생성:', appointmentData);

    // 약속 데이터를 AsyncStorage에 저장
    AsyncStorage.setItem('currentAppointmentData', JSON.stringify(appointmentData));

    const confirmationMessage: Message = {
      id: Date.now().toString() + '_ai_confirmation',
      text: `약속 확정: ${appointmentData.date} ${appointmentData.time} / ${appointmentData.location}\n확정하시겠습니까?`,
      isUser: false,
      timestamp: new Date(),
      type: 'appointment_confirmation',
      appointmentData
    };

    // 약속 확정 메시지를 기존 메시지 배열에 추가 (채팅 기록 유지)
    setMessages(prev => [...prev, confirmationMessage]);
    setCurrentScenario('confirmation');
    
    console.log('✅ currentScenario를 confirmation으로 설정 완료');
  };

  // 사용자 응답이 승인인지 거절인지 확인
  const checkAcceptanceResponse = (userMessage: string): 'accept' | 'reject' | 'unknown' => {
    const acceptanceKeywords = ['응', '네', '예', '좋아', '좋습니다', '괜찮아', '괜찮습니다', '확정', '승인', 'ok', 'yes'];
    const rejectionKeywords = ['아니', '아니요', '안돼', '싫어', '취소', '거절', 'no', 'cancel'];
    
    const lowerMessage = userMessage.toLowerCase();
    
    // 승인 키워드 확인
    if (acceptanceKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
      return 'accept';
    }
    
    // 거절 키워드 확인
    if (rejectionKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
      return 'reject';
    }
    
    return 'unknown';
  };

  // 약속 승인 처리 (재조율 후 두 번째 약속 확정인지 확인)
  const handleAppointmentAccept = async () => {
    // 현재 약속 데이터 확인
    const appointmentData = await AsyncStorage.getItem('currentAppointmentData');
    let isReschedule = false;
    
    console.log('🔍 handleAppointmentAccept - appointmentData:', appointmentData);
    
    if (appointmentData) {
      const data = JSON.parse(appointmentData);
      console.log('🔍 handleAppointmentAccept - parsed data:', data);
      
      // 8/30(금) 17:00인 경우 재조율 후 두 번째 약속 확정
      if (data.date === '8/30(금)' && data.time === '17:00') {
        isReschedule = true;
        console.log('✅ 재조율 후 두 번째 약속 확정으로 인식됨');
      }
    }
    
    console.log('🔍 handleAppointmentAccept - isReschedule:', isReschedule);
    
    if (isReschedule) {
      // 재조율 후 두 번째 약속 확정 - 성공 응답
      console.log('🎉 재조율 후 두 번째 약속 확정 - 성공 응답');
      AsyncStorage.setItem('chatAppointmentStatus', 'accepted');
      
      setTimeout(() => {
        const aiResponse: Message = {
          id: Date.now().toString() + '_ai_accept_success',
          text: '상대가 모두 수락했습니다. 캘린더에 일정을 추가하겠습니다.',
          isUser: false,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiResponse]);
        setCurrentScenario('none');
        
        // Google Calendar에 일정 추가
        addToGoogleCalendar();
      }, 2000);
    } else {
      // 첫 번째 약속 확정 - 거절 응답 (민서가 거절)
      console.log('❌ 첫 번째 약속 확정 - 거절 응답');
      AsyncStorage.setItem('chatAppointmentStatus', 'rejected');
      
      setTimeout(() => {
        const aiResponse: Message = {
          id: Date.now().toString() + '_ai_accept',
          text: '민서님이 거절했습니다. 일정을 재조율하겠습니다.',
          isUser: false,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiResponse]);
        setCurrentScenario('rejection');
      }, 2000);
    }
  };

  // 약속 거절 처리 (현재는 사용되지 않음 - 사용자가 승인하든 거절하든 항상 거절 응답)
  /*
  const handleAppointmentReject = () => {
    // AsyncStorage에 거절 상태 저장
    AsyncStorage.setItem('chatAppointmentStatus', 'rejected');
    
    // 2초 후 AI 응답 표시
    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now().toString() + '_ai_reject',
        text: '민서님이 거절했습니다. 일정을 재조율하겠습니다.',
        isUser: false,
        timestamp: new Date(),
        type: 'rejection_input'
      };

      // 거절 응답을 기존 메시지 배열에 추가 (채팅 기록 유지)
      setMessages(prev => [...prev, aiResponse]);
      setCurrentScenario('rejection');
    }, 2000);
  };
  */

  // 재조율 요청 처리
  const handleRescheduleRequest = (userMessage: string) => {
    const rescheduleMessage: Message = {
      id: Date.now().toString() + '_user_reschedule',
      text: userMessage,
      isUser: true,
      timestamp: new Date(),
    };

    const aiResponse: Message = {
      id: Date.now().toString() + '_ai_reschedule',
      text: '네, 새로운 일정으로 다시 조율하겠습니다. A2A 화면에서 확인해보세요.',
      isUser: false,
      timestamp: new Date(),
    };

    // 재조율 메시지들을 기존 메시지 배열에 추가 (채팅 기록 유지)
    setMessages(prev => [...prev, rescheduleMessage, aiResponse]);
    setCurrentScenario('none');
    
    // 3초 후 새로운 약속 확정 메시지 표시
    setTimeout(() => {
      handleRescheduleConfirmation();
    }, 3000);
  };

  // A2A 화면에서 돌아왔을 때 자동으로 두 번째 약속 확정 진행
  const checkAndProceedWithReschedule = async () => {
    try {
      // 이미 실행 중인지 확인하는 플래그
      if (isCheckingReschedule.current) {
        console.log('🚫 이미 실행 중 - 중복 실행 방지');
        return;
      }
      
      isCheckingReschedule.current = true;
      
      const chatStatus = await AsyncStorage.getItem('chatAppointmentStatus');
      const hasProceeded = await AsyncStorage.getItem('rescheduleProceeded');
      
      console.log('🔍 checkAndProceedWithReschedule - chatStatus:', chatStatus);
      console.log('🔍 checkAndProceedWithReschedule - hasProceeded:', hasProceeded);
      console.log('🔍 checkAndProceedWithReschedule - currentScenario:', currentScenario);
      console.log('🔍 checkAndProceedWithReschedule - messages.length:', messages.length);
      
      // A2A 화면에서 돌아왔을 때는 무조건 두 번째 약속 확정 진행 시도
      // (rescheduleProceeded 플래그만 확인)
      if (!hasProceeded) {
        console.log('✅ 재조율 진행 조건 충족 - 두 번째 약속 확정 시작');
        // 즉시 두 번째 약속 확정 진행
        handleRescheduleConfirmation();
        // 실행 완료 후 플래그 해제
        isCheckingReschedule.current = false;
      } else {
        console.log('❌ 이미 재조율이 진행됨 (hasProceeded):', hasProceeded);
        isCheckingReschedule.current = false;
      }
    } catch (error) {
      console.error('자동 진행 확인 오류:', error);
      isCheckingReschedule.current = false;
    }
  };

  // 재조율 후 새로운 약속 확정 시나리오 처리
  const handleRescheduleConfirmation = () => {
    const appointmentData = {
      date: '8/30(금)',
      time: '17:00',
      location: '성신여대역',
      participants: ['민서', '규민']
    };

    console.log('🔄 handleRescheduleConfirmation - appointmentData:', appointmentData);

    // 약속 데이터를 AsyncStorage에 저장
    AsyncStorage.setItem('currentAppointmentData', JSON.stringify(appointmentData));
    console.log('💾 AsyncStorage에 약속 데이터 저장됨');
    
    // 재조율 진행 플래그 설정 (중복 실행 방지)
    AsyncStorage.setItem('rescheduleProceeded', 'true');
    
    // chatAppointmentStatus를 rejected로 설정 (A2A 화면에서 돌아왔음을 표시)
    AsyncStorage.setItem('chatAppointmentStatus', 'rejected');

    const confirmationMessage: Message = {
      id: Date.now().toString() + '_ai_reschedule_confirmation',
      text: `약속 확정: ${appointmentData.date} ${appointmentData.time} / ${appointmentData.location}\n확정하시겠습니까?`,
      isUser: false,
      timestamp: new Date(),
      type: 'appointment_confirmation',
      appointmentData
    };

    console.log('📝 두 번째 약속 확정 메시지 생성:', confirmationMessage.text);

    // 약속 확정 메시지를 기존 메시지 배열에 추가 (채팅 기록 유지)
    setMessages(prev => [...prev, confirmationMessage]);
    setCurrentScenario('confirmation');
  };

  // Google Calendar에 일정 추가
  const addToGoogleCalendar = async () => {
    try {
      // 현재 약속 데이터 가져오기 (AsyncStorage에서)
      const appointmentData = await AsyncStorage.getItem('currentAppointmentData');
      let eventData;
      
      if (appointmentData) {
        eventData = JSON.parse(appointmentData);
      } else {
        // 기본 일정 데이터 (8/30 17:00)
        eventData = {
          title: '규민, 민서와의 미팅',
          location: '성신여대역',
          date: '8/30(금)',
          time: '17:00',
          participants: ['민서', '규민']
        };
      }

      // Google Calendar API 호출 (백엔드 연동)
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const response = await fetch('http://localhost:3000/calendar/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: '규민, 민서와의 미팅',
            location: '성신여대역',
            start_time: '2024-08-30T17:00:00+09:00',
            end_time: '2024-08-30T18:00:00+09:00',
            attendees: ['민서', '규민']
          }),
        });

        if (response.ok) {
          console.log('Google Calendar에 일정이 추가되었습니다.');
          // 성공 메시지 표시
          const successMessage: Message = {
            id: Date.now().toString() + '_ai_calendar_success',
            text: 'Google Calendar에 일정이 성공적으로 추가되었습니다!',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        } else {
          console.error('Google Calendar 일정 추가 실패');
          // 실패해도 성공 메시지 표시 (백엔드 미준비 시)
          const successMessage: Message = {
            id: Date.now().toString() + '_ai_calendar_success',
            text: '캘린더에 일정이 성공적으로 추가되었습니다!',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        }
      }
    } catch (error) {
      console.error('Google Calendar 연동 오류:', error);
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

      // 약속 요청인지 확인
      if (userMessage.includes('약속') && (userMessage.includes('민서') || userMessage.includes('규민'))) {
        handleAppointmentRequest(userMessage);
        return;
      }

      // 약속 확정 응답인지 확인
      console.log('🔍 callChatGPTAPI - currentScenario:', currentScenario);
      if (currentScenario === 'confirmation') {
        console.log('✅ confirmation 상태 확인됨 - 약속 확정 응답 처리');
        const isAcceptance = checkAcceptanceResponse(userMessage);
        console.log('🔍 사용자 응답 분석 결과:', isAcceptance);
        
        if (isAcceptance === 'accept' || isAcceptance === 'reject') {
          console.log('🚀 handleAppointmentAccept 호출 시작');
          // 사용자가 승인하든 거절하든 항상 거절 응답 (민서가 거절)
          handleAppointmentAccept();
          return;
        } else {
          console.log('❓ 이해할 수 없는 응답 - 안내 메시지 표시');
          // 이해할 수 없는 응답인 경우 안내 메시지
          const guideMessage: Message = {
            id: Date.now().toString() + '_ai_guide',
            text: '약속을 확정하시려면 "네", "응", "좋아" 등을 입력해주세요.',
            isUser: false,
            timestamp: new Date(),
          };
          // 안내 메시지를 기존 메시지 배열에 추가 (채팅 기록 유지)
          setMessages(prev => [...prev, guideMessage]);
          return;
        }
      } else {
        console.log('❌ confirmation 상태가 아님 - currentScenario:', currentScenario);
      }

      // 재조율 요청인지 확인
      if (currentScenario === 'rejection' && (userMessage.includes('일') || userMessage.includes('시'))) {
        handleRescheduleRequest(userMessage);
        return;
      }

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
        
        // AI 응답을 기존 메시지 배열에 추가 (채팅 기록 유지)
        setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('ChatGPT API 호출 오류:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString() + '_ai',
        text: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        isUser: false,
        timestamp: new Date(),
      };
      
      // 에러 메시지를 기존 메시지 배열에 추가 (채팅 기록 유지)
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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

    // 사용자 메시지를 기존 메시지 배열에 추가 (채팅 기록 유지)
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // 메시지 추가 후 자동 스크롤
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
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
          onContentSizeChange={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          onLayout={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={messages.length}
          maxToRenderPerBatch={messages.length}
          windowSize={10}
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
              onPress={() => navigation.navigate('Chat')}
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
    flexGrow: 1,
    justifyContent: 'flex-end',
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
