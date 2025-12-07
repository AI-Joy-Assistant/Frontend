import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  AlertCircle
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

type CalendarViewMode = 'CONDENSED' | 'STACKED' | 'DETAILED';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Mock Props/State for Request Card
  const [showRequest, setShowRequest] = useState(true);

  const onNavigateToA2A = (id: string) => {
    navigation.navigate('A2A', { initialLogId: id });
  };

  const onDismissRequest = () => {
    setShowRequest(false);
  };

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // Schedule State (API Integration)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // View Mode State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('CONDENSED');
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Modal & Edit State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');

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
    onDismissRequest();
    onNavigateToA2A('1');
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
        const start = new Date(event.start.dateTime || event.start.date || '');
        const end = new Date(event.end.dateTime || event.end.date || '');

        const date = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];

        const startTime = start.toTimeString().slice(0, 5);
        const endTime = end.toTimeString().slice(0, 5);

        return {
          id: event.id,
          title: event.summary,
          date: date,
          endDate: date !== endDateStr ? endDateStr : undefined,
          time: `${startTime} - ${endTime}`,
          participants: event.attendees?.map(a => a.displayName || a.email) || [],
          type: 'NORMAL'
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

  const handleOpenAddSchedule = () => {
    setEditingScheduleId(null);
    setFormTitle('');
    setFormStartDate(selectedDate);
    setFormEndDate('');
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setShowDeleteConfirm(false);
    setShowScheduleModal(true);
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
    if (!formTitle.trim()) {
      Alert.alert('Error', '일정 제목을 입력해주세요.');
      return;
    }
    if (!formStartDate) {
      Alert.alert('Error', '시작 날짜를 선택해주세요.');
      return;
    }

    try {
      setIsLoading(true);

      const startDateTimeStr = `${formStartDate}T${formStartTime}:00`;
      const endDateTimeStr = formEndDate
        ? `${formEndDate}T${formEndTime}:00`
        : `${formStartDate}T${formEndTime}:00`;

      const start = new Date(startDateTimeStr);
      const end = new Date(endDateTimeStr);

      const eventData: CreateEventRequest = {
        summary: formTitle,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Request Card  */}
          {showRequest && (
            <View style={styles.requestCardContainer}>
              <View style={styles.requestCard}>
                <View style={styles.requestCardBgCircle} />

                <View style={styles.requestCardHeader}>
                  <View style={styles.requestCardBadge}>
                    <View style={styles.iconCircle}>
                      <Bell size={16} color={COLORS.primaryMain} fill={COLORS.primaryMain} />
                    </View>
                    <Text style={styles.requestCardBadgeText}>새로운 일정 요청</Text>
                    <View style={styles.redDot} />
                  </View>
                  <TouchableOpacity onPress={onDismissRequest}>
                    <X size={18} color={COLORS.neutral300} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.requestCardTitle}>새로운 일정이 도착했어요!</Text>
                <Text style={styles.requestCardSubtitle}>
                  지민님이 '저녁 식사' 일정을 제안했어요.
                </Text>

                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.viewButton, { flex: 1 }]}
                    onPress={() => handleViewRequest()}
                  >
                    <Text style={styles.viewButtonText}>보기</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Calendar Section  */}
          <View style={[
            styles.calendarContainer,
            showRequest ? styles.calendarContainerRounded : styles.calendarContainerTopRounded
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
                      onPress={() => handleEditSchedule(schedule)}
                      style={[
                        styles.scheduleCard,
                        schedule.type === 'A2A' ? styles.scheduleCardA2A : styles.scheduleCardNormal
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
                            {schedule.time}
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

            <View style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>제목</Text>
                <TextInput
                  style={styles.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="일정 제목을 입력하세요"
                  placeholderTextColor={COLORS.neutral400}
                />
              </View>

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
                      />
                    )
                  )}
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => setShowScheduleModal(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveSchedule}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>{editingScheduleId ? '수정하기' : '추가하기'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav activeTab={Tab.HOME} />
    </SafeAreaView>
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
    paddingBottom: 10,
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
    minHeight: '60%',
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
});