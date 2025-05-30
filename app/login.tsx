import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
    scheme: 'frontend',
    // useProxy: Platform.select({ web: false, default: true }), // 제거
    // native: 'your.app://redirect' (필요시)
  });

console.log('redirectUri:', redirectUri);

export default function Login() {
  const [userInfo, setUserInfo] = useState(null);
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.webClientId,
    iosClientId: Constants.expoConfig?.extra?.EXPO_CLIENT_ID,
    androidClientId: Constants.expoConfig?.extra?.EXPO_CLIENT_ID,
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
  });
  console.log('response(바깥):', response);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (idToken) {
        handleSignInWithGoogle(idToken);
      }
    }
  }, [response]);
  

  const handleSignInWithGoogle = async (token: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${Constants.expoConfig?.extra?.API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 토큰 저장
        await AsyncStorage.setItem('accessToken', data.data.tokens.accessToken);
        await AsyncStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        
        // 사용자 정보 저장
        await AsyncStorage.setItem('user', JSON.stringify(data.data.user));
        
        // 메인 페이지로 이동
        router.replace('/main');
      } else {
        console.error('로그인 실패:', data.message);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
    }
  };

  const handleGoogleLogin = () => {
    promptAsync();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Joy Assistant</Text>
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <Text style={styles.buttonText}>Google로 로그인</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F111A',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});