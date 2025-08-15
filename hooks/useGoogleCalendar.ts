// hooks/useGoogleCalendar.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarDay, CalendarMonth } from '../types/calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://localhost:3000'; // 백엔드 서버 포트로 변경

export function useGoogleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 구글 OAuth access_token (백엔드에 쿼리로 전달)
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // AsyncStorage에서 토큰 불러오기
  useEffect(() => {
    const loadAccessToken = async () => {
      try {
        // 먼저 AsyncStorage에서 확인
        const token = await AsyncStorage.getItem('access_token');
        if (token) {
          console.log('✅ AsyncStorage에서 토큰 불러오기 성공');
          setAccessToken(token);
        } else {
          console.log('⚠️ AsyncStorage에 토큰이 없습니다');
          // 백엔드에서 Google OAuth access_token 가져오기 시도
          try {
            const response = await fetch('http://localhost:3000/auth/google-token', {
              method: 'GET',
              credentials: 'include', // 쿠키 포함
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.access_token) {
                console.log('✅ 백엔드에서 Google OAuth 토큰 가져오기 성공');
                await AsyncStorage.setItem('access_token', data.access_token);
                setAccessToken(data.access_token);
              }
            } else {
              console.log('❌ 백엔드에서 Google OAuth 토큰 가져오기 실패:', response.status);
            }
          } catch (error) {
            console.error('❌ 백엔드에서 Google OAuth 토큰 가져오기 오류:', error);
          }
        }
      } catch (error) {
        console.error('❌ AsyncStorage에서 토큰 불러오기 실패:', error);
      }
    };
    
    loadAccessToken();
  }, []);

  /** 로컬 YYYY-MM-DD */
  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  /** 선택 날짜의 KST 하루 범위 */
  const kstRange = (dateISO: string) => ({
    from: `${dateISO}T00:00:00+09:00`,
    to:   `${dateISO}T23:59:59+09:00`,
  });

  /** 공통 범위 조회 (from/to는 RFC3339, +09:00 포함) */
  const fetchEventsRange = async (fromISO: string, toISO: string) => {
    if (!accessToken) { setEvents([]); return; }

    const qs = new URLSearchParams({
      access_token: accessToken,      // 백엔드가 쿼리로 받음
      time_min: fromISO,              // URLSearchParams가 +를 %2B로 인코딩
      time_max: toISO,
    }).toString();

    const res = await fetch(`${API_BASE}/calendar/events?${qs}`);
    if (!res.ok) {
      console.error('캘린더 조회 실패:', res.status, await res.text());
      setEvents([]);
      return;
    }
    const data = await res.json();    // { events: [...] }
    setEvents(data.events ?? []);
  };

  /** 월 전체 조회 (해당 월 1일 00:00 ~ 말일 23:59:59 KST) */
  const fetchMonthEvents = async (year: number, month: number) => {
    const mm = String(month).padStart(2, '0');
    const first = `${year}-${mm}-01T00:00:00+09:00`;
    const lastDate = new Date(year, month, 0).getDate();
    const last = `${year}-${mm}-${String(lastDate).padStart(2, '0')}T23:59:59+09:00`;
    await fetchEventsRange(first, last);
  };

  /** 하루 범위 조회 (선택일 / 인자로 받은 날짜) */
  const fetchGoogleCalendarEvents = async (dateISO?: string) => {
    if (!accessToken) { setEvents([]); return; }

    const target = dateISO || selectedDate || toLocalYmd(new Date());
    const { from, to } = kstRange(target);
    await fetchEventsRange(from, to);
  };

  /** OAuth 동의 URL */
  const getGoogleAuthUrl = async () => {
    try {
      const res = await fetch(`${API_BASE}/calendar/auth-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.auth_url as string;
    } catch (e) {
      console.error('Google OAuth URL 가져오기 실패:', e);
      return null;
    }
  };

  /** OAuth 코드로 토큰 교환 */
  const authenticateGoogle = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/calendar/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: 'http://localhost:3000/auth/google/callback',
        }),
      });
      if (!res.ok) {
        console.error('Google OAuth 인증 실패', await res.text());
        return null;
      }
      const data = await res.json();
      setAccessToken(data.access_token);
      return data.access_token as string;
    } catch (e) {
      console.error('Google OAuth 인증 중 오류:', e);
      return null;
    }
  };

  /** 실구글 조회(래퍼) */
  const fetchRealGoogleCalendarEvents = async () => {
    await fetchGoogleCalendarEvents(selectedDate || toLocalYmd(new Date()));
  };

  /** 월 격자 생성 (표시용) */
  const generateCalendarMonth = useCallback((year: number, month: number, selectedDateParam?: string): CalendarMonth => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    const todayString = toLocalYmd(today);
    const currentSelectedDate = selectedDateParam || selectedDate;

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dateString = toLocalYmd(currentDate);
      const dayOfMonth = currentDate.getDate();
      const isToday = dateString === todayString;
      const isSelected = currentSelectedDate === dateString;
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      const hasEvents = events.some(event => {
        let eventDate: string;
        if (event.start.dateTime) eventDate = toLocalYmd(new Date(event.start.dateTime));
        else if (event.start.date) eventDate = event.start.date;
        else return false;
        return eventDate === dateString;
      });

      days.push({ date: dateString, dayOfMonth, isToday, isSelected, hasEvents, isWeekend });
    }

    return { year, month, days };
  }, [selectedDate, events.length]);

  /** 선택된 날짜의 이벤트 */
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(event => {
      let eventDate: string;
      if (event.start.dateTime) eventDate = toLocalYmd(new Date(event.start.dateTime));
      else if (event.start.date) eventDate = event.start.date;
      else return false;
      return eventDate === selectedDate;
    });
  }, [selectedDate, events]);

  /** 특정 날짜의 이벤트 */
  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!date) return [];
    return events.filter(event => {
      let eventDate: string;
      if (event.start.dateTime) eventDate = toLocalYmd(new Date(event.start.dateTime));
      else if (event.start.date) eventDate = event.start.date;
      else return false;
      return eventDate === date;
    });
  }, [events]);

  /** 날짜 선택 시: 격자 갱신 + 그 날짜 범위 조회 */
  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    if (currentMonth) {
      const updated = generateCalendarMonth(currentMonth.year, currentMonth.month, date);
      setCurrentMonth(updated);
    }
    fetchGoogleCalendarEvents(date);
  }, [currentMonth, generateCalendarMonth]);

  /** 월 변경 시: 격자 갱신 + 월 전체 조회 */
  const changeMonth = (year: number, month: number) => {
    const newMonth = generateCalendarMonth(year, month, selectedDate);
    setCurrentMonth(newMonth);
    fetchMonthEvents(year, month); // 월 전체 범위 조회
  };

  /** 이벤트 추가 → 평평한 필드로 전송 → 재조회 */
  const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    setLoading(true);
    try {
      if (!accessToken) throw new Error('구글 인증이 필요합니다.');

      const payload = {
        summary: event.summary,
        description: event.description,
        start_time: event.start.dateTime,  // 백엔드가 평평한 필드 기대
        end_time: event.end.dateTime,
        location: event.location,
        attendees: event.attendees?.map(a => a.email) ?? [],
      };

      const url = `${API_BASE}/calendar/events?` + new URLSearchParams({
        access_token: accessToken,
        calendar_id: 'primary',
      }).toString();

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      const created = await res.json();

      // 생성된 날짜만 빠르게 재조회
      const dateISO = (event.start.dateTime ?? '').slice(0, 10);
      await fetchGoogleCalendarEvents(dateISO || selectedDate);

      // (옵션) 월 전체도 갱신하고 싶으면 주석 해제
      if (currentMonth) await fetchMonthEvents(currentMonth.year, currentMonth.month);

      return created;
    } catch (e) {
      console.error('이벤트 추가 실패:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  /** 최초 로딩: 오늘 달 격자 & 선택일 설정 */
  useEffect(() => {
    const now = new Date();
    const today = toLocalYmd(now);
    const initial = generateCalendarMonth(now.getFullYear(), now.getMonth() + 1, today);
    setCurrentMonth(initial);
    setSelectedDate(today);
  }, []);

  /** accessToken 또는 currentMonth 준비되면 월 전체 조회 */
  useEffect(() => {
    if (accessToken && currentMonth) {
      fetchMonthEvents(currentMonth.year, currentMonth.month);
    }
  }, [accessToken, currentMonth]);

  return {
    events,
    currentMonth,
    selectedDate,
    selectedEvents,
    loading,
    accessToken,

    // actions
    getEventsForDate,
    selectDate,
    changeMonth,
    addEvent,

    // fetchers
    fetchGoogleCalendarEvents,     // 하루 범위
    fetchRealGoogleCalendarEvents, // wrapper
    getGoogleAuthUrl,
    authenticateGoogle,
  };
}
