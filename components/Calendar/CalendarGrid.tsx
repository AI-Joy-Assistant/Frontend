import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarDay } from '../../types/calendar';

interface CalendarGridProps {
  days: CalendarDay[];
  onDayPress: (day: CalendarDay) => void;
}

export default function CalendarGrid({ days, onDayPress }: CalendarGridProps) {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={styles.container}>
      {/* 요일 헤더 */}
      <View style={styles.dayHeader}>
        {dayNames.map((dayName, index) => (
          <View key={dayName} style={styles.dayHeaderCell}>
            <Text style={[
              styles.dayHeaderText,
              index === 0 && styles.sundayText,
              index === 6 && styles.saturdayText
            ]}>
              {dayName}
            </Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View style={styles.calendarGrid}>
        {days.map((day, index) => (
          <TouchableOpacity
            key={day.date}
            style={[
              styles.dayCell,
              day.isToday && !day.isSelected && styles.todayCell
            ]}
            onPress={() => onDayPress(day)}
          >
            {day.isSelected && <View style={styles.selectedDayOverlay} />}
            <Text style={[
              styles.dayText,
              day.isSelected && styles.selectedDayText,
              day.isToday && !day.isSelected && styles.todayText,
              day.isWeekend && !day.isSelected && styles.weekendText
            ]}>
              {day.dayOfMonth}
            </Text>
            {day.hasEvents && <View style={styles.eventDot} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F111A',
  },
  dayHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  dayHeaderCell: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  sundayText: {
    color: '#EF4444',
  },
  saturdayText: {
    color: '#4A90E2',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.285%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    zIndex: 2,
  },
  selectedDay: {
    backgroundColor: '#EF4444',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
    zIndex: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // marginHorizontal: 'auto',
  },
  todayText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  weekendText: {
    color: '#9CA3AF',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
    zIndex: 2,
  },
  selectedDayOverlay: {
    position: 'absolute',
    top: 5,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 40,
    backgroundColor: '#EF4444',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
    zIndex: 1,
    pointerEvents: 'none',
  },
}); 