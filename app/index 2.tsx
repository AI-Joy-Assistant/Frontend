import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

export default function Index() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <Text style={{ color: '#fff' }}>스플래시 화면입니다</Text>
    </View>
  );
} 