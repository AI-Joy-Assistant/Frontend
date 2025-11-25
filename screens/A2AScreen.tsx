import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE } from '../constants/config';

// 날짜 포맷 헬퍼
const formatTimestamp = (isoString: string) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const hours = kstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) { return ''; }
};

const formatDate = (isoString: string) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return `${kstDate.getUTCMonth() + 1}/${kstDate.getUTCDate()}`;
  } catch (e) { return ''; }
};

interface AgentChatRoom {
  id: string;
  sessionId: string;
  agentNames: string[];
  lastMessage: string;
  lastMessageTime: string;
  status: 'pending' | 'completed' | 'in_progress';
}

const A2AScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [chatRooms, setChatRooms] = useState<AgentChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);

  // 채팅방 목록 조회
  const fetchAgentChatRooms = async () => {
    if (loadingRooms) return;
    setLoadingRooms(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch(`${API_BASE}/a2a/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const sessions = data.sessions || [];

        const mappedRooms: AgentChatRoom[] = sessions.map((session: any) => {
          const names = session.participant_names && session.participant_names.length > 0
              ? session.participant_names
              : ['대화상대'];

          let status: AgentChatRoom['status'] = 'pending';
          if (session.status === 'completed') status = 'completed';
          else if (session.status === 'in_progress') status = 'in_progress';

          return {
            id: session.thread_id || session.id,
            sessionId: session.id, // 상세 화면으로 넘길 ID
            agentNames: names,
            lastMessage: `최근 활동: ${formatDate(session.created_at)}`,
            lastMessageTime: session.created_at,
            status: status,
          };
        });
        setChatRooms(mappedRooms);
      }
    } catch (e) {
      console.error('fetchAgentChatRooms error:', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  useFocusEffect(
      useCallback(() => {
        fetchAgentChatRooms();
      }, [])
  );

  const deleteChatRoom = async (roomId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch(`${API_BASE}/a2a/room/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setChatRooms(prev => prev.filter(r => r.id !== roomId));
      }
    } catch (e) { console.error(e); }
  };

  const renderChatRoom = ({ item }: { item: AgentChatRoom }) => (
      <View style={styles.chatRoomItem}>
        {/* 목록 클릭 시 상세 화면(A2AChatDetail)으로 이동 */}
        <TouchableOpacity
            style={styles.chatRoomLeft}
            onPress={() => {
              navigation.navigate('A2AChatDetail', {
                sessionId: item.sessionId,
                title: item.agentNames.join(', ')
              });
            }}
        >
          <View style={styles.chatRoomIcon}>
            <Ionicons name={item.agentNames.length > 1 ? "people" : "person"} size={24} color="#4A90E2" />
          </View>
          <View style={styles.chatRoomContent}>
            <Text style={styles.chatRoomTitle} numberOfLines={1}>
              {item.agentNames.join(', ')}
            </Text>
            <View style={styles.statusRow}>
              <View style={[
                styles.statusIndicator,
                item.status === 'completed' ? styles.completedStatus :
                    item.status === 'in_progress' ? styles.inProgressStatus : styles.pendingStatus
              ]} />
              <Text style={styles.statusText}>
                {item.status === 'completed' ? '완료' :
                    item.status === 'in_progress' ? '진행중' : '대기중'}
              </Text>
              <Text style={styles.chatRoomTime}>
                • {formatDate(item.lastMessageTime)} {formatTimestamp(item.lastMessageTime)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 삭제 버튼 */}
        <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert("삭제", "채팅방을 삭제하시겠습니까?", [
                { text: "취소", style: "cancel" },
                { text: "삭제", style: "destructive", onPress: () => deleteChatRoom(item.id) }
              ]);
            }}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
  );

  return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>진행 중인 조율</Text>
          </View>
          <TouchableOpacity onPress={fetchAgentChatRooms} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {loadingRooms ? (
              <ActivityIndicator style={{ marginTop: 50 }} color="#4A90E2" size="large" />
          ) : (
              <FlatList
                  data={chatRooms}
                  renderItem={renderChatRoom}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.chatRoomsListContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>진행 중인 조율이 없습니다.</Text>
                    </View>
                  }
              />
          )}
        </View>

        {/* 하단 네비게이션 */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Friends')}>
            <Ionicons name="people" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
            <Ionicons name="person" size={24} color="#4A90E2" />
            <Text style={[styles.navText, styles.activeNavText]}>A2A</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('User')}>
            <Ionicons name="person-circle" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>User</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
  );
};

export default A2AScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F111A' },
  header: {
    backgroundColor: '#0F111A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
    height: 60
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  refreshButton: { padding: 4 },
  listContainer: { flex: 1, backgroundColor: '#1F2937' }, // 전체 배경색 통일
  chatRoomsListContent: { paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 16 },
  chatRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    backgroundColor: '#1F2937'
  },
  chatRoomLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  chatRoomContent: { flex: 1, marginRight: 8 },
  chatRoomIcon: { marginRight: 16 },
  chatRoomTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pendingStatus: { backgroundColor: '#FFC107' },
  inProgressStatus: { backgroundColor: '#4CAF50' },
  completedStatus: { backgroundColor: '#66BB6A' },
  statusText: { fontSize: 12, color: '#9CA3AF' },
  chatRoomTime: { color: '#6B7280', fontSize: 11, marginLeft: 6 },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bottomNavigation: { flexDirection: 'row', backgroundColor: '#0F111A', borderTopColor: '#374151', borderTopWidth: 2, paddingVertical: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  activeNavItem: {},
  navText: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  activeNavText: { color: '#4A90E2', fontWeight: '600' },
});