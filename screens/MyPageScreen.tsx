import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, Alert, ScrollView, Platform, TouchableWithoutFeedback
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, Settings, LogOut, Trash2, ChevronRight, User as UserIcon, Calendar as CalendarIcon, Check, AlertCircle, Info, BookOpen } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { getBackendUrl } from '../utils/environment';
import { useTutorial } from '../store/TutorialContext';
import { useFocusEffect } from '@react-navigation/native';

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
  const { resetTutorial } = useTutorial();
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
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [showCalendarIntegrationModal, setShowCalendarIntegrationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 결과 알림 모달 상태
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [resultModalType, setResultModalType] = useState<'success' | 'error' | 'info'>('success');
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isCalendarLinked, setIsCalendarLinked] = useState<boolean | null>(null);
  const [cachedProfilePicture, setCachedProfilePicture] = useState<string | null>(null);

  // 컴포넌트 마운트 즉시 캐시 데이터 병렬 로드 (가장 빠른 표시를 위해)
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const [cachedUserInfo, userPicture, cachedStatus, storedAuthProvider] = await Promise.all([
          AsyncStorage.getItem('cachedUserInfo'),
          AsyncStorage.getItem('userPicture'),
          AsyncStorage.getItem('cachedCalendarLinked'),
          AsyncStorage.getItem('authProvider'),
        ]);

        if (userPicture) setCachedProfilePicture(userPicture);
        if (cachedUserInfo) {
          const parsed = JSON.parse(cachedUserInfo);
          setUserInfo(parsed);
          setNickname(parsed.name || '');
        }
        if (cachedStatus !== null) setIsCalendarLinked(cachedStatus === 'true');
        if (storedAuthProvider) setAuthProvider(storedAuthProvider);
      } catch (error) {
        console.error('캐시 로드 오류:', error);
      }
    };
    loadCachedData();
  }, []);

  // 사용자 정보 불러오기 (API에서 최신 데이터 가져오기)
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
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUserInfo(userData);
        setNickname(userData.name || '');
        // 캐시에 저장
        await AsyncStorage.setItem('cachedUserInfo', JSON.stringify(userData));
      } else if (!userInfo) {
        Alert.alert('오류', '사용자 정보를 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      if (!userInfo) {
        Alert.alert('오류', '사용자 정보를 불러오지 못했습니다.');
      }
    }
  };

  // Google 캘린더 연동 핸들러
  const handleConnectGoogleCalendar = async () => {
    try {
      setIsLoading(true);
      const BACKEND_URL = getBackendUrl();
      const token = await AsyncStorage.getItem('accessToken');

      const authUrlRes = await fetch(`${BACKEND_URL}/calendar/link-url`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!authUrlRes.ok) {
        const errorBody = await authUrlRes.text();
        throw new Error(`인증 URL 요청 실패: ${authUrlRes.status} - ${errorBody}`);
      }
      const { auth_url } = await authUrlRes.json();

      const result = await WebBrowser.openAuthSessionAsync(
        auth_url,
        'frontend://calendar-linked'
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const success = url.searchParams.get('success');
        const errorParam = url.searchParams.get('error');

        if (success === 'true') {
          setResultModalType('success');
          setResultModalMessage('Google 캘린더가 연동되었습니다!');
          setResultModalVisible(true);
          setIsCalendarLinked(true); // 즉시 상태 업데이트
        } else if (errorParam) {
          setResultModalType('error');
          setResultModalMessage(`캘린더 연동 실패: ${errorParam}`);
          setResultModalVisible(true);
        } else {
          setResultModalType('info');
          setResultModalMessage('연동이 완료되었습니다.');
          setResultModalVisible(true);
          setIsCalendarLinked(true); // 즉시 상태 업데이트
        }
      }
    } catch (error) {
      console.error('Calendar link error:', error);
      setResultModalType('error');
      setResultModalMessage('캘린더 연동 중 오류가 발생했습니다.');
      setResultModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 캘린더 연동 상태 확인 (API에서 최신 데이터 가져오기)
  const checkCalendarLinkStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_BASE}/calendar/link-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsCalendarLinked(data.is_linked);
        await AsyncStorage.setItem('cachedCalendarLinked', data.is_linked ? 'true' : 'false');
      }
    } catch (error) {
      console.error('캘린더 상태 확인 오류:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUserInfo();
      checkCalendarLinkStatus();
    }, [])
  );

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
      await AsyncStorage.removeItem('authProvider');
      await AsyncStorage.removeItem('userPicture');
      // calendarIntegrationDismissed는 로그아웃 시 유지 (기기 설정처럼 동작)
      // 그 외 알림 관련 로컬 데이터도 삭제 여부 결정 필요하지만, 
      // 사용자가 캘린더 버튼만 명시했으므로 캘린더 관련 키 삭제는 제거함.
      // 다른 dismissed 데이터들도 사용자별 데이터라면 지우는게 맞지만, 
      // 현재 요청은 "연동하지 않기" 상태 유지임.

      // 사용자별 데이터인 dismissedRequestIds 등은 지우는게 맞을 수 있으나
      // 일단 사용자가 지적한 캘린더 버튼 관련만 수정.

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
        },
      });

      if (response.ok) {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('authProvider');
        await AsyncStorage.removeItem('userPicture');
        await AsyncStorage.removeItem('calendarIntegrationDismissed'); // 캘린더 연동 무시 상태 초기화
        await AsyncStorage.removeItem('dismissedRequestIds');
        await AsyncStorage.removeItem('dismissedNotificationIds');
        await AsyncStorage.removeItem('viewedRequestIds');
        await AsyncStorage.removeItem('viewedNotificationIds');
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
            {(userInfo.profile_image || cachedProfilePicture) ? (
              <Image
                source={{
                  uri: userInfo.profile_image
                    ? `${API_BASE}/auth/profile-image/${userInfo.id}`
                    : cachedProfilePicture!
                }}
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
            {/* Google Calendar 메뉴 항목 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                if (!isCalendarLinked) {
                  setShowCalendarIntegrationModal(true);
                }
              }}
              activeOpacity={isCalendarLinked ? 1 : 0.7}
            >
              <View style={styles.settingItemLeft}>
                <View style={[styles.iconContainer, styles.normalIconContainer]}>
                  <CalendarIcon size={18} color="#525252" />
                </View>
                <Text style={[styles.settingLabel, styles.normalLabel]}>Google Calendar</Text>
              </View>
              {isCalendarLinked ? (
                <Text style={{ fontSize: 14, color: COLORS.primaryMain, fontWeight: '600' }}>연동됨</Text>
              ) : (
                <Text style={{ fontSize: 14, color: COLORS.primaryMain, fontWeight: '600' }}>연동하기</Text>
              )}
            </TouchableOpacity>
            <Divider />
            <SettingItem icon={PenSquareIcon} label="닉네임 설정" onPress={() => setNicknameModalVisible(true)} />
            <Divider />
            <SettingItem icon={SettingsIcon} label="앱 설정" onPress={() => Alert.alert('알림', '준비 중인 기능입니다.')} />
            <Divider />
            <SettingItem icon={BookOpen} label="튜토리얼 다시보기" onPress={resetTutorial} />
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

      {/* Google 캘린더 연동 설명 모달 */}
      <Modal
        visible={showCalendarIntegrationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendarIntegrationModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCalendarIntegrationModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={styles.calendarModalContent}>
                <View style={styles.calendarModalIconContainer}>
                  <CalendarIcon size={26} color={COLORS.primaryMain} />
                </View>
                <Text style={styles.calendarModalTitle}>Google Calendar 연동하기</Text>
                <Text style={styles.calendarModalDescription}>
                  연동 시 기존 일정을 자동으로 가져오고,{'\n'}앱에서 추가한 일정도 동기화됩니다.{'\n'}연동하지 않으면 <Text style={{ fontWeight: '600', color: COLORS.primaryMain }}>JOYNER 자체 캘린더</Text>로만{'\n'}사용할 수 있습니다.
                </Text>
                <TouchableOpacity
                  style={styles.calendarConnectButton}
                  onPress={() => {
                    setShowCalendarIntegrationModal(false);
                    handleConnectGoogleCalendar();
                  }}
                >
                  <Text style={styles.calendarConnectButtonText}>연동하기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarCancelButton}
                  onPress={() => setShowCalendarIntegrationModal(false)}
                >
                  <Text style={styles.calendarCancelButtonText}>나중에</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 결과 알림 모달 */}
      <Modal
        visible={resultModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setResultModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setResultModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={styles.resultModalContent}>
                <View style={[
                  styles.resultModalIconContainer,
                  resultModalType === 'success' && { backgroundColor: '#E0E7FF' },
                  resultModalType === 'error' && { backgroundColor: '#FEE2E2' },
                  resultModalType === 'info' && { backgroundColor: '#E0E7FF' },
                ]}>
                  {resultModalType === 'success' && <Check size={28} color={COLORS.primaryMain} />}
                  {resultModalType === 'error' && <AlertCircle size={28} color="#EF4444" />}
                  {resultModalType === 'info' && <Info size={28} color={COLORS.primaryMain} />}
                </View>
                <Text style={[
                  styles.resultModalTitle,
                  resultModalType === 'success' && { color: COLORS.primaryMain },
                  resultModalType === 'error' && { color: '#EF4444' },
                  resultModalType === 'info' && { color: COLORS.primaryMain },
                ]}>
                  {resultModalType === 'success' ? '성공' : resultModalType === 'error' ? '오류' : '알림'}
                </Text>
                <Text style={styles.resultModalMessage}>{resultModalMessage}</Text>
                <TouchableOpacity
                  style={[
                    styles.resultModalButton,
                    resultModalType === 'success' && { backgroundColor: COLORS.primaryMain },
                    resultModalType === 'error' && { backgroundColor: '#EF4444' },
                    resultModalType === 'info' && { backgroundColor: COLORS.primaryMain },
                  ]}
                  onPress={() => setResultModalVisible(false)}
                >
                  <Text style={styles.resultModalButtonText}>확인</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
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
  // Google Calendar Integration Styles
  calendarLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryBg,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  calendarModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '92%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarModalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  calendarModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  calendarConnectButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primaryMain,
    marginBottom: 10,
  },
  calendarConnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  calendarCancelButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  calendarCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Result Modal Styles
  resultModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  resultModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultModalMessage: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  resultModalButton: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  resultModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default MyPageScreen;