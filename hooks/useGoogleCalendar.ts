// hooks/useGoogleCalendar.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarDay, CalendarMonth } from '../types/calendar';

const API_BASE = 'http://localhost:3000'; // 필요 시 env

// 앱 JWT 얻기: localStorage → 없으면 /auth/token (세션 쿠키)
async function getAppJwt(): Promise<string> {
  const cached = typeof window !== 'undefined' ? localStorage.getItem('app_jwt') : null;
  if (cached) return cached;
  const res = await fetch(`${API_BASE}/auth/token`, { credentials: 'include' });
  if (!res.ok) throw new Error('앱 로그인 필요');
  const data = await res.json();
  const token = data?.accessToken;
  if (!token) throw new Error('앱 로그인 필요');
  try { localStorage.setItem('app_jwt', token); } catch {}
  return token;
}

export function useGoogleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 로컬 YYYY-MM-DD
  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const kstRange = (dateISO: string) => ({
    from: `${dateISO}T00:00:00+09:00`,
    to:   `${dateISO}T23:59:59+09:00`,
  });

  async function tryRefreshToken(oldJwt: string) {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${oldJwt}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data?.accessToken;
    if (newToken) {
      try { localStorage.setItem('app_jwt', newToken); } catch {}
    }
    return newToken;
  }

  // 공통 범위 조회(Authorization: Bearer <앱JWT> 만 사용)
  const fetchEventsRange = async (fromISO: string, toISO: string) => {
    const jwt = await getAppJwt();
    const qs = new URLSearchParams({ time_min: fromISO, time_max: toISO }).toString();
    let res = await fetch(`${API_BASE}/calendar/events?${qs}`, {
      headers: { Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',},
    });

    if (res.status === 401) {
      let body: any = {};
      try { body = await res.clone().json(); } catch {}
      if (body?.detail === 'token_expired') {
        const newJwt = await tryRefreshToken(jwt);
        if (newJwt) {
          res = await fetch(`${API_BASE}/calendar/events?${qs}`, {
            headers: { Authorization: `Bearer ${newJwt}`, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    if (!res.ok) {
      console.error('캘린더 조회 실패:', res.status, await res.text());
      setEvents([]);
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
  };

  const fetchMonthEvents = async (year: number, month: number) => {
    const mm = String(month).padStart(2, '0');
    const first = `${year}-${mm}-01T00:00:00+09:00`;
    const lastDate = new Date(year, month, 0).getDate();
    const last = `${year}-${mm}-${String(lastDate).padStart(2, '0')}T23:59:59+09:00`;
    await fetchEventsRange(first, last);
  };

  const fetchGoogleCalendarEvents = async (dateISO?: string) => {
    const target = dateISO || selectedDate || toLocalYmd(new Date());
    const { from, to } = kstRange(target);
    await fetchEventsRange(from, to);
  };

  // (옵션) OAuth 도우미들 – 필요하면 그대로 사용
  const getGoogleAuthUrl = async () => {
    try {
      const res = await fetch(`${API_BASE}/calendar/auth-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.auth_url as string;
    } catch { return null; }
  };
  const authenticateGoogle = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/calendar/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirect_uri: 'http://localhost:3000/auth/google/callback' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token as string;
    } catch { return null; }
  };

  // 실시간 동기화를 위한 웹훅 구독
  const subscribeToWebhook = async () => {
    try {
      const jwt = await getAppJwt();
      const res = await fetch(`${API_BASE}/calendar/subscribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        console.error('웹훅 구독 실패:', res.status, await res.text());
        return false;
      }
      const data = await res.json();
      console.log('웹훅 구독 성공:', data);
      return true;
    } catch (error) {
      console.error('웹훅 구독 오류:', error);
      return false;
    }
  };

  // 웹훅 구독 갱신
  const renewWebhookSubscription = async () => {
    try {
      const jwt = await getAppJwt();
      const res = await fetch(`${API_BASE}/calendar/renew-subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        console.error('웹훅 갱신 실패:', res.status, await res.text());
        return false;
      }
      const data = await res.json();
      console.log('웹훅 갱신 성공:', data);
      return true;
    } catch (error) {
      console.error('웹훅 갱신 오류:', error);
      return false;
    }
  };

  const fetchRealGoogleCalendarEvents = async () => {
    await fetchGoogleCalendarEvents(selectedDate || toLocalYmd(new Date()));
  };

  // 월 격자
  const generateCalendarMonth = useCallback((year: number, month: number, selectedDateParam?: string): CalendarMonth => {
    const firstDay = new Date(year, month - 1, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const todayString = toLocalYmd(new Date());
    const currentSelectedDate = selectedDateParam || selectedDate;

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateString = toLocalYmd(currentDate);
      const hasEvents = events.some(ev => {
        const eventDate = ev.start.dateTime ? toLocalYmd(new Date(ev.start.dateTime)) : ev.start.date || '';
        return eventDate === dateString;
      });
      days.push({
        date: dateString,
        dayOfMonth: currentDate.getDate(),
        isToday: dateString === todayString,
        isSelected: currentSelectedDate === dateString,
        hasEvents,
        isWeekend: [0,6].includes(currentDate.getDay()),
      });
    }
    return { year, month, days };
  }, [selectedDate, events]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(ev => {
      const eventDate = ev.start.dateTime ? toLocalYmd(new Date(ev.start.dateTime)) : ev.start.date || '';
      return eventDate === selectedDate;
    });
  }, [selectedDate, events]);

  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!date) return [];
    return events.filter(ev => {
      const eventDate = ev.start.dateTime ? toLocalYmd(new Date(ev.start.dateTime)) : ev.start.date || '';
      return eventDate === date;
    });
  }, [events]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    if (currentMonth) setCurrentMonth(generateCalendarMonth(currentMonth.year, currentMonth.month, date));
  }, [currentMonth, generateCalendarMonth]);

  const changeMonth = (year: number, month: number) => {
    setCurrentMonth(generateCalendarMonth(year, month, selectedDate));
    fetchMonthEvents(year, month);
  };

  // 이벤트 추가: 앱 JWT만 사용(백엔드가 구글 토큰 갱신)
  const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    setLoading(true);
    try {
      const jwt = await getAppJwt();
      const payload = {
        summary: event.summary,
        description: event.description,
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
        location: event.location,
        attendees: event.attendees?.map(a => a.email) ?? [],
      };
      const res = await fetch(`${API_BASE}/calendar/events?calendar_id=primary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();

      const dateISO = (event.start.dateTime ?? '').slice(0, 10);
      await fetchGoogleCalendarEvents(dateISO || selectedDate);
      if (currentMonth) await fetchMonthEvents(currentMonth.year, currentMonth.month);
      return created;
    } finally {
      setLoading(false);
    }
  };

  // 초기 세팅
  useEffect(() => {
    const now = new Date();
    const today = toLocalYmd(now);
    setCurrentMonth(generateCalendarMonth(now.getFullYear(), now.getMonth() + 1, today));
    setSelectedDate(today);
  }, []);

  // currentMonth 준비되면 월 전체 조회(로그인 상태면)
  useEffect(() => {
    (async () => {
      if (!currentMonth) return;
      try {
        await getAppJwt();
        await fetchMonthEvents(currentMonth.year, currentMonth.month);
      } catch {
        /* 아직 로그인 안 됨 */
      }
    })();
  }, [currentMonth]);

  return {
    events,
    currentMonth,
    selectedDate,
    selectedEvents,
    loading,
    getEventsForDate,
    selectDate,
    changeMonth,
    addEvent,
    fetchGoogleCalendarEvents,
    fetchRealGoogleCalendarEvents,
    getGoogleAuthUrl,
    authenticateGoogle,
    subscribeToWebhook,
    renewWebhookSubscription,
  };
}
