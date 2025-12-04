import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Props = {
  selectedDates: string[];              // ISO YYYY-MM-DD
  onToggle: (isoDate: string) => void;  // toggle select
  onFocus?: (isoDate: string) => void;  // make active date
  initial?: Date;
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function MiniCalendar({ selectedDates, onToggle, onFocus, initial }: Props) {
  const init = initial ?? new Date();
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth()); // 0-11

  const matrix = useMemo(() => {
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay(); // 0-Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { y: number; m: number; d: number; inMonth: boolean }[] = [];
    // lead from previous month
    for (let i = firstWeekday - 1; i >= 0; i--) {
      cells.push({ y: month === 0 ? year - 1 : year, m: month === 0 ? 11 : month - 1, d: prevMonthDays - i, inMonth: false });
    }
    // this month
    for (let d = 1; d <= daysInMonth; d++) cells.push({ y: year, m: month, d, inMonth: true });
    // tail for next month to fill 6x7=42
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) cells.push({ y: month === 11 ? year + 1 : year, m: month === 11 ? 0 : month + 1, d, inMonth: false });
    return cells;
  }, [year, month]);

  const goPrev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else { setMonth((m) => m - 1); }
  };
  const goNext = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else { setMonth((m) => m + 1); }
  };

  const weekLabels = ['일','월','화','수','목','금','토'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goPrev} style={styles.headerBtn}><Text style={styles.headerBtnText}>{'<'}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{`${year}-${pad(month+1)}`}</Text>
        <TouchableOpacity onPress={goNext} style={styles.headerBtn}><Text style={styles.headerBtnText}>{'>'}</Text></TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {weekLabels.map((w) => (<Text key={w} style={styles.weekLabel}>{w}</Text>))}
      </View>
      <View style={styles.grid}>
        {matrix.map((c, idx) => {
          const iso = toIso(c.y, c.m, c.d);
          const selected = selectedDates.includes(iso);
          return (
            <TouchableOpacity key={`${iso}_${idx}`} style={[styles.cell, selected && styles.cellSelected, !c.inMonth && styles.cellDim]} onPress={() => { onToggle(iso); onFocus && onFocus(iso); }}>
              <Text style={[styles.cellText, selected && styles.cellTextSelected, !c.inMonth && styles.cellTextDim]}>{c.d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0F111A', borderColor: '#374151', borderWidth: 1, borderRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  headerTitle: { color: '#FFFFFF', fontWeight: '700' },
  headerBtn: { padding: 6, backgroundColor: '#1F2937', borderRadius: 8 },
  headerBtnText: { color: '#D1D5DB', fontWeight: '700' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 6, marginTop: 4 },
  weekLabel: { flex: 1, textAlign: 'center', color: '#9CA3AF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6 },
  cell: { width: '14.2857%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginVertical: 2 },
  cellSelected: { backgroundColor: '#2563EB' },
  cellText: { color: '#D1D5DB', fontWeight: '600' },
  cellTextSelected: { color: '#FFFFFF' },
  cellDim: { opacity: 0.5 },
  cellTextDim: { color: '#9CA3AF' },
});










