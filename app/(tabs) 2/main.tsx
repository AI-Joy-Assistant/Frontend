import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarHeader from '../../components/Calendar/CalendarHeader';
import CalendarGrid from '../../components/Calendar/CalendarGrid';
import EventDetails from '../../components/Calendar/EventDetails';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

export default function Main() {
  const {
    currentMonth,
    selectedDate,
    selectedEvents,
    getEventsForDate,
    selectDate,
    changeMonth,
    addEvent,
  } = useGoogleCalendar();

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(new Date().getMonth() + 1);

  const handleDayPress = (day: any) => {
    console.log('=== 메인 화면에서 날짜 클릭 ===');
    console.log('클릭된 날짜 객체:', day);
    console.log('클릭된 날짜:', day.date);
    console.log('클릭된 일:', day.dayOfMonth);
    selectDate(day.date);
  };

  const handleAddEvent = () => {
    Alert.alert(
      '일정 추가',
      '새로운 일정을 추가하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '추가',
          onPress: () => {
            // 실제로는 일정 추가 모달을 띄우거나 네비게이션
            Alert.alert('알림', '일정 추가 기능은 개발 중입니다.');
          },
        },
      ]
    );
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    let newYear = currentYear;
    let newMonth = currentMonthNum;

    if (direction === 'prev') {
      if (newMonth === 1) {
        newMonth = 12;
        newYear--;
      } else {
        newMonth--;
      }
    } else {
      if (newMonth === 12) {
        newMonth = 1;
        newYear++;
      } else {
        newMonth++;
      }
    }

    setCurrentYear(newYear);
    setCurrentMonthNum(newMonth);
    changeMonth(newYear, newMonth);
  };

  if (!currentMonth) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <CalendarHeader
            year={currentYear}
            month={currentMonthNum}
            onAddEvent={handleAddEvent}
            onMonthChange={handleMonthChange}
          />
        </View>
      </SafeAreaView>
    );
  }

  console.log('=== 메인 화면 렌더링 ===');
  console.log('현재 선택된 날짜:', selectedDate);
  console.log('선택된 이벤트 개수:', selectedEvents.length);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 캘린더 헤더 */}
        <CalendarHeader
          year={currentMonth.year}
          month={currentMonth.month}
          onAddEvent={handleAddEvent}
          onMonthChange={handleMonthChange}
        />

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 캘린더 그리드 */}
        <CalendarGrid
          days={currentMonth.days}
          onDayPress={handleDayPress}
        />

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 이벤트 상세 정보 */}
        <EventDetails
          selectedDate={selectedDate}
          events={selectedEvents}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 0,
  },
}); 