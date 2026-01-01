import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Alert,
  Switch,
  FlatList,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  X,
  Bell,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Settings2,
  AlignJustify,
  GripHorizontal,
  MoreHorizontal,
  Check,
  Trash2,
  AlertCircle,
  Star,
  MapPin,
  Users,
  Search,
  UserPlus
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScheduleItem } from '../types/schedule';
import { COLORS } from '../constants/Colors';
import { RootStackParamList } from '../types';
import BottomNav from '../components/BottomNav';
import { Tab } from '../types';
import { calendarService } from '../services/calendarService';
import { CreateEventRequest } from '../types/calendar';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';
import { API_BASE } from '../constants/config';
import NotificationPanel from '../components/NotificationPanel';
import { badgeStore } from '../store/badgeStore';

// Pending 요청 타입 정의
interface PendingRequest {
  id: string;
  thread_id: string;
  title: string;
  summary?: string;
  initiator_id: string;
  initiator_name: string;
  initiator_avatar: string;
  participant_count: number;
  proposed_date?: string;
  proposed_time?: string;
  status: string;
  created_at: string;
  reschedule_requested_at?: string; // 재조율 요청 시간
  type?: 'new' | 'reschedule';
}

// 친구 타입 정의 (ChatScreen과 동일)
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

type CalendarViewMode = 'CONDENSED' | 'STACKED' | 'DETAILED';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // 현재 사용자 ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Pending 요청 카드 State
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [viewedRequestIds, setViewedRequestIds] = useState<string[]>([]);
  const [viewedNotificationIds, setViewedNotificationIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<{
    id: string;
    type: 'schedule_rejected' | 'friend_request' | 'friend_accepted' | 'general';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    metadata?: Record<string, unknown>;
  }[]>([]);

  // Load dismissed request IDs and viewed count from AsyncStorage on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedDismissed = await AsyncStorage.getItem('dismissedRequestIds');
        if (storedDismissed) {
          setDismissedRequestIds(JSON.parse(storedDismissed));
        }
        const storedDismissedNotifications = await AsyncStorage.getItem('dismissedNotificationIds');
        if (storedDismissedNotifications) {
          setDismissedNotificationIds(JSON.parse(storedDismissedNotifications));
        }
        const storedViewedRequests = await AsyncStorage.getItem('viewedRequestIds');
        if (storedViewedRequests) {
          setViewedRequestIds(JSON.parse(storedViewedRequests));
        }
        const storedViewedNotifications = await AsyncStorage.getItem('viewedNotificationIds');
        if (storedViewedNotifications) {
          setViewedNotificationIds(JSON.parse(storedViewedNotifications));
        }
      } catch (error) {
        console.error('Failed to load stored data:', error);
      }
    };
    loadStoredData();
  }, []);

  const onNavigateToA2A = (id: string) => {
    navigation.navigate('A2A', { initialLogId: id });
  };

  const onDismissRequest = async (requestId: string) => {
    const newDismissedIds = [...dismissedRequestIds, requestId];
    setDismissedRequestIds(newDismissedIds);
    try {
      await AsyncStorage.setItem('dismissedRequestIds', JSON.stringify(newDismissedIds));
    } catch (error) {
      console.error('Failed to save dismissed request IDs:', error);
    }
  };

  const onDismissNotification = async (notificationId: string) => {
    const newDismissedIds = [...dismissedNotificationIds, notificationId];
    setDismissedNotificationIds(newDismissedIds);
    try {
      await AsyncStorage.setItem('dismissedNotificationIds', JSON.stringify(newDismissedIds));
    } catch (error) {
      console.error('Failed to save dismissed notification IDs:', error);
    }
  };

  const markNotificationsAsViewed = async () => {
    // 현재 보이는 요청들의 ID를 viewed로 저장
    const currentRequestIds = pendingRequests
      .filter(r => !dismissedRequestIds.includes(r.id))
      .map(r => r.id);
    const newViewedRequestIds = [...new Set([...viewedRequestIds, ...currentRequestIds])];
    setViewedRequestIds(newViewedRequestIds);

    // 현재 보이는 알림들의 ID를 viewed로 저장
    const currentNotificationIds = notifications
      .filter(n => !dismissedNotificationIds.includes(n.id))
      .map(n => n.id);
    const newViewedNotificationIds = [...new Set([...viewedNotificationIds, ...currentNotificationIds])];
    setViewedNotificationIds(newViewedNotificationIds);

    // AsyncStorage에 저장
    try {
      await AsyncStorage.setItem('viewedRequestIds', JSON.stringify(newViewedRequestIds));
      await AsyncStorage.setItem('viewedNotificationIds', JSON.stringify(newViewedNotificationIds));
    } catch (error) {
      console.error('Failed to save viewed IDs:', error);
    }
  };

  // Pending 요청 API 호출
  const fetchPendingRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      console.log('📋 Pending 요청 조회 시작, token:', token ? '있음' : '없음');
      if (!token) return;

      const response = await fetch(`${API_BASE}/a2a/pending-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📋 API 응답 상태:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Pending 요청 데이터:', data);
        setPendingRequests(data.requests || []);
      } else {
        const errorText = await response.text();
        console.error('📋 API 에러:', errorText);
      }
    } catch (error) {
      console.error('Pending 요청 조회 실패:', error);
    }
  };

  // 알림 조회 API 호출
  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_BASE}/chat/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('알림 조회 실패:', error);
    }
  };

  // 현재 사용자 정보 조회
  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.id);
      }
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
    }
  };

  // 화면에 포커스될 때마다 요청 및 알림 새로고침
  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser();
      fetchPendingRequests();
      fetchNotifications();
      // 배지 폴링은 BottomNav에서 처리하므로 여기서는 제거
    }, [])
  );

  // 표시할 요청 필터링 (dismissed 제외, 첫 번째만 표시)
  const visibleRequest = pendingRequests.find(req => !dismissedRequestIds.includes(req.id));
  const showRequest = !!visibleRequest;

  console.log('📋 visibleRequest:', visibleRequest);
  console.log('📋 showRequest:', showRequest);

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // Schedule State (API Integration)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // View Mode State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('CONDENSED');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // Modal & Edit State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<ScheduleItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  // Participant & Location State (A2A Integration)
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [isSubmittingA2A, setIsSubmittingA2A] = useState(false);

  // Date/Time Picker State
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const parseTime = (timeStr: string) => {
    if (!timeStr) return new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartDatePicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setFormStartDate(`${year}-${month}-${day}`);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setFormEndDate(`${year}-${month}-${day}`);
    }
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartTimePicker(false);
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setFormStartTime(`${hours}:${minutes}`);
    }
  };

  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndTimePicker(false);
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setFormEndTime(`${hours}:${minutes}`);
    }
  };

  // State for the currently selected date
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  });

  // State for the visible month in the calendar (Year, Month index 0-11)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  // Today's date string
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }, []);

  const handleViewRequest = () => {
    if (visibleRequest) {
      onDismissRequest(visibleRequest.id);
      onNavigateToA2A(visibleRequest.thread_id);
    }
  };

  // Helper to format date string YYYY-MM-DD
  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  // Calculate Calendar Data
  const calendarData = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Previous Month Padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      let y = viewYear;
      let m = viewMonth - 1;
      if (m < 0) { m = 11; y--; }
      days.push({ day: d, year: y, month: m, isCurrentMonth: false, fullDate: formatDate(y, m, d) });
    }

    // Current Month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, year: viewYear, month: viewMonth, isCurrentMonth: true, fullDate: formatDate(viewYear, viewMonth, i) });
    }

    // Next Month Padding
    const remainingSlots = 42 - days.length; // Max 6 rows
    for (let i = 1; i <= remainingSlots; i++) {
      let y = viewYear;
      let m = viewMonth + 1;
      if (m > 11) { m = 0; y++; }
      days.push({ day: i, year: y, month: m, isCurrentMonth: false, fullDate: formatDate(y, m, i) });
    }

    return days;
  }, [viewYear, viewMonth]);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      // Fetch for a wide range, e.g., current month +/- 1 month
      const startOfMonth = new Date(viewYear, viewMonth - 1, 1);
      const endOfMonth = new Date(viewYear, viewMonth + 2, 0);

      const events = await calendarService.getCalendarEvents(startOfMonth, endOfMonth);

      const mappedSchedules: ScheduleItem[] = events.map(event => {
        // Check if it's an all-day event (has date but no dateTime)
        const isAllDayEvent = event.start.date && !event.start.dateTime;

        let date: string;
        let endDateStr: string;
        let startTime: string;
        let endTime: string;

        if (isAllDayEvent) {
          // For all-day events, use the date directly
          date = event.start.date!;
          // Google Calendar's all-day event end date is exclusive (next day)
          // So we need to subtract 1 day for display
          const endDateObj = new Date(event.end.date + 'T00:00:00');
          endDateObj.setDate(endDateObj.getDate() - 1);
          const endYear = endDateObj.getFullYear();
          const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDateObj.getDate()).padStart(2, '0');
          endDateStr = `${endYear}-${endMonth}-${endDay}`;
          startTime = '종일';
          endTime = '';
        } else {
          const start = new Date(event.start.dateTime || event.start.date || '');
          const end = new Date(event.end.dateTime || event.end.date || '');

          date = start.toISOString().split('T')[0];
          endDateStr = end.toISOString().split('T')[0];

          startTime = start.toTimeString().slice(0, 5);
          endTime = end.toTimeString().slice(0, 5);
        }

        // A2A 일정인지 확인 (백엔드에서 A2A 일정 생성 시 description에 마커 저장)
        const description = event.description || '';
        const isA2A = description.includes('A2A Agent') || description.includes('session_id:') || description.includes('[A2A]');

        return {
          id: event.id,
          title: event.summary,
          date: date,
          endDate: date !== endDateStr ? endDateStr : undefined,
          time: isAllDayEvent ? '종일' : `${startTime} - ${endTime}`,
          participants: event.attendees?.map(a => a.displayName || a.email) || [],
          type: isA2A ? 'A2A' : 'NORMAL'
        };
      });

      setSchedules(mappedSchedules);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      // Alert.alert('Error', 'Failed to load schedules'); // Optional: Suppress initial load errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [viewYear, viewMonth]);

  // Helper: Get all events for a specific date
  const getEventsForDate = (dateStr: string) => {
    return schedules.filter(s => {
      if (s.endDate) {
        return dateStr >= s.date && dateStr <= s.endDate;
      }
      return s.date === dateStr;
    }).sort((a, b) => a.id.localeCompare(b.id));
  };

  // Helper: Get color for schedule
  const getScheduleColor = (schedule: ScheduleItem) => {
    if (schedule.type === 'A2A') return { bg: COLORS.primaryLight, text: COLORS.white };

    const colors = [
      { bg: '#FDBA74', text: COLORS.white }, // orange-300
      { bg: '#FDE047', text: '#713F12' }, // yellow-300
      { bg: '#86EFAC', text: '#14532D' }, // green-300
      { bg: '#93C5FD', text: COLORS.white }, // blue-300
      { bg: '#F9A8D4', text: COLORS.white }, // pink-300
    ];
    let hash = 0;
    for (let i = 0; i < schedule.id.length; i++) {
      hash = schedule.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const handlePrevClick = () => {
    if (isCalendarExpanded) {
      let newM = viewMonth - 1;
      let newY = viewYear;
      if (newM < 0) { newM = 11; newY--; }
      setViewMonth(newM);
      setViewYear(newY);
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      const newDateStr = formatDate(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handleNextClick = () => {
    if (isCalendarExpanded) {
      let newM = viewMonth + 1;
      let newY = viewYear;
      if (newM > 11) { newM = 0; newY++; }
      setViewMonth(newM);
      setViewYear(newY);
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      const newDateStr = formatDate(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const daysToRender = useMemo(() => {
    if (isCalendarExpanded) {
      return calendarData;
    } else {
      const selectedInView = calendarData.find(d => d.fullDate === selectedDate);
      if (selectedInView) {
        const index = calendarData.indexOf(selectedInView);
        const weekStart = Math.floor(index / 7) * 7;
        return calendarData.slice(weekStart, weekStart + 7);
      } else {
        const firstOfCurrent = calendarData.findIndex(d => d.isCurrentMonth && d.day === 1);
        const weekStart = Math.floor(firstOfCurrent / 7) * 7;
        return calendarData.slice(weekStart, weekStart + 7);
      }
    }
  }, [calendarData, isCalendarExpanded, selectedDate]);

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y !== viewYear || (m - 1) !== viewMonth) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  };

  // 친구 목록 불러오기
  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_BASE}/friends/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // 친구 선택 토글
  const toggleFriendSelection = (friendUserId: string) => {
    setSelectedFriendIds(prev => {
      if (prev.includes(friendUserId)) {
        return prev.filter(id => id !== friendUserId);
      } else {
        return [...prev, friendUserId];
      }
    });
  };

  // 선택된 친구 정보 가져오기
  const getSelectedFriends = () => {
    return friends.filter(f => selectedFriendIds.includes(f.friend.id));
  };

  // 친구 검색 필터
  const filteredFriends = friends.filter(f =>
    f.friend.name.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
    f.friend.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  const handleOpenAddSchedule = () => {
    setEditingScheduleId(null);
    setFormTitle('');
    setFormStartDate(selectedDate);
    setFormEndDate('');
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setIsAllDay(false);
    setShowDeleteConfirm(false);
    // 참여자 및 장소 초기화
    setSelectedFriendIds([]);
    setFormLocation('');
    setFriendSearchQuery('');
    // 친구 목록 새로고침
    fetchFriends();
    setShowScheduleModal(true);
  };

  const handleScheduleClick = (schedule: ScheduleItem) => {
    setSelectedDetailSchedule(schedule);
    setShowDetailModal(true);
  };

  const handleMoveToEdit = () => {
    if (selectedDetailSchedule) {
      setShowDetailModal(false);
      // Wait for modal transition slightly if needed, or just open next one
      setTimeout(() => {
        handleEditSchedule(selectedDetailSchedule);
      }, 100);
    }
  };

  const handleEditSchedule = (schedule: ScheduleItem) => {
    setEditingScheduleId(schedule.id);
    setFormTitle(schedule.title);
    setFormStartDate(schedule.date);
    setFormEndDate(schedule.endDate || '');
    setShowDeleteConfirm(false);

    if (schedule.time.includes('-')) {
      const [start, end] = schedule.time.split('-').map(s => s.trim());
      setFormStartTime(start || '09:00');
      setFormEndTime(end || '10:00');
    } else {
      setFormStartTime('09:00');
      setFormEndTime('10:00');
    }

    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    console.log('[HomeScreen Debug] handleSaveSchedule called!');
    console.log('[HomeScreen Debug] selectedFriendIds:', selectedFriendIds);
    console.log('[HomeScreen Debug] formTitle:', formTitle);

    // 웹/모바일 모두 지원하는 alert 함수
    const showAlert = (title: string, message: string) => {
      if (Platform.OS === 'web') {
        window.alert(`${title}: ${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

    if (!formTitle.trim()) {
      showAlert('오류', '일정 제목을 입력해주세요.');
      return;
    }
    if (!formStartDate) {
      showAlert('오류', '시작 날짜를 선택해주세요.');
      return;
    }

    // 종료 날짜가 시작 날짜보다 이전인지 검사
    if (formEndDate && formEndDate < formStartDate) {
      showAlert('오류', '종료 날짜가 시작 날짜보다 이전일 수 없습니다.');
      return;
    }

    // 같은 날짜일 경우 종료 시간이 시작 시간보다 이전인지 검사 (종일이 아닐 때만)
    if (!isAllDay && formStartTime && formEndTime) {
      const isSameDay = !formEndDate || formEndDate === formStartDate;
      if (isSameDay && formEndTime <= formStartTime) {
        showAlert('오류', '종료 시간이 시작 시간보다 이전이거나 같을 수 없습니다.');
        return;
      }
    }

    // 참여자가 있으면 A2A 요청으로 처리
    if (selectedFriendIds.length > 0) {
      try {
        setIsSubmittingA2A(true);
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) {
          showAlert('오류', '로그인이 필요합니다.');
          return;
        }

        // 날짜/시간 문자열 생성
        const dateStr = formStartDate; // YYYY-MM-DD
        const [year, month, day] = dateStr.split('-').map(Number);
        const formattedDate = `${month}월 ${day}일`;

        let dateRangeStr = formattedDate;
        if (formEndDate && formEndDate !== formStartDate) {
          const [eYear, eMonth, eDay] = formEndDate.split('-').map(Number);
          dateRangeStr = `${formattedDate}부터 ${eMonth}월 ${eDay}일까지`;
        }

        const timeStr = isAllDay ? '종일' : `${formStartTime}`;
        const locationStr = formLocation ? ` ${formLocation}에서` : '';

        // A2A 요청 메시지 생성
        const scheduleMessage = `${dateRangeStr} ${timeStr}에${locationStr} "${formTitle}" 일정 잡아줘`;

        console.log('[HomeScreen A2A Debug] Sending request:', {
          message: scheduleMessage,
          date: formStartDate,
          selected_friends: selectedFriendIds,
        });

        const response = await fetch(`${API_BASE}/chat/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: scheduleMessage,
            date: formStartDate,
            selected_friends: selectedFriendIds,
            title: formTitle,  // 제목 별도 전달
            location: formLocation || undefined,  // 장소 별도 전달
          }),
        });

        console.log('[HomeScreen A2A Debug] Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[HomeScreen A2A Debug] Full response data:', JSON.stringify(data, null, 2));

          const responseData = data.data || data;

          // 성공 처리
          setShowScheduleModal(false);

          // A2A 세션이 생성되었으면 A2A 화면으로 이동
          const scheduleInfo = responseData.schedule_info;
          console.log('[HomeScreen A2A Debug] Schedule info:', scheduleInfo);

          if (scheduleInfo?.session_ids?.length > 0) {
            const sessionId = scheduleInfo.session_ids[0];
            // 성공 피드백 후 A2A 화면으로 이동
            if (Platform.OS === 'web') {
              window.alert('일정 요청이 전송되었습니다! A2A 화면에서 확인하세요.');
            } else {
              Alert.alert(
                '일정 요청 완료',
                '참여자들에게 일정 요청이 전송되었습니다.',
                [
                  { text: '확인', onPress: () => navigation.navigate('A2A', { initialLogId: sessionId }) }
                ]
              );
            }
          } else {
            // scheduleInfo가 없거나 session_ids가 없어도 요청이 성공했으면 알림
            console.log('[HomeScreen A2A Debug] No session_ids in response, but request succeeded');
            showAlert('완료', '일정 요청이 전송되었습니다. A2A 화면에서 확인해주세요.');
          }

          // 상태 초기화
          setSelectedFriendIds([]);
          setFormLocation('');
          fetchSchedules();
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.log('[HomeScreen A2A Debug] Error response:', errorData);
          showAlert('오류', errorData.detail || '일정 요청 전송에 실패했습니다.');
        }
      } catch (error) {
        console.error('Failed to create A2A request:', error);
        showAlert('오류', '일정 요청 전송에 실패했습니다.');
      } finally {
        setIsSubmittingA2A(false);
      }
      return;
    }

    // 참여자가 없으면 기존 일반 일정 저장 로직
    try {
      setIsLoading(true);

      let startTimeStr = formStartTime || '00:00';
      let endTimeStr = formEndTime || '23:59';
      let endDateForEvent = formEndDate || formStartDate;

      // If all-day is selected, set time to full day
      // Google Calendar expects all-day events to end at 00:00 of the NEXT day
      if (isAllDay) {
        startTimeStr = '00:00';
        endTimeStr = '00:00';

        // Calculate next day for end date (without UTC conversion)
        // 종료 날짜가 있으면 그 날짜 + 1일, 없으면 시작 날짜 + 1일
        const baseEndDate = formEndDate || formStartDate;
        const [year, month, day] = baseEndDate.split('-').map(Number);
        const endDateObj = new Date(year, month - 1, day);
        endDateObj.setDate(endDateObj.getDate() + 1);

        const nextYear = endDateObj.getFullYear();
        const nextMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const nextDay = String(endDateObj.getDate()).padStart(2, '0');
        endDateForEvent = `${nextYear}-${nextMonth}-${nextDay}`;
      }

      const startDateTimeStr = `${formStartDate}T${startTimeStr}:00`;
      const endDateTimeStr = `${endDateForEvent}T${endTimeStr}:00`;

      // Create ISO string with KST timezone offset (+09:00)
      const formatKSTISO = (dateTimeStr: string) => {
        // Append KST timezone offset directly to the datetime string
        return `${dateTimeStr}+09:00`;
      };

      const eventData: CreateEventRequest = {
        summary: formTitle,
        start_time: formatKSTISO(startDateTimeStr),
        end_time: formatKSTISO(endDateTimeStr),
        is_all_day: isAllDay,
      };

      if (editingScheduleId) {
        await calendarService.deleteCalendarEvent(editingScheduleId);
      }

      await calendarService.createCalendarEvent(eventData);

      setShowScheduleModal(false);
      fetchSchedules();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      Alert.alert('Error', 'Failed to save schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!editingScheduleId) return;

    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      setIsLoading(true);
      await calendarService.deleteCalendarEvent(editingScheduleId);
      setShowScheduleModal(false);
      fetchSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      Alert.alert('Error', 'Failed to delete schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSchedules = getEventsForDate(selectedDate);

  const getDisplayDateHeader = () => {
    const date = new Date(viewYear, viewMonth);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const getSelectedDateDisplay = () => {
    const [y, m, d] = selectedDate.split('-');
    return `${parseInt(m)}월 ${parseInt(d)}일 일정`;
  };

  const getCellHeight = () => {
    if (!isCalendarExpanded) return 56;
    switch (viewMode) {
      case 'CONDENSED': return 56;
      case 'STACKED': return 80;
      case 'DETAILED': return 96;
      default: return 64;
    }
  };

  // 필터링된 요청 목록 (dismissed 제외)
  const visibleRequests = pendingRequests.filter(req => !dismissedRequestIds.includes(req.id));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Calendar Section  */}
          <View style={[
            styles.calendarContainer,
            styles.calendarContainerRounded
          ]}>

            {/* Calendar Header */}
            <View style={styles.calendarHeader}>
              <View style={styles.calendarHeaderLeft}>
                <TouchableOpacity onPress={handlePrevClick} style={styles.iconButton}>
                  <ChevronLeft size={24} color={COLORS.neutral400} />
                </TouchableOpacity>
                <Text style={styles.calendarTitle}>{getDisplayDateHeader()}</Text>
                <TouchableOpacity onPress={handleNextClick} style={styles.iconButton}>
                  <ChevronRight size={24} color={COLORS.neutral400} />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarHeaderRight}>
                <TouchableOpacity
                  style={styles.todayButton}
                  onPress={() => {
                    const today = new Date();
                    setViewYear(today.getFullYear());
                    setViewMonth(today.getMonth());
                    setSelectedDate(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));
                  }}
                >
                  <Text style={styles.todayButtonText}>오늘</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowNotificationPanel(true);
                    markNotificationsAsViewed();
                  }}
                  style={styles.iconButton}
                >
                  {(() => {
                    // 새 요청 수: viewed에 없는 요청들 (내가 보낸 것 제외)
                    const visibleRequests = pendingRequests.filter(r => !dismissedRequestIds.includes(r.id) && r.initiator_id !== currentUserId);
                    const newRequestCount = visibleRequests.filter(r => !viewedRequestIds.includes(r.id)).length;

                    // 새 알림 수: viewed에 없는 알림들 (내가 거절한 것 제외)
                    const visibleNotifications = notifications.filter(n => {
                      if (dismissedNotificationIds.includes(n.id)) return false;
                      if (n.type === 'schedule_rejected' && (n.metadata as any)?.rejected_by === currentUserId) return false;
                      return true;
                    });
                    const newNotificationCount = visibleNotifications.filter(n => !viewedNotificationIds.includes(n.id)).length;

                    const hasNotifications = (newRequestCount + newNotificationCount) > 0;

                    return (
                      <>
                        <Bell size={20} color={hasNotifications ? '#EF4444' : COLORS.neutral400} />
                        {hasNotifications && <View style={styles.notificationDot} />}
                      </>
                    );
                  })()}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowViewMenu(true)}
                  style={styles.iconButton}
                >
                  <Settings2 size={20} color={COLORS.neutral400} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Calendar Grid  */}
            <View style={styles.calendarGrid}>
              <View style={styles.weekRow}>
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                  <Text key={idx} style={[
                    styles.weekDayText,
                    idx === 0 ? { color: '#F87171' } : { color: COLORS.neutral400 }
                  ]}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {daysToRender.map((dayData, idx) => {
                  const isSelected = dayData.fullDate === selectedDate;
                  const isToday = dayData.fullDate === todayStr;
                  const events = getEventsForDate(dayData.fullDate);
                  const cellHeight = getCellHeight();

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleDateClick(dayData.fullDate)}
                      style={[
                        styles.dayCell,
                        { height: cellHeight },
                        isSelected && styles.dayCellSelected
                      ]}
                    >
                      <View style={[
                        styles.dayNumberContainer,
                        isSelected && styles.dayNumberSelected,
                        !isSelected && isToday && styles.dayNumberToday
                      ]}>
                        <Text style={[
                          styles.dayNumberText,
                          isSelected ? { color: 'white' } :
                            isToday ? { color: COLORS.primaryMain } :
                              dayData.isCurrentMonth ? { color: COLORS.neutralSlate } : { color: COLORS.neutral300 }
                        ]}>
                          {dayData.day}
                        </Text>
                      </View>

                      <View style={styles.eventsContainer}>
                        {viewMode === 'CONDENSED' && (
                          <View style={styles.dotsContainer}>
                            {events.slice(0, 3).map((evt, i) => (
                              <View key={i} style={[
                                styles.dot,
                                { backgroundColor: getScheduleColor(evt).bg }
                              ]} />
                            ))}
                            {events.length > 3 && <View style={[styles.dot, { backgroundColor: COLORS.neutral300 }]} />}
                          </View>
                        )}

                        {viewMode === 'STACKED' && (
                          <View style={styles.barsContainer}>
                            {events.slice(0, 4).map((evt, i) => {
                              const isStart = evt.date === dayData.fullDate;
                              const isEnd = evt.endDate ? evt.endDate === dayData.fullDate : true;

                              let borderStyle = { borderRadius: 4, marginLeft: 2, marginRight: 2 };
                              if (evt.endDate && evt.endDate !== evt.date) {
                                if (isStart && !isEnd) borderStyle = { borderRadius: 0, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, marginLeft: 2, marginRight: 0 } as any;
                                else if (!isStart && isEnd) borderStyle = { borderRadius: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4, marginLeft: 0, marginRight: 2 } as any;
                                else if (!isStart && !isEnd) borderStyle = { borderRadius: 0, marginLeft: 0, marginRight: 0 } as any;
                              }

                              return (
                                <View
                                  key={evt.id + i}
                                  style={[
                                    styles.bar,
                                    borderStyle,
                                    { backgroundColor: getScheduleColor(evt).bg }
                                  ]}
                                />
                              );
                            })}
                          </View>
                        )}

                        {viewMode === 'DETAILED' && (
                          <View style={styles.detailedContainer}>
                            {events.slice(0, 2).map((evt, i) => (
                              <View key={i} style={[
                                styles.detailedItem,
                                { backgroundColor: getScheduleColor(evt).bg }
                              ]}>
                                <Text style={[styles.detailedText, { color: getScheduleColor(evt).text }]} numberOfLines={1}>
                                  {evt.title}
                                </Text>
                              </View>
                            ))}
                            {events.length > 2 && (
                              <Text style={styles.moreText}>+{events.length - 2}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsCalendarExpanded(!isCalendarExpanded)}
              style={styles.expandButton}
            >
              {isCalendarExpanded ? (
                <ChevronUp size={16} color={COLORS.neutral300} />
              ) : (
                <ChevronDown size={16} color={COLORS.neutral300} />
              )}
            </TouchableOpacity>
          </View>

          {/* Schedule List */}
          <View style={styles.scheduleListContainer}>
            <View style={styles.scheduleListHeader}>
              <Text style={styles.scheduleListDate}>{getSelectedDateDisplay()}</Text>
              <TouchableOpacity
                onPress={handleOpenAddSchedule}
                style={styles.addButton}
              >
                <Plus size={20} color={COLORS.primaryMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.schedules}>
              {filteredSchedules.length > 0 ? (
                filteredSchedules.map((schedule) => {
                  const isMultiDay = !!schedule.endDate;
                  return (
                    <TouchableOpacity
                      key={schedule.id}
                      onPress={() => handleScheduleClick(schedule)}
                      style={[
                        styles.scheduleCard,
                        schedule.type === 'A2A' ? styles.scheduleCardA2A : { borderLeftColor: getScheduleColor(schedule).bg }
                      ]}
                    >
                      <View style={styles.scheduleCardHeader}>
                        <Text style={styles.scheduleTitle}>{schedule.title}</Text>
                        {schedule.type === 'A2A' && (
                          <View style={styles.a2aBadge}>
                            <Text style={styles.a2aBadgeText}>A2A</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.scheduleInfo}>
                        <View style={styles.scheduleTimeRow}>
                          <Clock size={12} color={schedule.type === 'A2A' ? COLORS.primaryMain : COLORS.neutral400} />
                          <Text style={[
                            styles.scheduleTimeText,
                            schedule.type === 'A2A' && { color: COLORS.primaryMain }
                          ]}>
                            {(() => {
                              const timeStr = schedule.time;
                              if (timeStr === '00:00 - 23:59' || timeStr === '09:00 - 08:59') return '종일';
                              // Check if it's a full day (ends with :59 and spans ~24h)
                              const parts = timeStr.split(' - ');
                              if (parts.length === 2) {
                                const [sh, sm] = parts[0].split(':').map(Number);
                                const [eh, em] = parts[1].split(':').map(Number);
                                const startMins = sh * 60 + sm;
                                const endMins = eh * 60 + em;
                                const diff = endMins < startMins ? (24 * 60 - startMins + endMins) : (endMins - startMins);
                                if (diff >= 23 * 60 + 50) return '종일';
                              }
                              return timeStr;
                            })()}
                          </Text>
                        </View>

                        {isMultiDay && (
                          <Text style={styles.scheduleDateRange}>
                            {schedule.date} ~ {schedule.endDate}
                          </Text>
                        )}
                      </View>

                      {schedule.participants.length > 0 && (
                        <View style={styles.participantsContainer}>
                          <View style={styles.avatars}>
                            {schedule.participants.slice(0, 3).map((p, i) => (
                              <View key={i} style={[
                                styles.avatar,
                                { backgroundColor: i % 2 === 0 ? COLORS.primaryLight : COLORS.primaryMain }
                              ]}>
                                <Text style={styles.avatarText}>{p[0]}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={styles.participantsCount}>
                            {schedule.participants.length + 1}명 참가
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <CalendarIcon size={24} color={COLORS.neutral300} />
                  </View>
                  <Text style={styles.emptyText}>등록된 일정이 없습니다</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* View Mode Menu Modal  */}
      <Modal
        visible={showViewMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowViewMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowViewMenu(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={[styles.menuItem, viewMode === 'CONDENSED' && styles.menuItemSelected]}
                onPress={() => { setViewMode('CONDENSED'); setShowViewMenu(false); }}
              >
                <View style={styles.menuItemLeft}>
                  <MoreHorizontal size={14} color={viewMode === 'CONDENSED' ? COLORS.primaryMain : COLORS.neutral600} />
                  <Text style={[styles.menuItemText, viewMode === 'CONDENSED' && styles.menuItemTextSelected]}>축소형</Text>
                </View>
                {viewMode === 'CONDENSED' && <Check size={14} color={COLORS.primaryMain} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, viewMode === 'STACKED' && styles.menuItemSelected]}
                onPress={() => { setViewMode('STACKED'); setShowViewMenu(false); }}
              >
                <View style={styles.menuItemLeft}>
                  <GripHorizontal size={14} color={viewMode === 'STACKED' ? COLORS.primaryMain : COLORS.neutral600} />
                  <Text style={[styles.menuItemText, viewMode === 'STACKED' && styles.menuItemTextSelected]}>스택형</Text>
                </View>
                {viewMode === 'STACKED' && <Check size={14} color={COLORS.primaryMain} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, viewMode === 'DETAILED' && styles.menuItemSelected]}
                onPress={() => { setViewMode('DETAILED'); setShowViewMenu(false); }}
              >
                <View style={styles.menuItemLeft}>
                  <AlignJustify size={14} color={viewMode === 'DETAILED' ? COLORS.primaryMain : COLORS.neutral600} />
                  <Text style={[styles.menuItemText, viewMode === 'DETAILED' && styles.menuItemTextSelected]}>상세형</Text>
                </View>
                {viewMode === 'DETAILED' && <Check size={14} color={COLORS.primaryMain} />}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Schedule Modal  */}
      <Modal
        visible={showScheduleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingScheduleId ? '일정 수정' : '새 일정 추가'}</Text>
              <View style={styles.modalHeaderRight}>
                {editingScheduleId && (
                  <TouchableOpacity
                    onPress={handleDeleteClick}
                    style={[
                      styles.deleteButton,
                      showDeleteConfirm && styles.deleteButtonConfirm
                    ]}
                  >
                    {showDeleteConfirm ? (
                      <>
                        <AlertCircle size={14} color="white" />
                        <Text style={styles.deleteButtonText}>삭제할까요?</Text>
                      </>
                    ) : (
                      <Trash2 size={20} color={COLORS.neutral400} />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                  <X size={24} color={COLORS.neutral300} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                {/* 참여자 선택 섹션 (새 일정 추가 시에만 표시) */}
                {!editingScheduleId && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>참여자 (선택)</Text>
                    <TouchableOpacity
                      style={styles.participantSelector}
                      onPress={() => setShowFriendPicker(true)}
                    >
                      {selectedFriendIds.length > 0 ? (
                        <View style={styles.selectedParticipantsRow}>
                          {getSelectedFriends().slice(0, 4).map((f, idx) => (
                            <View key={f.friend.id} style={[styles.participantChip, { marginLeft: idx > 0 ? -8 : 0 }]}>
                              {f.friend.picture ? (
                                <Image
                                  source={{ uri: f.friend.picture }}
                                  style={styles.participantAvatarImage}
                                />
                              ) : (
                                <View style={[styles.participantAvatar, { backgroundColor: idx % 2 === 0 ? COLORS.primaryLight : COLORS.primaryMain }]}>
                                  <Text style={styles.participantAvatarText}>{f.friend.name[0]}</Text>
                                </View>
                              )}
                            </View>
                          ))}
                          {selectedFriendIds.length > 4 && (
                            <View style={[styles.participantChip, { marginLeft: -8 }]}>
                              <View style={[styles.participantAvatar, { backgroundColor: COLORS.neutral400 }]}>
                                <Text style={styles.participantAvatarText}>+{selectedFriendIds.length - 4}</Text>
                              </View>
                            </View>
                          )}
                          <Text style={styles.participantCount}>{selectedFriendIds.length}명 선택됨</Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedFriendIds([]);
                            }}
                            style={styles.clearParticipantsButton}
                          >
                            <X size={18} color={COLORS.neutral500} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.addParticipantRow}>
                          <Users size={18} color={COLORS.neutral400} />
                          <Text style={styles.placeholderText}>친구를 초대하여 일정을 조율하세요</Text>
                          <UserPlus size={18} color={COLORS.primaryMain} style={{ marginLeft: 'auto' }} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>제목</Text>
                  <TextInput
                    style={styles.input}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="약속 제목을 입력하세요"
                    placeholderTextColor={COLORS.neutral400}
                  />
                </View>

                {/* 장소 입력 (참여자가 있을 때만 표시) */}
                {selectedFriendIds.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>장소 (선택)</Text>
                    <View style={styles.iconInput}>
                      <MapPin size={18} color={COLORS.neutral400} />
                      <TextInput
                        style={styles.locationInput}
                        value={formLocation}
                        onChangeText={setFormLocation}
                        placeholder="만날 장소를 입력하세요"
                        placeholderTextColor={COLORS.neutral400}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>시작 날짜</Text>
                    <TouchableOpacity
                      style={styles.iconInput}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <CalendarIcon size={18} color={COLORS.neutral700} />
                      <Text style={styles.inputNoBorder}>{formStartDate || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' ? (
                      <DatePickerModal
                        visible={showStartDatePicker}
                        onClose={() => setShowStartDatePicker(false)}
                        onSelect={(date) => onStartDateChange(null, date)}
                        initialDate={parseDate(formStartDate)}
                      />
                    ) : (
                      showStartDatePicker && (
                        <DateTimePicker
                          value={parseDate(formStartDate)}
                          mode="date"
                          display="default"
                          onChange={onStartDateChange}
                        />
                      )
                    )}
                  </View>
                  <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>종료 날짜 (선택)</Text>
                    <TouchableOpacity
                      style={styles.iconInput}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <CalendarIcon size={18} color={COLORS.neutral400} />
                      <Text style={styles.inputNoBorder}>{formEndDate || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' ? (
                      <DatePickerModal
                        visible={showEndDatePicker}
                        onClose={() => setShowEndDatePicker(false)}
                        onSelect={(date) => onEndDateChange(null, date)}
                        initialDate={parseDate(formEndDate)}
                      />
                    ) : (
                      showEndDatePicker && (
                        <DateTimePicker
                          value={parseDate(formEndDate)}
                          mode="date"
                          display="default"
                          onChange={onEndDateChange}
                        />
                      )
                    )}
                  </View>
                </View>

                {/* All Day Toggle */}
                <View style={styles.allDayRow}>
                  <Text style={styles.allDayLabel}>종일</Text>
                  <Switch
                    value={isAllDay}
                    onValueChange={setIsAllDay}
                    trackColor={{ false: COLORS.neutral200, true: COLORS.primaryLight }}
                    thumbColor={isAllDay ? COLORS.primaryMain : COLORS.neutral400}
                  />
                </View>

                {!isAllDay && (
                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.label}>시작 시간</Text>
                      <TouchableOpacity
                        style={styles.iconInput}
                        onPress={() => setShowStartTimePicker(true)}
                      >
                        <Clock size={18} color={COLORS.neutral700} />
                        <Text style={styles.inputNoBorder}>{formStartTime || 'HH:MM'}</Text>
                      </TouchableOpacity>
                      {Platform.OS === 'web' ? (
                        <TimePickerModal
                          visible={showStartTimePicker}
                          onClose={() => setShowStartTimePicker(false)}
                          onSelect={(date) => onStartTimeChange(null, date)}
                          initialTime={parseTime(formStartTime)}
                        />
                      ) : (
                        showStartTimePicker && (
                          <DateTimePicker
                            value={parseTime(formStartTime)}
                            mode="time"
                            display="default"
                            onChange={onStartTimeChange}
                            minuteInterval={1}
                          />
                        )
                      )}
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.label}>종료 시간</Text>
                      <TouchableOpacity
                        style={styles.iconInput}
                        onPress={() => setShowEndTimePicker(true)}
                      >
                        <Clock size={18} color={COLORS.neutral700} />
                        <Text style={styles.inputNoBorder}>{formEndTime || 'HH:MM'}</Text>
                      </TouchableOpacity>
                      {Platform.OS === 'web' ? (
                        <TimePickerModal
                          visible={showEndTimePicker}
                          onClose={() => setShowEndTimePicker(false)}
                          onSelect={(date) => onEndTimeChange(null, date)}
                          initialTime={parseTime(formEndTime)}
                        />
                      ) : (
                        showEndTimePicker && (
                          <DateTimePicker
                            value={parseTime(formEndTime)}
                            mode="time"
                            display="default"
                            onChange={onEndTimeChange}
                            minuteInterval={1}
                          />
                        )
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={() => setShowScheduleModal(false)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveSchedule}
                    style={[
                      styles.saveButton,
                      selectedFriendIds.length > 0 && styles.a2aSaveButton
                    ]}
                    disabled={isSubmittingA2A}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSubmittingA2A ? '요청 중...' :
                        editingScheduleId ? '수정하기' :
                          selectedFriendIds.length > 0 ? '일정 요청하기 ✨' : '추가하기'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDetailModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{selectedDetailSchedule?.title}</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.closeDetailButton}
                  >
                    <X size={24} color={COLORS.neutral400} />
                  </TouchableOpacity>
                </View>

                <View style={styles.tagContainer}>
                  <View style={[
                    styles.typeTag,
                    selectedDetailSchedule?.type === 'A2A' && styles.typeTagA2A
                  ]}>
                    <Text style={[
                      styles.typeTagText,
                      selectedDetailSchedule?.type === 'A2A' && styles.typeTagTextA2A
                    ]}>
                      {selectedDetailSchedule?.type === 'A2A' ? 'A2A 일정' : '일반 일정'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconBox}>
                      <CalendarIcon size={20} color={COLORS.neutral500} />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>날짜</Text>
                      <Text style={styles.infoValue}>
                        {selectedDetailSchedule?.date}
                        {selectedDetailSchedule?.endDate && ` ~ ${selectedDetailSchedule.endDate}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.infoIconBox}>
                      <Clock size={20} color={COLORS.neutral500} />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>시간</Text>
                      <Text style={styles.infoValue}>
                        {(() => {
                          const timeStr = selectedDetailSchedule?.time || '';
                          if (timeStr === '00:00 - 23:59' || timeStr === '09:00 - 08:59') return '종일';
                          const parts = timeStr.split(' - ');
                          if (parts.length === 2) {
                            const [sh, sm] = parts[0].split(':').map(Number);
                            const [eh, em] = parts[1].split(':').map(Number);
                            const startMins = sh * 60 + sm;
                            const endMins = eh * 60 + em;
                            const diff = endMins < startMins ? (24 * 60 - startMins + endMins) : (endMins - startMins);
                            if (diff >= 23 * 60 + 50) return '종일';
                          }
                          return timeStr;
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailButtonRow}>
                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={async () => {
                      if (!selectedDetailSchedule) return;
                      const confirmDelete = Platform.OS === 'web'
                        ? window.confirm('이 일정을 삭제하시겠습니까?')
                        : await new Promise<boolean>((resolve) => {
                          Alert.alert(
                            '일정 삭제',
                            '이 일정을 삭제하시겠습니까?',
                            [
                              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
                              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
                            ]
                          );
                        });
                      if (confirmDelete) {
                        try {
                          await calendarService.deleteCalendarEvent(selectedDetailSchedule.id);
                          setShowDetailModal(false);
                          fetchSchedules();
                        } catch (error) {
                          console.error('일정 삭제 실패:', error);
                        }
                      }
                    }}
                  >
                    <Trash2 size={22} color={COLORS.neutral500} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editLinkButton}
                    onPress={handleMoveToEdit}
                  >
                    <Text style={styles.editLinkText}>일정 수정하기</Text>
                    <ChevronRight size={18} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Notification Panel */}
      <NotificationPanel
        visible={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
        pendingRequests={pendingRequests.filter(r => !dismissedRequestIds.includes(r.id) && r.initiator_id !== currentUserId)}
        notifications={notifications.filter(n => {
          // dismissed된 알림 제외
          if (dismissedNotificationIds.includes(n.id)) return false;
          // 거절 알림 중 내가 거절한 것은 제외 (상대방에게만 표시)
          if (n.type === 'schedule_rejected' && n.metadata?.rejected_by === currentUserId) return false;
          return true;
        })}
        onNavigateToA2A={onNavigateToA2A}
        onNavigateToFriends={(tab) => {
          navigation.navigate('Friends', { initialTab: tab });
        }}
        onDismissRequest={onDismissRequest}
        onDismissNotification={onDismissNotification}
      />

      {/* Friend Picker Modal */}
      <Modal
        visible={showFriendPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendPicker(false)}
      >
        <View style={styles.friendPickerOverlay}>
          <View style={styles.friendPickerContainer}>
            <View style={styles.friendPickerHeader}>
              <Text style={styles.friendPickerTitle}>참여자 선택</Text>
              <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                <X size={24} color={COLORS.neutral400} />
              </TouchableOpacity>
            </View>

            <View style={styles.friendSearchContainer}>
              <Search size={18} color={COLORS.neutral400} />
              <TextInput
                style={styles.friendSearchInput}
                value={friendSearchQuery}
                onChangeText={setFriendSearchQuery}
                placeholder="친구 검색..."
                placeholderTextColor={COLORS.neutral400}
              />
            </View>

            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.friend.id}
              style={styles.friendList}
              renderItem={({ item, index }) => {
                const isSelected = selectedFriendIds.includes(item.friend.id);
                return (
                  <TouchableOpacity
                    style={styles.friendItem}
                    onPress={() => toggleFriendSelection(item.friend.id)}
                  >
                    {item.friend.picture ? (
                      <Image
                        source={{ uri: item.friend.picture }}
                        style={styles.friendItemAvatarImage}
                      />
                    ) : (
                      <View style={[styles.friendItemAvatar, { backgroundColor: index % 2 === 0 ? COLORS.primaryLight : COLORS.primaryMain }]}>
                        <Text style={styles.friendItemAvatarText}>{item.friend.name[0]}</Text>
                      </View>
                    )}
                    <View style={styles.friendItemInfo}>
                      <Text style={styles.friendItemName}>{item.friend.name}</Text>
                      <Text style={styles.friendItemEmail}>{item.friend.email}</Text>
                    </View>
                    <View style={[
                      styles.friendItemCheckbox,
                      {
                        backgroundColor: isSelected ? COLORS.primaryMain : 'transparent',
                        borderColor: isSelected ? COLORS.primaryMain : COLORS.neutral300
                      }
                    ]}>
                      {isSelected && <Check size={14} color="white" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyFriendsText}>
                  {friends.length === 0 ? '친구가 없습니다. 먼저 친구를 추가하세요!' : '검색 결과가 없습니다.'}
                </Text>
              }
            />

            <View style={styles.friendPickerFooter}>
              <TouchableOpacity
                style={styles.friendPickerButton}
                onPress={() => setShowFriendPicker(false)}
              >
                <Text style={styles.friendPickerButtonText}>
                  완료 {selectedFriendIds.length > 0 ? `(${selectedFriendIds.length}명 선택)` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav activeTab={Tab.HOME} />
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutralLight,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  requestCardContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  requestCardBgCircle: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F0F9FF', // light blue
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  requestCardBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryMain,
    marginRight: 6,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  requestCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
    marginBottom: 4,
  },
  requestCardSubtitle: {
    fontSize: 14,
    color: COLORS.neutral500,
    marginBottom: 16,
  },
  viewButton: {
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  calendarContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  calendarContainerRounded: {
    borderRadius: 24,
  },
  calendarContainerTopRounded: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginTop: -20, // Connect with previous element if needed
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
    marginHorizontal: 10,
  },
  calendarHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayButton: {
    backgroundColor: COLORS.neutral100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.neutral600,
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    width: 10,
    height: 10,
  },
  calendarGrid: {
    marginBottom: 10,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
    paddingTop: 4,
  },
  dayCellSelected: {
    backgroundColor: '#F0F9FF',
  },
  dayNumberContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 12,
    marginBottom: 2,
  },
  dayNumberSelected: {
    backgroundColor: COLORS.primaryMain,
  },
  dayNumberToday: {
    backgroundColor: COLORS.neutral100,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  barsContainer: {
    width: '100%',
    paddingHorizontal: 2,
    marginTop: 2,
    gap: 2,
  },
  bar: {
    height: 4,
    width: '100%',
  },
  detailedContainer: {
    width: '100%',
    paddingHorizontal: 1,
    marginTop: 2,
    gap: 1,
  },
  detailedItem: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 2,
  },
  detailedText: {
    fontSize: 9,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 9,
    color: COLORS.neutral400,
    textAlign: 'center',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  scheduleListContainer: {
    paddingHorizontal: 20,
  },
  scheduleListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleListDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  schedules: {
    gap: 12,
  },
  scheduleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
  },
  scheduleCardNormal: {
    borderLeftColor: COLORS.neutral300,
  },
  scheduleCardA2A: {
    borderLeftColor: COLORS.primaryMain,
    backgroundColor: '#F0F9FF',
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral900,
  },
  a2aBadge: {
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  a2aBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scheduleInfo: {
    marginBottom: 12,
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  scheduleTimeText: {
    fontSize: 14,
    color: COLORS.neutral500,
  },
  scheduleDateRange: {
    fontSize: 12,
    color: COLORS.neutral400,
    marginLeft: 16,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  participantsCount: {
    fontSize: 12,
    color: COLORS.neutral400,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.neutral400,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    width: 160,
    position: 'absolute',
    top: 180,
    right: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemText: {
    fontSize: 14,
    color: COLORS.neutral600,
  },
  menuItemTextSelected: {
    color: COLORS.primaryMain,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  formScrollView: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonConfirm: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral700,
  },
  input: {
    backgroundColor: COLORS.neutral100,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.neutral900,
  },
  row: {
    flexDirection: 'row',
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral100,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  inputNoBorder: {
    fontSize: 16,
    color: COLORS.neutral900,
  },
  allDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  allDayLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.neutral700,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.neutral200,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral600,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Detail Modal Styles
  detailCard: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.neutral900,
    flex: 1,
    marginRight: 12,
  },
  closeDetailButton: {
    padding: 4,
    marginTop: -4,
    marginRight: -4,
    backgroundColor: COLORS.neutral100,
    borderRadius: 20,
  },
  tagContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  typeTag: {
    backgroundColor: COLORS.neutral100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  typeTagText: {
    fontSize: 13,
    color: COLORS.neutral600,
    fontWeight: '600',
  },
  typeTagA2A: {
    backgroundColor: COLORS.primaryBg,
  },
  typeTagTextA2A: {
    color: COLORS.primaryMain,
  },
  infoSection: {
    gap: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.neutral400,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.neutral900,
  },
  detailButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteIconButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLinkButton: {
    flex: 1,
    backgroundColor: COLORS.primaryMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  editLinkText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Participant & Location Styles
  participantSelector: {
    backgroundColor: COLORS.neutral50,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    borderStyle: 'dashed',
  },
  selectedParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantChip: {
    zIndex: 1,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  participantAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
  },
  participantAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  participantCount: {
    fontSize: 13,
    color: COLORS.neutral600,
    marginLeft: 12,
    fontWeight: '500',
    flex: 1,
  },
  clearParticipantsButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: COLORS.neutral100,
    borderRadius: 12,
  },
  addParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholderText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.neutral400,
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.neutral900,
    marginLeft: 8,
    paddingVertical: 0,
  },
  a2aSaveButton: {
    backgroundColor: COLORS.primaryDark,
  },
  // Friend Picker Modal Styles
  friendPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  friendPickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  friendPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  friendPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  friendSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral50,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.neutral900,
  },
  friendList: {
    paddingHorizontal: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  friendItemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendItemAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  friendItemAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendItemInfo: {
    flex: 1,
  },
  friendItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.neutral900,
  },
  friendItemEmail: {
    fontSize: 12,
    color: COLORS.neutral400,
    marginTop: 2,
  },
  friendItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendPickerFooter: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  friendPickerButton: {
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  friendPickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyFriendsText: {
    textAlign: 'center',
    color: COLORS.neutral400,
    fontSize: 14,
    paddingVertical: 40,
  },
});