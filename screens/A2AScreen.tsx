import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    Image,
    TextInput,
    SafeAreaView,
    ActivityIndicator,
    ScrollView,
    Platform,
    Alert
} from 'react-native';
import {
    CheckCircle2,
    Clock,
    ChevronRight,
    X,
    MapPin,
    Calendar,
    CalendarCheck,
    ArrowLeft,
    Trash2,
    AlertCircle,
    ChevronLeft,
    ChevronUp,
    ChevronDown
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import TimePickerModal from '../components/TimePickerModal';
import RealTimeNegotiationView from '../components/RealTimeNegotiationView';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, A2ALog, Tab } from '../types';
import BottomNav from '../components/BottomNav';
import { API_BASE, WS_BASE } from '../constants/config';

// Colors based on the provided React/Tailwind code
const COLORS = {
    primaryMain: '#3730A3',
    primaryLight: '#818CF8',
    primaryDark: '#0E004E',
    primaryBg: '#EEF2FF',
    neutralLight: '#F9FAFB',
    neutral50: '#F9FAFB',
    neutralSlate: '#1F2937',
    neutral100: '#F3F4F6',
    neutral200: '#E5E7EB',
    neutral300: '#D1D5DB',
    neutral400: '#9CA3AF',
    neutral500: '#6B7280',
    neutral600: '#4B5563',
    neutral700: '#374151',
    neutral900: '#111827', // Added for calendar title
    white: '#FFFFFF',
    green600: '#16A34A',
    green50: '#F0FDF4',
    green100: '#DCFCE7',
    amber600: '#D97706',
    amber50: '#FFFBEB',
    amber100: '#FEF3C7',
    red600: '#DC2626',   // [NEW] 거절됨 상태용 빨간색
    red50: '#FEF2F2',    // [NEW] 거절됨 배경색
    red100: '#FEE2E2',   // [NEW] 거절됨 테두리색
    approveBtn: '#0E004E'
};

const A2AScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'A2A'>>();
    const initialLogId = route.params?.initialLogId;

    const [logs, setLogs] = useState<A2ALog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<A2ALog | null>(null);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [isProcessExpanded, setIsProcessExpanded] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    const [isCalendarLoading, setIsCalendarLoading] = useState(false);
    const [selectedNewTime, setSelectedNewTime] = useState<Date | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [confirmationType, setConfirmationType] = useState<'official' | 'reschedule' | 'partial'>('official');
    const [pendingApprovers, setPendingApprovers] = useState<string[]>([]);

    // Restore deleted states
    const [preferredTime, setPreferredTime] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // True A2A States
    const [showNegotiation, setShowNegotiation] = useState(false);
    const [negotiatingSessionId, setNegotiatingSessionId] = useState<string | null>(null);
    const [showHumanDecision, setShowHumanDecision] = useState(false);
    const [lastProposalForDecision, setLastProposalForDecision] = useState<any>(null);
    const [isModalClosing, setIsModalClosing] = useState(false);  // 모달 닫힘 중 버튼 숨김용
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);  // 거절 확인 팝업 상태
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);  // 삭제 확인 팝업 상태
    const [deleteTargetLogId, setDeleteTargetLogId] = useState<string | null>(null);  // 삭제 대상 로그 ID

    // 재조율 시작시간/종료시간 상태
    const [startTimeExpanded, setStartTimeExpanded] = useState(true);
    const [endTimeExpanded, setEndTimeExpanded] = useState(false);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [endTime, setEndTime] = useState<string | null>(null);
    const [startMonth, setStartMonth] = useState(new Date());
    const [endMonth, setEndMonth] = useState(new Date());
    // 오전/오후 선택 상태
    const [startPeriod, setStartPeriod] = useState<'AM' | 'PM' | null>(null);
    const [endPeriod, setEndPeriod] = useState<'AM' | 'PM' | null>(null);

    // 바쁜 시간대 (캘린더 일정이 있는 시간)
    const [busyTimes, setBusyTimes] = useState<{ [date: string]: string[] }>({});

    // 참여자 이름 툴팁 상태 (index 추적)
    const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

    // 날짜 선택 시 해당 날짜의 바쁜 시간대 조회
    const fetchBusyTimes = async (dateStr: string) => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/calendar/busy-times?date=${dateStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBusyTimes(prev => ({ ...prev, [dateStr]: data.busy_times || [] }));
            }
        } catch (e) {
            console.error("Failed to fetch busy times:", e);
        }
    };

    // startDate 변경 시 바쁜 시간 조회
    useEffect(() => {
        if (startDate) {
            fetchBusyTimes(startDate);
        }
    }, [startDate]);

    // endDate 변경 시 바쁜 시간 조회
    useEffect(() => {
        if (endDate) {
            fetchBusyTimes(endDate);
        }
    }, [endDate]);

    useEffect(() => {
        if (selectedReason === "날짜를 변경하고 싶어요" && selectedLog) {
            fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
        }
    }, [selectedReason, currentMonth, selectedLog]);

    const fetchAvailability = async (year: number, month: number) => {
        if (!selectedLog) return;
        setIsCalendarLoading(true);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${selectedLog.id}/availability?year=${year}&month=${month}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableDates(data.available_dates || []);
            }
        } catch (e) {
            console.error("Availability fetch error", e);
        } finally {
            setIsCalendarLoading(false);
        }
    };

    const handleMonthChange = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentMonth);
        if (direction === 'prev') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentMonth(newDate);
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();

        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return (
            <View style={[styles.calendarContainer, styles.calendarContainerRounded]}>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity onPress={() => handleMonthChange('prev')} style={styles.iconButton}>
                        <ChevronRight size={24} color={COLORS.neutral400} style={{ transform: [{ rotate: "180deg" }] }} />
                    </TouchableOpacity>
                    <Text style={styles.calendarTitle}>
                        {year}년 {month + 1}월
                    </Text>
                    <TouchableOpacity onPress={() => handleMonthChange('next')} style={styles.iconButton}>
                        <ChevronRight size={24} color={COLORS.neutral400} />
                    </TouchableOpacity>
                </View>

                {isCalendarLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primaryMain} style={{ margin: 20 }} />
                ) : (
                    <View style={styles.calendarGrid}>
                        <View style={styles.weekRow}>
                            {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
                                <Text key={d} style={[
                                    styles.weekDayText,
                                    idx === 0 ? { color: '#F87171' } : { color: COLORS.neutral400 }
                                ]}>{d}</Text>
                            ))}
                        </View>
                        <View style={styles.daysGrid}>
                            {days.map((day, index) => {
                                if (!day) return <View key={index} style={styles.dayCell} />;

                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isAvailable = availableDates.includes(dateStr);
                                const isSelected = selectedDate === dateStr;
                                const isOriginal = selectedLog?.details?.proposedDate && (
                                    selectedLog.details.proposedDate.includes(dateStr) ||
                                    selectedLog.details.proposedDate.includes(`${month + 1}월 ${day}일`)
                                );
                                const isDisabled = !isAvailable;

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.dayCell}
                                        disabled={isDisabled}
                                        onPress={() => setSelectedDate(dateStr)}
                                    >
                                        <View style={[
                                            styles.dayNumberContainer,
                                            isSelected && styles.dayNumberSelected,
                                            isOriginal && !isSelected && styles.dayNumberOriginal
                                        ]}>
                                            <Text style={[
                                                styles.dayNumberText,
                                                isSelected ? { color: 'white' } :
                                                    isOriginal ? { color: 'white' } :
                                                        isDisabled ? { color: COLORS.neutral300 } :
                                                            { color: COLORS.neutralSlate }
                                            ]}>
                                                {day}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.legendContainer}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.primaryMain }]} />
                                <Text style={styles.legendText}>선택됨</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.amber600 }]} />
                                <Text style={styles.legendText}>기존 약속</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.neutral200 }]} />
                                <Text style={styles.legendText}>불가능</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    };


    const renderTimeSelection = () => {
        const proposedTime = selectedLog?.details?.proposedTime || "시간 정보 없음";

        const onTimeChange = (event: any, selectedDate?: Date) => {
            if (Platform.OS === 'android') setShowTimePicker(false);
            if (selectedDate) {
                setSelectedNewTime(selectedDate);
            }
        };

        return (
            <View style={styles.timeSelectionContainer}>
                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>현재 시간</Text>
                    <View style={styles.timeValueContainer}>
                        <Clock size={16} color={COLORS.neutral500} style={{ marginRight: 6 }} />
                        <Text style={styles.timeValueText}>{proposedTime}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>변경 희망 시간</Text>
                    <TouchableOpacity
                        style={styles.timePickerButton}
                        onPress={() => setShowTimePicker(true)}
                    >
                        <Clock size={16} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.timePickerText}>
                            {selectedNewTime
                                ? selectedNewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : "시간 선택"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {Platform.OS === 'web' ? (
                    <TimePickerModal
                        visible={showTimePicker}
                        onClose={() => setShowTimePicker(false)}
                        onSelect={(date) => {
                            setSelectedNewTime(date);
                            setShowTimePicker(false);
                        }}
                        initialTime={selectedNewTime || new Date()}
                    />
                ) : (
                    showTimePicker && (
                        <DateTimePicker
                            value={selectedNewTime || new Date()}
                            mode="time"
                            display="default"
                            onChange={onTimeChange}
                            minuteInterval={1}
                        />
                    )
                )}
            </View>
        );
    };

    // 오전/오후 시간 버튼 생성 (00:00~23:30 전체 커버)
    const AM_TIMES = ['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
    const PM_TIMES = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'];

    // 시간 선택 렌더링 (시작/종료 공용) - 오전/오후 선택 후 시간 버튼 표시
    // selectedPeriod: 선택된 오전/오후, onPeriodSelect: 오전/오후 선택 콜백
    const renderTimeButtons = (
        selectedTime: string | null,
        onSelect: (time: string) => void,
        dateStr: string | null,
        selectedPeriod: 'AM' | 'PM' | null,
        onPeriodSelect: (period: 'AM' | 'PM') => void,
        minTime?: string | null,
        minDate?: string | null
    ) => {
        const busyTimesForDate = dateStr ? (busyTimes[dateStr] || []) : [];

        // 시간 비교 함수 (HH:MM 형식)
        const isBeforeMinTime = (time: string): boolean => {
            if (!minTime || !minDate || dateStr !== minDate) return false;
            const [h1, m1] = time.split(':').map(Number);
            const [h2, m2] = minTime.split(':').map(Number);
            return h1 * 60 + m1 <= h2 * 60 + m2;  // 시작시간과 같거나 이전이면 비활성화
        };

        // 오전/오후 버튼 렌더링 (시간 버튼과 동일한 디자인)
        const renderPeriodButtons = () => (
            <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.neutral500, marginBottom: 12 }}>시간대 선택</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {(['AM', 'PM'] as const).map((period) => {
                        const isSelected = selectedPeriod === period;
                        const label = period === 'AM' ? '오전' : '오후';
                        return (
                            <TouchableOpacity
                                key={period}
                                onPress={() => onPeriodSelect(period)}
                                style={{ flex: 1 }}
                            >
                                <View style={{
                                    paddingVertical: 14,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: COLORS.primaryMain,
                                    backgroundColor: isSelected ? COLORS.primaryMain : 'white',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{
                                        color: isSelected ? 'white' : COLORS.neutralSlate,
                                        fontSize: 14,
                                        fontWeight: 'bold'
                                    }}>{label}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );

        // 시간 버튼 렌더링 (30분 단위)
        const renderTimeGrid = (times: string[], periodLabel: string) => (
            <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.neutral400, marginBottom: 8 }}>{periodLabel}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                    {times.map((time) => {
                        const isBusy = busyTimesForDate.includes(time);
                        const isBeforeStart = isBeforeMinTime(time);
                        const isDisabled = isBusy || isBeforeStart;
                        return (
                            <TouchableOpacity
                                key={time}
                                onPress={() => !isDisabled && onSelect(time)}
                                disabled={isDisabled}
                                style={{
                                    width: '25%',
                                    paddingHorizontal: 4,
                                    marginBottom: 8,
                                }}
                            >
                                <View style={{
                                    paddingVertical: 10,
                                    borderRadius: 8,
                                    borderWidth: isDisabled ? 0 : 1,
                                    borderColor: selectedTime === time ? COLORS.primaryMain : COLORS.primaryMain,
                                    backgroundColor: isDisabled ? COLORS.neutral100 : (selectedTime === time ? COLORS.primaryMain : 'white'),
                                    alignItems: 'center',
                                }}>
                                    <Text style={{
                                        color: isDisabled ? COLORS.neutral300 : (selectedTime === time ? 'white' : COLORS.neutralSlate),
                                        fontSize: 10,
                                        fontWeight: 'bold'
                                    }}>{time}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );

        return (
            <View style={{ marginTop: 12 }}>
                {/* 항상 오전/오후 버튼 표시 */}
                {renderPeriodButtons()}

                {/* 오전 선택 시 오전 시간 버튼 표시 */}
                {selectedPeriod === 'AM' && renderTimeGrid(AM_TIMES, '오전 시간')}

                {/* 오후 선택 시 오후 시간 버튼 표시 */}
                {selectedPeriod === 'PM' && renderTimeGrid(PM_TIMES, '오후 시간')}
            </View>
        );
    };

    // 달력 렌더링 (시작/종료 공용)
    const renderScheduleCalendar = (selectedDateVal: string | null, onSelectDate: (date: string) => void, month: Date, onMonthChange: (dir: 'prev' | 'next') => void) => {
        const year = month.getFullYear();
        const monthNum = month.getMonth();
        const firstDay = new Date(year, monthNum, 1).getDay();
        const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // 기존 약속 날짜 (proposedDate 또는 requestedDate)
        let originalDateRaw = (selectedLog?.details as any)?.proposedDate || (selectedLog?.details as any)?.requestedDate || '';

        // 한국어 날짜 형식 파싱 (예: "12월 13일" -> "2025-12-13")
        let originalDate = '';
        if (originalDateRaw) {
            const koreanDateMatch = originalDateRaw.match(/(\d+)월\s*(\d+)일/);
            if (koreanDateMatch) {
                const parsedMonth = koreanDateMatch[1].padStart(2, '0');
                const parsedDay = koreanDateMatch[2].padStart(2, '0');
                originalDate = `${year}-${parsedMonth}-${parsedDay}`;
            } else if (originalDateRaw.includes('-')) {
                // 이미 ISO 형식인 경우
                originalDate = originalDateRaw;
            }
        }
        console.log('📅 [Calendar] originalDate:', originalDate, 'raw:', originalDateRaw);

        const weeks: (number | null)[][] = [];
        let currentWeek: (number | null)[] = Array(firstDay).fill(null);

        for (let day = 1; day <= daysInMonth; day++) {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weeks.push(currentWeek);
        }

        return (
            <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={() => onMonthChange('prev')}>
                        <ChevronLeft size={20} color={COLORS.neutral500} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.neutralSlate }}>
                        {year}.{String(monthNum + 1).padStart(2, '0')}
                    </Text>
                    <TouchableOpacity onPress={() => onMonthChange('next')}>
                        <ChevronRight size={20} color={COLORS.neutral500} />
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: i === 0 ? '#EF4444' : COLORS.neutral500 }}>{d}</Text>
                    ))}
                </View>
                {weeks.map((week, wIdx) => (
                    <View key={wIdx} style={{ flexDirection: 'row', marginBottom: 4 }}>
                        {week.map((day, dIdx) => {
                            if (!day) return <View key={dIdx} style={{ flex: 1, height: 40 }} />;
                            const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = selectedDateVal === dateStr;
                            const isOriginalDate = dateStr === originalDate;  // 기존 약속 날짜
                            const isPast = new Date(dateStr) < new Date(todayStr);

                            return (
                                <TouchableOpacity
                                    key={dIdx}
                                    onPress={() => !isPast && onSelectDate(dateStr)}
                                    disabled={isPast}
                                    style={{ flex: 1, height: 40, justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <View style={{
                                        width: 32, height: 32, borderRadius: 16,
                                        backgroundColor: isSelected ? COLORS.primaryMain : isOriginalDate ? COLORS.primaryBg : 'transparent',
                                        justifyContent: 'center', alignItems: 'center'
                                    }}>
                                        <Text style={{
                                            color: isSelected ? 'white' : isPast ? COLORS.neutral300 : dIdx === 0 ? '#EF4444' : COLORS.neutralSlate,
                                            fontSize: 14, fontWeight: isOriginalDate ? '700' : '400'
                                        }}>{day}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>
        );
    };

    // 시작시간/종료시간 토글 렌더링 (참고 디자인 적용)
    const renderRescheduleTimeSelection = () => {
        // 날짜를 MM.DD 형식으로 변환하는 함수
        const formatDateShort = (dateStr: string | null | undefined): string => {
            if (!dateStr) return '';
            // YYYY-MM-DD 형식에서 MM.DD 추출
            const parts = dateStr.split('-');
            if (parts.length >= 3) {
                return `${parseInt(parts[1])}.${parseInt(parts[2])}`;
            }
            return dateStr;
        };

        // 기존 시간 (proposedDate + proposedTime ~ proposedEndTime)
        const originalDate = (selectedLog?.details as any)?.proposedDate;
        const originalStartTime = (selectedLog?.details as any)?.proposedTime || (selectedLog?.details as any)?.time;
        const originalEndTime = (selectedLog?.details as any)?.proposedEndTime;

        let originalTimeDisplay = '미정';
        if (originalDate && originalStartTime) {
            const dateFormatted = formatDateShort(originalDate);
            const endPart = originalEndTime ? `~${originalEndTime}` : '~미정';
            originalTimeDisplay = `${dateFormatted} ${originalStartTime}${endPart}`;
        }

        // 변경 요청 시간 (startDate + startTime ~ endTime)
        let newTimeDisplay = '선택';
        if (startDate && startTime) {
            const dateFormatted = formatDateShort(startDate);
            const endPart = endTime ? `~${endTime}` : '~미정';
            newTimeDisplay = `${dateFormatted} ${startTime}${endPart}`;
        }

        return (
            <View style={{ paddingHorizontal: 8, paddingVertical: 12 }}>
                {/* 상단 요약 박스: 기존 시간 → 변경 요청 시간 */}
                <View style={{
                    backgroundColor: `${COLORS.primaryBg}80`,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: `${COLORS.primaryLight}30`,
                    alignItems: 'center'
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 13, color: COLORS.neutral500 }}>{originalTimeDisplay}</Text>
                        <Text style={{ fontSize: 14, color: COLORS.neutral400 }}>→</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.primaryMain }}>{newTimeDisplay}</Text>
                    </View>
                </View>

                {/* 시작시간 토글 */}
                <TouchableOpacity
                    onPress={() => setStartTimeExpanded(!startTimeExpanded)}
                    style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: 16, backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 4,
                        borderWidth: 1, borderColor: COLORS.neutral200
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate }}>시작 시간</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.primaryMain, marginRight: 8 }}>
                            {startDate && startTime ? `${startDate} ${startTime}` : '선택'}
                        </Text>
                        {startTimeExpanded ? <ChevronUp size={16} color={COLORS.neutral400} /> : <ChevronDown size={16} color={COLORS.neutral400} />}
                    </View>
                </TouchableOpacity>

                {startTimeExpanded && (
                    <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.neutral100 }}>
                        {renderScheduleCalendar(startDate, setStartDate, startMonth, (dir) => {
                            const newDate = new Date(startMonth);
                            newDate.setMonth(newDate.getMonth() + (dir === 'prev' ? -1 : 1));
                            setStartMonth(newDate);
                        })}
                        {startDate && renderTimeButtons(startTime, setStartTime, startDate, startPeriod, setStartPeriod)}
                    </View>
                )}

                {/* 종료시간 토글 */}
                <TouchableOpacity
                    onPress={() => setEndTimeExpanded(!endTimeExpanded)}
                    style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: 16, backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 4,
                        borderWidth: 1, borderColor: COLORS.neutral200
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate }}>종료 시간</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.primaryMain, marginRight: 8 }}>
                            {endDate && endTime ? `${endDate} ${endTime}` : '선택'}
                        </Text>
                        {endTimeExpanded ? <ChevronUp size={16} color={COLORS.neutral400} /> : <ChevronDown size={16} color={COLORS.neutral400} />}
                    </View>
                </TouchableOpacity>

                {endTimeExpanded && (
                    <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.neutral100 }}>
                        {renderScheduleCalendar(endDate, setEndDate, endMonth, (dir) => {
                            const newDate = new Date(endMonth);
                            newDate.setMonth(newDate.getMonth() + (dir === 'prev' ? -1 : 1));
                            setEndMonth(newDate);
                        })}
                        {endDate && renderTimeButtons(endTime, setEndTime, endDate, endPeriod, setEndPeriod, startTime, startDate)}
                    </View>
                )}
            </View>
        );
    };

    const handleSubmitReschedule = async () => {
        if (!selectedLog) return;
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('accessToken');

            // 시작시간/종료시간 기반으로 proposal 구성
            const proposalDetails = {
                date: startDate,
                time: startTime,
                endDate: endDate,
                endTime: endTime,
                reason: `${startDate} ${startTime} 제안`  // 요청 시간을 사유에 표시
            };

            const response = await fetch(`${API_BASE}/a2a/session/${selectedLog.id}/reschedule`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(proposalDetails),
            });

            if (response.ok) {
                // 시간 범위 형식으로 표시
                const newTimeRange = `${startDate} ${startTime} ~ ${endDate} ${endTime}`;

                // 선택된 로그의 상세 정보를 새로운 날짜/시간으로 업데이트
                if (selectedLog) {
                    const updatedLog = {
                        ...selectedLog,
                        details: {
                            ...selectedLog.details,
                            proposedDate: startDate,
                            proposedTime: startTime,
                            proposedEndDate: endDate,
                            proposedEndTime: endTime
                        },
                        timeRange: newTimeRange
                    };
                    setSelectedLog(updatedLog as typeof selectedLog);

                    // 로그 목록도 즉시 업데이트
                    setLogs(prevLogs => prevLogs.map(log =>
                        log.id === selectedLog.id
                            ? { ...log, timeRange: newTimeRange, details: { ...(log.details || {}), proposedDate: startDate, proposedTime: startTime } as typeof log.details }
                            : log
                    ));
                }
                setConfirmationType('reschedule');
                setIsConfirmed(true);
                setIsRescheduling(false);

                // 상태 초기화
                setStartDate(null);
                setStartTime(null);
                setEndDate(null);
                setEndTime(null);
                setStartPeriod(null);
                setEndPeriod(null);

                fetchA2ALogs(false);
            } else {
                console.error("Reschedule failed");
            }
        } catch (error) {
            console.error("Error submitting reschedule:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentUser = async () => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentUserId(data.id);
            }
        } catch (e) {
            console.error("Failed to fetch current user", e);
        }
    };

    const fetchA2ALogs = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                console.error("No access token found");
                if (showLoading) setLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE}/a2a/sessions`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();

                // 시간 형식 변환 함수 (MM월 DD일 오전/오후 HH시 → YYYY-MM-DD HH:MM)
                const formatTimeRange = (date: string | undefined, time: string | undefined): string => {
                    if (!date && !time) return "미정";

                    const now = new Date();
                    const currentYear = now.getFullYear();

                    let formattedDate = date || '';
                    let formattedTime = time || '';

                    // MM월 DD일 형식 → YYYY-MM-DD
                    if (date) {
                        const koreanMatch = date.match(/(\d{1,2})월\s*(\d{1,2})일/);
                        if (koreanMatch) {
                            const month = String(koreanMatch[1]).padStart(2, '0');
                            const day = String(koreanMatch[2]).padStart(2, '0');
                            formattedDate = `${currentYear}-${month}-${day}`;
                        }
                    }

                    // 오전/오후 HH시 → HH:MM
                    if (time) {
                        const timeMatch = time.match(/(오전|오후)\s*(\d{1,2})시/);
                        if (timeMatch) {
                            let hour = parseInt(timeMatch[2]);
                            if (timeMatch[1] === '오후' && hour !== 12) hour += 12;
                            if (timeMatch[1] === '오전' && hour === 12) hour = 0;
                            formattedTime = `${String(hour).padStart(2, '0')}:00`;
                        }
                    }

                    return `${formattedDate} ${formattedTime}`.trim() || "미정";
                };

                const mappedLogs: A2ALog[] = data.sessions.map((session: any) => ({
                    id: session.id,
                    title: session.details?.purpose || session.title || "일정 조율",
                    status: session.status === 'completed' ? 'COMPLETED'
                        : session.status === 'rejected' ? 'REJECTED'
                            : 'IN_PROGRESS',
                    // [✅ 수정] 요약에는 참여자 이름만 표시 (이모지 옆 텍스트)
                    summary: session.participant_names?.join(', ') || "참여자 없음",
                    timeRange: formatTimeRange(session.details?.proposedDate, session.details?.proposedTime),
                    createdAt: session.created_at,
                    details: session.details,
                    initiator_user_id: session.initiator_user_id
                }));
                setLogs(mappedLogs);

            } else {
                console.error("Failed to fetch sessions:", response.status);
            }
        } catch (error) {
            console.error("Error fetching A2A logs:", error);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCurrentUser();
        fetchA2ALogs();
    }, [fetchA2ALogs]);

    // WebSocket for real-time A2A updates
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!currentUserId) return;

        const connectWebSocket = () => {
            try {
                const ws = new WebSocket(`${WS_BASE}/ws/${currentUserId}`);

                ws.onopen = () => {
                    console.log("[WS:A2A] 연결 성공");
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log("[WS:A2A] 메시지 수신:", data.type);

                        if (data.type === "a2a_request") {
                            // A2A 요청 도착 - 카드 목록 즉시 새로고침
                            console.log("[WS:A2A] 새 A2A 요청:", data.from_user);
                            fetchA2ALogs(false);
                        }
                    } catch (e) {
                        console.error("[WS:A2A] 메시지 파싱 오류:", e);
                    }
                };

                ws.onerror = (error) => {
                    console.error("[WS:A2A] 오류:", error);
                };

                ws.onclose = () => {
                    console.log("[WS:A2A] 연결 종료, 5초 후 재연결 시도");
                    setTimeout(connectWebSocket, 5000);
                };

                wsRef.current = ws;
            } catch (e) {
                console.error("[WS:A2A] 연결 실패:", e);
            }
        };

        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [currentUserId]);

    const [initialCheckDone, setInitialCheckDone] = useState(false);

    useEffect(() => {
        if (initialLogId && logs.length > 0 && !selectedLog && !initialCheckDone) {
            const targetLog = logs.find(l => l.id === initialLogId);
            if (targetLog) {
                handleLogClick(targetLog);
                setInitialCheckDone(true);
            }
        }
    }, [initialLogId, logs, selectedLog, initialCheckDone]);
    // =============================================
    // True A2A Handlers
    // =============================================

    const startTrueA2ANegotiation = (sessionId: string) => {
        setNegotiatingSessionId(sessionId);
        setShowNegotiation(true);
    };

    const handleNegotiationClose = () => {
        setShowNegotiation(false);
        setNegotiatingSessionId(null);
        fetchA2ALogs();  // 협상 종료 후 목록 새로고침
    };

    const handleNeedHumanDecision = (lastProposal: any) => {
        setLastProposalForDecision(lastProposal);
        setShowNegotiation(false);
        setShowHumanDecision(true);
    };

    const handleAgreementReached = (proposal: any) => {
        setShowNegotiation(false);
        setConfirmationType('official');
        setIsConfirmed(true);
        fetchA2ALogs();
    };

    const submitHumanDecision = async (approved: boolean, counterProposal?: any) => {
        if (!negotiatingSessionId) return;

        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${negotiatingSessionId}/human-decision`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    approved,
                    counter_proposal: counterProposal
                })
            });

            if (res.ok) {
                setShowHumanDecision(false);
                if (approved) {
                    setConfirmationType('official');
                    setIsConfirmed(true);
                }
                fetchA2ALogs();
            } else {
                Alert.alert('오류', '결정 처리에 실패했습니다.');
            }
        } catch (e) {
            console.error('Human decision error:', e);
            Alert.alert('오류', '결정 처리 중 오류가 발생했습니다.');
        }
    };

    // =============================================

    const handleClose = () => {
        setIsModalClosing(true);  // 버튼 이상하게 구려짐 방지
        setTooltipIndex(null);  // 툴팁 초기화
        setTimeout(() => {
            setSelectedLog(null);
            setIsRescheduling(false);
            setIsConfirmed(false);
            setSelectedReason(null);
            setIsProcessExpanded(false);
            setManualInput('');
            setPreferredTime('');
            // isModalClosing은 모달이 다시 열릴 때 리셋됨
        }, 100);
    };

    const formatExactTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}.${month}.${day} ${hours}:${minutes}`;
    };

    const handleLogClick = async (log: any) => {
        // 모달 열기 전 닫힘 상태 리셋
        setIsModalClosing(false);
        // 먼저 기본 정보로 모달을 즉시 열고, 로딩 상태 표시
        setSelectedLog({ ...log, details: { ...log.details, _loading: true } } as any);
        setIsProcessExpanded(false);
        setIsConfirmed(false);
        setIsRescheduling(false);

        const startTime = Date.now();
        console.log('⏱️ [Modal] API 호출 시작');

        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${log.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const apiTime = Date.now() - startTime;
            console.log(`⏱️ [Modal] API 응답 시간: ${apiTime}ms`);

            if (res.ok) {
                const data = await res.json();
                const newDetails = data.details || {};
                const newStatus = data.status;

                if (newDetails.proposer === "알 수 없음" && log.details?.proposer) {
                    newDetails.proposer = log.details.proposer;
                }

                // API 응답으로 완전한 데이터를 받은 후에 모달 표시
                setSelectedLog({
                    ...log,
                    status: newStatus || log.status,
                    details: { ...(log.details || {}), ...newDetails }
                });

                const totalTime = Date.now() - startTime;
                console.log(`⏱️ [Modal] 전체 처리 시간: ${totalTime}ms`);
                console.log('📋 [DEBUG] Updated status:', newStatus, 'rescheduleRequestedBy:', newDetails.rescheduleRequestedBy);
            } else {
                // API 실패 시 기존 데이터로 표시
                setSelectedLog(log);
            }
        } catch (e) {
            console.error("Failed to fetch log details:", e);
            setSelectedLog(log);
        }
    };

    const handleRescheduleClick = () => {
        setIsRescheduling(true);
    };

    const handleBackToDetail = () => {
        setIsRescheduling(false);
    };

    const handleApproveClick = async () => {
        if (!selectedLog) return;
        console.log('� 승인 버튼 클릭 - session_id:', selectedLog.id);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${selectedLog.id}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            console.log('� 승인 API 응답 상태:', res.status);
            const data = await res.json();
            console.log('� 승인 API 응답 데이터:', data);

            if (res.ok) {
                // 전원 승인 완료 시 일정 확정 화면 표시
                if (data.all_approved) {
                    console.log('� 전원 승인 완료 - 일정 확정 화면 표시');
                    setConfirmationType('official');
                    setIsConfirmed(true);
                } else {
                    // 아직 다른 참여자 승인 대기 중 - 확인 화면으로 표시
                    const pendingNames = data.pending_approvers || [];
                    setPendingApprovers(pendingNames);
                    setConfirmationType('partial');
                    setIsConfirmed(true);
                }
            } else {
                console.error("Approve failed:", data);
                alert(data.detail || data.error || "승인 처리에 실패했습니다.");
            }
        } catch (e) {
            console.error("Approve error", e);
            alert("승인 처리 중 오류가 발생했습니다.");
        }
    };

    const submitReject = async () => {
        if (!selectedLog) return;

        try {
            const token = await AsyncStorage.getItem('accessToken');

            // 세션 상세 정보에서 proposal 구성
            const proposal = {
                date: selectedLog.details?.proposedDate || '',
                time: selectedLog.details?.proposedTime || '',
                location: selectedLog.details?.location || '',
                activity: selectedLog.details?.purpose || selectedLog.title || '',
                participants: selectedLog.details?.participants || []
            };

            // /chat/approve-schedule API를 approved: false로 호출
            const res = await fetch(`${API_BASE}/chat/approve-schedule`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    thread_id: selectedLog.details?.thread_id || null,
                    session_ids: [selectedLog.id],
                    approved: false,
                    proposal: proposal
                })
            });

            const data = await res.json();
            console.log('🔴 거절 API 응답:', data);

            if (res.ok) {
                // 처리가 완료되면 모달 닫기 및 목록 갱신
                setShowRejectConfirm(false);
                handleClose();
                fetchA2ALogs();
                Alert.alert("알림", "약속에서 나갔습니다.");
            } else {
                console.error("Reject failed:", data);
                alert(data.detail || data.error || "거절 처리에 실패했습니다.");
            }
        } catch (e) {
            console.error("Reject error:", e);
            alert("거절 처리 중 오류가 발생했습니다.");
        }
    };

    const handleRejectClick = () => {
        // [수정] 바로 API를 호출하지 않고 확인 팝업만 표시
        setShowRejectConfirm(true);
    };



    const reasons = [
        "날짜를 변경하고 싶어요",
        "시간을 변경하고 싶어요"
    ];

    const formatTimeAgo = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return '방금 전';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
        return `${Math.floor(diffInSeconds / 86400)}일 전`;
    };

    const confirmDeleteLog = async (logId: string) => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${logId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchA2ALogs();
            } else {
                alert("삭제에 실패했습니다.");
            }
        } catch (e) {
            console.error("Delete error", e);
            alert("오류가 발생했습니다.");
        }
    };

    const handleDeleteLog = (logId: string) => {
        console.log("Delete triggered for:", logId);
        // [수정] 커스텀 모달로 변경
        setDeleteTargetLogId(logId);
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
        if (deleteTargetLogId) {
            await confirmDeleteLog(deleteTargetLogId);
        }
        setShowDeleteConfirm(false);
        setDeleteTargetLogId(null);
    };

    const renderLogItem = ({ item }: { item: A2ALog }) => (
        <TouchableOpacity
            style={styles.logItem}
            onPress={() => handleLogClick(item)}
            activeOpacity={0.7}
        >
            <View style={styles.logHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.logTitle}>{item.title}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[
                        styles.statusBadge,
                        item.status?.toLowerCase() === 'completed' ? styles.statusCompleted
                            : item.status?.toLowerCase() === 'rejected' ? styles.statusRejected
                                : styles.statusInProgress
                    ]}>
                        <View style={{
                            width: 6, height: 6, borderRadius: 3,
                            backgroundColor: item.status?.toLowerCase() === 'completed' ? COLORS.green600
                                : item.status?.toLowerCase() === 'rejected' ? COLORS.red600
                                    : COLORS.amber600,
                            marginRight: 6
                        }} />
                        <Text style={[
                            styles.statusText,
                            {
                                color: item.status?.toLowerCase() === 'completed' ? COLORS.green600
                                    : item.status?.toLowerCase() === 'rejected' ? COLORS.red600
                                        : COLORS.amber600
                            }
                        ]}>
                            {item.status?.toLowerCase() === 'completed' ? '완료됨'
                                : item.status?.toLowerCase() === 'rejected' ? '거절됨'
                                    : '진행중'}
                        </Text>
                    </View>
                    {(item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'rejected') && (
                        <TouchableOpacity
                            onPress={(e) => {
                                console.log("Trash icon pressed");
                                e.stopPropagation();
                                handleDeleteLog(item.id);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ padding: 4 }} // Added padding to increase visibility/hit area in case
                        >
                            <Trash2 size={18} color={COLORS.neutral400} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.logSummary}>
                <Text style={styles.logSummaryText}>👥 {item.summary}</Text>
            </View>

            <View style={styles.logFooter}>
                <Text style={styles.logTime}>{item.timeRange}</Text>
                <ChevronRight size={16} color={COLORS.neutral300} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>

            {/* List */}
            <View style={styles.listContainer}>
                {loading && logs.length === 0 ? (
                    <ActivityIndicator size="large" color={COLORS.primaryDark} style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={logs}
                        renderItem={renderLogItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>히스토리가 없습니다.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <BottomNav activeTab={Tab.A2A} />

            {/* 삭제 확인 팝업 모달 */}
            <Modal
                visible={showDeleteConfirm}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteConfirm(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                }}>
                    <View style={{
                        backgroundColor: COLORS.white,
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
                    }}>
                        <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: '#FEF2F2',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 16,
                        }}>
                            <Trash2 size={24} color="#F87171" />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 16 }}>일정 삭제</Text>
                        <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                            삭제된 일정은 복구할 수 없습니다.{'\n'}정말 삭제하시겠습니까?
                        </Text>

                        <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
                            {/* 취소 버튼 */}
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    backgroundColor: '#F1F5F9',
                                    alignItems: 'center',
                                }}
                                onPress={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteTargetLogId(null);
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>취소</Text>
                            </TouchableOpacity>

                            {/* 삭제 버튼 */}
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    backgroundColor: '#F87171',
                                    alignItems: 'center',
                                }}
                                onPress={executeDelete}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>삭제</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* True A2A Real-time Negotiation View */}
            {negotiatingSessionId && (
                <RealTimeNegotiationView
                    sessionId={negotiatingSessionId}
                    visible={showNegotiation}
                    onClose={handleNegotiationClose}
                    onNeedHumanDecision={handleNeedHumanDecision}
                    onAgreementReached={handleAgreementReached}
                />
            )}

            {/* Human Decision Modal */}
            <Modal
                visible={showHumanDecision}
                transparent
                animationType="fade"
                onRequestClose={() => setShowHumanDecision(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '50%' }]}>
                        <View style={styles.rescheduleHeader}>
                            <View>
                                <Text style={styles.rescheduleTitle}>🤔 결정이 필요해요</Text>
                                <Text style={styles.rescheduleSub}>AI가 5라운드 내에 합의하지 못했어요</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowHumanDecision(false)}>
                                <X size={24} color={COLORS.neutral400} />
                            </TouchableOpacity>
                        </View>

                        {lastProposalForDecision && (
                            <View style={{ padding: 16 }}>
                                <Text style={{ fontSize: 14, color: COLORS.neutral600, marginBottom: 8 }}>
                                    마지막 제안:
                                </Text>
                                <View style={{ backgroundColor: COLORS.primaryBg, padding: 12, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.primaryDark }}>
                                        📅 {lastProposalForDecision.date} {lastProposalForDecision.time}
                                    </Text>
                                    {lastProposalForDecision.location && (
                                        <Text style={{ fontSize: 14, color: COLORS.neutral600, marginTop: 4 }}>
                                            📍 {lastProposalForDecision.location}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        <View style={{ padding: 16, gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.approveButton, { width: '100%' }]}
                                onPress={() => submitHumanDecision(true)}
                            >
                                <CheckCircle2 size={18} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.approveButtonText}>이 시간으로 확정할게요</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.rescheduleButton, { width: '100%' }]}
                                onPress={() => {
                                    setShowHumanDecision(false);
                                    // 재조율 화면으로 이동
                                    if (selectedLog) {
                                        setIsRescheduling(true);
                                    }
                                }}
                            >
                                <Text style={styles.rescheduleButtonText}>다른 시간으로 다시 협상</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal */}
            <Modal
                visible={!!selectedLog}
                transparent
                animationType="slide"
                onRequestClose={handleClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        {/* 거절 확인 카드 팝업 (오버레이) */}
                        {showRejectConfirm && (
                            <View style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 100,
                            }}>
                                <View style={{
                                    backgroundColor: COLORS.white,
                                    borderRadius: 16,
                                    padding: 20,
                                    width: '60%',
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 12,
                                    elevation: 8,
                                }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 6 }}>약속에서 나가시겠습니까?</Text>
                                    <Text style={{ fontSize: 12, color: COLORS.neutral500, marginBottom: 20, textAlign: 'center' }}>해당 약속에서 나가게 됩니다.{'\n'}재조율을 원한다면 재조율 버튼을 눌러주세요.</Text>

                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        {/* 취소 버튼 */}
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: COLORS.neutral200,
                                                paddingVertical: 8,
                                                paddingHorizontal: 20,
                                                borderRadius: 10,
                                            }}
                                            onPress={() => {
                                                setShowRejectConfirm(false);
                                            }}
                                        >
                                            <Text style={{ color: COLORS.neutral600, fontSize: 14, fontWeight: '600' }}>취소</Text>
                                        </TouchableOpacity>

                                        {/* 확인 버튼 */}
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: '#0E004E',
                                                paddingVertical: 8,
                                                paddingHorizontal: 20,
                                                borderRadius: 10,
                                            }}
                                            onPress={submitReject}
                                        >
                                            <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: '600' }}>확인</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        {isConfirmed ? (
                            /* --- CONFIRMATION VIEW --- */
                            <View style={styles.confirmationContainer}>
                                <TouchableOpacity onPress={() => { handleClose(); fetchA2ALogs(); }} style={styles.closeButtonAbsolute}>
                                    <X size={24} color={COLORS.neutral400} />
                                </TouchableOpacity>

                                <View style={styles.confirmIconContainer}>
                                    <CalendarCheck size={40} color={COLORS.primaryDark} />
                                </View>

                                <Text style={styles.confirmTitle}>
                                    {confirmationType === 'official' ? "일정 확정" : confirmationType === 'partial' ? "승인 완료" : "재조율 요청 완료"}
                                </Text>
                                <Text style={styles.confirmDesc}>
                                    {confirmationType === 'official'
                                        ? `모든 참여자의 승인으로 "${selectedLog?.title}" 일정이 캘린더에 추가되었습니다.`
                                        : confirmationType === 'partial'
                                            ? `"${selectedLog?.title}" 일정을 승인하였으며,\n"${pendingApprovers.join(', ')}" 님의 승인을 기다리고 있습니다.`
                                            : `"${selectedLog?.title}" 일정의 재조율 요청이 전송되었습니다.\n상대방의 수락을 기다려주세요.`}
                                </Text>

                                {/* Ticket Card */}
                                <View style={styles.ticketCard}>
                                    {/* Decorative Circles */}
                                    <View style={[styles.ticketCircle, { left: -12 }]} />
                                    <View style={[styles.ticketCircle, { right: -12 }]} />

                                    {/* 날짜 / 시간 Row */}
                                    <View style={styles.ticketHeader}>
                                        <View>
                                            <Text style={styles.ticketLabel}>날짜</Text>
                                            <Text style={styles.ticketValue}>
                                                {confirmationType === 'reschedule' && selectedDate
                                                    ? selectedDate
                                                    : (selectedLog?.details?.proposedDate || selectedLog?.details?.proposedTime?.split(' ')[0] || '날짜 미정')}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.ticketLabel}>시간</Text>
                                            <Text style={[styles.ticketValue, { color: COLORS.primaryMain }]}>
                                                {confirmationType === 'reschedule' && startTime
                                                    ? `${startTime}${endTime ? `~${endTime}` : ''}`
                                                    : (selectedLog?.details?.proposedTime?.match(/\d{1,2}:\d{2}/)?.[0] || selectedLog?.details?.proposedTime || '시간 미정')}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 장소 / 참여자 Row - ticketHeader와 동일한 스타일 적용 */}
                                    <View style={[styles.ticketHeader, { marginBottom: 0, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.neutral100 }]}>
                                        <View>
                                            <Text style={styles.ticketLabel}>장소</Text>
                                            <Text style={styles.ticketValue}>
                                                {selectedLog?.details?.location || '미정'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.ticketLabel}>참여자</Text>
                                            <View style={[styles.attendeeStack, { marginTop: 4 }]}>
                                                {/* 참여자 프로필 이미지 (최대 3개) */}
                                                {/* 참여자 프로필 이미지 (최대 3개) */}
                                                {((selectedLog?.details as any)?.attendees?.map((a: any) => a.avatar) || (selectedLog?.details as any)?.participantImages || ['https://picsum.photos/150']).slice(0, 3).map((uri: string, idx: number) => (
                                                    <Image
                                                        key={idx}
                                                        source={{ uri: uri || 'https://picsum.photos/150' }}
                                                        style={[styles.attendeeAvatar, { marginLeft: idx > 0 ? -8 : 0 }]}
                                                    />
                                                ))}
                                                {/* 본인 표시 */}
                                                <View style={[styles.attendeeAvatar, styles.attendeeYou, { marginLeft: -8 }]}>
                                                    <Text style={styles.attendeeYouText}>You</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {confirmationType !== 'reschedule' && (
                                    <TouchableOpacity style={styles.viewCalendarBtn} onPress={() => { handleClose(); navigation.navigate('Home'); }}>
                                        <Calendar size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                                        <Text style={styles.viewCalendarText}>View in Calendar</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : isRescheduling ? (
                            /* --- RESCHEDULE VIEW --- */
                            <View style={{ flex: 1 }}>
                                <View style={styles.rescheduleHeader}>
                                    <View>
                                        <Text style={styles.rescheduleTitle}>일정 재조율</Text>
                                        <Text style={styles.rescheduleSub}>AI가 자동으로 재협상을 시작합니다</Text>
                                    </View>
                                    <TouchableOpacity onPress={handleClose}>
                                        <X size={24} color={COLORS.neutral400} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.rescheduleContent}>
                                    {/* 새로운 시작/종료 시간 선택 UI */}
                                    {renderRescheduleTimeSelection()}
                                </ScrollView>

                                <View style={styles.rescheduleFooter}>
                                    <TouchableOpacity onPress={handleBackToDetail} style={styles.cancelBtn}>
                                        <Text style={styles.cancelBtnText}>취소</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSubmitReschedule}
                                        disabled={!startDate || !startTime || !endDate || !endTime}
                                        style={[
                                            styles.confirmBtn,
                                            (!startDate || !startTime || !endDate || !endTime) && styles.submitButtonDisabled
                                        ]}
                                    >
                                        <Text style={styles.confirmBtnText}>AI에게 재협상 요청</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            /* --- DETAIL VIEW --- */
                            <View style={{ flex: 1 }}>
                                <LinearGradient
                                    colors={[COLORS.primaryLight, COLORS.primaryMain]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.detailHeader}
                                >
                                    <View style={styles.detailHeaderContent}>
                                        <View style={styles.detailHeaderIcon}>
                                            <CheckCircle2 size={20} color="white" />
                                        </View>
                                        <View>
                                            <Text style={styles.detailHeaderSub}>
                                                {(selectedLog?.details as any)?.rescheduleRequestedBy ? "재조율 요청" : "새로운 일정 요청"}
                                            </Text>
                                            <Text style={styles.detailHeaderTime}>
                                                {(() => {
                                                    const details = selectedLog?.details as any;
                                                    const timestamp = details?.rescheduleRequestedAt || selectedLog?.createdAt;
                                                    return formatExactTime(timestamp || '');
                                                })()}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={handleClose} style={styles.detailCloseBtn}>
                                        <X size={24} color="white" />
                                    </TouchableOpacity>
                                </LinearGradient>

                                <ScrollView style={styles.detailContent}>
                                    {selectedLog?.details && (
                                        <>
                                            {console.log('🔍 [DEBUG] selectedLog.status:', selectedLog.status, 'toLowerCase:', selectedLog.status?.toLowerCase?.())}
                                            {/* Proposer */}
                                            <View style={styles.proposerCard}>
                                                <Image source={{ uri: selectedLog.details.proposerAvatar }} style={styles.proposerAvatar} />
                                                <View>
                                                    <Text style={styles.proposerLabel}>보낸 사람</Text>
                                                    <Text style={styles.proposerName}>{selectedLog.details.proposer}</Text>
                                                </View>
                                            </View>

                                            {/* Info Cards */}
                                            <View style={styles.infoStack}>
                                                <View style={styles.infoCard}>
                                                    <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                        <Calendar size={20} color={COLORS.primaryMain} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>내용</Text>
                                                        <Text style={styles.infoValue}>{selectedLog.details.purpose}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.infoCard}>
                                                    <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                        <Clock size={20} color={COLORS.primaryMain} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>요청시간</Text>
                                                        <Text style={styles.infoValue}>
                                                            {/* 요청시간: requestedDate/Time 우선, 없으면 proposedDate/Time fallback */}
                                                            {(selectedLog.details as any)?.requestedDate || selectedLog.details.proposedDate
                                                                ? `${(selectedLog.details as any)?.requestedDate || selectedLog.details.proposedDate} ${(selectedLog.details as any)?.requestedTime || selectedLog.details.proposedTime}`
                                                                : (selectedLog.details as any)?.requestedTime || selectedLog.details.proposedTime || '미정'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* 협상 확정 시간 - 협상 완료 상태(completed/pending_approval)일 때 표시 */}
                                                {['pending_approval', 'completed'].includes((selectedLog as any).status?.toLowerCase?.() || '') && (
                                                    <View style={styles.infoCard}>
                                                        <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                            <CheckCircle2 size={20} color={COLORS.primaryMain} />
                                                        </View>
                                                        <View>
                                                            <Text style={styles.infoLabel}>협상 확정 시간</Text>
                                                            <Text style={styles.infoValue}>
                                                                {/* agreedDate/Time 우선, 없으면 proposedDate/Time fallback */}
                                                                {(selectedLog.details as any)?.agreedDate || selectedLog.details.proposedDate
                                                                    ? `${(selectedLog.details as any)?.agreedDate || selectedLog.details.proposedDate} ${(selectedLog.details as any)?.agreedTime || selectedLog.details.proposedTime}`
                                                                    : (selectedLog.details as any)?.agreedTime || selectedLog.details.proposedTime || '협상 중'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}


                                                <View style={styles.infoCard}>
                                                    <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                        <MapPin size={20} color={COLORS.primaryMain} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>위치</Text>
                                                        <Text style={styles.infoValue}>{selectedLog.details.location || '미정'}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Attendees */}
                                            <View style={styles.attendeesSection}>
                                                <Text style={styles.attendeesLabel}>참여자</Text>
                                                <View style={styles.attendeeStackContainer}>
                                                    <View style={styles.attendeeStack}>
                                                        {(selectedLog.details as any)?.attendees?.filter((attendee: any) => {
                                                            // left_participants에 있는 사용자는 제외
                                                            const leftParticipants = (selectedLog.details as any)?.left_participants || [];
                                                            return !leftParticipants.includes(attendee.id);
                                                        }).map((attendee: any, idx: number) => (
                                                            <TouchableOpacity
                                                                key={idx}
                                                                onPress={() => setTooltipIndex(tooltipIndex === idx ? null : idx)}
                                                                style={[styles.attendeeWrapper, tooltipIndex === idx && styles.attendeeSelected]}
                                                            >
                                                                {attendee.isCurrentUser ? (
                                                                    <View style={[styles.attendeeAvatar, styles.attendeeYou]}>
                                                                        <Text style={styles.attendeeYouText}>You</Text>
                                                                    </View>
                                                                ) : (
                                                                    <Image
                                                                        source={{ uri: attendee.avatar }}
                                                                        style={styles.attendeeAvatar}
                                                                    />
                                                                )}
                                                            </TouchableOpacity>
                                                        )) || (
                                                                <>
                                                                    <Image source={{ uri: selectedLog.details.proposerAvatar }} style={styles.attendeeAvatar} />
                                                                    <View style={[styles.attendeeAvatar, styles.attendeeYou, { marginLeft: -8 }]}>
                                                                        <Text style={styles.attendeeYouText}>You</Text>
                                                                    </View>
                                                                </>
                                                            )}
                                                    </View>
                                                    {tooltipIndex !== null && (selectedLog.details as any)?.attendees?.[tooltipIndex] && (
                                                        <View style={styles.tooltipRow}>
                                                            <View style={[styles.tooltipSpacer, { width: 8 + tooltipIndex * 15 }]} />
                                                            <View style={styles.tooltipContainer}>
                                                                <Text style={styles.tooltipText}>
                                                                    {(selectedLog.details as any).attendees[tooltipIndex].isCurrentUser
                                                                        ? '나'
                                                                        : ((selectedLog.details as any).attendees[tooltipIndex].name || '알 수 없음')}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Process */}
                                            <View style={styles.processCard}>
                                                <TouchableOpacity
                                                    style={styles.processHeader}
                                                    onPress={() => setIsProcessExpanded(!isProcessExpanded)}
                                                >
                                                    <Text style={styles.processTitle}>A2A 협상 과정 보기</Text>
                                                    <ChevronRight
                                                        size={16}
                                                        color={COLORS.neutral300}
                                                        style={{ transform: [{ rotate: isProcessExpanded ? '90deg' : '0deg' }] }}
                                                    />
                                                </TouchableOpacity>

                                                {isProcessExpanded && (
                                                    <View style={styles.processList}>
                                                        <View style={styles.processLine} />
                                                        {selectedLog.details.process.map((step: any, idx: number) => (
                                                            <View key={idx} style={styles.processItem}>
                                                                <View style={styles.processDot} />
                                                                <View style={{ flex: 1 }}>
                                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Text style={styles.processStep}>[{step.step}]</Text>
                                                                        {step.created_at && (
                                                                            <Text style={{ fontSize: 10, color: COLORS.neutral400 }}>
                                                                                {new Date(step.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                    <Text style={styles.processDesc}>{step.description}</Text>
                                                                </View>
                                                            </View>
                                                        ))}

                                                        {/* 나간 사람들 표시 */}
                                                        {(selectedLog.details as any)?.left_participants?.length > 0 && (
                                                            <>
                                                                {(selectedLog.details as any).attendees
                                                                    ?.filter((a: any) => (selectedLog.details as any).left_participants?.includes(a.id))
                                                                    .map((leftUser: any, idx: number) => (
                                                                        <View key={`left-${idx}`} style={styles.processItem}>
                                                                            <View style={[styles.processDot, { backgroundColor: '#EF4444' }]} />
                                                                            <View style={{ flex: 1 }}>
                                                                                <Text style={[styles.processDesc, { color: '#EF4444' }]}>
                                                                                    {leftUser.name || '참여자'}님이 약속에서 나갔습니다.
                                                                                </Text>
                                                                            </View>
                                                                        </View>
                                                                    ))
                                                                }
                                                            </>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <View style={styles.buttonRow}>
                                        {/* 모달이 닫히는 중이 아닐 때만 버튼 표시 */}
                                        {!isModalClosing && (
                                            <>
                                                <TouchableOpacity onPress={handleRescheduleClick} style={styles.rescheduleButton}>
                                                    <Text style={styles.rescheduleButtonText}>재조율</Text>
                                                </TouchableOpacity>

                                                {/* 승인/거절 버튼: initiator_user_id는 리스트에서 이미 가져옴 (API 대기 불필요) */}
                                                {selectedLog?.status?.toLowerCase() !== 'completed' && (() => {
                                                    const rescheduleRequestedBy = (selectedLog?.details as any)?.rescheduleRequestedBy;
                                                    // 재조율 요청이 있으면: 요청한 사람이 아닌 사람에게 버튼 표시
                                                    // 재조율 요청이 없으면: initiator가 아닌 사람에게 버튼 표시
                                                    const showButtons = rescheduleRequestedBy
                                                        ? currentUserId !== rescheduleRequestedBy
                                                        : currentUserId !== selectedLog?.initiator_user_id;

                                                    return showButtons ? (
                                                        <>
                                                            <TouchableOpacity onPress={handleApproveClick} style={styles.approveButton}>
                                                                <CheckCircle2 size={16} color="white" style={{ marginRight: 6 }} />
                                                                <Text style={styles.approveButtonText}>승인</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity onPress={handleRejectClick} style={styles.rejectButton}>
                                                                <X size={16} color="white" style={{ marginRight: 6 }} />
                                                                <Text style={styles.rejectButtonText}>거절</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    ) : null;
                                                })()}
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.neutralLight },

    // Header
    headerContainer: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        marginBottom: 4,
        zIndex: 10
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate },

    // List
    listContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    listContent: { paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.neutral500, fontSize: 16 },
    // Calendar Styles from HomeScreen
    calendarContainer: {
        backgroundColor: 'white',
        marginTop: 16,
        padding: 20,
        // Removed border to match HomeScreen card style if desired, or keep specific container style
        borderWidth: 1,
        borderColor: COLORS.neutral200,
    },
    calendarContainerRounded: {
        borderRadius: 24,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'center', // Center title like HomeScreen? HomeScreen uses space-between but left aligned text. Let's use left align container logic if needed or just center.
        // Actually HomeScreen uses headerLeft container. Let's stick to simple center for modal or match HomeScreen exactly.
        // HomeScreen: Left [Chevron Title Chevron] ... Right [Today]
        // Let's keep it simple for modal: [Chevron Title Chevron]
        alignItems: 'center',
        marginBottom: 20,
    },
    calendarTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.neutral900,
        marginHorizontal: 10,
    },
    iconButton: {
        padding: 4,
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
        aspectRatio: 1, // Make square
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    dayNumberContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    dayNumberSelected: {
        backgroundColor: COLORS.primaryMain,
    },
    dayNumberOriginal: {
        backgroundColor: '#F59E0B', // Amber-500 for original date
    },
    dayNumberText: {
        fontSize: 14,
        fontWeight: '500',
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 12
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    legendText: {
        fontSize: 12,
        color: COLORS.neutral600
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },

    logItem: {
        backgroundColor: COLORS.white,
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.neutral100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    logTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.neutralSlate },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
    statusCompleted: { backgroundColor: COLORS.green50, borderColor: COLORS.green100 },
    statusInProgress: { backgroundColor: COLORS.amber50, borderColor: COLORS.amber100 },
    statusRejected: { backgroundColor: COLORS.red50, borderColor: COLORS.red100 },
    statusText: { fontSize: 9, fontWeight: 'bold' },
    logSummary: { marginBottom: 10 },
    logSummaryText: { fontSize: 11, color: COLORS.neutral500 },
    logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.neutral50 },
    logTime: { fontSize: 11, color: COLORS.neutral400 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '90%',
        overflow: 'hidden'
    },

    // Confirmation View
    confirmationContainer: { flex: 1, alignItems: 'center', padding: 24, backgroundColor: COLORS.neutralLight },
    closeButtonAbsolute: { position: 'absolute', top: 24, right: 24, zIndex: 10 },
    confirmIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24, marginTop: 32 },
    confirmEmoji: { fontSize: 48, marginBottom: 16, marginTop: 32 },
    confirmTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 8 },
    confirmDesc: { fontSize: 14, color: COLORS.neutral500, textAlign: 'center', lineHeight: 20, marginBottom: 32 },

    ticketCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: COLORS.neutral50,
        position: 'relative',
        overflow: 'hidden'
    },
    ticketCircle: { position: 'absolute', top: '50%', width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.neutralLight, marginTop: -12 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    ticketLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutral400, marginBottom: 4, letterSpacing: 0.5 },
    ticketValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    ticketSub: { fontSize: 14, fontWeight: '500', color: COLORS.neutral400 },
    ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.neutral200, borderStyle: 'dashed' },
    ticketLocationTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 2 },
    ticketLocationSub: { fontSize: 12, color: COLORS.neutral400 },

    viewCalendarBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.approveBtn, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    viewCalendarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Reschedule View
    rescheduleHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.neutral100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white },
    rescheduleTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    rescheduleSub: { fontSize: 12, color: COLORS.neutral500, marginTop: 2 },
    rescheduleContent: { flex: 1, padding: 20, backgroundColor: COLORS.white },
    section: { marginBottom: 24 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 12 },
    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    reasonChip: { width: '48%', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    reasonChipSelected: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryBg },
    reasonChipUnselected: { borderColor: COLORS.neutral200, backgroundColor: COLORS.white },
    reasonText: { fontSize: 12, fontWeight: 'bold' },
    reasonTextSelected: { color: COLORS.primaryMain },
    reasonTextUnselected: { color: COLORS.neutral500 },
    textArea: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.neutral200, borderRadius: 16, padding: 16, fontSize: 14, color: COLORS.neutralSlate, textAlignVertical: 'top' },
    inputWrapper: { position: 'relative', justifyContent: 'center' },
    inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
    textInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.neutral200, borderRadius: 16, paddingLeft: 44, paddingRight: 16, paddingVertical: 14, fontSize: 14, color: COLORS.neutralSlate },

    rescheduleFooter: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.neutral100, flexDirection: 'row', gap: 12, backgroundColor: COLORS.white },
    cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.neutral100, alignItems: 'center' },
    cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: COLORS.neutral600 },
    confirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.primaryMain, alignItems: 'center' },
    submitButtonDisabled: { backgroundColor: COLORS.neutral300, shadowOpacity: 0 },
    confirmBtnText: { fontSize: 16, fontWeight: 'bold', color: 'white' },

    // Time Selection Styles
    timeSelectionContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: COLORS.neutral50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.neutral200
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    timeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutral700
    },
    timeValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.neutral100,
        borderRadius: 8
    },
    timeValueText: {
        fontSize: 14,
        color: COLORS.neutral600,
        fontWeight: '500'
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.neutral200,
        marginVertical: 12
    },
    timePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.primaryMain
    },
    timePickerText: {
        fontSize: 14,
        color: COLORS.primaryDark,
        fontWeight: '600'
    },

    // Detail View
    detailHeader: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailHeaderContent: { flexDirection: 'row', alignItems: 'center' },
    detailHeaderIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    detailHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
    detailHeaderTime: { fontSize: 11, fontWeight: 'bold', color: 'white' },
    detailCloseBtn: { padding: 4 },
    detailContent: { flex: 1, padding: 16, backgroundColor: COLORS.neutralLight },

    proposerCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.neutral100, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    proposerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    proposerLabel: { fontSize: 11, color: COLORS.neutral500, fontWeight: '500' },
    proposerName: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate },

    infoStack: { gap: 8, marginBottom: 16 },
    infoCard: { padding: 10, backgroundColor: COLORS.white, borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    infoIconBox: { width: 30, height: 30, borderRadius: 6, backgroundColor: COLORS.neutral50, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    infoLabel: { fontSize: 11, color: COLORS.neutral400, fontWeight: 'bold', marginBottom: 2 },
    infoValue: { fontSize: 13, fontWeight: 'bold', color: COLORS.neutralSlate },

    attendeesSection: { marginBottom: 16 },
    attendeesLabel: { fontSize: 11, color: COLORS.neutral400, fontWeight: 'bold', marginBottom: 6, paddingLeft: 4 },
    attendeeStackContainer: {},
    attendeeStack: { flexDirection: 'row', marginLeft: 8 },
    attendeeWrapper: { marginLeft: -8 },
    attendeeSelected: { zIndex: 10 },
    attendeeAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.white, backgroundColor: COLORS.neutral100 },
    tooltipRow: { flexDirection: 'row', marginTop: 6 },
    tooltipSpacer: {},
    tooltipContainer: { backgroundColor: COLORS.white, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.primaryMain },
    tooltipText: { color: COLORS.neutral700, fontSize: 11, fontWeight: '600' },
    attendeeYou: { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' },
    attendeeYouText: { fontSize: 9, fontWeight: 'bold', color: COLORS.primaryMain },
    attendeePlus: { backgroundColor: COLORS.neutral100, justifyContent: 'center', alignItems: 'center' },
    attendeePlusText: { fontSize: 9, fontWeight: 'bold', color: COLORS.neutral400 },

    processCard: { padding: 12, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral100, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    processHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    processTitle: { fontSize: 11, fontWeight: 'bold', color: COLORS.neutral500 },
    processList: { marginTop: 12, paddingLeft: 6, position: 'relative' },
    processLine: { position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, backgroundColor: COLORS.neutral100 },
    processItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, position: 'relative', zIndex: 1 },
    processDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.neutral200, borderWidth: 2, borderColor: COLORS.white, marginRight: 12, marginTop: 4 },
    processStep: { fontSize: 9, fontWeight: 'bold', color: COLORS.neutral400, marginBottom: 2 },
    processDesc: { fontSize: 11, color: COLORS.neutral600 },

    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.neutral100, backgroundColor: COLORS.white },
    buttonRow: { flexDirection: 'row', gap: 12 },
    rescheduleButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral200, alignItems: 'center' },
    rescheduleButtonText: { color: COLORS.neutralSlate, fontWeight: 'bold', fontSize: 14 },
    approveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.approveBtn, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: COLORS.approveBtn, shadowOpacity: 0.3, shadowRadius: 8 },
    approveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    rejectButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#FECACA', shadowOpacity: 0.3, shadowRadius: 8 },
    rejectButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

export default A2AScreen;
