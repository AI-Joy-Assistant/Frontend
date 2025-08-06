import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GoogleLogin from '../components/GoogleLogin';

export default function Login() {
  const handleLoginSuccess = async (token: string) => {
    try {
      // 토큰 저장
      await AsyncStorage.setItem('access_token', token);
      
      console.log('✅ Google 로그인 성공');
      
      // 메인 화면으로 이동 (홈 탭)
      router.replace('/(tabs) 2/');
    } catch (error) {
      console.error('로그인 성공 처리 오류:', error);
      Alert.alert('오류', '로그인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleLoginError = (error: string) => {
    console.error('Google 로그인 오류:', error);
    Alert.alert('로그인 실패', error);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>
        AI assistant가 여러분의{'\n'}편안한 일상을 위해 도와드릴게요
      </Text>

      <TouchableOpacity 
        style={styles.emailButton}
        onPress={() => {
          // 테스트용: 로그인 없이 홈 화면으로 이동
          router.replace('/(tabs) 2/');
        }}
      >
        <Ionicons name="mail-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.emailText}>테스트: 홈 화면으로 이동</Text>
      </TouchableOpacity>

      <GoogleLogin 
        onLoginSuccess={handleLoginSuccess}
        onLoginError={handleLoginError}
      />

      <TouchableOpacity style={styles.socialButton}>
        <Image
          source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' }}
          style={styles.icon}
        />
        <Text style={styles.socialText}>Sign With Apple</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        가입된 계정이 있나요?{' '}
        <Text style={styles.link}>
          로그인하기
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 32,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3C4A64',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emailText: {
    color: '#fff',
    fontSize: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#3C4A64',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  socialText: {
    color: '#fff',
    fontSize: 16,
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  footer: {
    color: '#aaa',
    marginTop: 24,
    fontSize: 13,
  },
  link: {
    color: '#4D6FFF',
  },
}); 