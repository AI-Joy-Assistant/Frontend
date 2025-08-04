import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="main"
        options={{
          title: '홈',
        }}
      />
    </Tabs>
  );
} 