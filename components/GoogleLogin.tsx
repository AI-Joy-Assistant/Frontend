import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GoogleLoginProps {
  onLoginSuccess: (token: string) => void;
  onLoginError: (error: string) => void;
}

export default function GoogleLogin({ onLoginSuccess, onLoginError }: GoogleLoginProps) {
  useEffect(() => {
    // URL 파라미터에서 토큰 확인 (OAuth 콜백 후)
    const checkUrlParams = async () => {
      try {
        const url = await WebBrowser.getRedirectUrl();
        if (url) {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const error = urlObj.searchParams.get('error');
          
          if (token) {
            await AsyncStorage.setItem('access_token', token);
            onLoginSuccess(token);
          } else if (error) {
            onLoginError(error);
          }
        }
      } catch (error) {
        console.log('URL 파라미터 확인 중 오류:', error);
      }
    };

    checkUrlParams();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      // 백엔드 서버가 실행되지 않을 경우를 대비한 테스트
      console.log('🔗 Google 로그인 시도...');
      
      // 백엔드 서버 상태 확인
      try {
        const response = await fetch('http://localhost:8000/');
        console.log('✅ 백엔드 서버 연결 성공');
      } catch (error) {
        console.log('❌ 백엔드 서버 연결 실패:', error);
        // 백엔드 서버가 없을 때 임시 로그인 처리
        const mockToken = 'mock-jwt-token-' + Date.now();
        await AsyncStorage.setItem('access_token', mockToken);
        onLoginSuccess(mockToken);
        return;
      }
      
      // 백엔드의 Google OAuth URL로 리다이렉트
      const authUrl = 'http://localhost:8000/auth/google';
      
      console.log('🔗 Google OAuth URL:', authUrl);
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'http://localhost:8081' // 리다이렉트 URL
      );

      if (result.type === 'success') {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        const error = url.searchParams.get('error');
        
        if (token) {
          await AsyncStorage.setItem('access_token', token);
          onLoginSuccess(token);
        } else if (error) {
          onLoginError(error);
        }
      } else if (result.type === 'cancel') {
        console.log('Google 로그인이 취소되었습니다.');
      }
    } catch (error) {
      console.error('Google 로그인 오류:', error);
      onLoginError('Google 로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
      <Ionicons name="logo-google" size={24} color="#fff" />
      <Text style={styles.googleButtonText}>Google로 로그인</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 10,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 