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
    id: string;
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
          console.log('=== MY_PAGE_DEBUG ===');
          console.log('전체 사용자 데이터:', userData);
          console.log('프로필 이미지 URL:', userData.profile_image);
          console.log('이름:', userData.name);
          console.log('이메일:', userData.email);
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

      if (!newNickname.trim()) {
        Alert.alert('오류', '닉네임을 입력해주세요.');
        return;
      }

      const response = await fetch('http://localhost:3000/auth/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newNickname.trim() }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUserInfo(prev => prev ? { ...prev, name: newNickname.trim() } : null);
        setNickname(newNickname.trim());
        setNicknameModalVisible(false);
        setNewNickname('');
        Alert.alert('성공', '닉네임이 업데이트되었습니다.');
      } else {
        const errorData = await response.json();
        Alert.alert('오류', errorData.detail || '닉네임 업데이트 실패');
      }
    } catch (error) {
      console.error('닉네임 업데이트 오류:', error);
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
        const errorData = await response.json();
        Alert.alert('오류', errorData.detail || '탈퇴 실패');
      }
    } catch (error) {
      console.error('탈퇴 오류:', error);
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>마이페이지</Text>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Image 
            source={{ 
              uri: userInfo.profile_image ? `http://localhost:3000/auth/profile-image/${userInfo.id}` : undefined,
              cache: 'force-cache'
            }} 
            style={styles.profileImage}
            resizeMode="cover"
            onLoad={() => console.log('=== IMAGE_SUCCESS === 프로필 이미지 로드 성공:', userInfo.profile_image)}
            onError={(error) => {
              console.log('=== IMAGE_ERROR === 프로필 이미지 로드 실패:', error.nativeEvent.error);
              console.log('=== IMAGE_ERROR === 시도한 URL:', userInfo.profile_image);
            }}
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
            <Ionicons name="trash" size={24} color="#EF4444" />
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
              탈퇴 시 데이터가 삭제되며 복구할 수 없습니다.
            </Text>
            <Text style={[styles.modalMessage, styles.secondMessage]}>
              정말 탈퇴하시겠습니까?
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
    height: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  header: {
    backgroundColor: '#0F111A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
    height: 60,
  },
  backButton: {
    padding: 10,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  profileImage: {
    width: 135,
    height: 135,
    borderRadius: 67.5,
    marginBottom: 10,
  },
  defaultAvatar: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: 'white',
    fontSize: 50,
    fontWeight: 'bold',
  },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  nickname: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
  },
  menuSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 7,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '40%',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  deleteText: {
    color: '#EF4444',
  },
  loadingText: {
    color: '#fff',
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
    width: 350,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 25,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 30,
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 7,
    width: '40%',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 7,
    width: '40%',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalMessage: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 5,
  },
  secondMessage: {
    marginTop: -5,
    marginBottom: 30,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#0F111A',
    borderTopColor: '#374151',
    borderTopWidth: 2,
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
  debugText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 5,
  },
});
