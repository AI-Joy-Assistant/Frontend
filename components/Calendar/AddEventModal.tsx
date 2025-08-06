import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarEvent } from '../../types/calendar';

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  selectedDate: string;
}

export default function AddEventModal({ visible, onClose, onAddEvent, selectedDate }: AddEventModalProps) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');

  const handleAddEvent = () => {
    if (!summary.trim()) {
      Alert.alert('오류', '일정 제목을 입력해주세요.');
      return;
    }

    // 시간 형식 검증
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('오류', '시간 형식이 올바르지 않습니다. (HH:MM 형식)');
      return;
    }

    // 시작 시간이 종료 시간보다 늦은지 확인
    const startTimeObj = new Date(`${selectedDate}T${startTime}:00`);
    const endTimeObj = new Date(`${selectedDate}T${endTime}:00`);
    if (startTimeObj >= endTimeObj) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const event: Omit<CalendarEvent, 'id'> = {
      summary: summary.trim(),
      description: description.trim(),
      start: {
        dateTime: `${selectedDate}T${startTime}:00+09:00`,
      },
      end: {
        dateTime: `${selectedDate}T${endTime}:00+09:00`,
      },
      attendees: [],
      location: location.trim(),
      htmlLink: '',
    };

    onAddEvent(event);
    
    // 폼 초기화
    setSummary('');
    setDescription('');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocation('');
    
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>일정 추가</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>날짜</Text>
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>제목 *</Text>
              <TextInput
                style={styles.textInput}
                value={summary}
                onChangeText={setSummary}
                placeholder="일정 제목을 입력하세요"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="일정에 대한 설명을 입력하세요"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.timeSection}>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>시작 시간</Text>
                <TextInput
                  style={styles.textInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>종료 시간</Text>
                <TextInput
                  style={styles.textInput}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="10:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>장소</Text>
              <TextInput
                style={styles.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="장소를 입력하세요"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddEvent}>
              <Text style={styles.addButtonText}>추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#F9FAFB',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeInput: {
    flex: 1,
    marginRight: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
}); 