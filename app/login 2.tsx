import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri, ResponseType } from "expo-auth-session";
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      responseType: ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: makeRedirectUri({
        scheme: 'frontend'
      }),
    }
  );

  useEffect(() => {
    const handleLogin = async () => {
      if (response?.type !== 'success') return;
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (!idToken) return;

      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/google`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ token: idToken }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || '인증 처리 중 오류가 발생했습니다.');
        }

        if (data.success && data.data) {
          const { user, tokens } = data.data;
          
          const userInfo = {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture
          };

          // 토큰 저장
          await AsyncStorage.setItem('accessToken', tokens.accessToken);
          await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
          await AsyncStorage.setItem('user', JSON.stringify(userInfo));

          console.log('✅ 로그인 성공. 사용자 정보 저장:', userInfo);
          
          // 페이지 이동
          router.replace('/(tabs)/main');
        } else {
          throw new Error('서버 응답 형식이 올바르지 않습니다.');
        }
      } catch (error: any) {
        console.error('로그인 오류:', error);
        Alert.alert(
          '로그인 실패',
          error.message || '인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
        );
      }
    };

    handleLogin();
  }, [response]);

  const handleGoogleLogin = () => {
    promptAsync();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>
        AI assistant가 여러분의{'\n'}편안한 일상을 위해 도와드릴게요
      </Text>

      <TouchableOpacity style={styles.emailButton}>
        <Ionicons name="mail-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.emailText}>Sign Up With Email</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.socialButton} 
        onPress={handleGoogleLogin} 
        disabled={!request}
      >
        <Image
          source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }}
          style={styles.icon}
        />
        <Text style={styles.socialText}>Sign with Google</Text>
      </TouchableOpacity>

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