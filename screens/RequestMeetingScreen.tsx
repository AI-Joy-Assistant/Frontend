import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TextInput,
    Modal,
    ActivityIndicator,
    Platform,
    FlatList,
    Alert,
} from 'react-native';
import {
    Clock,
    ArrowRight,
    Check,
    Sparkles,
    X,
    Plus,
    Search,
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Users,
    MapPin,
    Sun,
    Moon,
    Plane,
    Minus,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import { getBackendUrl } from '../utils/environment';

const COLORS = {
    primaryMain: '#3730A3',
    primaryLight: '#818CF8',
    primaryDark: '#0E004E',
    primaryBg: '#EEF2FF',
    neutralSlate: '#334155',
    neutralGray: '#94A3B8',
    neutralLight: '#F8FAFC',
    white: '#FFFFFF',
    indigo50: '#EEF2FF',
    indigo100: '#E0E7FF',
    indigo700: '#4338CA',
    amber50: '#FFFBEB',
    amber100: '#FEF3C7',
    amber700: '#B45309',
};

interface Friend {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

interface FriendFromAPI {
    id: string;
    friend: {
        id: string;
        name: string;
        email: string;
        picture?: string;
    };
    created_at: string;
}

const RequestMeetingScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(true);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>('');  // ✅ 현재 사용자 ID

    // Request details state
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');

    const [showFriendModal, setShowFriendModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('18:00');

    const [activePicker, setActivePicker] = useState<'startDate' | 'endDate' | 'startTime' | 'endTime' | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [appliedRecIndex, setAppliedRecIndex] = useState<number | null>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);

    // Calendar state
    const [calendarYear, setCalendarYear] = useState(today.getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);

    // Time picker state
    const [tempAmPm, setTempAmPm] = useState<'오전' | '오후'>('오전');
    const [tempHour, setTempHour] = useState(9);
    const [tempMinute, setTempMinute] = useState(0);

    // Duration picker state
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [durationHour, setDurationHour] = useState(1);
    const [durationMinute, setDurationMinute] = useState(0);
    const [tempDurationHour, setTempDurationHour] = useState(1);
    const [tempDurationMinute, setTempDurationMinute] = useState(0);

    const totalParticipants = selectedFriends.length + 1;
    const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const minutes = [0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const durationHours = [0, 1, 2, 3, 4, 5, 6];
    const durationMinutes = [0, 15, 30, 45];
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    // Duration Nights State
    const [durationNights, setDurationNights] = useState(0);

    const handleDurationNightChange = (change: number) => {
        const newValue = Math.max(0, durationNights + change);
        setDurationNights(newValue);
    };

    // Generate calendar days
    const getCalendarDays = () => {
        const firstDay = new Date(calendarYear, calendarMonth - 1, 1).getDay();
        const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
        const daysInPrevMonth = new Date(calendarYear, calendarMonth - 1, 0).getDate();

        const days: { day: number; isCurrentMonth: boolean }[] = [];

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true });
        }

        // Next month days
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, isCurrentMonth: false });
        }

        return days;
    };

    const handlePrevMonth = () => {
        if (calendarMonth === 1) {
            setCalendarMonth(12);
            setCalendarYear(calendarYear - 1);
        } else {
            setCalendarMonth(calendarMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (calendarMonth === 12) {
            setCalendarMonth(1);
            setCalendarYear(calendarYear + 1);
        } else {
            setCalendarMonth(calendarMonth + 1);
        }
    };

    const handleDateSelect = (day: number, isCurrentMonth: boolean) => {
        if (!isCurrentMonth) return;
        const dateStr = `${calendarYear}-${calendarMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        if (activePicker === 'startDate') setStartDate(dateStr);
        else if (activePicker === 'endDate') setEndDate(dateStr);
        setActivePicker(null);
        setHasAnalyzed(false);
    };

    const formatDisplayDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${parseInt(month)}월 ${parseInt(day)}일`;
    };

    const openTimePicker = (type: 'startTime' | 'endTime') => {
        const timeStr = type === 'startTime' ? startTime : endTime;
        const [hStr, mStr] = timeStr.split(':');
        let h = parseInt(hStr);
        const m = parseInt(mStr);
        setTempAmPm(h >= 12 ? '오후' : '오전');
        setTempHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
        setTempMinute(m);
        setActivePicker(type);
    };

    const confirmTimePicker = () => {
        let h = tempHour;
        if (tempAmPm === '오후' && h !== 12) h += 12;
        if (tempAmPm === '오전' && h === 12) h = 0;
        const timeStr = `${h.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`;
        if (activePicker === 'startTime') setStartTime(timeStr);
        else if (activePicker === 'endTime') setEndTime(timeStr);
        setActivePicker(null);
        setHasAnalyzed(false);
    };

    const openDurationPicker = () => {
        setTempDurationHour(durationHour);
        setTempDurationMinute(durationMinute);
        setShowDurationPicker(true);
    };

    const confirmDurationPicker = () => {
        setDurationHour(tempDurationHour);
        setDurationMinute(tempDurationMinute);
        setShowDurationPicker(false);
        setHasAnalyzed(false);
    };

    const formatDuration = () => {
        if (durationHour === 0 && durationMinute === 0) return '0분';
        if (durationHour === 0) return `${durationMinute}분`;
        if (durationMinute === 0) return `${durationHour}시간`;
        return `${durationHour}시간 ${durationMinute.toString().padStart(2, '0')}분`;
    };

    // ✅ 현재 사용자 ID 가져오기 (API 호출)
    useEffect(() => {
        const loadUserId = async () => {
            try {
                const token = await AsyncStorage.getItem('accessToken');
                if (!token) return;

                const response = await fetch(`${getBackendUrl()}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setCurrentUserId(data.id);
                }
            } catch (error) {
                console.error('사용자 ID 조회 실패:', error);
            }
        };
        loadUserId();
    }, []);

    // Fetch friends from API
    const fetchFriends = async () => {
        try {
            setLoadingFriends(true);
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;

            const response = await fetch(`${getBackendUrl()}/friends/list`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const friendsList: Friend[] = (data.friends || []).map((f: FriendFromAPI) => ({
                    id: f.friend.id,
                    name: f.friend.name,
                    email: f.friend.email,
                    avatar: f.friend.picture || `https://picsum.photos/seed/${f.friend.id}/150`,
                }));
                setFriends(friendsList);
            }
        } catch (error) {
            console.error('Error fetching friends:', error);
        } finally {
            setLoadingFriends(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchFriends();
        }, [])
    );

    const toggleFriendSelection = (id: string) => {
        setSelectedFriends(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
        setHasAnalyzed(false);
        setAppliedRecIndex(null);
    };

    const handleAnalyze = async () => {
        if (selectedFriends.length === 0) return;

        setIsAnalyzing(true);
        setRecommendations([]);

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                console.error('No access token');
                setIsAnalyzing(false);
                return;
            }

            // Calculate duration in minutes
            let totalDurationMinutes = (durationHour * 60) + durationMinute;
            let reqStartTime = startTime;
            let reqEndTime = endTime;

            // [Travel Mode] If multi-day, we still request single-day slots from backend
            // because backend searches for availability WITHIN a single day.
            // We will filter for CONSECUTIVE days on the client side.
            if (durationNights > 0) {
                // Request availability for "Full Day" (e.g. 08:00 ~ 22:00, 14 hours)
                // We set duration equal to the window size to ensure NO events exist in this window.
                // If there is even a 1-minute event, the 14-hour slot won't fit.
                totalDurationMinutes = 840; // 14 hours * 60

                // Use robust waking hours for travel days
                reqStartTime = '08:00';
                reqEndTime = '22:00';
            }

            // Build ISO date strings for the date range
            const timeMin = `${startDate}T00:00:00+09:00`;
            const timeMax = `${endDate}T23:59:59+09:00`;

            const response = await fetch(`${getBackendUrl()}/calendar/multi-user-free`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: selectedFriends,
                    duration_minutes: totalDurationMinutes || 60,
                    time_min: timeMin,
                    time_max: timeMax,
                    preferred_start_time: reqStartTime,
                    preferred_end_time: reqEndTime,
                    // [Travel Mode] Request more candidates + pass duration_nights
                    limit: durationNights > 0 ? 100 : 5,
                    duration_nights: durationNights,  // ✅ 박 수 전달
                }),
            });

            if (response.ok) {
                const data = await response.json();
                let recs = data.recommendations || [];

                // ✅ 최적 → 안정 → 협의 필요 순으로 정렬
                const statusOrder: Record<string, number> = { '최적': 0, '안정': 1, '협의 필요': 2 };
                recs.sort((a: any, b: any) => {
                    const orderA = statusOrder[a.status] ?? 3;
                    const orderB = statusOrder[b.status] ?? 3;
                    if (orderA !== orderB) return orderA - orderB;
                    // 같은 상태면 날짜 순
                    return a.date.localeCompare(b.date);
                });

                setRecommendations(recs);

                if (recs.length === 0) {
                    Alert.alert('알림', '조건에 맞는 추천 일정을 찾을 수 없습니다.');
                }
                setHasAnalyzed(true);
            } else {
                const errorText = await response.text();
                console.error('Failed to analyze:', errorText);
                Alert.alert('오류', '일정 분석 중 문제가 발생했습니다.\n' + errorText);
            }
        } catch (error) {
            console.error('Error analyzing schedules:', error);
            Alert.alert('오류', '서버 연결에 실패했습니다.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSend = async () => {
        if (selectedFriends.length === 0) return;

        if (!title.trim()) {
            Alert.alert('알림', '일정 제목을 입력해주세요.');
            return;
        }

        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                console.error('No access token');
                return;
            }

            // Calculate duration in minutes
            const totalDurationMinutes = (durationHour * 60) + durationMinute;

            // Build the schedule request message
            let scheduleDescription = '';
            if (durationNights > 0) {
                scheduleDescription = `${formatDisplayDate(startDate)}부터 ${durationNights}박 ${durationNights + 1}일 동안, ${startTime}~${endTime} 사이에 ${title} 일정 잡아줘`;
            } else {
                scheduleDescription = `${formatDisplayDate(startDate)}부터 ${formatDisplayDate(endDate)}까지, ${startTime}~${endTime} 사이에 ${formatDuration()} 미팅`;
            }

            // Call the chat API which handles A2A session creation
            const response = await fetch(`${getBackendUrl()}/chat/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: scheduleDescription,
                    session_id: null,  // Create new session
                    selected_friends: selectedFriends,
                    title: title,
                    location: location || null,
                    duration_nights: durationNights,  // 박 수 추가 (0이면 당일)
                    // 명시적 시간 정보 추가
                    start_date: startDate,
                    end_date: endDate,
                    start_time: startTime,
                    end_time: endTime,
                    duration_minutes: (durationHour * 60) + durationMinute,
                }),
            });

            if (response.ok) {
                setIsSent(true);
                setTimeout(() => navigation.navigate('A2A'), 1800);
            } else {
                const error = await response.text();
                console.error('Failed to send request:', error);
            }
        } catch (error) {
            console.error('Error sending schedule request:', error);
        }
    };

    const filteredFriends = friends.filter(f => f.name.includes(searchTerm) || f.email.includes(searchTerm));

    // Helper to get status color
    const getStatusColor = (status: string) => {
        if (status === '최적') return COLORS.primaryMain;
        if (status === '안정') return COLORS.primaryLight;
        return COLORS.primaryDark;
    };

    const handleApplyRecommendation = (index: number) => {
        if (appliedRecIndex === index) {
            setAppliedRecIndex(null);
            return;
        }

        setAppliedRecIndex(index);
        setActivePicker(null);

        const rec = recommendations[index];
        if (rec) {
            // Apply recommendation to inputs
            // rec.date is ISO format (YYYY-MM-DD)
            setStartDate(rec.date);

            if (durationNights > 0) {
                // For multi-day, calculate end date from start date + nights
                const sDate = new Date(rec.date);
                const eDate = new Date(sDate);
                eDate.setDate(sDate.getDate() + durationNights);
                const eDateStr = `${eDate.getFullYear()}-${(eDate.getMonth() + 1).toString().padStart(2, '0')}-${eDate.getDate().toString().padStart(2, '0')}`;
                setEndDate(eDateStr);
                // Time is set to full day logic or kept as is
                setStartTime('09:00'); // Reset to default active hours or keep 00:00? User might want to start at specific time. 
                // Let's keep 09:00-18:00 as sensible defaults for the "activity" part of the trip.
            } else {
                setEndDate(rec.date);
                setStartTime(rec.timeStart);
                setEndTime(rec.timeEnd);
            }

            // Update calendar view to match
            const [y, m] = rec.date.split('-').map(Number);
            setCalendarYear(y);
            setCalendarMonth(m);
        }
    };

    if (isSent) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <Sparkles size={48} color={COLORS.white} fill={COLORS.white} />
                    </View>
                    <Text style={styles.successTitle}>요청을 보냈습니다!</Text>
                    <Text style={styles.successSubtitle}>내 AI 비서가 친구들의 비서와{'\n'}협상을 시작했습니다.</Text>
                </View>
                <BottomNav activeTab={Tab.REQUEST} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>일정 조율 요청</Text>
                    <Text style={styles.headerSubtitle}>참여자들의 캘린더를 분석하여 최적의 시간을 제안합니다.</Text>
                </View>

                {/* Participants */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>참여자 선택 <Text style={styles.sectionCount}>({selectedFriends.length})</Text></Text>
                    </View>
                    <View style={styles.participantsContainer}>
                        {selectedFriends.map(id => {
                            const friend = friends.find(f => f.id === id);
                            if (!friend) return null;
                            return (
                                <View key={id} style={styles.participantChip}>
                                    <Image source={{ uri: friend.avatar }} style={styles.participantAvatar} />
                                    <Text style={styles.participantName}>{friend.name}</Text>
                                    <TouchableOpacity onPress={() => toggleFriendSelection(id)} style={styles.participantRemove}>
                                        <X size={14} color={COLORS.neutralGray} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                        <TouchableOpacity onPress={() => setShowFriendModal(true)} style={styles.addParticipantButton}>
                            <Plus size={24} color={COLORS.neutralGray} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Settings Card */}
                <View style={styles.settingsCard}>
                    {/* Title Input */}
                    <View style={styles.settingsSection}>
                        <Text style={styles.settingsLabel}>일정 제목 <Text style={{ color: COLORS.neutralGray, fontSize: 10 }}>(필수)</Text></Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="예: 프로젝트 킥오프 미팅"
                            value={title}
                            onChangeText={setTitle}
                            placeholderTextColor={COLORS.neutralGray}
                        />
                    </View>

                    {/* Location Input */}
                    <View style={styles.settingsSection}>
                        <Text style={styles.settingsLabel}>장소 <Text style={{ color: COLORS.neutralGray, fontSize: 10 }}>(선택)</Text></Text>
                        <View style={styles.inputWithIconContainer}>
                            <MapPin size={18} color={COLORS.neutralGray} style={styles.inputIcon} />
                            <TextInput
                                style={styles.textInputWithIcon}
                                placeholder="예: 강남역 스타벅스"
                                value={location}
                                onChangeText={setLocation}
                                placeholderTextColor={COLORS.neutralGray}
                            />
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Schedule Total Duration (Nights) */}
                    <View style={styles.settingsSection}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.settingsLabel}>일정 총 기간</Text>
                            <View style={{
                                backgroundColor: COLORS.indigo50,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 12
                            }}>
                                <Text style={{
                                    color: COLORS.primaryMain,
                                    fontWeight: 'bold',
                                    fontSize: 12
                                }}>
                                    {durationNights === 0 ? '당일' : `${durationNights}박 ${durationNights + 1}일`}
                                </Text>
                            </View>
                        </View>

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: COLORS.white,
                            borderRadius: 16,
                            padding: 8,
                            borderWidth: 1,
                            borderColor: COLORS.neutralLight,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                            marginBottom: durationNights > 0 ? 12 : 0
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 14,
                                    backgroundColor: durationNights === 0 ? COLORS.primaryMain : '#1E1B4B',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {durationNights === 0 ? (
                                        <Sun size={20} color="white" />
                                    ) : (
                                        <Moon size={20} color="white" />
                                    )}
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate }}>직접 설정하기</Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 8 }}>
                                <TouchableOpacity
                                    onPress={() => handleDurationNightChange(-1)}
                                    style={{ padding: 4 }}
                                >
                                    <Minus size={20} color={COLORS.primaryMain} strokeWidth={3} />
                                </TouchableOpacity>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.neutralSlate, minWidth: 20, textAlign: 'center' }}>
                                    {durationNights}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleDurationNightChange(1)}
                                    style={{ padding: 4 }}
                                >
                                    <Plus size={20} color={COLORS.primaryMain} strokeWidth={3} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {durationNights > 0 && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: COLORS.indigo50,
                                borderRadius: 20,
                                padding: 16,
                                gap: 12,
                                marginTop: 8
                            }}>
                                <View style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    backgroundColor: COLORS.white,
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Plane size={18} color={COLORS.primaryMain} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 2 }}>여행 모드 활성화됨</Text>
                                    <Text style={{ fontSize: 11, color: COLORS.neutralGray, lineHeight: 16 }}>참여자들의 캘린더에서 '연속된 가용 일수'를 우선적으로 분석합니다.</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Date Range */}
                    <View style={styles.settingsSection}>
                        <Text style={styles.settingsLabel}>조율 날짜 범위</Text>
                        <View style={styles.dateRangeContainer}>
                            <TouchableOpacity
                                onPress={() => { setActivePicker(activePicker === 'startDate' ? null : 'startDate'); setHasAnalyzed(false); }}
                                style={[styles.dateButton, activePicker === 'startDate' && styles.dateButtonActive]}
                            >
                                <Text style={styles.dateLabel}>시작</Text>
                                <View style={styles.dateValueRow}>
                                    <CalendarIcon size={14} color={COLORS.primaryLight} style={{ marginRight: 6 }} />
                                    <Text style={styles.dateValue}>{formatDisplayDate(startDate)}</Text>
                                </View>
                            </TouchableOpacity>
                            <ArrowRight size={18} color={COLORS.neutralGray} style={{ opacity: 0.4 }} />
                            <TouchableOpacity
                                onPress={() => { setActivePicker(activePicker === 'endDate' ? null : 'endDate'); setHasAnalyzed(false); }}
                                style={[styles.dateButton, activePicker === 'endDate' && styles.dateButtonActive]}
                            >
                                <Text style={styles.dateLabel}>종료</Text>
                                <View style={styles.dateValueRow}>
                                    <CalendarIcon size={14} color={COLORS.primaryLight} style={{ marginRight: 6 }} />
                                    <Text style={styles.dateValue}>{formatDisplayDate(endDate)}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Time Window */}
                    <View style={[styles.settingsSection, durationNights > 0 && { opacity: 0.3 }]} pointerEvents={durationNights > 0 ? 'none' : 'auto'}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.settingsLabel}>선호 시간대 (WINDOW)</Text>
                            {durationNights > 0 && (
                                <Text style={{ fontSize: 11, color: COLORS.primaryMain, fontWeight: 'bold' }}>여행 모드는 종일 설정됨</Text>
                            )}
                        </View>
                        <View style={styles.timeContainer}>
                            <TouchableOpacity
                                onPress={() => openTimePicker('startTime')}
                                style={[styles.timeButton, activePicker === 'startTime' && styles.timeButtonActive]}
                            >
                                <Clock size={16} color={COLORS.primaryLight} />
                                <Text style={styles.timeValue}>{startTime}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => openTimePicker('endTime')}
                                style={[styles.timeButton, activePicker === 'endTime' && styles.timeButtonActive]}
                            >
                                <Clock size={16} color={COLORS.primaryLight} />
                                <Text style={styles.timeValue}>{endTime}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Duration Picker */}
                    <View style={[styles.settingsSection, durationNights > 0 && { opacity: 0.3 }]} pointerEvents={durationNights > 0 ? 'none' : 'auto'}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.settingsLabel}>미팅 소요 시간 (DURATION)</Text>
                            {durationNights > 0 && (
                                <Text style={{ fontSize: 11, color: COLORS.primaryMain, fontWeight: 'bold' }}>기간으로 자동 설정됨</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={openDurationPicker} style={styles.durationDropdown}>
                            <Clock size={16} color={COLORS.neutralGray} />
                            <Text style={styles.durationDropdownText}>{formatDuration()}</Text>
                            <ChevronDown size={18} color={COLORS.neutralGray} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Analysis Section */}
                <View style={styles.section}>
                    {!hasAnalyzed ? (
                        <TouchableOpacity
                            onPress={handleAnalyze}
                            disabled={selectedFriends.length === 0 || isAnalyzing}
                            style={[styles.analyzeButton, selectedFriends.length === 0 && styles.analyzeButtonDisabled]}
                        >
                            {isAnalyzing ? (
                                <>
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                    <Text style={styles.analyzeButtonText}>친구들 캘린더 분석 중...</Text>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} color={COLORS.white} fill={COLORS.white} />
                                    <Text style={styles.analyzeButtonText}>최적의 일정 분석하기</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.resultsContainer}>
                            <View style={styles.resultsHeader}>
                                <Text style={styles.resultsTitle}>AI 추천 일정</Text>
                                <Sparkles size={14} color={COLORS.primaryMain} />
                            </View>

                            {recommendations.map((rec, i) => {
                                const isApplied = appliedRecIndex === i;
                                return (
                                    <View key={i} style={styles.recommendationContainer}>
                                        <TouchableOpacity
                                            onPress={() => handleApplyRecommendation(i)}
                                            style={[styles.recommendationCard, isApplied && styles.recommendationCardActive]}
                                        >
                                            <View style={styles.recommendationLeft}>
                                                <View style={[styles.recommendationIcon, { backgroundColor: getStatusColor(rec.status) }]}>
                                                    <CalendarIcon size={20} color={COLORS.white} />
                                                </View>
                                                <View>
                                                    <Text style={[styles.recommendationDate, isApplied && { color: COLORS.primaryMain }]}>
                                                        {(() => {
                                                            if (durationNights > 0) {
                                                                const sDate = new Date(rec.date);
                                                                const eDate = new Date(sDate);
                                                                eDate.setDate(sDate.getDate() + durationNights);
                                                                const getDayStr = (d: Date) => weekdays[d.getDay()];
                                                                const format = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일(${getDayStr(d)})`;
                                                                return `${format(sDate)} ~ ${format(eDate)}`;
                                                            }
                                                            return rec.displayDate;
                                                        })()}
                                                    </Text>
                                                    <Text style={styles.recommendationTime}>
                                                        {durationNights > 0 ? '종일 (여행 모드)' : `${rec.timeStart} - ${rec.timeEnd}`}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.recommendationRight}>
                                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(rec.status) }]}>
                                                    <Text style={styles.statusText}>{rec.status}</Text>
                                                </View>
                                                <View style={styles.participantCount}>
                                                    <Users size={12} color={COLORS.neutralSlate} style={{ opacity: 0.5 }} />
                                                    <Text style={styles.countText}>{rec.availableCount}/{totalParticipants}</Text>
                                                    <ChevronDown size={14} color={isApplied ? COLORS.primaryMain : COLORS.neutralGray} style={isApplied ? { transform: [{ rotate: '180deg' }] } : {}} />
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {isApplied && (
                                            <View style={styles.recommendationDetails}>
                                                <View style={styles.detailsHeader}>
                                                    <Text style={styles.detailsTitle}>상세 참여 가능 인원</Text>
                                                    <Text style={styles.detailsCount}>{rec.availableCount}명 확인됨</Text>
                                                </View>

                                                <View style={styles.participantGrid}>
                                                    {/* Me - ✅ 가용성에 따라 체크/X 표시 */}
                                                    {rec.availableIds.includes(currentUserId) ? (
                                                        <View style={styles.participantCardAvailable}>
                                                            <View style={styles.meAvatarContainer}>
                                                                <View style={styles.meAvatar}><Text style={styles.meAvatarText}>나</Text></View>
                                                                <View style={styles.checkBadge}><Check size={8} color={COLORS.white} strokeWidth={4} /></View>
                                                            </View>
                                                            <Text style={styles.participantCardName}>나</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.participantCardUnavailable}>
                                                            <View style={styles.meAvatarContainer}>
                                                                <View style={[styles.meAvatar, { opacity: 0.5 }]}><Text style={styles.meAvatarText}>나</Text></View>
                                                                <View style={styles.xBadge}><X size={8} color={COLORS.white} strokeWidth={4} /></View>
                                                            </View>
                                                            <Text style={styles.participantCardNameGray}>나</Text>
                                                        </View>
                                                    )}

                                                    {rec.availableIds.map((id: string) => {
                                                        const friend = friends.find(f => f.id === id);
                                                        if (!friend) return null;
                                                        return (
                                                            <View key={id} style={styles.participantCardAvailable}>
                                                                <View style={styles.friendAvatarContainer}>
                                                                    <Image source={{ uri: friend.avatar }} style={styles.friendAvatarSmall} />
                                                                    <View style={styles.checkBadge}><Check size={8} color={COLORS.white} strokeWidth={4} /></View>
                                                                </View>
                                                                <Text style={styles.participantCardName}>{friend.name}</Text>
                                                            </View>
                                                        );
                                                    })}

                                                    {rec.unavailableIds.map((id: string) => {
                                                        const friend = friends.find(f => f.id === id);
                                                        if (!friend) return null;
                                                        return (
                                                            <View key={id} style={styles.participantCardUnavailable}>
                                                                <View style={styles.friendAvatarContainer}>
                                                                    <Image source={{ uri: friend.avatar }} style={[styles.friendAvatarSmall, { opacity: 0.5 }]} />
                                                                    <View style={styles.xBadge}><X size={8} color={COLORS.white} strokeWidth={4} /></View>
                                                                </View>
                                                                <Text style={styles.participantCardNameGray}>{friend.name}</Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>

                                                {rec.status === '최적' ? (
                                                    <View style={styles.tipBoxIndigo}>
                                                        <Text style={styles.tipTextIndigo}>✨ 모든 인원이 참여할 수 있는 최적의 윈도우입니다. 캘린더 등록 시 자동으로 확정될 가능성이 높습니다.</Text>
                                                    </View>
                                                ) : (
                                                    <View style={styles.tipBoxAmber}>
                                                        <Text style={styles.tipTextAmber}>💡 {rec.unavailableIds.length}명의 에이전트가 다른 일정을 감지했습니다. JOY 비서가 대신 협상을 제안하여 시간 조정을 시도할 수 있습니다.</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Send Button */}
                <View style={styles.sendButtonContainer}>
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={selectedFriends.length === 0 || !hasAnalyzed}
                        style={[styles.sendButton, (selectedFriends.length === 0 || !hasAnalyzed) && styles.sendButtonDisabled]}
                    >
                        <Text style={styles.sendButtonText}>{hasAnalyzed ? `${selectedFriends.length}명에게 요청 보내기` : '일정을 분석해주세요'}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Time Picker Modal */}
            <Modal visible={activePicker === 'startTime' || activePicker === 'endTime'} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.timePickerContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>시간 선택</Text>
                            <TouchableOpacity onPress={() => setActivePicker(null)}><X size={24} color={COLORS.neutralGray} /></TouchableOpacity>
                        </View>

                        <View style={styles.timePickerColumns}>
                            {/* AM/PM Column */}
                            <View style={styles.timePickerColumn}>
                                <TouchableOpacity
                                    onPress={() => setTempAmPm('오전')}
                                    style={[styles.timePickerItem, tempAmPm === '오전' && styles.timePickerItemSelected]}
                                >
                                    <Text style={[styles.timePickerItemText, tempAmPm === '오전' && styles.timePickerItemTextSelected]}>오전</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTempAmPm('오후')}
                                    style={[styles.timePickerItem, tempAmPm === '오후' && styles.timePickerItemSelected]}
                                >
                                    <Text style={[styles.timePickerItemText, tempAmPm === '오후' && styles.timePickerItemTextSelected]}>오후</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Hour Column */}
                            <View style={styles.timePickerColumnWithHeader}>
                                <Text style={styles.timePickerColumnHeader}>시</Text>
                                <ScrollView style={styles.timePickerScrollColumn} showsVerticalScrollIndicator={false}>
                                    {hours.map(h => (
                                        <TouchableOpacity
                                            key={h}
                                            onPress={() => setTempHour(h)}
                                            style={[styles.timePickerItem, tempHour === h && styles.timePickerItemSelected]}
                                        >
                                            <Text style={[styles.timePickerItemText, tempHour === h && styles.timePickerItemTextSelected]}>{h}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Minute Column */}
                            <View style={styles.timePickerColumnWithHeader}>
                                <Text style={styles.timePickerColumnHeader}>분</Text>
                                <ScrollView style={styles.timePickerScrollColumn} showsVerticalScrollIndicator={false}>
                                    {minutes.map(m => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => setTempMinute(m)}
                                            style={[styles.timePickerItem, tempMinute === m && styles.timePickerItemSelected]}
                                        >
                                            <Text style={[styles.timePickerItemText, tempMinute === m && styles.timePickerItemTextSelected]}>{m.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <TouchableOpacity onPress={confirmTimePicker} style={styles.timePickerConfirmButton}>
                            <Text style={styles.timePickerConfirmText}>확인</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Duration Picker Modal */}
            <Modal visible={showDurationPicker} transparent animationType="fade" onRequestClose={() => setShowDurationPicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.timePickerContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>소요 시간 선택</Text>
                            <TouchableOpacity onPress={() => setShowDurationPicker(false)}><X size={24} color={COLORS.neutralGray} /></TouchableOpacity>
                        </View>

                        <View style={styles.timePickerColumns}>
                            {/* Hour Column */}
                            <View style={styles.timePickerColumnWithHeader}>
                                <Text style={styles.timePickerColumnHeader}>시간</Text>
                                <ScrollView style={styles.timePickerScrollColumn} showsVerticalScrollIndicator={false}>
                                    {durationHours.map(h => (
                                        <TouchableOpacity
                                            key={h}
                                            onPress={() => setTempDurationHour(h)}
                                            style={[styles.timePickerItem, tempDurationHour === h && styles.timePickerItemSelected]}
                                        >
                                            <Text style={[styles.timePickerItemText, tempDurationHour === h && styles.timePickerItemTextSelected]}>{h}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Minute Column */}
                            <View style={styles.timePickerColumnWithHeader}>
                                <Text style={styles.timePickerColumnHeader}>분</Text>
                                <ScrollView style={styles.timePickerScrollColumn} showsVerticalScrollIndicator={false}>
                                    {durationMinutes.map(m => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => setTempDurationMinute(m)}
                                            style={[styles.timePickerItem, tempDurationMinute === m && styles.timePickerItemSelected]}
                                        >
                                            <Text style={[styles.timePickerItemText, tempDurationMinute === m && styles.timePickerItemTextSelected]}>{m.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <TouchableOpacity onPress={confirmDurationPicker} style={styles.timePickerConfirmButton}>
                            <Text style={styles.timePickerConfirmText}>확인</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Date Picker Modal */}
            <Modal visible={activePicker === 'startDate' || activePicker === 'endDate'} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.dateModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>날짜 선택</Text>
                            <TouchableOpacity onPress={() => setActivePicker(null)}><X size={24} color={COLORS.neutralGray} /></TouchableOpacity>
                        </View>

                        <View style={styles.calendarHeader}>
                            <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarNavButton}>
                                <ChevronLeft size={24} color={COLORS.neutralSlate} />
                            </TouchableOpacity>
                            <Text style={styles.calendarMonthText}>{calendarYear}년 {calendarMonth}월</Text>
                            <TouchableOpacity onPress={handleNextMonth} style={styles.calendarNavButton}>
                                <ChevronRight size={24} color={COLORS.neutralSlate} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.calendarWeekdays}>
                            {weekdays.map((day, i) => (
                                <Text key={i} style={[styles.calendarWeekday, i === 0 && styles.calendarWeekdaySunday]}>{day}</Text>
                            ))}
                        </View>

                        <View style={styles.calendarGrid}>
                            {getCalendarDays().map((dateObj, idx) => {
                                const dateString = `${calendarYear}-${calendarMonth.toString().padStart(2, '0')}-${dateObj.day.toString().padStart(2, '0')}`;
                                const isSelected = (activePicker === 'startDate' && startDate === dateString) || (activePicker === 'endDate' && endDate === dateString);
                                const isSunday = idx % 7 === 0;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => handleDateSelect(dateObj.day, dateObj.isCurrentMonth)}
                                        style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
                                    >
                                        <Text style={[
                                            styles.calendarDayText,
                                            isSelected && styles.calendarDayTextSelected,
                                            !dateObj.isCurrentMonth && styles.calendarDayTextOther,
                                            isSunday && dateObj.isCurrentMonth && !isSelected && styles.calendarDayTextSunday
                                        ]}>{dateObj.day}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Friend Selection Modal */}
            <Modal visible={showFriendModal} transparent animationType="slide" onRequestClose={() => setShowFriendModal(false)}>
                <View style={styles.bottomModalOverlay}>
                    <View style={styles.bottomModalContent}>
                        <TouchableOpacity style={styles.modalHandleContainer} onPress={() => setShowFriendModal(false)}>
                            <View style={styles.modalHandle} />
                        </TouchableOpacity>
                        <View style={styles.bottomModalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>친구 선택</Text>
                                <Text style={styles.modalSubtitle}>조율에 참여할 친구를 추가하세요.</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowFriendModal(false)}><X size={24} color={COLORS.neutralGray} /></TouchableOpacity>
                        </View>
                        <View style={styles.searchContainer}>
                            <Search size={18} color={COLORS.neutralGray} />
                            <TextInput style={styles.searchInput} placeholder="이름 또는 이메일 검색" placeholderTextColor={COLORS.neutralGray} value={searchTerm} onChangeText={setSearchTerm} />
                        </View>
                        {loadingFriends ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={COLORS.primaryMain} />
                                <Text style={styles.loadingText}>친구 목록 불러오는 중...</Text>
                            </View>
                        ) : friends.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>등록된 친구가 없습니다.</Text>
                                <Text style={styles.emptySubtext}>Friends 탭에서 친구를 추가해주세요.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredFriends}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ paddingBottom: 24 }}
                                renderItem={({ item }) => {
                                    const isSelected = selectedFriends.includes(item.id);
                                    return (
                                        <TouchableOpacity onPress={() => toggleFriendSelection(item.id)} style={[styles.friendItem, isSelected && styles.friendItemSelected]}>
                                            <View style={styles.friendItemLeft}>
                                                <Image source={{ uri: item.avatar }} style={styles.friendItemAvatar} />
                                                <View>
                                                    <Text style={[styles.friendItemName, isSelected && { color: COLORS.primaryMain }]}>{item.name}</Text>
                                                    <Text style={styles.friendItemEmail}>{item.email}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                {isSelected && <Check size={14} color={COLORS.white} strokeWidth={3} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                        <View style={styles.selectCompleteContainer}>
                            <TouchableOpacity onPress={() => setShowFriendModal(false)} style={styles.selectCompleteButton}>
                                <Text style={styles.selectCompleteButtonText}>선택 완료 ({selectedFriends.length}명)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <BottomNav activeTab={Tab.REQUEST} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.neutralLight },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 120 },
    header: { backgroundColor: COLORS.white, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 48 : 24, paddingBottom: 32, borderBottomLeftRadius: 48, borderBottomRightRadius: 48, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate },
    headerSubtitle: { fontSize: 12, color: COLORS.neutralGray, marginTop: 8, fontWeight: '500' },
    section: { paddingHorizontal: 24, marginBottom: 24 },
    sectionHeader: { marginBottom: 16, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.neutralSlate, textTransform: 'uppercase', letterSpacing: 1.5 },
    sectionCount: { color: COLORS.primaryMain },
    participantsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    participantChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.3)', borderRadius: 16, paddingLeft: 6, paddingRight: 12, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    participantAvatar: { width: 32, height: 32, borderRadius: 12, marginRight: 8 },
    participantName: { fontSize: 12, fontWeight: 'bold', color: COLORS.neutralSlate },
    participantRemove: { marginLeft: 8 },
    addParticipantButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.neutralGray, justifyContent: 'center', alignItems: 'center' },
    settingsCard: { marginHorizontal: 24, backgroundColor: COLORS.white, borderRadius: 40, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    settingsSection: { marginBottom: 24 },
    settingsLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutralGray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateButton: { flex: 1, borderRadius: 16, padding: 16, backgroundColor: COLORS.neutralLight, borderWidth: 2, borderColor: 'transparent' },
    dateButtonActive: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryBg },
    dateLabel: { fontSize: 9, fontWeight: 'bold', color: COLORS.primaryLight, textTransform: 'uppercase', marginBottom: 4 },
    dateValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate },
    timeContainer: { flexDirection: 'row', gap: 12 },
    timeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, backgroundColor: COLORS.neutralLight, borderWidth: 2, borderColor: 'transparent' },
    timeButtonActive: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryBg },
    timeValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginLeft: 12 },
    durationChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    durationChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.neutralLight, borderWidth: 2, borderColor: COLORS.neutralLight },
    durationChipActive: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryMain },
    durationChipText: { fontSize: 11, fontWeight: 'bold', color: COLORS.neutralSlate },
    durationChipTextActive: { color: COLORS.white },
    durationDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.neutralLight, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent' },
    durationDropdownText: { flex: 1, fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginLeft: 12 },
    analyzeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryMain, borderRadius: 24, paddingVertical: 20, gap: 12, shadowColor: COLORS.primaryMain, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
    analyzeButtonDisabled: { backgroundColor: COLORS.neutralGray, opacity: 0.5, shadowOpacity: 0 },
    analyzeButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.white },
    resultsContainer: { marginTop: 8 },
    resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
    resultsTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.neutralSlate, textTransform: 'uppercase', letterSpacing: 1.5 },
    recommendationContainer: { marginBottom: 16 },
    recommendationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 24, padding: 20, borderWidth: 2, borderColor: 'rgba(148, 163, 184, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    recommendationCardActive: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryBg },
    recommendationLeft: { flexDirection: 'row', alignItems: 'center' },
    recommendationIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    recommendationDate: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate },
    recommendationTime: { fontSize: 12, fontWeight: '500', color: COLORS.neutralGray },
    recommendationRight: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4 },
    statusText: { fontSize: 9, fontWeight: '900', color: COLORS.white },
    participantCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    countText: { fontSize: 11, fontWeight: 'bold', color: COLORS.neutralSlate },
    recommendationDetails: { marginTop: 8, marginHorizontal: 8, padding: 20, backgroundColor: COLORS.white, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(55, 48, 163, 0.1)' },
    detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    detailsTitle: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutralSlate, textTransform: 'uppercase', letterSpacing: 1.5 },
    detailsCount: { fontSize: 10, fontWeight: 'bold', color: COLORS.primaryMain },
    participantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    participantCardAvailable: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(238, 242, 255, 0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(55, 48, 163, 0.1)' },
    participantCardUnavailable: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.2)', opacity: 0.6 },
    meAvatarContainer: { position: 'relative', marginRight: 8 },
    meAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryMain, justifyContent: 'center', alignItems: 'center' },
    meAvatarText: { fontSize: 10, fontWeight: 'bold', color: COLORS.white },
    friendAvatarContainer: { position: 'relative', marginRight: 8 },
    friendAvatarSmall: { width: 28, height: 28, borderRadius: 8 },
    checkBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.primaryMain, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: COLORS.white },
    xBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.neutralGray, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: COLORS.white },
    participantCardName: { fontSize: 10, fontWeight: 'bold', color: COLORS.primaryMain },
    participantCardNameGray: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutralGray },
    tipBoxIndigo: { padding: 12, backgroundColor: COLORS.indigo50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.indigo100 },
    tipTextIndigo: { fontSize: 10, fontWeight: '500', color: COLORS.indigo700, lineHeight: 16 },
    tipBoxAmber: { padding: 12, backgroundColor: COLORS.amber50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.amber100 },
    tipTextAmber: { fontSize: 10, fontWeight: '500', color: COLORS.amber700, lineHeight: 16 },
    sendButtonContainer: { paddingHorizontal: 24, paddingTop: 24 },
    sendButton: { backgroundColor: COLORS.primaryDark, borderRadius: 24, paddingVertical: 20, alignItems: 'center', shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
    sendButtonDisabled: { backgroundColor: COLORS.neutralGray, opacity: 0.5, shadowOpacity: 0 },
    sendButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.white },
    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    successIcon: { width: 96, height: 96, backgroundColor: COLORS.primaryMain, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 32, transform: [{ rotate: '12deg' }], shadowColor: COLORS.primaryMain, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 16 },
    successTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 12 },
    successSubtitle: { fontSize: 14, color: 'rgba(51, 65, 85, 0.6)', textAlign: 'center', fontWeight: '500', lineHeight: 22 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    timeModalContent: { backgroundColor: COLORS.white, width: '100%', maxWidth: 320, borderRadius: 32, padding: 24, maxHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    modalSubtitle: { fontSize: 12, color: COLORS.neutralGray, marginTop: 4, fontWeight: '500' },
    timeSlotsContainer: { maxHeight: 280 },
    timeSlot: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: COLORS.neutralLight },
    timeSlotActive: { backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primaryLight },
    timeSlotText: { fontSize: 14, fontWeight: '600', color: COLORS.neutralSlate, textAlign: 'center' },
    timeSlotTextActive: { color: COLORS.primaryMain, fontWeight: 'bold' },
    bottomModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    bottomModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 48, borderTopRightRadius: 48, maxHeight: '85%' },
    modalHandleContainer: { width: '100%', alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
    modalHandle: { width: 48, height: 6, backgroundColor: 'rgba(148, 163, 184, 0.3)', borderRadius: 3 },
    bottomModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingBottom: 8 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralLight, borderRadius: 16, marginHorizontal: 24, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent' },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 14, color: COLORS.neutralSlate },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    loadingText: { marginTop: 12, fontSize: 14, color: COLORS.neutralGray },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 8 },
    emptySubtext: { fontSize: 12, color: COLORS.neutralGray },
    friendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 24, marginBottom: 4, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: COLORS.white },
    friendItemSelected: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primaryMain },
    friendItemLeft: { flexDirection: 'row', alignItems: 'center' },
    friendItemAvatar: { width: 48, height: 48, borderRadius: 16, marginRight: 16, borderWidth: 2, borderColor: COLORS.white },
    friendItemName: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate },
    friendItemEmail: { fontSize: 10, color: COLORS.neutralGray, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(148, 163, 184, 0.4)', justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: COLORS.primaryMain, borderColor: COLORS.primaryMain },
    selectCompleteContainer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, backgroundColor: COLORS.white },

    // New Input Styles
    textInput: {
        backgroundColor: COLORS.neutralLight,
        borderWidth: 1,
        borderColor: COLORS.indigo100,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.neutralSlate,
        marginBottom: 8,
    },
    inputWithIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutralLight,
        borderWidth: 1,
        borderColor: COLORS.indigo100,
        borderRadius: 12,
        marginBottom: 8,
    },
    inputIcon: {
        marginLeft: 16,
    },
    textInputWithIcon: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        fontSize: 14,
        color: COLORS.neutralSlate,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.indigo100,
        marginVertical: 16,
    },
    selectCompleteButton: { backgroundColor: COLORS.primaryMain, borderRadius: 24, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.primaryMain, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
    selectCompleteButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.white },
    // Date picker styles
    dateValueRow: { flexDirection: 'row', alignItems: 'center' },
    dateModalContent: { backgroundColor: COLORS.white, width: '100%', maxWidth: 360, borderRadius: 32, padding: 24 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 8 },
    calendarNavButton: { padding: 8 },
    calendarMonthText: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    calendarWeekdays: { flexDirection: 'row', marginBottom: 8 },
    calendarWeekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: COLORS.neutralGray },
    calendarWeekdaySunday: { color: '#F87171' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
    calendarDaySelected: { backgroundColor: COLORS.primaryMain, borderRadius: 20 },
    calendarDayText: { fontSize: 14, fontWeight: '600', color: COLORS.neutralSlate },
    calendarDayTextSelected: { color: COLORS.white },
    calendarDayTextOther: { color: 'rgba(148, 163, 184, 0.4)' },
    calendarDayTextSunday: { color: '#F87171' },
    // Time picker styles
    timePickerContent: { backgroundColor: COLORS.white, width: '100%', maxWidth: 360, borderRadius: 32, padding: 24 },
    timePickerColumns: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginVertical: 16, gap: 8 },
    timePickerColumn: { alignItems: 'center', paddingTop: 32 },
    timePickerColumnWithHeader: { alignItems: 'center' },
    timePickerColumnHeader: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralGray, marginBottom: 12 },
    timePickerScrollColumn: { maxHeight: 220 },
    timePickerItem: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginVertical: 2 },
    timePickerItemSelected: { backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primaryMain },
    timePickerItemText: { fontSize: 16, fontWeight: '600', color: COLORS.neutralSlate, textAlign: 'center' },
    timePickerItemTextSelected: { color: COLORS.primaryMain, fontWeight: 'bold' },
    timePickerConfirmButton: { backgroundColor: COLORS.primaryMain, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    timePickerConfirmText: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
});

export default RequestMeetingScreen;
