import { Ionicons } from '@expo/vector-icons';
import { UserPlus, Check, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  Platform
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import { getBackendUrl } from '../utils/environment';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [emailInput, setEmailInput] = useState<string>('');
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{ id: string; name: string } | null>(null);

  // Web-compatible alert function
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
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
        headers: { 'Authorization': `Bearer ${token}` },
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

  const handleAddFriend = async () => {
    if (!searchTerm.trim()) {
      showAlert('오류', '이메일을 입력해주세요.');
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
        showAlert('성공', '친구 요청을 보냈습니다.');
        setSearchTerm('');
        setIsAdding(false);
      } else {
        const errorData = await response.json();
        console.log('친구 추가 에러 응답:', errorData);
        showAlert('오류', errorData.detail || errorData.error || '친구 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('친구 추가 예외:', error);
      showAlert('오류', '친구 추가 중 오류가 발생했습니다.');
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
        showAlert('오류', '삭제 실패');
      }
    } catch (e) {
      showAlert('오류', '삭제 중 오류 발생');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert('성공', '친구 요청을 수락했습니다.');
        fetchFriendRequests();
        fetchFriends();
      } else {
        showAlert('오류', '요청 수락에 실패했습니다.');
      }
    } catch (e) {
      showAlert('오류', '요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${getBackendUrl()}/friends/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert('성공', '친구 요청을 거절했습니다.');
        fetchFriendRequests();
      } else {
        showAlert('오류', '요청 거절에 실패했습니다.');
      }
    } catch (e) {
      showAlert('오류', '요청 처리 중 오류가 발생했습니다.');
    }
  };

  const copyToClipboard = async () => {
    if (userInfo?.email) {
      await Clipboard.setStringAsync(userInfo.email);
      showAlert('복사됨', '아이디(이메일)가 복사되었습니다.');
    }
  };



  // --- Render Views ---

  if (isAdding) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
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
              />
            </View>
            {searchTerm.length > 0 && (
              <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
                <Text style={styles.addButtonText}>추가</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* My ID Card */}
          <LinearGradient
            colors={[COLORS.primaryMain, COLORS.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.idCard}
          >
            <View style={styles.idCardDecor} />

            <Text style={styles.idCardLabel}>내 아이디</Text>
            <View style={styles.idCardContent}>
              <View>
                <Text style={styles.idCardValue}>{userInfo?.email || 'Loading...'}</Text>
                <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                  <Ionicons name="copy-outline" size={12} color="white" style={{ marginRight: 4 }} />
                  <Text style={styles.copyButtonText}>아이디 복사</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.qrButton}>
                <Ionicons name="qr-code-outline" size={24} color={COLORS.primaryMain} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
        <BottomNav activeTab={Tab.FRIENDS} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.mainHeader}>
        <View style={styles.mainHeaderTop}>
          <View>
            <Text style={styles.mainTitle}>친구 관리</Text>
            <Text style={styles.mainSubtitle}>전체 {friends.length}명</Text>
          </View>
          <TouchableOpacity
            style={styles.addUserButton}
            onPress={() => setIsAdding(true)}
          >
            <UserPlus size={25} color={COLORS.primaryMain} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
              친구 목록
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              받은 요청 {friendRequests.length > 0 && `(${friendRequests.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'friends' && (
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
        )}
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primaryMain} style={{ marginTop: 20 }} />
        ) : activeTab === 'friends' ? (
          <FlatList
            data={friends.filter(f =>
              !friendRequests.some(req => req.from_user.id === f.friend.id) &&
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
                        source={{ uri: item.friend.picture || 'https://via.placeholder.com/150' }}
                        style={styles.avatarImage}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.friendName}>{item.friend.name}</Text>
                    <Text style={styles.friendEmail}>{item.friend.email}</Text>
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
            data={friendRequests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.requestItem}>
                <View style={styles.friendInfo}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatarRing}>
                      <Image
                        source={{ uri: item.from_user.picture || 'https://via.placeholder.com/150' }}
                        style={styles.avatarImage}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{item.from_user.name}</Text>
                    <Text style={styles.friendEmail}>{item.from_user.email}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(item.id)}
                  >
                    <Check size={18} color={COLORS.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectRequest(item.id)}
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
                      { backgroundColor: pressed ? '#3730A3' : '#0E004E' }
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
    </SafeAreaView>
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
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  idCardDecor: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    backgroundColor: 'white',
    opacity: 0.1,
    borderRadius: 64,
  },
  idCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  idCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  idCardValue: {
    fontSize: 20, // Reduced from 24 to fit email
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 10,
    color: 'white',
  },
  qrButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 16,
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
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.neutralLight,
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
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.green500,
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
  // Friend Request Styles
  requestsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
    marginBottom: 12,
    marginLeft: 4,
  },
  requestItem: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: COLORS.neutral100,
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.neutralSlate,
    marginBottom: 2,
  },
  requestEmail: {
    fontSize: 12,
    color: COLORS.neutral500,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: COLORS.primaryMain,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: COLORS.neutral100,
    padding: 8,
    borderRadius: 20,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.neutral200,
    marginVertical: 12,
    marginHorizontal: 4,
  },
});

export default FriendsScreen;