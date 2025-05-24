import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLoginPress = () => {
    console.log('🔐 로그인 링크 눌림!');
    navigation.navigate('LoginDetailScreen');
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

      <TouchableOpacity style={styles.socialButton}>
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
        <Text style={styles.link} onPress={handleLoginPress}>
          로그인하기
        </Text>
      </Text>
    </View>
  );
};

export default LoginScreen;

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
