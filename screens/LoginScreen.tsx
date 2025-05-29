import React, {useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
// import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {makeRedirectUri, ResponseType} from "expo-auth-session";
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
// import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

// const BACKEND_URL = Platform.OS === 'web'
//     ? 'http://localhost:3000' // ← PC IP 주소로 변경

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
};

const redirectUri = 'https://auth.expo.io/@whtndus/frontend';

export default function LoginScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest(
      {
        clientId: '842065249237-52la75vprit1aqgoku97t8d76ps5ug0f.apps.googleusercontent.com', // 구글 클라이언트 ID
        // iosClientId: '842065249237-14tunhbsetl55us6v7cnrsrgu6e3ijb6.apps.googleusercontent.com',
        responseType: ResponseType.IdToken,
        scopes: ['openid', 'profile', 'email'],
        // usePKCE: false, // Google OAuth에서는 PKCE 비활성화
        redirectUri : makeRedirectUri({useProxy:true}),

      },
      // discovery
  );
  console.log('✅ Redirect URI:',AuthSession.makeRedirectUri());

  // const { setUserId } = useAuth();

  useEffect(() => {
    const handleLogin = async () => {
      if (response?.type !== 'success') return;
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (!idToken) return;

      try {
        const API_URL = process.env.EXPO_CLIENT_ID;
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: idToken }),
        });
        const data = await res.json();
        console.log('서버 응답:', data);

        if (data.user && data.user.id) {
          const userInfo = {
            id: data.user.id,
            email: data.user.email,
            nickname: data.user.nickname ?? data.user.name ?? '사용자',
          };
          await AsyncStorage.setItem('user', JSON.stringify(userInfo));
          await AsyncStorage.setItem('idToken', idToken);

          console.log('✅ 로그인 성공. userId 저장:', userInfo.id);
          // 페이지 이동
          router.push('/select');
        } else {
          Alert.alert('로그인 실패', JSON.stringify(data));
        }
      } catch (err) {
        console.log('서버 연결 실패:', err);
        Alert.alert('서버 연결 실패', err.message);
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

      <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} disabled={!request}>
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
};

// export default LoginScreen;

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
