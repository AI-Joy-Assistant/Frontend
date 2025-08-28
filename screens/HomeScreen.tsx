import React, { useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Alert, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { CalendarEvent } from '../types/calendar';
import CalendarHeader from '../components/Calendar/CalendarHeader';
import CalendarGrid from '../components/Calendar/CalendarGrid';
import EventDetails from '../components/Calendar/EventDetails';
import AddEventModal from '../components/Calendar/AddEventModal';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    events,
    currentMonth,
    selectedDate: hookSelectedDate,
    selectedEvents: hookSelectedEvents,
    selectDate,
    changeMonth,
    addEvent,
    getEventsForDate,
    deleteEvent,
  } = useGoogleCalendar();

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(new Date().getMonth() + 1);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // 로컬 시간으로 오늘 날짜 문자열 생성
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayString = `${todayYear}-${todayMonth}-${todayDay}`;
  const [selectedDate, setSelectedDate] = useState(todayString);

  const handleDayPress = (day: any) => {
    setSelectedDate(day.date);
    selectDate(day.date);
  };

  // 🔁 기존의 selectedEvents useMemo 블록 전부 삭제하고 아래 한 줄로 교체
  const selectedEvents = useMemo(
      () => getEventsForDate(selectedDate),
      [selectedDate, events, getEventsForDate]
  );

  // 선택된 날짜의 이벤트 계산
  // const selectedEvents = useMemo(() => {
  //   if (!selectedDate) return [];
  //
  //   return events.filter(event => {
  //     let eventDate: string;
  //
  //     if (event.start.dateTime) {
  //       // 로컬 시간으로 날짜 파싱
  //       const eventDateTime = new Date(event.start.dateTime);
  //       const year = eventDateTime.getFullYear();
  //       const month = String(eventDateTime.getMonth() + 1).padStart(2, '0');
  //       const day = String(eventDateTime.getDate()).padStart(2, '0');
  //       eventDate = `${year}-${month}-${day}`;
  //     } else if (event.start.date) {
  //       eventDate = event.start.date;
  //     } else {
  //       return false;
  //     }
  //
  //     return eventDate === selectedDate;
  //   });
  // }, [selectedDate, events]);

  const handleAddEvent = () => {
    setShowAddEventModal(true);
  };

  const handleAddEventSubmit = async (event: Omit<CalendarEvent, 'id'>) => {
    try {
      await addEvent(event);
      setShowAddEventModal(false);
      Alert.alert('성공', '일정이 추가되었습니다.');

      // 캘린더 새로고침을 위해 현재 월 다시 로드
      if (currentMonth) {
        changeMonth(currentMonth.year, currentMonth.month);
      }
    } catch (error) {
      console.error('일정 추가 실패:', error);
      Alert.alert('오류', '일정 추가에 실패했습니다.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      Alert.alert('삭제됨', '일정이 삭제되었습니다.');
    } catch (e) {
      console.error('일정 삭제 실패:', e);
      Alert.alert('오류', '일정 삭제에 실패했습니다.');
    }
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
        {/* 하단 탭바 */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
            <Ionicons name="home" size={24} color="#4A90E2" />
            <Text style={[styles.navText, styles.activeNavText]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubble" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Friends')}
          >
            <Ionicons name="people" size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('A2A')}
          >
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
      </SafeAreaView>
    );
  }

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
          onDeleteEvent={handleDeleteEvent}
        />
      </ScrollView>

      {/* 일정 추가 모달 */}
      <AddEventModal
        visible={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        onAddEvent={handleAddEventSubmit}
        selectedDate={selectedDate}
      />

      {/* 하단 탭바 */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <Ionicons name="home" size={24} color="#4A90E2" />
          <Text style={[styles.navText, styles.activeNavText]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Chat')}
        >
          <Ionicons name="chatbubble" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Friends')}
        >
          <Ionicons name="people" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('A2A')}
        >
          <Ionicons name="person" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>A2A</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('User')}
        >
          <Ionicons name="person-circle" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>User</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
    height: '100%',
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
    color: '#4A90E2',
    fontWeight: '600',
  },
});