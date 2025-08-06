import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>User Screen</Text>
        <Text style={styles.subtitle}>This is the User tab</Text>
        <Text style={styles.text}>Minseo Cho</Text>
        <Text style={styles.text}>backto1115@gmail.com</Text>
        <Text style={styles.text}>챗봇이름: amycms님의 JOY</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222023',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 30,
  },
  text: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },
}); 