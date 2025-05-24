import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LoginDetailScreen = () => {
  const [email, setEmail] = useState('backooo@gmail.com'); // 기본값
  const [password, setPassword] = useState('password123');
  const [secureEntry, setSecureEntry] = useState(true);

  const toggleSecureEntry = () => {
    setSecureEntry(!secureEntry);
  };

  const handleLogin = () => {
    console.log('📥 로그인 시도:', email, password);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.subtitle}>원활한 이용을 위해 로그인 해주세요</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color="#aaa" />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          placeholderTextColor="#666"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#aaa" />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          placeholderTextColor="#666"
          secureTextEntry={secureEntry}
        />
        <TouchableOpacity onPress={toggleSecureEntry}>
          <Ionicons name={secureEntry ? 'eye-off' : 'eye'} size={20} color="#aaa" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity>
        <Text style={styles.forgot}>비밀번호를 잊으셨나요?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginText}>로그인하기</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.socialButton}>
        <Image
          source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }}
          style={styles.icon}
        />
        <Text style={styles.socialText}>Sign With Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.socialButton}>
        <Image
          source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' }}
          style={styles.icon}
        />
        <Text style={styles.socialText}>Sign With Apple</Text>
      </TouchableOpacity>

      <Text style={styles.or}>Or</Text>
      <Text style={styles.footer}>
        가입된 계정이 없으신가요? <Text style={styles.link}>가입하기</Text>
      </Text>
    </View>
  );
};

export default LoginDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    backgroundColor: '#1E2230',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    height: 56,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
    marginLeft: 8,
  },
  forgot: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#4D6FFF',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  or: {
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    color: '#aaa',
    textAlign: 'center',
    fontSize: 13,
  },
  link: {
    color: '#4D6FFF',
  },
});