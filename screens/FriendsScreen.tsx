import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, Check, X, Info } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
  Platform,
  Animated
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import { getBackendUrl } from '../utils/environment';
import WebSocketService from '../services/WebSocketService';
import { useTutorial } from '../store/TutorialContext';

// Colors
const COLORS = {
  primaryMain: '#3730A3',   // Reference: primary.main
  primaryLight: '#818CF8',  // Reference: primary.light
  primaryDark: '#0E004E',   // Reference: primary.dark
  primaryBg: '#EEF2FF',     // Reference: primary.bg

  neutralSlate: '#334155',  // Reference: neutral.slate
  neutralGray: '#CBD5E1',   // Reference: neutral.gray
  neutralLight: '#F8FAFC',  // Reference: neutral.light

  // Inferred from Slate palette usage
  neutral100: '#F1F5F9', // Slate 100
  neutral200: '#E2E8F0', // Slate 200
  neutral300: '#CBD5E1', // Slate 300
  neutral400: '#94A3B8', // Slate 400
  neutral500: '#64748B', // Slate 500

  white: '#FFFFFF',
  red400: '#F87171',
  red50: '#FEF2F2',
  green500: '#22C55E',
};

interface FriendRequest {
  id: string;
  from_user: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
  status: string;
  created_at: string;
}

interface Friend {
  id: string;
  friend: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
  created_at: string;
}

const FriendsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Friends'>>();
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>(
    route.params?.initialTab || 'friends'
  );

  // 튜토리얼 훅 사용
  const {
    isTutorialActive,
    fakeFriendRequest,
    currentStep,
    nextSubStep,
    markTutorialFriendAdded,
    tutorialFriendAdded,
    ghostFriend,
    currentSubStep,
    registerTarget
  } = useTutorial();

  // ✅ [NEW] 튜토리얼 탭 강조 애니메이션
  const tabScale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTutorialActive && currentStep === 'ACCEPT_FRIEND' && currentSubStep?.id === 'go_to_requests') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(tabScale, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(tabScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      tabScale.setValue(1);
    }
  }, [isTutorialActive, currentStep, currentSubStep?.id]);

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [emailInput, setEmailInput] = useState<string>('');
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; handle?: string } | null>(null);

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{ id: string; name: string } | null>(null);

  // 중복 클릭 방지를 위한 처리 중인 요청 ID 목록
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set());

  // Custom Alert Modal State
  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');
  const [customAlertType, setCustomAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Custom alert function (replaces window.alert)
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message);
    setCustomAlertType(type);
    setCustomAlertVisible(true);
  };

  // Fetch User Info for "My ID" card
  const fetchUserInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const response = await fetch(`${getBackendUrl()}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch user info', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      console.log('친구 요청 목록 조회 시작...');
      const response = await fetch(`${getBackendUrl()}/friends/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });

      console.log('친구 요청 응답 상태:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('친구 요청 데이터:', data);
        setFriendRequests(data.requests || []);
      } else {
        const errorData = await response.json();
        console.error('친구 요청 조회 실패:', errorData);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  // 튜토리얼 모드일 때 가짜 요청 주입
  const displayedRequests = React.useMemo(() => {
    if (isTutorialActive && currentStep === 'ACCEPT_FRIEND' && !tutorialFriendAdded) {
      // 이미 실제 목록에 있는지 확인
      const exists = friendRequests.some(r => r.id === fakeFriendRequest.id);
      if (!exists) {
        return [fakeFriendRequest, ...friendRequests];
      }
    }
    return friendRequests;
  }, [isTutorialActive, currentStep, tutorialFriendAdded, friendRequests, fakeFriendRequest]);

  // 튜토리얼 모드일 때 가짜 친구 주입
  const displayedFriends = React.useMemo(() => {
    if (tutorialFriendAdded || (isTutorialActive && currentStep !== 'INTRO' && currentStep !== 'ACCEPT_FRIEND')) {
      // 이미 실제 목록에 있는지 확인
      const exists = friends.some(f => f.friend.id === ghostFriend.id);
      if (!exists) {
        const fakeFriend: Friend = {
          id: 'tutorial_friend_relation',
          friend: ghostFriend,
          created_at: new Date().toISOString()
        };
        return [fakeFriend, ...friends];
      }
    }
    return friends;
  }, [tutorialFriendAdded, isTutorialActive, currentStep, friends, ghostFriend]);

  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/list`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Mocking status for UI as backend might not provide it yet
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserInfo();
      fetchFriendRequests();
      fetchFriends();
    }, [])
  );

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const response = await fetch(`${getBackendUrl()}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        }
      } catch (e) {
        console.error('User ID fetch error:', e);
      }
    };
    fetchUserId();
  }, []);

  // WebSocket for real-time friend request notifications (using singleton service)
  useEffect(() => {
    if (!currentUserId) return;

    // 싱글톤 서비스 연결 (이미 연결되어 있으면 스킵)
    WebSocketService.connect(currentUserId);

    // FriendsScreen에서 필요한 메시지 구독
    const unsubscribe = WebSocketService.subscribe(
      'FriendsScreen',
      ['friend_request', 'friend_accepted', 'friend_rejected'],
      (data) => {
        console.log(`[WS:Friends] Event: ${data.type}`);

        if (data.type === "friend_request") {
          fetchFriendRequests();
          // DB 반영 지연 가능성 고려하여 재시도
          setTimeout(() => fetchFriendRequests(), 500);
        } else if (data.type === "friend_accepted") {
          fetchFriends();
          fetchFriendRequests();
        } else if (data.type === "friend_rejected") {
          fetchFriends();
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

  const handleAddFriend = async () => {
    if (!searchTerm.trim()) {
      showAlert('오류', '이메일을 입력해주세요.', 'error');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: searchTerm.trim() }),
      });

      console.log('친구 추가 응답 상태:', response.status);

      if (response.ok) {
        showAlert('성공', '친구 요청을 보냈습니다.', 'success');
        setSearchTerm('');
      } else {
        const errorData = await response.json();
        console.log('친구 추가 에러 응답:', errorData);
        let errorMsg = errorData.detail || errorData.error || '친구 추가에 실패했습니다.';
        if (typeof errorMsg === 'string' && errorMsg.includes('해당 이메일 또는 아이디의 사용자를 찾을 수 없습니다.')) {
          errorMsg = '해당 이메일 또는 아이디의\n사용자를 찾을 수 없습니다.';
        }
        showAlert('오류', errorMsg, 'error');
      }
    } catch (error) {
      console.error('친구 추가 예외:', error);
      showAlert('오류', '친구 추가 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteFriend = (friendId: string, friendName: string) => {
    setSelectedFriend({ id: friendId, name: friendName });
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedFriend) return;

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/${selectedFriend.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        fetchFriends();
        setDeleteModalVisible(false);
        setSelectedFriend(null);
      } else {
        showAlert('오류', '삭제 실패', 'error');
      }
    } catch (e) {
      showAlert('오류', '삭제 중 오류 발생', 'error');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    // 이미 처리 중인 요청이면 무시
    if (processingRequestIds.has(requestId)) {
      return;
    }

    // 튜토리얼 가짜 요청 수락 처리
    if (isTutorialActive && requestId === fakeFriendRequest.id) {
      // 백엔드에 실제로 가이드 친구 추가 요청 (튜토리얼용 엔드포인트)
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          await fetch(`${getBackendUrl()}/friends/tutorial/add-guide`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      } catch (e) {
        console.error('Tutorial guide add error:', e);
      }

      markTutorialFriendAdded();
      showAlert('성공', '친구 요청을 수락했습니다.', 'success');

      // 다음 단계로 진행
      setTimeout(() => {
        nextSubStep();
      }, 500);
      return;
    }

    // 처리 중 상태로 설정
    setProcessingRequestIds(prev => new Set(prev).add(requestId));

    // UI에서 즉시 제거 (낙관적 업데이트)
    setFriendRequests(prev => prev.filter(req => req.id !== requestId));

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert('성공', '친구 요청을 수락했습니다.', 'success');
        fetchFriends();
      } else {
        // 실패 시 요청 목록 다시 불러오기
        fetchFriendRequests();
        showAlert('오류', '요청 수락에 실패했습니다.', 'error');
      }
    } catch (e) {
      // 오류 시 요청 목록 다시 불러오기
      fetchFriendRequests();
      showAlert('오류', '요청 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      // 처리 완료 후 상태 정리
      setProcessingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    // 이미 처리 중인 요청이면 무시
    if (processingRequestIds.has(requestId)) {
      return;
    }

    // 처리 중 상태로 설정
    setProcessingRequestIds(prev => new Set(prev).add(requestId));

    // UI에서 즉시 제거 (낙관적 업데이트)
    setFriendRequests(prev => prev.filter(req => req.id !== requestId));

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert('성공', '친구 요청을 거절했습니다.', 'success');
      } else {
        // 실패 시 요청 목록 다시 불러오기
        fetchFriendRequests();
        showAlert('오류', '요청 거절에 실패했습니다.', 'error');
      }
    } catch (e) {
      // 오류 시 요청 목록 다시 불러오기
      fetchFriendRequests();
      showAlert('오류', '요청 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      // 처리 완료 후 상태 정리
      setProcessingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const copyToClipboard = async () => {
    if (userInfo?.handle) {
      await Clipboard.setStringAsync(userInfo.handle);
      showAlert('복사 완료!', `${userInfo.handle}가 클립보드에 복사되었습니다.`, 'success');
    }
  };

  // --- Render Views ---

  if (isAdding) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 24 }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => setIsAdding(false)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.neutral500} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>친구 추가</Text>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {/* Search Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={COLORS.primaryMain} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="친구의 이메일 또는 아이디로 검색"
                placeholderTextColor={COLORS.neutral400}
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={handleAddFriend}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="input_friend_handle"
              />
            </View>
            {searchTerm.length > 0 && (
              <TouchableOpacity style={styles.addButton} onPress={handleAddFriend} testID="btn_send_friend_request">
                <Text style={styles.addButtonText}>추가</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* My ID Card */}
          <LinearGradient
            colors={['#818CF8', '#3730A3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.idCard}
          >
            <Text style={[styles.idCardLabel, { letterSpacing: 0 }]}>내 프로필</Text>

            {/* Main Info */}
            <View style={styles.idCardMain}>
              <Text style={styles.idCardName}>{userInfo?.name || 'Loading...'}</Text>
              <View style={styles.idCardHandleRow}>
                <Text style={styles.idCardHandleSymbol}>@</Text>
                <Text style={styles.idCardHandle}>{userInfo?.handle || ''}</Text>
                <TouchableOpacity
                  style={{ marginLeft: 2, padding: 4, justifyContent: 'center', alignItems: 'center', marginTop: 5 }}
                  onPress={copyToClipboard}
                >
                  <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Email */}
            <View style={styles.idCardEmailRow}>
              <Ionicons name="mail" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.idCardEmail}>{userInfo?.email || ''}</Text>
            </View>
          </LinearGradient>
        </View>
        <BottomNav activeTab={Tab.FRIENDS} />

        {/* Custom Alert Modal for isAdding view */}
        <Modal
          visible={customAlertVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCustomAlertVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setCustomAlertVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => { }}>
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 20,
                  padding: 24,
                  width: '90%',
                  maxWidth: 320,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                }}>
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    marginBottom: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: customAlertType === 'success' ? '#E0E7FF' :
                      customAlertType === 'error' ? '#FEE2E2' : '#E0E7FF'
                  }}>
                    {customAlertType === 'success' ? (
                      <Check size={28} color={COLORS.primaryMain} />
                    ) : customAlertType === 'error' ? (
                      <X size={28} color="#DC2626" />
                    ) : (
                      <Info size={28} color={COLORS.primaryMain} />
                    )}
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 12, textAlign: 'center' }}>
                    {customAlertTitle}
                  </Text>
                  <Text style={{ fontSize: 16, color: COLORS.neutral500, lineHeight: 24, marginBottom: 32, textAlign: 'center' }}>
                    {customAlertMessage}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: '100%',
                      height: 50,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 16,
                      backgroundColor: customAlertType === 'success' ? COLORS.primaryMain :
                        customAlertType === 'error' ? '#EF4444' : COLORS.primaryMain
                    }}
                    onPress={() => setCustomAlertVisible(false)}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>확인</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.mainHeader, { paddingTop: insets.top + 24 }]}>
        {/* Tab Switcher - Moved to top */}
        <View style={styles.mainHeaderTop}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
              testID="tab_friends_list"
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                친구 목록
              </Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: tabScale }] }}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'requests' && styles.activeTab,
                  // 튜토리얼 강조 스타일
                  isTutorialActive && currentSubStep?.id === 'go_to_requests' && {
                    borderColor: COLORS.primaryMain,
                    borderWidth: 2,
                    backgroundColor: '#EDE9FE', // Light purple bg
                    shadowColor: COLORS.primaryMain,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    elevation: 5
                  }
                ]}
                onPress={() => {
                  setActiveTab('requests');
                  // 튜토리얼 진행: 받은 요청 탭 클릭 시
                  if (isTutorialActive && currentStep === 'ACCEPT_FRIEND') {
                    console.log('[FriendsScreen] Requests tab clicked in tutorial');
                    setTimeout(() => nextSubStep(), 300);
                  }
                }}
                testID="tab_requests"
                ref={(r) => { if (r) registerTarget('tab_requests', r); }}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'requests' && styles.activeTabText,
                  isTutorialActive && currentSubStep?.id === 'go_to_requests' && { color: COLORS.primaryMain, fontWeight: 'bold' }
                ]}>
                  받은 요청 {displayedRequests.length > 0 && `(${displayedRequests.length})`}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <TouchableOpacity
            style={styles.addUserButton}
            onPress={() => setIsAdding(true)}
            testID="btn_add_friend"
          >
            <UserPlus size={25} color={COLORS.primaryMain} />
          </TouchableOpacity>
        </View>

        {activeTab === 'friends' && (
          <>
            <View style={styles.mainSearchBox}>
              <Ionicons name="search" size={18} color={COLORS.neutral400} style={styles.mainSearchIcon} />
              <TextInput
                style={styles.mainSearchInput}
                placeholder="친구 검색..."
                placeholderTextColor={COLORS.neutral400}
                value={friendSearchQuery}
                onChangeText={setFriendSearchQuery}
              />
            </View>
            <Text style={styles.friendListCount}>친구목록 {displayedFriends.length}명</Text>
          </>
        )}
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primaryMain} style={{ marginTop: 20 }} />
        ) : activeTab === 'friends' ? (
          <FlatList
            data={displayedFriends.filter(f =>
              !displayedRequests.some(req => req.from_user.id === f.friend.id) &&
              (friendSearchQuery === '' ||
                f.friend.name.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
                f.friend.email.toLowerCase().includes(friendSearchQuery.toLowerCase()))
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={null}
            renderItem={({ item }) => (
              <View style={styles.friendItem}>
                <View style={styles.friendInfo}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatarRing}>
                      <Image
                        source={{ uri: item.friend.picture || 'https://picsum.photos/150' }}
                        style={styles.avatarImage}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.friendName}>{item.friend.name}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDeleteFriend(item.friend.id, item.friend.name)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.red400} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>친구가 없습니다.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={displayedRequests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.requestItem}>
                <View style={styles.friendInfo}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatarRing}>
                      <Image
                        source={{ uri: item.from_user.picture || 'https://picsum.photos/150' }}
                        style={styles.avatarImage}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{item.from_user.name}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[
                      styles.acceptButton,
                      processingRequestIds.has(item.id) && { opacity: 0.5 }
                    ]}
                    onPress={() => handleAcceptRequest(item.id)}
                    disabled={processingRequestIds.has(item.id)}
                    testID={item.id === fakeFriendRequest.id ? 'btn_accept_friend' : undefined}
                  >
                    <Check size={18} color={COLORS.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rejectButton,
                      processingRequestIds.has(item.id) && { opacity: 0.5 }
                    ]}
                    onPress={() => handleRejectRequest(item.id)}
                    disabled={processingRequestIds.has(item.id)}
                  >
                    <X size={18} color={COLORS.red400} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>받은 친구 요청이 없습니다.</Text>
              </View>
            }
          />
        )}
      </View>

      <BottomNav activeTab={Tab.FRIENDS} />

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDeleteModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconContainer}>
                    <Ionicons name="trash-outline" size={24} color={COLORS.red400} />
                  </View>
                  <Text style={styles.modalTitle}>친구 삭제</Text>
                  <Text style={styles.modalMessage}>
                    <Text style={{ fontWeight: 'bold' }}>{selectedFriend?.name}</Text>님을 친구 목록에서 삭제하시겠습니까?
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setDeleteModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalDeleteButton,
                      { backgroundColor: pressed ? '#DC2626' : '#EF4444' }
                    ]}
                    onPress={confirmDelete}
                  >
                    <Text style={styles.modalDeleteText}>삭제</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={customAlertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomAlertVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCustomAlertVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 24,
                width: '90%',
                maxWidth: 320,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  marginBottom: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: customAlertType === 'success' ? '#E0E7FF' :
                    customAlertType === 'error' ? '#FEE2E2' : '#E0E7FF'
                }}>
                  {customAlertType === 'success' ? (
                    <Check size={28} color={COLORS.primaryMain} />
                  ) : customAlertType === 'error' ? (
                    <X size={28} color="#DC2626" />
                  ) : (
                    <Info size={28} color={COLORS.primaryMain} />
                  )}
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 12, textAlign: 'center' }}>
                  {customAlertTitle}
                </Text>
                <Text style={{ fontSize: 16, color: COLORS.neutral500, lineHeight: 24, marginBottom: 32, textAlign: 'center' }}>
                  {customAlertMessage}
                </Text>
                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 50,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                    backgroundColor: customAlertType === 'success' ? COLORS.primaryMain :
                      customAlertType === 'error' ? '#EF4444' : COLORS.primaryMain
                  }}
                  onPress={() => setCustomAlertVisible(false)}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>확인</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutralLight,
  },
  // Add Friend View Styles
  headerContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchBox: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    color: COLORS.neutralSlate,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addButton: {
    marginTop: 12,
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  idCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  idCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  idCardMain: {
    marginBottom: 12,
  },
  idCardName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 6,
  },
  idCardHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idCardHandleSymbol: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  idCardHandle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  idCardEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  idCardEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Main View Styles
  mainHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
    marginBottom: 4,
  },
  mainHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
  },
  mainSubtitle: {
    fontSize: 12,
    color: COLORS.neutral500,
    marginTop: 4,
    fontWeight: '500',
  },
  addUserButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent', // hover effect not directly applicable
  },
  mainSearchBox: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mainSearchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  mainSearchInput: {
    backgroundColor: COLORS.neutralLight,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.neutralSlate,
    fontWeight: '500',
  },
  friendListCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutralSlate,
    marginTop: 8,
    marginLeft: 4,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  friendItem: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },

  friendName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.neutral400,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.red50,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.neutral400,
    fontSize: 16,
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 0,
    gap: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.neutralLight,
    flexShrink: 0,
  },
  activeTab: {
    backgroundColor: COLORS.primaryMain,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral500,
  },
  activeTabText: {
    color: COLORS.white,
  },
  // Request Item Styles
  requestItem: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
    marginLeft: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.red50,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.neutral500,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.neutral100,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral500,
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.red400, // Fallback or remove if unused, but keeping for safety if Pressable fails
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.neutral200,
    marginVertical: 12,
    marginHorizontal: 4,
  },
});

export default FriendsScreen;