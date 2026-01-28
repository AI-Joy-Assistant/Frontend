import React, { useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
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
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { getBackendUrl } from '../utils/environment';
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
  AlertTriangle,
  Star,
  MapPin,
  Users,
  Search,
  UserPlus,
  Info,
  User as UserIcon
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
import WebSocketService from '../services/WebSocketService';
import NotificationPanel from '../components/NotificationPanel';
import { badgeStore } from '../store/badgeStore';
import { useTutorial } from '../store/TutorialContext';
import { FAKE_CONFIRMED_SCHEDULE } from '../constants/tutorialData';
import { dataCache, CACHE_KEYS } from '../utils/dataCache';
import { homeStore } from '../store/homeStore';
import { friendsStore } from '../store/friendsStore';

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    isTutorialActive,
    currentStep,
    fakeSchedule,
    registerTarget,
    currentSubStep,
    nextSubStep
  } = useTutorial();

  // homeStore에서 전역 상태 구독
  const homeState = useSyncExternalStore(
    homeStore.subscribe,
    homeStore.getSnapshot
  );
  const pendingRequests = homeState.pendingRequests;
  const notifications = homeState.notifications;

  // friendsStore에서 친구 데이터 구독
  const friendsState = useSyncExternalStore(
    friendsStore.subscribe,
    friendsStore.getSnapshot
  );

  // 현재 사용자 ID와 프로필 사진
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);

  // Dismissed/Viewed State (UI 상태로 로컬 유지)
  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [viewedRequestIds, setViewedRequestIds] = useState<string[]>([]);
  const [viewedNotificationIds, setViewedNotificationIds] = useState<string[]>([]);

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
        // authProvider도 즉시 로드 (배너 표시를 위해 필수)
        const storedAuthProvider = await AsyncStorage.getItem('authProvider');
        if (storedAuthProvider) {
          setAuthProvider(storedAuthProvider);
        }
        // 캘린더 연동 상태 캐시 로드 (깜빡임 방지)
        const cachedCalendarLinked = await AsyncStorage.getItem('isCalendarLinked');
        if (cachedCalendarLinked !== null) {
          setIsCalendarLinked(cachedCalendarLinked === 'true');
        }
      } catch (error) {
        console.error('Failed to load stored data:', error);
      }
    };
    loadStoredData();
  }, []);

  // Apple 로그인 사용자의 캘린더 연동 상태 체크 (authProvider 변경 시)
  useEffect(() => {
    if (authProvider === 'apple') {
      checkCalendarLinkStatus();
      // dismissed 상태도 복원
      AsyncStorage.getItem('calendarIntegrationDismissed').then(val => {
        if (val === 'true') setIsCalendarDismissed(true);
      });
    }
  }, [authProvider]);

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





  // 캘린더 연동 상태 확인
  const checkCalendarLinkStatus = async () => {
    console.log('[DEBUG] checkCalendarLinkStatus 호출됨');
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('[DEBUG] checkCalendarLinkStatus - 토큰 없음');
        return;
      }

      const response = await fetch(`${API_BASE}/calendar/link-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('[DEBUG] calendar/link-status 응답:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] link-status 데이터:', data);
        const linked = data.is_linked || false;
        setIsCalendarLinked(linked);
        // 캐시에 저장 (다음 화면 진입 시 깜빡임 방지)
        await AsyncStorage.setItem('isCalendarLinked', linked ? 'true' : 'false');
      } else {
        // API 호출 실패 시 (연동 안 됨으로 처리)
        console.log('[DEBUG] API 실패 - isCalendarLinked = false');
        setIsCalendarLinked(false);
        await AsyncStorage.setItem('isCalendarLinked', 'false');
      }
    } catch (error) {
      console.error('캘린더 연동 상태 확인 실패:', error);
      // 에러 시에도 연동 안 됨으로 처리 (버튼 표시)
      setIsCalendarLinked(false);
    }
  };

  // 현재 사용자 정보 조회
  const fetchCurrentUser = async (useCache = true) => {
    const cacheKey = CACHE_KEYS.USER_ME;

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      // 캐시 먼저 확인
      if (useCache) {
        const cached = dataCache.get<any>(cacheKey);
        if (cached.exists && cached.data) {
          setCurrentUserId(cached.data.id);
          if (cached.data.picture) setUserPicture(cached.data.picture);

          if (!cached.isStale) return;
          if (dataCache.isPending(cacheKey)) return;
        }
      }

      // 중복 요청 방지
      if (dataCache.isPending(cacheKey)) return;
      dataCache.markPending(cacheKey);

      // AsyncStorage에서 프로필 사진 가져오기 (백업)
      const storedPicture = await AsyncStorage.getItem('userPicture');
      if (storedPicture) {
        setUserPicture(storedPicture);
      }

      // AsyncStorage에서 auth provider 가져오기
      const storedAuthProvider = await AsyncStorage.getItem('authProvider');
      if (storedAuthProvider) {
        setAuthProvider(storedAuthProvider);
        if (storedAuthProvider === 'apple') {
          checkCalendarLinkStatus();
        }
      }

      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.id);
        if (data.picture) {
          setUserPicture(data.picture);
        }
        dataCache.set(cacheKey, data, 5 * 60 * 1000); // 5분 캐시
      }
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      dataCache.invalidate(cacheKey);
    }
  };

  // 화면에 포커스될 때마다 요청 및 알림 새로고침 (캐시 기반)
  useFocusEffect(
    useCallback(() => {
      // 캐시 기반 데이터 로딩
      homeStore.fetchAll();
      friendsStore.fetchAll();
      fetchCurrentUser();
      // 배지 폴링은 BottomNav에서 처리하므로 여기서는 제거
      // Apple 캘린더 연동 상태 체크는 별도 useEffect에서 authProvider 변경 시 처리
    }, [])
  );

  // WebSocket for real-time A2A notifications (using singleton service)
  useEffect(() => {
    if (!currentUserId) return;

    // 싱글톤 서비스 연결 (이미 연결되어 있으면 스킵)
    WebSocketService.connect(currentUserId);

    // HomeScreen에서 필요한 메시지만 구독
    const unsubscribe = WebSocketService.subscribe(
      'HomeScreen',
      ['a2a_request', 'friend_request', 'friend_accepted', 'notification', 'a2a_status_changed'],
      (data) => {
        console.log("[WS:Home] WS Event:", data.type);

        // WebSocket 이벤트 시 캐시 무효화 후 새로고침
        homeStore.invalidate();
        homeStore.refresh();
        friendsStore.invalidate();
        friendsStore.refresh();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

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
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleItem | null>(null);
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
  // friends 데이터는 friendsState.friends에서 가져옴
  const friends = friendsState.friends;
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [isSubmittingA2A, setIsSubmittingA2A] = useState(false);

  // Custom Alert Modal State
  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [onCustomAlertConfirm, setOnCustomAlertConfirm] = useState<(() => void) | null>(null);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');
  const [customAlertType, setCustomAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Google Calendar Integration Modal State
  const [showCalendarIntegrationModal, setShowCalendarIntegrationModal] = useState(false);
  const [isCalendarLinked, setIsCalendarLinked] = useState<boolean | null>(null);
  const [isCalendarDismissed, setIsCalendarDismissed] = useState(false);

  // Date Picker Modal State
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerMode, setPickerMode] = useState<'YEAR' | 'MONTH'>('YEAR');

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

  // Google 캘린더 연동 핸들러
  const handleConnectGoogleCalendar = async () => {
    try {
      setIsLoading(true);
      const BACKEND_URL = getBackendUrl();
      const token = await AsyncStorage.getItem('accessToken');

      // 1. 캘린더 연동 전용 URL 가져오기 (Apple 로그인 사용자용)
      console.log('Token for calendar link:', token ? 'exists' : 'null');
      console.log('Backend URL:', BACKEND_URL);

      const authUrlRes = await fetch(`${BACKEND_URL}/calendar/link-url`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      console.log('Auth URL response status:', authUrlRes.status);

      if (!authUrlRes.ok) {
        const errorBody = await authUrlRes.text();
        console.error('Auth URL error:', errorBody);
        throw new Error(`인증 URL 요청 실패: ${authUrlRes.status} - ${errorBody}`);
      }
      const { auth_url } = await authUrlRes.json();

      // 2. WebBrowser로 인증 진행
      // 백엔드에서 frontend://calendar-linked 로 리다이렉트
      const result = await WebBrowser.openAuthSessionAsync(
        auth_url,
        'frontend://calendar-linked'
      );

      console.log('OAuth result type:', result.type);
      console.log('OAuth result:', JSON.stringify(result));

      if (result.type === 'success' && result.url) {
        // 3. URL에서 success 또는 error 파라미터 확인
        const url = new URL(result.url);
        const success = url.searchParams.get('success');
        const errorParam = url.searchParams.get('error');
        const returnedToken = url.searchParams.get('token');

        console.log('Success:', success, 'Error:', errorParam, 'Token:', returnedToken);

        if (success === 'true') {
          // 새 /calendar/link-callback 방식 - 백엔드에서 이미 토큰 저장됨
          setCustomAlertTitle('성공');
          setCustomAlertMessage('Google 캘린더가 연동되었습니다!');
          setCustomAlertType('success');
          setCustomAlertVisible(true);
          setIsCalendarLinked(true);
          // 캐시에도 저장 (MyPageScreen에서 바로 반영되도록)
          await AsyncStorage.setItem('isCalendarLinked', 'true');
          dataCache.set('calendar:link-status', { is_linked: true }, 10 * 60 * 1000);
          fetchSchedules();
        } else if (errorParam) {
          setCustomAlertTitle('오류');
          setCustomAlertMessage(`캘린더 연동 실패: ${errorParam}`);
          setCustomAlertType('error');
          setCustomAlertVisible(true);
        } else if (returnedToken) {
          // 이전 방식 호환
          setCustomAlertTitle('성공');
          setCustomAlertMessage('Google 캘린더가 연동되었습니다!');
          setCustomAlertType('success');
          setCustomAlertVisible(true);
          setIsCalendarLinked(true);
          // 캐시에도 저장
          await AsyncStorage.setItem('isCalendarLinked', 'true');
          dataCache.set('calendar:link-status', { is_linked: true }, 10 * 60 * 1000);
          fetchSchedules();
        } else {
          setCustomAlertTitle('알림');
          setCustomAlertMessage('연동이 완료되었습니다. 캘린더를 새로고침합니다.');
          setCustomAlertType('info');
          setCustomAlertVisible(true);
          setIsCalendarLinked(true);
          // 캐시에도 저장
          await AsyncStorage.setItem('isCalendarLinked', 'true');
          dataCache.set('calendar:link-status', { is_linked: true }, 10 * 60 * 1000);
          fetchSchedules();
        }
      } else if (result.type === 'cancel') {
        console.log('User cancelled calendar auth');
      } else if (result.type === 'dismiss') {
        console.log('Browser dismissed');
      }
    } catch (error) {
      console.error('Calendar link error:', error);
      setCustomAlertTitle('오류');
      setCustomAlertMessage('캘린더 연동 중 오류가 발생했습니다.');
      setCustomAlertType('error');
      setCustomAlertVisible(true);
    } finally {
      setIsLoading(false);
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

          // [FIX] toISOString() 대신 로컬 시간대 기반 날짜 추출
          // toISOString()은 UTC로 변환하여 KST 오전 시간이 전날로 표시되는 문제 발생
          const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          date = formatLocalDate(start);
          endDateStr = formatLocalDate(end);

          startTime = start.toTimeString().slice(0, 5);
          endTime = end.toTimeString().slice(0, 5);
        }

        // A2A 일정인지 확인 (백엔드에서 A2A 일정 생성 시 description에 마커 저장)
        const description = event.description || '';
        const isA2A = description.includes('A2A Agent') || description.includes('session_id:') || description.includes('[A2A]');

        // [NEW] A2A 일정의 경우 description에서 참여자 정보 파싱
        let participants: string[] = event.attendees?.map(a => a.displayName || a.email) || [];
        if (isA2A && description.includes('[A2A_DATA]')) {
          try {
            const match = description.match(/\[A2A_DATA\](.*?)\[\/A2A_DATA\]/s);
            if (match && match[1]) {
              const a2aData = JSON.parse(match[1]);
              if (a2aData.participants && Array.isArray(a2aData.participants)) {
                participants = a2aData.participants;
              }
            }
          } catch (e) {
            console.warn('Failed to parse A2A data from description:', e);
          }
        }

        return {
          id: event.id,
          title: event.summary,
          date: date,
          endDate: date !== endDateStr ? endDateStr : undefined,
          time: isAllDayEvent ? '종일' : `${startTime} - ${endTime}`,
          participants: participants,
          type: isA2A ? 'A2A' : 'NORMAL',
          location: event.location
        };
      });

      // [NEW] 튜토리얼 중이고 'CHECK_HOME' 또는 'COMPLETE' 단계라면 가짜 확정 일정 추가
      if (isTutorialActive && (currentStep === 'CHECK_HOME' || currentStep === 'COMPLETE')) {
        console.log('📅 Injecting fake tutorial schedule');
        mappedSchedules.push({
          id: fakeSchedule.id,
          title: fakeSchedule.title,
          date: fakeSchedule.date,
          time: fakeSchedule.time,
          participants: fakeSchedule.participants,
          type: 'A2A',
          location: fakeSchedule.location,
          hasConflict: false,
          conflictWith: []
        });
      }

      // 충돌(중복) 감지 로직
      const schedulesWithConflicts = detectScheduleConflicts(mappedSchedules);
      setSchedules(schedulesWithConflicts);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 시간 겹침 감지 함수
  const detectScheduleConflicts = (schedules: ScheduleItem[]): ScheduleItem[] => {
    // 시간 문자열을 분으로 변환 (예: "18:00" -> 1080)
    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr || timeStr === '종일') return -1;
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return -1;
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    };

    return schedules.map(schedule => {
      // 종일 일정은 충돌 체크 제외
      if (schedule.time === '종일' || schedule.time.includes('종일')) {
        return { ...schedule, hasConflict: false, conflictWith: [] };
      }

      // 시간 범위 파싱 ("18:00 - 20:00")
      const timeParts = schedule.time.split(' - ');
      if (timeParts.length !== 2) {
        return { ...schedule, hasConflict: false, conflictWith: [] };
      }

      const startMins = parseTimeToMinutes(timeParts[0]);
      const endMins = parseTimeToMinutes(timeParts[1]);
      if (startMins === -1 || endMins === -1) {
        return { ...schedule, hasConflict: false, conflictWith: [] };
      }

      // A2A 일정끼리 겹치는 경우만 감지 (일반 일정은 무시)
      const conflicts = schedules.filter(other => {
        if (other.id === schedule.id) return false;
        if (schedule.type !== 'A2A') return false;  // 현재 일정이 A2A가 아니면 충돌 체크 안함
        if (other.type !== 'A2A') return false;     // 상대 일정이 A2A가 아니면 충돌 체크 안함
        if (other.time === '종일' || other.time.includes('종일')) return false;

        // 같은 날짜인지 확인 (멀티데이 일정 고려)
        const scheduleStart = schedule.date;
        const scheduleEnd = schedule.endDate || schedule.date;
        const otherStart = other.date;
        const otherEnd = other.endDate || other.date;

        // 날짜 범위가 겹치는지 확인
        if (scheduleEnd < otherStart || otherEnd < scheduleStart) return false;

        // 시간 범위 파싱
        const otherTimeParts = other.time.split(' - ');
        if (otherTimeParts.length !== 2) return false;

        const otherStartMins = parseTimeToMinutes(otherTimeParts[0]);
        const otherEndMins = parseTimeToMinutes(otherTimeParts[1]);
        if (otherStartMins === -1 || otherEndMins === -1) return false;

        // 시간 겹침 조건: (start1 < end2) && (start2 < end1)
        return startMins < otherEndMins && otherStartMins < endMins;
      });

      return {
        ...schedule,
        hasConflict: conflicts.length > 0,
        conflictWith: conflicts.map(c => c.id)
      };
    });
  };

  useEffect(() => {
    fetchSchedules();
  }, [viewYear, viewMonth, isTutorialActive, currentStep]);

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

  // [REMOVED] fetchFriends - friendsStore.fetchAll()로 대체됨

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
    // 친구 목록 새로고침 (캐시 기반)
    friendsStore.fetchAll();
    setShowScheduleModal(true);

    // [NEW] 튜토리얼: 홈 추가 버튼 클릭 처리 (모달 열리는 시간 고려)
    if (isTutorialActive && currentStep === 'COMPLETE' && currentSubStep?.id === 'show_home_add_button') {
      setTimeout(() => {
        nextSubStep();
      }, 500);
    }
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
    setFormLocation(schedule.location || '');
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

    // 커스텀 알림 모달을 표시하는 함수
    const showAlert = (title: string, message: string, onConfirm?: () => void) => {
      const type = title.includes('완료') || title.includes('성공') ? 'success' :
        title.includes('오류') ? 'error' : 'info';
      setCustomAlertTitle(title);
      setCustomAlertMessage(message);
      setCustomAlertType(type);
      setOnCustomAlertConfirm(() => onConfirm || null);
      setCustomAlertVisible(true);
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

        // 시간 범위 문자열 생성 (시작~종료)
        const timeStr = isAllDay ? '종일' : (formEndTime && formEndTime !== formStartTime
          ? `${formStartTime}~${formEndTime}`
          : `${formStartTime}`);
        const locationStr = formLocation ? ` ${formLocation}에서` : '';

        // A2A 요청 메시지 생성
        const scheduleMessage = `${dateRangeStr} ${timeStr}에${locationStr} "${formTitle}" 일정 잡아줘`;

        // 날짜 차이(duration_nights) 계산
        let durationParams = {};
        if (formEndDate && formEndDate !== formStartDate) {
          const start = new Date(formStartDate);
          const end = new Date(formEndDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          durationParams = {
            duration_nights: diffDays,
            start_date: formStartDate,
            end_date: formEndDate
          };
        } else {
          durationParams = {
            start_date: formStartDate,
            end_date: formStartDate
          };
        }

        console.log('[HomeScreen A2A Debug] Sending request:', {
          message: scheduleMessage,
          date: formStartDate,
          start_time: formStartTime,
          end_time: formEndTime,
          selected_friends: selectedFriendIds,
          is_all_day: isAllDay,  // ✅ 디버그용 추가
          ...durationParams
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
            start_time: isAllDay ? undefined : formStartTime,  // 시작 시간
            end_time: isAllDay ? undefined : formEndTime,      // 종료 시간
            is_all_day: isAllDay,  // ✅ 종일 여부 추가
            ...durationParams  // ✅ 다박 정보 추가
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
            // 성공 피드백 후 A2A 화면으로 이동
            showAlert(
              '일정 요청 완료',
              '참여자들에게 일정 요청이 전송되었습니다.',
              () => navigation.navigate('A2A', { initialLogId: sessionId })
            );
          } else {
            // scheduleInfo가 없거나 session_ids가 없어도 요청이 성공했으면 알림
            console.log('[HomeScreen A2A Debug] No session_ids in response, but request succeeded');
            console.log('[HomeScreen A2A Debug] scheduleInfo:', JSON.stringify(scheduleInfo, null, 2));
            console.log('[HomeScreen A2A Debug] responseData:', JSON.stringify(responseData, null, 2));
            showAlert('오류', 'A2A 세션이 생성되지 않았습니다. 콘솔을 확인해주세요.');
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
        location: formLocation,
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

  const handleDeleteClick = () => {
    if (!editingScheduleId) return;

    // 삭제할 일정 정보 설정 후 커스텀 모달 표시
    const schedule = schedules.find(s => s.id === editingScheduleId);
    if (schedule) {
      setScheduleToDelete(schedule);
      setShowDeleteConfirm(true);
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
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Top Header with Logo and Profile */}
        <View style={[styles.topHeader, { paddingTop: insets.top + 14 }]}>
          <View style={styles.logoContainer}>
            <View style={styles.logoImageWrapper}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>JOYNER</Text>
          </View>

        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Google Calendar Link Button - Apple 로그인 사용자에게만 표시, 연동 완료 시 숨김 */}
          {authProvider === 'apple' && isCalendarLinked !== true && !isCalendarDismissed && (
            <TouchableOpacity
              onPress={() => setShowCalendarIntegrationModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.primaryBg,
                marginHorizontal: 20,
                marginTop: 15,
                marginBottom: 3,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: COLORS.primaryLight,
              }}
            >
              <CalendarIcon size={26} color={COLORS.primaryMain} style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.primaryMain }}>
                  Google 캘린더 연동하기
                </Text>
                <Text style={{ fontSize: 13, color: '#8B95A5', marginTop: 3 }}>
                  일정을 자동으로 동기화하세요
                </Text>
              </View>
              <ChevronRight size={22} color={COLORS.primaryMain} />
            </TouchableOpacity>
          )}

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
                <TouchableOpacity
                  onPress={() => {
                    setPickerYear(viewYear);
                    setPickerMonth(viewMonth);
                    setPickerMode('YEAR');
                    setDatePickerVisible(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}
                >
                  <Text style={styles.calendarTitle}>{getDisplayDateHeader()}</Text>
                  <ChevronDown size={20} color={COLORS.neutralSlate} style={{ marginLeft: 0 }} />
                </TouchableOpacity>
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
                                { backgroundColor: getScheduleColor(evt).bg },
                                evt.hasConflict && evt.type === 'A2A' && { backgroundColor: '#EF4444' }  // A2A 충돌 시 빨간색
                              ]} />
                            ))}
                            {events.length > 3 && <View style={[styles.dot, { backgroundColor: COLORS.neutral300 }]} />}
                            {/* A2A 일정 중 충돌 있는 날짜에 경고 표시 */}
                            {events.some(e => e.hasConflict && e.type === 'A2A') && (
                              <View style={styles.conflictDot}>
                                <AlertTriangle size={10} color="#EF4444" />
                              </View>
                            )}
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
                style={[
                  styles.addButton,
                  isTutorialActive && currentStep === 'COMPLETE' && currentSubStep?.id === 'show_home_add_button' && {
                    borderColor: COLORS.primaryMain,
                    borderWidth: 2,
                    backgroundColor: '#EDE9FE',
                    shadowColor: COLORS.primaryMain,
                    elevation: 5
                  }
                ]}
                testID="btn_home_add"
                ref={(r) => { if (r) registerTarget('btn_home_add', r); }}
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
                        <Text style={[styles.scheduleTitle, { flex: 1 }]}>{schedule.title}</Text>
                        <View style={styles.badgesContainer}>
                          {schedule.hasConflict && schedule.type === 'A2A' && (
                            <View style={styles.conflictBadge}>
                              <AlertTriangle size={10} color="#EF4444" />
                              <Text style={styles.conflictBadgeText}>중복</Text>
                            </View>
                          )}
                          {schedule.type === 'A2A' && (
                            <View style={styles.a2aBadge}>
                              <Text style={styles.a2aBadgeText}>A2A</Text>
                            </View>
                          )}
                        </View>
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

                      {/* 참여자 아바타/명수 표시 제거됨 - 상세 카드에서만 표시 */}
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

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDatePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 24,
                width: '85%',
                maxWidth: 320,
                padding: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 20, textAlign: 'center' }}>
                  날짜 이동
                </Text>

                {pickerMode === 'YEAR' ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => setPickerYear(prev => prev - 12)}
                      >
                        <ChevronLeft size={24} color={COLORS.neutral500} />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.primaryMain, marginHorizontal: 20 }}>
                        {Math.floor(pickerYear / 12) * 12} - {Math.floor(pickerYear / 12) * 12 + 11}
                      </Text>
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => setPickerYear(prev => prev + 12)}
                      >
                        <ChevronRight size={24} color={COLORS.neutral500} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 }}>
                      {Array.from({ length: 12 }, (_, i) => Math.floor(pickerYear / 12) * 12 + i).map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={{
                            width: '30%',
                            paddingVertical: 12,
                            marginBottom: 10,
                            borderRadius: 12,
                            backgroundColor: pickerYear === year ? COLORS.primaryMain : COLORS.neutralLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => {
                            setPickerYear(year);
                            setPickerMode('MONTH');
                          }}
                        >
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: pickerYear === year ? 'white' : COLORS.neutralSlate
                          }}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    {/* Header with Year Selector (Click to go back to YEAR mode) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => setPickerYear(prev => prev - 1)}
                      >
                        <ChevronLeft size={24} color={COLORS.neutral500} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setPickerMode('YEAR')}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.primaryMain, marginHorizontal: 20 }}>
                          {pickerYear}년
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => setPickerYear(prev => prev + 1)}
                      >
                        <ChevronRight size={24} color={COLORS.neutral500} />
                      </TouchableOpacity>
                    </View>

                    {/* Month Grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 }}>
                      {Array.from({ length: 12 }, (_, i) => i).map((month) => (
                        <TouchableOpacity
                          key={month}
                          style={{
                            width: '30%',
                            paddingVertical: 12,
                            marginBottom: 10,
                            borderRadius: 12,
                            backgroundColor: pickerMonth === month ? COLORS.primaryMain : COLORS.neutralLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setPickerMonth(month)}
                        >
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: pickerMonth === month ? 'white' : COLORS.neutralSlate
                          }}>
                            {month + 1}월
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Actions - Only show in Month mode or always? Usually "Move" is needed in Month mode. In Year mode, Cancel is enough? Or allow Move. */}
                {/* User flow: Year -> Month -> Move/Cancel. */}
                {/* Let's show buttons always, but in Year mode 'Move' might be confusing if they haven't picked month. */}
                {/* But they might want to just change year and keep current month. So allow buttons in both. */}

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 16,
                      backgroundColor: COLORS.neutralLight,
                      alignItems: 'center',
                    }}
                    onPress={() => setDatePickerVisible(false)}
                  >
                    <Text style={{ color: COLORS.neutral500, fontWeight: '600', fontSize: 16 }}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 16,
                      backgroundColor: COLORS.primaryMain,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setViewYear(pickerYear);
                      setViewMonth(pickerMonth);
                      // 선택한 달의 1일로 설정
                      const newDate = new Date(pickerYear, pickerMonth, 1);
                      setSelectedDate(formatDate(pickerYear, pickerMonth, 1));
                      setDatePickerVisible(false);
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>이동</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
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
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color={COLORS.neutral400} />
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

                {/* 장소 입력 (모든 일정) */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>장소 (선택)</Text>
                  <View style={styles.iconInput}>
                    <MapPin size={18} color={COLORS.neutral400} />
                    <TextInput
                      style={styles.locationInput}
                      value={formLocation}
                      onChangeText={setFormLocation}
                      placeholder="장소를 입력하세요 (선택)"
                      placeholderTextColor={COLORS.neutral400}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>시작 날짜</Text>
                    <TouchableOpacity
                      style={[
                        styles.iconInput,
                        isTutorialActive && currentStep === 'COMPLETE' && currentSubStep?.id === 'start_end_time' && {
                          borderColor: COLORS.primaryMain,
                          borderWidth: 2,
                          backgroundColor: '#EDE9FE'
                        }
                      ]}
                      onPress={() => {
                        setShowStartDatePicker(true);
                        // [NEW] 튜토리얼: 날짜 클릭 시 다음 단계로
                        if (isTutorialActive && currentStep === 'COMPLETE' && currentSubStep?.id === 'start_end_time') {
                          nextSubStep();
                        }
                      }}
                      testID="input_start_date"
                      ref={(r) => { if (r) registerTarget('input_start_date', r); }}
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
                          selectedFriendIds.length > 0 ? '일정 요청하기' : '추가하기'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Friend Picker Modal - rendered inside Schedule Modal */}
            <Modal
              visible={showFriendPicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowFriendPicker(false)}
            >
              <View style={styles.friendPickerOverlay}>
                <View style={styles.friendPickerContainer}>
                  <View style={styles.friendPickerHandle} />
                  <View style={styles.friendPickerHeader}>
                    <View>
                      <Text style={styles.friendPickerTitle}>참여자 선택</Text>
                      <Text style={styles.friendPickerSubtitle}>일정에 초대할 친구를 선택해주세요</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                      <X size={24} color={COLORS.neutralGray} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.friendSearchContainer}>
                    <Search size={18} color={COLORS.neutral400} />
                    <TextInput
                      style={styles.friendSearchInput}
                      value={friendSearchQuery}
                      onChangeText={setFriendSearchQuery}
                      placeholder="이름 또는 이메일로 검색"
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
                            <View style={[styles.friendItemAvatar, { backgroundColor: COLORS.neutral100, alignItems: 'center', justifyContent: 'center' }]}>
                              <UserIcon size={20} color={COLORS.neutral400} />
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
                        선택 완료 ({selectedFriendIds.length}명)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
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

                  {selectedDetailSchedule?.location && (
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}>
                        <MapPin size={20} color={COLORS.neutral500} />
                      </View>
                      <View>
                        <Text style={styles.infoLabel}>장소</Text>
                        <Text style={styles.infoValue}>
                          {selectedDetailSchedule.location}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* [NEW] A2A 일정의 경우 참여자 목록 표시 */}
                  {selectedDetailSchedule?.type === 'A2A' && selectedDetailSchedule?.participants && selectedDetailSchedule.participants.length > 0 && (
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}>
                        <Users size={20} color={COLORS.neutral500} />
                      </View>
                      <View>
                        <Text style={styles.infoLabel}>참여자</Text>
                        <Text style={styles.infoValue}>
                          {selectedDetailSchedule.participants.join(', ')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.detailButtonRow}>
                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={() => {
                      if (!selectedDetailSchedule) return;
                      setScheduleToDelete(selectedDetailSchedule);
                      setShowDeleteConfirm(true);
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

      {/* 일정 삭제 확인 모달 */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIconContainer}>
              <Trash2 size={24} color="#F87171" />
            </View>
            <Text style={styles.deleteModalTitle}>일정 삭제</Text>
            <Text style={styles.deleteModalMessage}>
              <Text style={{ fontWeight: 'bold' }}>{scheduleToDelete?.title}</Text>
              {'\n'}이 일정을 삭제하시겠습니까?
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setScheduleToDelete(null);
                }}
              >
                <Text style={styles.deleteModalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={async () => {
                  if (scheduleToDelete) {
                    try {
                      await calendarService.deleteCalendarEvent(scheduleToDelete.id);
                      setShowDetailModal(false);
                      setShowScheduleModal(false);
                      fetchSchedules();
                    } catch (error) {
                      console.error('일정 삭제 실패:', error);
                    }
                  }
                  setShowDeleteConfirm(false);
                  setScheduleToDelete(null);
                }}
              >
                <Text style={styles.deleteModalConfirmText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 커스텀 알림 모달 */}
      <Modal
        visible={customAlertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomAlertVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCustomAlertVisible(false)}>
          <View style={styles.deleteModalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 24,
                width: '90%',
                maxWidth: 320,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}>
                <View style={[
                  styles.deleteModalIconContainer,
                  {
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    marginBottom: 20,
                    backgroundColor: customAlertType === 'success' ? '#E0E7FF' :
                      customAlertType === 'error' ? '#FEE2E2' : '#E0E7FF'
                  }
                ]}>

                  {customAlertType === 'success' ? (
                    <Check size={28} color={COLORS.primaryDark} />
                  ) : customAlertType === 'error' ? (
                    <X size={28} color="#DC2626" />
                  ) : (
                    <Info size={28} color={COLORS.primaryMain} />
                  )}
                </View>
                <Text style={[styles.deleteModalTitle, { fontSize: 20, marginBottom: 12, textAlign: 'center' }]}>{customAlertTitle}</Text>
                <Text style={[styles.deleteModalMessage, { fontSize: 16, lineHeight: 24, marginBottom: 32 }]}>
                  {customAlertMessage}
                </Text>
                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 50,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                    backgroundColor: customAlertType === 'success' ? COLORS.primaryDark :
                      customAlertType === 'error' ? '#EF4444' : COLORS.primaryMain
                  }}
                  onPress={() => {
                    setCustomAlertVisible(false);
                    if (onCustomAlertConfirm) {
                      onCustomAlertConfirm();
                      setOnCustomAlertConfirm(null);
                    }
                  }}
                >
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: 'white',
                  }}>
                    확인
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Google 캘린더 연동 설명 모달 */}
      <Modal
        visible={showCalendarIntegrationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendarIntegrationModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCalendarIntegrationModal(false)}>
          <View style={styles.deleteModalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 20,
                width: '92%',
                maxWidth: 360,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}>
                {/* 아이콘 */}
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#E0E7FF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 14,
                }}>
                  <CalendarIcon size={26} color={COLORS.primaryMain} />
                </View>

                {/* 제목 */}
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#1F2937',
                  marginBottom: 12,
                  textAlign: 'center',
                }}>
                  Google Calendar 연동하기
                </Text>

                {/* 설명 */}
                <Text style={{
                  fontSize: 14,
                  color: '#6B7280',
                  lineHeight: 20,
                  textAlign: 'center',
                  marginBottom: 18,
                }}>
                  연동 시 기존 일정을 자동으로 가져오고,{'\n'}앱에서 추가한 일정도 동기화됩니다.{'\n'}연동하지 않으면 <Text style={{ fontWeight: '600', color: COLORS.primaryMain }}>JOYNER 자체 캘린더</Text>로만{'\n'}사용할 수 있습니다.
                </Text>

                {/* 버튼들 */}
                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 50,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: COLORS.primaryMain,
                    marginBottom: 10,
                  }}
                  onPress={() => {
                    setShowCalendarIntegrationModal(false);
                    handleConnectGoogleCalendar();
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: 'white',
                  }}>
                    연동하기
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 50,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: '#F3F4F6',
                  }}
                  onPress={async () => {
                    setShowCalendarIntegrationModal(false);
                    setIsCalendarDismissed(true);
                    await AsyncStorage.setItem('calendarIntegrationDismissed', 'true');
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#6B7280',
                  }}>
                    연동하지 않기
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomNav activeTab={Tab.HOME} />
    </View>
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
  // Top Header Styles
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderTopWidth: 0,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImageWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryMain,
    letterSpacing: 1.5,
  },
  profileButton: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  profilePlaceholderText: {
    fontSize: 18,
  },
  profileRing: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
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
    marginLeft: -12, // Shift left as requested
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
    marginHorizontal: 4,
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
  conflictDot: {
    marginLeft: 2,
  },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  conflictBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 2,
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
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  // Friend Picker Modal Styles (exact copy from RequestMeetingScreen)
  friendPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  friendPickerContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    maxHeight: '85%',
    flex: 1,
  },
  friendPickerHandle: {
    width: 48,
    height: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
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
    color: COLORS.neutralSlate,
  },
  friendPickerSubtitle: {
    fontSize: 14,
    color: COLORS.neutralGray,
    marginTop: 4,
  },
  friendSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutralLight,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  friendSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.neutralSlate,
  },
  friendList: {
    paddingHorizontal: 0,
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    padding: 24,
    paddingBottom: 40,
    backgroundColor: COLORS.white,
  },
  friendPickerButton: {
    backgroundColor: '#3730A3',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  friendPickerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyFriendsText: {
    textAlign: 'center',
    color: COLORS.neutral400,
    fontSize: 14,
    paddingVertical: 40,
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  deleteModalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 16,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F87171',
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});