import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarDay, CalendarMonth } from '../types/calendar';

export function useGoogleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 백엔드 API에서 구글 캘린더 이벤트 가져오기
  const fetchGoogleCalendarEvents = async () => {
    try {
      setLoading(true);
      
      // 백엔드 API 호출
      const response = await fetch('http://localhost:3000/calendar/events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        setEvents([]);
      }
    } catch (error) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth 인증 URL 가져오기
  const getGoogleAuthUrl = async () => {
    try {
      const response = await fetch('http://localhost:3000/calendar/auth-url');
      if (response.ok) {
        const data = await response.json();
        return data.auth_url;
      }
    } catch (error) {
      console.error('Google OAuth URL 가져오기 실패:', error);
    }
    return null;
  };

  // Google OAuth 인증 처리
  const authenticateGoogle = async (code: string) => {
    try {
      const response = await fetch('http://localhost:3000/calendar/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: 'http://localhost:3000/auth/google/callback'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.access_token);
        return data.access_token;
      } else {
        console.error('Google OAuth 인증 실패');
        return null;
      }
    } catch (error) {
      console.error('Google OAuth 인증 중 오류:', error);
      return null;
    }
  };

  // 실제 Google Calendar API에서 이벤트 가져오기
  const fetchRealGoogleCalendarEvents = async () => {
    if (!accessToken) {
      setEvents([]);
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`http://localhost:3000/calendar/events?access_token=${accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        setEvents([]);
      }
    } catch (error) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // 현재 월의 캘린더 데이터 생성
  const generateCalendarMonth = useCallback((year: number, month: number, selectedDateParam?: string): CalendarMonth => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    // 로컬 시간으로 오늘 날짜 문자열 생성
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayString = `${todayYear}-${todayMonth}-${todayDay}`;
    const currentSelectedDate = selectedDateParam || selectedDate;

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // 로컬 시간으로 날짜 문자열 생성 (YYYY-MM-DD 형식)
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const dayOfMonth = currentDate.getDate();
      const isToday = dateString === todayString;
      
      // 선택된 날짜 비교를 정확하게 수행
      const isSelected = currentSelectedDate === dateString;
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      // 해당 날짜에 이벤트가 있는지 확인
      const hasEvents = events.some(event => {
        let eventDate: string;
        
        if (event.start.dateTime) {
          // dateTime 형식인 경우
          const eventDateTime = new Date(event.start.dateTime);
          eventDate = eventDateTime.toISOString().split('T')[0];
        } else if (event.start.date) {
          // date 형식인 경우
          eventDate = event.start.date;
        } else {
          return false;
        }
        
        return eventDate === dateString;
      });

      days.push({
        date: dateString,
        dayOfMonth,
        isToday,
        isSelected,
        hasEvents,
        isWeekend,
      });
    }

    return { year, month, days };
  }, [selectedDate, events.length]); // selectedDate와 events.length를 의존성으로 사용

  // 선택된 날짜의 이벤트를 메모이제이션
  const selectedEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    
    const filteredEvents = events.filter(event => {
      let eventDate: string;
      
      if (event.start.dateTime) {
        // dateTime 형식인 경우
        const eventDateTime = new Date(event.start.dateTime);
        eventDate = eventDateTime.toISOString().split('T')[0];
      } else if (event.start.date) {
        // date 형식인 경우
        eventDate = event.start.date;
      } else {
        return false;
      }
      
      const isMatch = eventDate === selectedDate;
      return isMatch;
    });
    
    return filteredEvents;
  }, [selectedDate, events]);

  // 특정 날짜의 이벤트 가져오기 (기존 호환성을 위해 유지)
  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!date) {
      return [];
    }
    
    const filteredEvents = events.filter(event => {
      let eventDate: string;
      
      if (event.start.dateTime) {
        // dateTime 형식인 경우
        const eventDateTime = new Date(event.start.dateTime);
        eventDate = eventDateTime.toISOString().split('T')[0];
      } else if (event.start.date) {
        // date 형식인 경우
        eventDate = event.start.date;
      } else {
        return false;
      }
      
      return eventDate === date;
    });
    
    return filteredEvents;
  }, [events]);

  // 날짜 선택
  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    
    // 현재 월의 캘린더를 새로운 선택된 날짜로 즉시 업데이트
    if (currentMonth) {
      // generateCalendarMonth를 사용하여 새로운 selectedDate로 캘린더 재생성
      const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month, date);
      setCurrentMonth(updatedMonth);
    }
  }, [currentMonth, generateCalendarMonth]);

  // 월 변경
  const changeMonth = (year: number, month: number) => {
    const newMonth = generateCalendarMonth(year, month, selectedDate);
    setCurrentMonth(newMonth);
  };

  // 이벤트 추가 (백엔드 API 호출)
  const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    setLoading(true);
    try {
      // 임시 ID 생성 (실제로는 서버에서 생성됨)
      const tempId = `temp_${Date.now()}`;
      const newEvent: CalendarEvent = {
        id: tempId,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees || [],
        location: event.location,
        htmlLink: '',
      };

      if (accessToken) {
        // 실제 Google Calendar API 호출
        const response = await fetch(`http://localhost:3000/calendar/events?access_token=${accessToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start_time: event.start.dateTime,
            end_time: event.end.dateTime,
            location: event.location,
            attendees: event.attendees?.map(a => a.email) || [],
          }),
        });

        if (response.ok) {
          const serverEvent = await response.json();
          // 서버에서 받은 이벤트로 교체
          setEvents(prev => prev.map(e => e.id === tempId ? serverEvent : e));
        } else {
          console.error('Google Calendar 이벤트 추가 실패:', response.status);
          // 실패해도 로컬 이벤트는 유지
          setEvents(prev => [...prev, newEvent]);
        }
      } else {
        // 액세스 토큰이 없으면 로컬에만 추가
        setEvents(prev => [...prev, newEvent]);
      }
      
      // 캘린더 데이터 즉시 업데이트
      if (currentMonth) {
        const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month, selectedDate);
        setCurrentMonth(updatedMonth);
      }
      
    } catch (error) {
      console.error('이벤트 추가 실패:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 초기화
  useEffect(() => {
    const now = new Date();
    // 로컬 시간으로 오늘 날짜 문자열 생성
    const todayYear = now.getFullYear();
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayString = `${todayYear}-${todayMonth}-${todayDay}`;
    
    const initialMonth = generateCalendarMonth(now.getFullYear(), now.getMonth() + 1, todayString);
    setCurrentMonth(initialMonth);
    setSelectedDate(todayString);
    
    // 백엔드 API에서 이벤트 가져오기
    fetchGoogleCalendarEvents();
  }, []);

  return {
    events,
    currentMonth,
    selectedDate,
    selectedEvents,
    loading,
    accessToken,
    getEventsForDate,
    selectDate,
    changeMonth,
    addEvent,
    fetchGoogleCalendarEvents,
    fetchRealGoogleCalendarEvents,
    getGoogleAuthUrl,
    authenticateGoogle,
  };
} 