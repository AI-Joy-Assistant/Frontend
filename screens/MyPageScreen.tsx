import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, Alert, ScrollView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, Settings, LogOut, Trash2, ChevronRight, User as UserIcon } from 'lucide-react-native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Colors from FriendsScreen.tsx for consistency
const COLORS = {
  primaryMain: '#3730A3',
  primaryLight: '#818CF8',
  primaryDark: '#0E004E',
  primaryBg: '#EEF2FF',

  neutralSlate: '#334155',
  neutralGray: '#CBD5E1',
  neutralLight: '#F8FAFC',

  neutral100: '#F1F5F9',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',

  white: '#FFFFFF',
  red400: '#F87171',
  red50: '#FEF2F2',
  green500: '#22C55E',
};

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
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);

  // 사용자 정보 불러오기
  const fetchUserInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        navigation.navigate('Login');
        return;
      }

      // 백엔드에서 사용자 정보 가져오기
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
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

  useEffect(() => {
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

      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
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

        // 사용자 정보 다시 불러오기
        await fetchUserInfo();
      } else {
        const errorData = await response.json();
        Alert.alert('오류', errorData.detail || '닉네임 업데이트 실패');
      }
    } catch (error) {
      console.error('닉네임 업데이트 오류:', error);
      Alert.alert('오류', '닉네임 업데이트 실패');
    }
  };

  // 로그아웃 버튼 클릭 시
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // 실제 로그아웃 실행
  const confirmLogout = async () => {
    try {
      await AsyncStorage.removeItem('accessToken');
      setLogoutModalVisible(false);
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

      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
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
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  const SettingItem = ({ icon: Icon, label, isDanger, onPress }: { icon: any, label: string, isDanger?: boolean, onPress?: () => void }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingItemLeft}>
        <View style={[
          styles.iconContainer,
          isDanger ? styles.dangerIconContainer : styles.normalIconContainer
        ]}>
          <Icon size={18} color={isDanger ? COLORS.red400 : '#525252'} />
        </View>
        <Text style={[
          styles.settingLabel,
          isDanger ? styles.dangerLabel : styles.normalLabel
        ]}>{label}</Text>
      </View>
      <ChevronRight size={18} color={COLORS.neutral300} />
    </TouchableOpacity>
  );

  const PenSquareIcon = ({ size, color }: { size: number, color: string }) => (
    <Image
      source={require('../assets/images/name.png')}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );

  const SettingsIcon = ({ size, color }: { size: number, color: string }) => (
    <Image
      source={require('../assets/images/settings.png')}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );

  const Divider = () => <View style={styles.divider} />;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Header */}
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.primaryMain]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerOverlay} />
          <View style={styles.avatarContainer}>
            {userInfo.profile_image ? (
              <Image
                source={{ uri: `${API_BASE}/auth/profile-image/${userInfo.id}?t=${Date.now()}` }}
                style={styles.avatarImage}
              />
            ) : (
              <UserIcon size={48} color={COLORS.primaryMain} />
            )}
          </View>
          <Text style={styles.userName}>{userInfo.name}</Text>
          <Text style={styles.userEmail}>{userInfo.email}</Text>
        </LinearGradient>

        {/* Settings List */}
        <View style={styles.settingsContainer}>
          <View style={styles.settingsCard}>
            <SettingItem icon={PenSquareIcon} label="닉네임 설정" onPress={() => setNicknameModalVisible(true)} />
            <Divider />
            <SettingItem icon={SettingsIcon} label="앱 설정" onPress={() => Alert.alert('알림', '준비 중인 기능입니다.')} />
            <Divider />
            <SettingItem icon={LogOut} label="로그아웃" isDanger onPress={handleLogout} />
            <Divider />
            <SettingItem icon={Trash2} label="탈퇴" isDanger onPress={() => setWithdrawModalVisible(true)} />
          </View>

          <Text style={styles.versionText}>
            JOYNER
          </Text>
        </View>
      </ScrollView>

      {/* 닉네임 변경 모달 */}
      <Modal
        visible={nicknameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNicknameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>닉네임 변경</Text>
            <TextInput
              style={styles.input}
              placeholder="새 닉네임을 입력하세요"
              placeholderTextColor={COLORS.neutral400}
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

      {/* 로그아웃 확인 모달 */}
      <ConfirmationModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
        title="로그아웃"
        icon={<LogOut size={24} color={COLORS.red400} />}
        confirmLabel="로그아웃"
        confirmColor={COLORS.red400}
      >
        <Text style={{ fontWeight: 'bold' }}>정말 로그아웃 하시겠습니까?</Text>
      </ConfirmationModal>

      {/* 탈퇴 확인 모달 */}
      <ConfirmationModal
        visible={withdrawModalVisible}
        onClose={() => setWithdrawModalVisible(false)}
        onConfirm={handleWithdraw}
        title="회원탈퇴"
        icon={<Trash2 size={24} color={COLORS.red400} />}
        confirmLabel="탈퇴"
        confirmColor={COLORS.red400}
      >
        {`탈퇴 시 데이터가 삭제되며 복구할 수 없습니다.\n`}
        <Text style={{ fontWeight: 'bold' }}>정말 탈퇴 하시겠습니까?</Text>
      </ConfirmationModal>

      <BottomNav activeTab={Tab.USER} />
    </View>
  );
};

// 재사용 가능한 확인 모달 컴포넌트
const ConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  icon,
  children,
  confirmLabel,
  confirmColor
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  confirmLabel: string;
  confirmColor: string;
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={[styles.modalIconContainer, { backgroundColor: COLORS.red50 }]}>
          {icon}
        </View>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalMessage}>
          {children}
        </Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: confirmColor }]}
            onPress={onConfirm}
          >
            <Text style={styles.deleteButtonText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutralLight,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.neutralSlate,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
    zIndex: 10,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  settingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  normalIconContainer: {
    backgroundColor: COLORS.neutral100,
  },
  dangerIconContainer: {
    backgroundColor: COLORS.red50,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  normalLabel: {
    color: COLORS.neutralSlate,
  },
  dangerLabel: {
    color: COLORS.red400,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.neutral100,
    marginHorizontal: 16,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.neutral400,
    marginTop: 24,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.red50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.neutral500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.neutral100,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    color: COLORS.neutralSlate,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.neutral100,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral500,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMain,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.red400,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default MyPageScreen;