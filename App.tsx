import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import * as Linking from 'expo-linking';

import A2AScreen from './screens/A2AScreen';
import ChatScreen from './screens/ChatScreen';
import FriendsScreen from './screens/FriendsScreen';
import HomeScreen from './screens/HomeScreen';
import LoginDetailScreen from './screens/LoginDetailScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TermsAgreementScreen from './screens/TermsAgreementScreen';
import MyPageScreen from './screens/MyPageScreen';
import SplashScreen from './screens/SplashScreen';
import TestScreen from './screens/TestScreen';
import RequestMeetingScreen from './screens/RequestMeetingScreen';
import A2AChatDetailScreen from './screens/A2AChatDetailScreen';
import { RootStackParamList } from './types';
import { TutorialProvider } from './store/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Platform } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // 기존 focus outline 제거 스타일
      const style = document.createElement('style');
      style.textContent = `
        :focus { outline: none !important; }
        input, textarea, select, div, button { outline: none !important; }
      `;
      document.head.appendChild(style);

      // global.css 로드 (Safe Area 지원)
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/global.css';
      document.head.appendChild(link);

      // HTML lang 속성을 한국어로 설정 (브라우저 번역 팝업 방지)
      document.documentElement.lang = 'ko';

      // viewport meta 태그 업데이트 (Safe Area 지원)
      let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
      if (viewportMeta) {
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      } else {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(viewportMeta);
      }

      // 모바일 브라우저 viewport height 버그 수정
      // 주소창이 나타나고 사라질 때 100vh가 변경되는 문제 해결
      const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      setVh();
      window.addEventListener('resize', setVh);
      window.addEventListener('orientationchange', setVh);

      return () => {
        window.removeEventListener('resize', setVh);
        window.removeEventListener('orientationchange', setVh);
      };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <TutorialProvider>
        <NavigationContainer
          linking={{
            prefixes: [
              'frontend://',
              'exp://',
              'https://joyner.co.kr',
              'https://www.joyner.co.kr',
              'http://localhost:8081',
            ],
            config: {
              screens: {
                Login: 'auth-success',
                TermsAgreement: 'TermsAgreement',
                Home: 'home',
                // ... other screens
              },
            },
          }}
        >
          <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="TermsAgreement" component={TermsAgreementScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="LoginDetailScreen" component={LoginDetailScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="A2A" component={A2AScreen} />
            <Stack.Screen name="User" component={MyPageScreen} />
            <Stack.Screen name="MyPage" component={MyPageScreen} />
            <Stack.Screen name="Test" component={TestScreen} />
            <Stack.Screen name="RequestMeeting" component={RequestMeetingScreen} />
            <Stack.Screen
              name="A2AChatDetail"
              component={A2AChatDetailScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
          <TutorialOverlay />
        </NavigationContainer>
      </TutorialProvider>
    </SafeAreaProvider>
  );
}
