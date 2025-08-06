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
      console.log('🔍 백엔드 API에서 캘린더 이벤트 가져오는 중...');
      
      // 백엔드 API 호출
      const response = await fetch('http://localhost:3000/calendar/events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ 백엔드 API에서 이벤트 가져오기 성공:', data);
        setEvents(data.events || []);
      } else {
        console.log('❌ 백엔드 API 실패:', response.status);
        setEvents([]);
      }
    } catch (error) {
      console.error('❌ 백엔드 API 호출 오류:', error);
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
        console.log('✅ Google OAuth 인증 성공');
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
      console.log('액세스 토큰이 없습니다.');
      setEvents([]);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 실제 Google Calendar API에서 이벤트 가져오는 중...');
      
      const response = await fetch(`http://localhost:3000/calendar/events?access_token=${accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ 실제 Google Calendar 이벤트 가져오기 성공:', data);
        setEvents(data.events || []);
      } else {
        console.log('❌ Google Calendar API 실패:', response.status);
        setEvents([]);
      }
    } catch (error) {
      console.error('❌ Google Calendar API 호출 오류:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // 현재 월의 캘린더 데이터 생성
  const generateCalendarMonth = useCallback((year: number, month: number): CalendarMonth => {
    console.log('=== 캘린더 월 생성 ===');
    console.log('생성 요청: 년', year, '월', month);
    console.log('현재 선택된 날짜:', selectedDate);
    
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dateString = currentDate.toISOString().split('T')[0];
      const dayOfMonth = currentDate.getDate();
      const isToday = dateString === todayString;
      
      // 선택된 날짜 비교를 정확하게 수행
      const isSelected = selectedDate === dateString;
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      if (isSelected) {
        console.log('선택된 날짜 발견:', dateString, '일:', dayOfMonth);
      }
      
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
  }, [selectedDate, events]);

  // 선택된 날짜의 이벤트를 메모이제이션
  const selectedEvents = useMemo(() => {
    if (!selectedDate) {
      console.log('이벤트 조회: 선택된 날짜가 없음');
      return [];
    }
    
    console.log('=== 선택된 날짜 이벤트 계산 ===');
    console.log('선택된 날짜:', selectedDate);
    console.log('전체 이벤트 개수:', events.length);
    
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
        console.log('이벤트에 날짜 정보 없음:', event.id);
        return false;
      }
      
      const isMatch = eventDate === selectedDate;
      console.log(`이벤트 ${event.id}: ${eventDate} vs ${selectedDate} = ${isMatch}`);
      return isMatch;
    });
    
    console.log('필터링된 이벤트 개수:', filteredEvents.length);
    return filteredEvents;
  }, [selectedDate, events]);

  // 특정 날짜의 이벤트 가져오기 (기존 호환성을 위해 유지)
  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!date) {
      console.log('이벤트 조회: 날짜가 없음');
      return [];
    }
    
    console.log('=== 이벤트 조회 디버깅 ===');
    console.log('조회 요청 날짜:', date);
    console.log('전체 이벤트 개수:', events.length);
    
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
        console.log('이벤트에 날짜 정보 없음:', event.id);
        return false;
      }
      
      const isMatch = eventDate === date;
      console.log(`이벤트 ${event.id}: ${eventDate} vs ${date} = ${isMatch}`);
      return isMatch;
    });
    
    console.log('필터링된 이벤트 개수:', filteredEvents.length);
    return filteredEvents;
  }, [events]);

  // 날짜 선택
  const selectDate = useCallback((date: string) => {
    console.log('=== 날짜 선택 디버깅 ===');
    console.log('클릭된 날짜:', date);
    console.log('이전 선택된 날짜:', selectedDate);
    console.log('현재 월 데이터:', currentMonth?.year, currentMonth?.month);
    
    // 즉시 상태 업데이트
    setSelectedDate(date);
    
    // 강제로 캘린더 재생성
    if (currentMonth) {
      setTimeout(() => {
        const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month);
        setCurrentMonth(updatedMonth);
      }, 0);
    }
  }, [selectedDate, currentMonth, generateCalendarMonth]);

  // 월 변경
  const changeMonth = (year: number, month: number) => {
    const newMonth = generateCalendarMonth(year, month);
    setCurrentMonth(newMonth);
  };

  // 이벤트 추가 (백엔드 API 호출)
  const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    setLoading(true);
    try {
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
          const newEvent = await response.json();
          console.log('✅ Google Calendar에 이벤트 추가 성공:', newEvent);
          
          // 이벤트 목록에 새 이벤트 추가
          setEvents(prev => {
            const updatedEvents = [...prev, newEvent];
            console.log('이벤트 목록 업데이트:', updatedEvents);
            return updatedEvents;
          });
          
          // 캘린더 데이터 즉시 업데이트
          if (currentMonth) {
            const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month);
            setCurrentMonth(updatedMonth);
          }
        } else {
          const errorText = await response.text();
          console.error('Google Calendar 이벤트 추가 실패:', response.status, errorText);
          throw new Error('이벤트 추가에 실패했습니다.');
        }
      } else {
        throw new Error('액세스 토큰이 필요합니다.');
      }
      
      // 캘린더 데이터 업데이트
      if (currentMonth) {
        const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month);
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
    const initialMonth = generateCalendarMonth(now.getFullYear(), now.getMonth() + 1);
    setCurrentMonth(initialMonth);
    setSelectedDate(now.toISOString().split('T')[0]);
    
    // 백엔드 API에서 이벤트 가져오기
    fetchGoogleCalendarEvents();
  }, []);

  // 이벤트 변경 시 캘린더 업데이트
  useEffect(() => {
    if (currentMonth) {
      const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month);
      setCurrentMonth(updatedMonth);
    }
  }, [events]);

  // 선택된 날짜 변경 시 캘린더 업데이트
  useEffect(() => {
    if (currentMonth && selectedDate) {
      console.log('선택된 날짜 변경으로 캘린더 업데이트:', selectedDate);
      const updatedMonth = generateCalendarMonth(currentMonth.year, currentMonth.month);
      setCurrentMonth(updatedMonth);
    }
  }, [selectedDate, currentMonth]);

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