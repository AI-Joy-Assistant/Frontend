import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';

type MyPageScreenRouteProp = RouteProp<RootStackParamList, 'MyPageScreen'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MyPageScreen = () => {
  const route = useRoute<MyPageScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { name: googleName, email, picture } = route.params;

  const [nickname, setNickname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);

  // 닉네임 불러오기 또는 초기 설정
  useEffect(() => {
    const fetchOrInitNickname = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('email', email)
        .single();

      if (error) {
        console.error('닉네임 조회 오류:', error.message);
        Alert.alert('오류', '닉네임을 불러오지 못했습니다.');
        return;
      }

      if (data?.name) {
        setNickname(data.name);
      } else {
        const { error: updateError } = await supabase
          .from('users')
          .update({ name: googleName })
          .eq('email', email);
        if (updateError) {
          console.error('닉네임 초기화 실패:', updateError.message);
        } else {
          setNickname(googleName);
        }
      }
    };

    fetchOrInitNickname();
  }, [email, googleName]);

  // 닉네임 수정
  const handleNicknameUpdate = async () => {
    const { error } = await supabase
      .from('users')
      .update({ name: newNickname })
      .eq('email', email);

    if (error) {
      Alert.alert('오류', '닉네임 업데이트 실패');
    } else {
      setNickname(newNickname);
      setNicknameModalVisible(false);
      setNewNickname('');
      Alert.alert('성공', '닉네임이 업데이트되었습니다.');
    }
  };

  // 로그아웃
  const handleLogout = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); // Login 또는 LoginScreen에 맞게
  };

  // 탈퇴
  const handleWithdraw = async () => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('email', email);

    if (error) {
      Alert.alert('오류', '탈퇴 실패');
    } else {
      Alert.alert('탈퇴 완료', '정상적으로 탈퇴되었습니다.');
      setWithdrawModalVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); // Login 또는 LoginScreen에 맞게
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: picture }} style={styles.profileImage} />
      <Text style={styles.name}>{googleName}</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.nickname}>챗봇이름: {nickname}님의 JOY</Text>

      <TouchableOpacity style={styles.button} onPress={() => setNicknameModalVisible(true)}>
        <Text style={styles.buttonText}>닉네임 수정</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>로그아웃</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.withdrawButton]} onPress={() => setWithdrawModalVisible(true)}>
        <Text style={styles.buttonText}>탈퇴</Text>
      </TouchableOpacity>

      {/* 닉네임 수정 모달 */}
      <Modal visible={nicknameModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>닉네임 수정</Text>
            <TextInput
              placeholder="새 닉네임 입력"
              style={styles.input}
              value={newNickname}
              onChangeText={setNewNickname}
              placeholderTextColor="#999"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity onPress={handleNicknameUpdate}>
                <Text style={styles.modalButton}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNicknameModalVisible(false)}>
                <Text style={styles.modalButton}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 탈퇴 모달 */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>정말 탈퇴하시겠습니까?</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity onPress={handleWithdraw}>
                <Text style={styles.modalButton}>확인</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <Text style={styles.modalButton}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MyPageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222023',
    alignItems: 'center',
    paddingTop: 80,
  },
  profileImage: {
    width: 135,
    height: 135,
    borderRadius: 67.5,
    marginBottom: 20,
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
  button: {
    width: 279,
    height: 53,
    backgroundColor: '#9199C0',
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 7,
  },
  withdrawButton: {
    backgroundColor: '#2D2D4D',
  },
  buttonText: {
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
    backgroundColor: '#2D2D4D',
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
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%', // ✅ 전체 너비를 조금 줄이면 내부 버튼 여백도 확보됨
  marginHorizontal: '5%',
  },
  modalButton: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: '#3C4A64',
    borderRadius: 7,
    marginHorizontal: 10,
    paddingHorizontal: 12, // ✅ 가로 padding 추가로 텍스트 여유 공간 확보
  minWidth: 100, 
  },
});
