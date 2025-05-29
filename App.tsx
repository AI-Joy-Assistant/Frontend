import React, {useEffect} from 'react';
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import LoginDetailScreen from './screens/LoginDetailScreen';
import { RootStackParamList } from './types';
import {Linking} from "react-native";
import MainScreen from "@/screens/MainScreen"; // ✅ 타입은 여기서 가져옴
import { navigationRef } from './navigationRef';
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
    // const navigation = useNavigation();
    useEffect(() => {
        const handleDeepLink = (event:{ url: string }) => {
            const { url } = event;
            console.log('📡 딥링크 감지:', url);

            const parsed = new URL(url);
            const accessToken = parsed.searchParams.get('accessToken');
            const name = parsed.searchParams.get('name');

            if (accessToken) {
                // 🔑 accessToken 저장 로직 (예: AsyncStorage)
                console.log('✅ 로그인 성공! accessToken:', accessToken, 'name:', name);

                // 로그인 완료 후 메인 화면으로 이동
                navigationRef.navigate("Main"); // Main 페이지 이름에 맞게 수정
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        return () => subscription.remove();
    }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="LoginDetailScreen" component={LoginDetailScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
