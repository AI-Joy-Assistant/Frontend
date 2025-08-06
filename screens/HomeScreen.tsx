import React, { useState } from 'react';
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
    currentMonth,
    selectedDate,
    getEventsForDate,
    selectDate,
    changeMonth,
    addEvent,
  } = useGoogleCalendar();

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(new Date().getMonth() + 1);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  const handleDayPress = (day: any) => {
    selectDate(day.date);
  };

  const handleAddEvent = () => {
    setShowAddEventModal(true);
  };

  const handleAddEventSubmit = async (event: Omit<CalendarEvent, 'id'>) => {
    try {
      await addEvent(event);
      Alert.alert('성공', '일정이 추가되었습니다.');
    } catch (error) {
      Alert.alert('오류', '일정 추가에 실패했습니다.');
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
            <Ionicons name="home" size={24} color="#3B82F6" />
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
      </SafeAreaView>
    );
  }

  const selectedEvents = getEventsForDate(selectedDate);
  console.log('홈 화면 - 선택된 날짜:', selectedDate, '이벤트 개수:', selectedEvents.length);

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
          <Ionicons name="home" size={24} color="#3B82F6" />
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
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#0F111A',
    borderTopColor: '#374151',
    borderTopWidth: 1,
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
}); 