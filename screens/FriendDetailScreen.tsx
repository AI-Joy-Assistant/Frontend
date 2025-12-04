import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import NegotiationService, { TimeCandidate } from '../services/negotiationService';
import MiniCalendar from '../components/MiniCalendar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FriendDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const friendId = route.params?.friendId as string;
  const friendName = route.params?.friendName as string;
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([friendId]);
  const [selectedFriendNames, setSelectedFriendNames] = useState<string[]>([friendName]);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [dateToRange, setDateToRange] = useState<Record<string, { start: string; end: string }>>({});
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [note, setNote] = useState('');

  const canSubmit = useMemo(() => selectedDates.length >= 1 && selectedDates.every((d) => !!dateToRange[d]), [selectedDates, dateToRange]);

  const toggleDate = (d: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(d)) {
        const next = prev.filter((x) => x !== d);
        setActiveDate(next.length ? next[next.length - 1] : null);
        // remove time mapping for that date
        setDateToRange((m) => { const copy = { ...m }; delete copy[d]; return copy; });
        return next;
      }
      const next = [...prev, d];
      setActiveDate(d);
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    const candidates: TimeCandidate[] = selectedDates.map((d) => ({ date: d, start: dateToRange[d].start, end: dateToRange[d].end }));
    setSheetVisible(false);
    Alert.alert('진행중', `${selectedFriendNames.join(', ')}와 일정 협상 시작했어요.`);
    await NegotiationService.createNegotiation(selectedFriendIds, candidates, note);
  };

  // very simple 7-day chips starting today
  const days: string[] = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) { // 30일 미니 달력 느낌의 칩
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{selectedFriendNames.join(', ')}</Text>
        <TouchableOpacity onPress={() => setSheetVisible(true)} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>AI로 일정 잡기</Text>
        </TouchableOpacity>
      </View>

      {/* Content placeholder */}
      <View style={{ flex: 1 }} />

      <Modal visible={sheetVisible} animationType="slide" transparent onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              <Text style={styles.sectionTitle}>대상자</Text>
              <View style={styles.participantsRow}>
                {selectedFriendNames.map((n, idx) => (
                  <View key={`${n}_${idx}`} style={styles.participantChip}><Text style={styles.participantText}>{n}</Text></View>
                ))}
                <TouchableOpacity style={styles.addParticipantBtn} onPress={() => {
                  // 간단 입력 프롬프트 (실제에선 친구 선택 리스트로 교체 가능)
                  // eslint-disable-next-line no-alert
                  const name = prompt('추가할 이름 입력');
                  // eslint-disable-next-line no-alert
                  const id = prompt('추가할 ID 입력');
                  if (name && id) { setSelectedFriendNames((p)=>[...p, name]); setSelectedFriendIds((p)=>[...p, id]); }
                }}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>날짜 선택(여러 개)</Text>
              <MiniCalendar selectedDates={selectedDates} onToggle={toggleDate} onFocus={(d)=>setActiveDate(d)} />

              <Text style={styles.sectionTitle}>시간대(선택된 날짜별 1개)</Text>
              <Text style={{ color:'#9CA3AF', paddingHorizontal:12, marginBottom:6 }}>현재 날짜: {activeDate || '날짜를 선택하세요'}</Text>
              <View style={styles.customRow}>
                <TextInput editable={!!activeDate} placeholder="시작 HH:mm" placeholderTextColor="#9CA3AF" style={styles.input} value={customStart} onChangeText={setCustomStart} />
                <Text style={{ color:'#9CA3AF', marginHorizontal: 8 }}>~</Text>
                <TextInput editable={!!activeDate} placeholder="종료 HH:mm" placeholderTextColor="#9CA3AF" style={styles.input} value={customEnd} onChangeText={setCustomEnd} />
                <TouchableOpacity disabled={!activeDate || !customStart || !customEnd} style={[styles.addRangeBtn, (!activeDate || !customStart || !customEnd) && { opacity: 0.5 }]} onPress={() => { if (activeDate && customStart && customEnd) { setDateToRange((m)=>({ ...m, [activeDate]: { start: customStart, end: customEnd } })); setCustomStart(''); setCustomEnd(''); } }}>
                  <Text style={{ color:'#FFFFFF', fontWeight:'700' }}>적용</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rangeList}>
                {selectedDates.map((d) => (
                  <View key={`sel_${d}`} style={styles.rangeChip}>
                    <Text style={styles.rangeText}>{d.slice(5)} {dateToRange[d] ? `${dateToRange[d].start}~${dateToRange[d].end}` : '시간 미지정'}</Text>
                    <TouchableOpacity onPress={() => { setDateToRange((m)=>{ const c={...m}; delete c[d]; return c; }); }}>
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>메모/장소(옵션)</Text>
              <TextInput style={styles.memoInput} placeholder="최대 80자" placeholderTextColor="#9CA3AF" maxLength={80} value={note} onChangeText={setNote} />
            </ScrollView>

            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSheetVisible(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]} disabled={!canSubmit} onPress={submit}>
                <Text style={styles.submitText}>제출</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F111A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 56, borderBottomWidth: 1, borderBottomColor: '#374151' },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111827', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' },
  sheetHandle: { alignSelf: 'center', width: 48, height: 4, borderRadius: 2, backgroundColor: '#374151', marginVertical: 8 },
  sectionTitle: { color: '#FFFFFF', fontWeight: '700', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  readonlyBox: { marginHorizontal: 12, backgroundColor: '#1F2937', borderRadius: 10, padding: 10, color: '#D1D5DB' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  chip: { backgroundColor: '#1F2937', borderColor: '#374151', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, margin: 6 },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#9CA3AF' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  calendarCell: { backgroundColor: '#1F2937', borderColor: '#374151', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, margin: 6 },
  calendarCellActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  calendarCellFocused: { borderColor: '#60A5FA', borderWidth: 2 },
  calendarCellText: { color: '#9CA3AF' },
  calendarCellTextActive: { color: '#FFFFFF', fontWeight: '600' },
  orText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 6 },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  input: { backgroundColor: '#1F2937', color: '#FFFFFF', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, width: 120 },
  memoInput: { marginHorizontal: 12, backgroundColor: '#1F2937', color: '#FFFFFF', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  sheetButtons: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1F2937' },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center' },
  cancelText: { color: '#9CA3AF', fontWeight: '600' },
  submitBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#2563EB' },
  submitText: { color: '#FFFFFF', fontWeight: '700' },
  participantsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, flexWrap: 'wrap' },
  participantChip: { backgroundColor: '#1F2937', borderColor: '#374151', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginRight: 6, marginBottom: 6 },
  participantText: { color: '#D1D5DB' },
  addParticipantBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  addRangeBtn: { marginLeft: 8, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  rangeList: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 8 },
  rangeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  rangeText: { color: '#FFFFFF', marginRight: 6 },
});


