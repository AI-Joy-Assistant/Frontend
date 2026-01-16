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
import ScreenTutorialOverlay from './components/ScreenTutorialOverlay';

import { Platform } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        :focus { outline: none !important; }
        input, textarea, select, div, button { outline: none !important; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <TutorialProvider>
      <NavigationContainer
        linking={{
          prefixes: ['frontend://', 'exp://'],
          config: {
            screens: {
              Login: 'auth-success',
              Home: 'home',
              // ... other screens
            },
          },
        }}
      >
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
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
        <ScreenTutorialOverlay />
      </NavigationContainer>
    </TutorialProvider>
  );
}
