import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MyPageScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    profile_image?: string;
  } | null>(null);
  const [nickname, setNickname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);

  // 사용자 정보 불러오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) {
          Alert.alert('오류', '로그인이 필요합니다.');
          navigation.navigate('Login');
          return;
        }

        // 백엔드에서 사용자 정보 가져오기
        const response = await fetch('http://localhost:3000/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUserInfo(userData);
          setNickname(userData.name || '');
        } else {
          Alert.alert('오류', '사용자 정보를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error('사용자 정보 조회 오류:', error);
        Alert.alert('오류', '사용자 정보를 불러오지 못했습니다.');
      }
    };

    fetchUserInfo();
  }, [navigation]);

  // 닉네임 수정
  const handleNicknameUpdate = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch('http://localhost:3000/auth/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newNickname }),
      });

      if (response.ok) {
        setNickname(newNickname);
        setNicknameModalVisible(false);
        setNewNickname('');
        Alert.alert('성공', '닉네임이 업데이트되었습니다.');
      } else {
        Alert.alert('오류', '닉네임 업데이트 실패');
      }
    } catch (error) {
      Alert.alert('오류', '닉네임 업데이트 실패');
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('accessToken');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      console.error('로그아웃 오류:', error);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  // 탈퇴
  const handleWithdraw = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch('http://localhost:3000/auth/me', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await AsyncStorage.removeItem('accessToken');
        Alert.alert('탈퇴 완료', '정상적으로 탈퇴되었습니다.');
        setWithdrawModalVisible(false);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else {
        Alert.alert('오류', '탈퇴 실패');
      }
    } catch (error) {
      Alert.alert('오류', '탈퇴 실패');
    }
  };

  if (!userInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>마이페이지</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.profileSection}>
          <Image 
            source={{ uri: userInfo.profile_image || 'https://via.placeholder.com/100' }} 
            style={styles.profileImage} 
          />
          <Text style={styles.name}>{userInfo.name}</Text>
          <Text style={styles.email}>{userInfo.email}</Text>
          <Text style={styles.nickname}>챗봇이름: {nickname}님의 JOY</Text>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setNicknameModalVisible(true)}
          >
            <Ionicons name="person" size={24} color="white" />
            <Text style={styles.menuText}>닉네임 변경</Text>
            <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="white" />
            <Text style={styles.menuText}>로그아웃</Text>
            <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <Ionicons name="trash" size={24} color="#e74c3c" />
            <Text style={[styles.menuText, styles.deleteText]}>회원탈퇴</Text>
            <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 닉네임 변경 모달 */}
      <Modal
        visible={nicknameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNicknameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>닉네임 변경</Text>
            <TextInput
              style={styles.input}
              placeholder="새 닉네임을 입력하세요"
              value={newNickname}
              onChangeText={setNewNickname}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setNicknameModalVisible(false);
                  setNewNickname('');
                }}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleNicknameUpdate}
              >
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 탈퇴 확인 모달 */}
      <Modal
        visible={withdrawModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>회원탈퇴</Text>
            <Text style={styles.modalMessage}>
              정말로 탈퇴하시겠습니까? 탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setWithdrawModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleWithdraw}
              >
                <Text style={styles.confirmButtonText}>탈퇴</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 하단 탭바 */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="home" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Chat')}
        >
          <Ionicons name="chatbubble" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Friends')}
        >
          <Ionicons name="people" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>A2A</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <Ionicons name="person-circle" size={24} color="#3B82F6" />
          <Text style={[styles.navText, styles.activeNavText]}>User</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default MyPageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 135,
    height: 135,
    borderRadius: 67.5,
    marginBottom: 10,
  },
  name: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  nickname: {
    color: 'white',
    fontSize: 14,
    marginBottom: 24,
  },
  menuSection: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 7,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  menuText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  deleteText: {
    color: '#e74c3c',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 300,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 15,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 7,
    width: '40%',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 7,
    width: '40%',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalMessage: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#0F111A',
    borderTopColor: '#374151',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavItem: {
    // 활성 상태 스타일
  },
  navText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  activeNavText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});
