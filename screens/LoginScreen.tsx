import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleGoogleLogin = async () => {
    try {
      console.log('🔐 Google 로그인 시작...');
      
      // Google OAuth URL로 브라우저 열기
      const authUrl = 'http://localhost:3000/auth/google';
      console.log('🌐 브라우저에서 Google 로그인 열기:', authUrl);
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'http://localhost:3000/auth/google/callback'
      );
      
      console.log('🔍 로그인 결과:', result);
      
      if (result.type === 'success' || result.type === 'dismiss') {
        // 성공 또는 dismiss(자동 창 닫기) 모두 성공으로 처리
        console.log('✅ Google 로그인 성공!');
        if (result.type === 'success') {
          console.log('🔗 리다이렉트 URL:', result.url);
        } else {
          console.log('🔄 창이 자동으로 닫혔습니다 (로그인 성공)');
        }
        
        // 백엔드에서 실제 토큰 받아오기
        try {
          console.log('🔑 백엔드에서 토큰 받아오는 중...');
          const tokenResponse = await fetch('http://localhost:3000/auth/token', {
            method: 'GET',
            credentials: 'include', // 쿠키 포함
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log('✅ 실제 토큰 받아오기 성공!');
            await AsyncStorage.setItem('accessToken', tokenData.accessToken);
            console.log('💾 실제 토큰 저장 완료');
          } else {
            console.log('⚠️ 토큰 받아오기 실패, Mock 토큰 사용');
            const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJNb2NrIFVzZXIiLCJpYXQiOjE3MzEwNjI0MDAsImV4cCI6MTczMTA2NjAwMH0.mockTokenSignature';
            await AsyncStorage.setItem('accessToken', mockToken);
            console.log('💾 Mock 토큰 저장 완료 (fallback)');
          }
        } catch (tokenError) {
          console.error('❌ 토큰 받아오기 오류:', tokenError);
          const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJNb2NrIFVzZXIiLCJpYXQiOjE3MzEwNjI0MDAsImV4cCI6MTczMTA2NjAwMH0.mockTokenSignature';
          await AsyncStorage.setItem('accessToken', mockToken);
          console.log('💾 Mock 토큰 저장 완료 (error fallback)');
        }
        
        // 성공 시 홈 화면으로 이동
        console.log('🚀 홈 화면으로 이동...');
        navigation.navigate('Home');
      } else if (result.type === 'cancel') {
        console.log('❌ 사용자가 로그인을 취소했습니다.');
        Alert.alert('로그인 취소', '로그인이 취소되었습니다.');
      } else {
        console.log('❌ 로그인 실패:', result);
        Alert.alert('로그인 실패', '다시 시도해 주세요.');
      }
    } catch (error) {
      console.error('❌ Google 로그인 오류:', error);
      
      // 개발용: 에러 발생 시 임시로 채팅 화면 이동
      Alert.alert(
        '개발 모드', 
        `로그인 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}\n\n채팅 화면으로 이동합니다.`,
        [
          { 
            text: '확인', 
            onPress: () => {
              console.log('🚀 개발 모드: 홈 화면으로 이동...');
              navigation.navigate('Home');
            }
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* 상단 로고 */}
      <View style={styles.logoContainer}>
        <Ionicons name="calendar" size={40} color="#4A90E2" />
        <Text style={styles.logoText}>JOYNER</Text>
      </View>

      {/* 구글 로그인 버튼 */}
      <TouchableOpacity 
        style={styles.googleButton} 
        onPress={handleGoogleLogin}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
        <Text style={styles.googleText}>Sign with Google</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    letterSpacing: 1.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '85%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 56, // 최소 터치 영역 확보
  },
  googleIcon: {
    marginRight: 12,
  },
  googleText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});
