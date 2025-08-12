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
            
            // 성공 시 홈 화면으로 이동
            console.log('🚀 홈 화면으로 이동...');
            navigation.navigate('Home');
          } else {
            console.log('❌ 토큰 받아오기 실패:', tokenResponse.status);
            throw new Error(`토큰 받아오기 실패: ${tokenResponse.status}`);
          }
        } catch (tokenError) {
          console.error('❌ 토큰 받아오기 오류:', tokenError);
          Alert.alert('로그인 실패', '토큰을 받아오는데 실패했습니다. 다시 시도해 주세요.');
          return;
        }
      } else if (result.type === 'cancel') {
        console.log('❌ 사용자가 로그인을 취소했습니다.');
        Alert.alert('로그인 취소', '로그인이 취소되었습니다.');
      } else {
        console.log('❌ 로그인 실패:', result);
        Alert.alert('로그인 실패', '다시 시도해 주세요.');
      }
    } catch (error) {
      console.error('❌ Google 로그인 오류:', error);
      Alert.alert('로그인 실패', '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <View style={styles.container}>
      {/* 상단 로고 */}
      <View style={styles.logoContainer}>
        <Ionicons name="calendar" size={60} color="#4A90E2" />
        <Text style={styles.logoText}>JOYNER</Text>
      </View>

      {/* 구글 로그인 버튼 */}
      <TouchableOpacity 
        style={styles.googleButton} 
        onPress={handleGoogleLogin}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={24} color="#4A90E2" style={styles.googleIcon} />
        <Text style={styles.googleText}>Sign with Google</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    letterSpacing: 1.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '65%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 48,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleText: {
    color: '#0F111A',
    fontSize: 18,
    fontWeight: '500',
  },
});
