import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';

type AuthCallbackScreenRouteProp = {
  params: {
    token?: string;
    name?: string;
    email?: string;
    picture?: string;
    error?: string;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AuthCallbackScreen = () => {
  const route = useRoute<AuthCallbackScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 AuthCallback 처리 시작...');
        console.log('📋 받은 파라미터:', route.params);

        const { token, name, email, picture, error } = route.params;

        if (error) {
          console.error('❌ 로그인 에러:', error);
          navigation.replace('Login');
          return;
        }

        if (token && name && email) {
          // 사용자 정보를 AsyncStorage에 저장
          await AsyncStorage.setItem('accessToken', token);
          await AsyncStorage.setItem('userName', name);
          await AsyncStorage.setItem('userEmail', email);
          await AsyncStorage.setItem('userPicture', picture || '');
          
          console.log('💾 사용자 정보 저장 완료');
          console.log('👤 사용자 정보:', { name, email, picture });
          
          // MainTabs로 이동
          console.log('🚀 MainTabs로 이동 시작...');
          navigation.replace('MainTabs');
          console.log('✅ MainTabs로 이동 완료');
        } else {
          console.log('⚠️ 필수 정보 누락');
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('❌ AuthCallback 처리 오류:', error);
        navigation.replace('Login');
      }
    };

    handleAuthCallback();
  }, [route.params, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.text}>로그인 처리 중...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: 'white',
  },
});

export default AuthCallbackScreen; 