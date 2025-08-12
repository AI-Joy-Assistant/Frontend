import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../types';
import { friendsApi } from '../lib/api';

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
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddFriendModal, setShowAddFriendModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [emailInput, setEmailInput] = useState<string>('');

  // 친구 요청 목록 가져오기
  const fetchFriendRequests = async () => {
    try {
      const result = await friendsApi.getRequests();
      
      if (result.success && result.data) {
        const requestsData = result.data as any;
        setFriendRequests(requestsData.requests || []);
      } else {
        console.log('친구 요청 목록 가져오기 실패:', result.error);
        setFriendRequests([]);
      }
    } catch (error) {
      console.error('친구 요청 목록 가져오기 오류:', error);
      setFriendRequests([]);
    }
  };

  // 친구 목록 가져오기
  const fetchFriends = async () => {
    try {
      const result = await friendsApi.getFriends();
      
      if (result.success && result.data) {
        const friendsData = result.data as any;
        setFriends(friendsData.friends || []);
      } else {
        console.log('친구 목록 가져오기 실패:', result.error);
        setFriends([]);
      }
    } catch (error) {
      console.error('친구 목록 가져오기 오류:', error);
      setFriends([]);
    }
  };

  useEffect(() => {
    fetchFriendRequests();
    fetchFriends();
  }, []);

  // 친구 요청 수락
  const acceptFriendRequest = async (requestId: string) => {
    try {
      const result = await friendsApi.acceptRequest(requestId);
      
      if (result.success) {
        Alert.alert('성공', '친구 요청을 수락했습니다.');
        fetchFriendRequests();
        fetchFriends();
      } else {
        Alert.alert('오류', '친구 요청 수락에 실패했습니다.');
      }
    } catch (error) {
      console.error('친구 요청 수락 오류:', error);
      Alert.alert('오류', '친구 요청 수락 중 오류가 발생했습니다.');
    }
  };

  // 친구 요청 거절
  const rejectFriendRequest = async (requestId: string) => {
    try {
      const result = await friendsApi.rejectRequest(requestId);
      
      if (result.success) {
        Alert.alert('성공', '친구 요청을 거절했습니다.');
        fetchFriendRequests();
      } else {
        Alert.alert('오류', '친구 요청 거절에 실패했습니다.');
      }
    } catch (error) {
      console.error('친구 요청 거절 오류:', error);
      Alert.alert('오류', '친구 요청 거절 중 오류가 발생했습니다.');
    }
  };

  // 친구 삭제
  const deleteFriend = async (friendId: string) => {
    try {
      const result = await friendsApi.deleteFriend(friendId);
      
      if (result.success) {
        Alert.alert('성공', '친구를 삭제했습니다.');
        fetchFriends();
      } else {
        Alert.alert('오류', '친구 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('친구 삭제 오류:', error);
      Alert.alert('오류', '친구 삭제 중 오류가 발생했습니다.');
    }
  };

  // 친구 추가
  const addFriend = async () => {
    if (!emailInput.trim()) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }

    try {
      const result = await friendsApi.addFriend(emailInput.trim());
      
      if (result.success) {
        Alert.alert('성공', '친구 요청을 보냈습니다.');
        setShowAddFriendModal(false);
        setEmailInput('');
      } else {
        Alert.alert('오류', result.error || '친구 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('친구 추가 오류:', error);
      Alert.alert('오류', '친구 추가 중 오류가 발생했습니다.');
    }
  };

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.friendRequestItem}>
      <View style={styles.profileImage}>
        <Ionicons name="person" size={24} color="#ccc" />
      </View>
      <View style={styles.friendRequestContent}>
        <Text style={styles.friendRequestName}>{item.from_user.name}</Text>
        <Text style={styles.friendRequestEmail}>{item.from_user.email}</Text>
      </View>
      <View style={styles.friendRequestButtons}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptFriendRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>수락</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => rejectFriendRequest(item.id)}
        >
          <Text style={styles.rejectButtonText}>거절</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <View style={styles.profileImage}>
        <Ionicons name="person" size={24} color="#ccc" />
      </View>
      <View style={styles.friendContent}>
        <Text style={styles.friendName}>{item.friend.name}</Text>
        <Text style={styles.friendEmail}>{item.friend.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          setSelectedFriend(item);
          setShowDeleteModal(true);
        }}
      >
        <Text style={styles.deleteButtonText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="친구 검색..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddFriendModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 친구 요청 섹션 */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>친구요청</Text>
            <FlatList
              data={friendRequests}
              renderItem={renderFriendRequest}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
            {friendRequests.length > 3 && (
              <TouchableOpacity style={styles.seeMoreButton}>
                <Text style={styles.seeMoreText}>더보기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 친구 목록 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>친구 {friends.length}명</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="hourglass" size={40} color="#ccc" />
              <Text style={styles.loadingText}>친구 목록을 불러오는 중...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>친구가 없습니다.</Text>
              <Text style={styles.emptySubText}>친구를 추가해보세요!</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* 하단 네비게이션 */}
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
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <Ionicons name="people" size={24} color="#3B82F6" />
          <Text style={[styles.navText, styles.activeNavText]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>A2A</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('MyPage')}
        >
          <Ionicons name="person-circle" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>User</Text>
        </TouchableOpacity>
      </View>

      {/* 친구 추가 모달 */}
      <Modal
        visible={showAddFriendModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddFriendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>구글 이메일로 친구 추가</Text>
            <TextInput
              style={styles.emailInput}
              placeholder="이메일 주소를 입력하세요"
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddFriendModal(false);
                  setEmailInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={addFriend}
              >
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 친구 삭제 확인 모달 */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>친구 삭제</Text>
            <Text style={styles.modalMessage}>
              친구 삭제시 취소가 불가능합니다. {selectedFriend?.friend.name}님을 정말로 삭제하시겠습니까?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  if (selectedFriend) {
                    deleteFriend(selectedFriend.friend.id);
                    setShowDeleteModal(false);
                  }
                }}
              >
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    height: '100%',
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
    padding: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchIcon: {
    marginRight: 8,
    color: '#9CA3AF',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#374151',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F111A',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  friendRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F2937',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F2937',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendRequestContent: {
    flex: 1,
  },
  friendContent: {
    flex: 1,
  },
  friendRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  friendRequestEmail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  friendEmail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  friendRequestButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  seeMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  seeMoreText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
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
  modalMessage: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailInput: {
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
});

export default FriendsScreen; 