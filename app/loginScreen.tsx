import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
  scheme: 'frontend',
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
        await AsyncStorage.setItem('accessToken', data.data.tokens.accessToken);
        await AsyncStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.data.user));
        router.replace('/main');
      } else {
        console.error('로그인 실패:', data.message);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Image
        source={require('../assets/logo_ver4.png')}
        style={styles.character}
        resizeMode="contain"
      />
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => promptAsync()}
        disabled={!request}
        activeOpacity={0.8}
      >
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101522',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 140,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFE082',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  speechBubble: {
    backgroundColor: '#284B63',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 24,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  speechText: {
    color: '#FFE082',
    fontSize: 18,
    fontWeight: '600',
  },
  character: {
    width: 300,
    height: 300,
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: '#F47C3C',
    borderRadius: 18,
    paddingHorizontal: 36,
    paddingVertical: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  googleButtonText: {
    color: '#FFE082',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});