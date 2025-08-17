// hooks/useGoogleCalendar.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarDay, CalendarMonth } from '../types/calendar';

const API_BASE = 'http://localhost:3000';

// 앱 JWT 얻기
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
  // 월 전체 이벤트
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // ★ 선택일 전용 이벤트(일일 조회 결과)
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 일 조회 범위: [00:00, 다음날 00:00) (배타)
  const kstRange = (dateISO: string) => {
    const d = new Date(`${dateISO}T00:00:00+09:00`);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const toYmd = (x: Date) =>
        `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return {
      from: `${dateISO}T00:00:00+09:00`,
      to:   `${toYmd(next)}T00:00:00+09:00`,
    };
  };

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

  // 공통 호출 + 정규화
  const fetchEventsRangeInternal = async (fromISO: string, toISO: string) => {
    const jwt = await getAppJwt();
    const qs = new URLSearchParams({ time_min: fromISO, time_max: toISO }).toString();
    let res = await fetch(`${API_BASE}/calendar/events?${qs}`, {
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
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
      return [] as CalendarEvent[];
    }
    const data = await res.json();
    const normalized = (data.events ?? []).map((ev: any) => ({
      ...ev,
      title: ev.title ?? ev.summary ?? '제목 없음',
      summary: ev.summary ?? ev.title ?? '제목 없음',
      description: ev.description ?? '',
      location: ev.location ?? '',
    }));
    setEvents(normalized);
    return normalized as CalendarEvent[];
  };

  // 월 범위 전용 (다른 날짜의 점 상태 유지)
  const fetchEventsRangeForMonth = async (fromISO: string, toISO: string) => {
    const list = await fetchEventsRangeInternal(fromISO, toISO);
    setEvents(list);            // 월 상태만 갱신
  };

  // 일 범위 전용 (선택일 상세)
  const fetchEventsRangeForDay = async (fromISO: string, toISO: string) => {
    const list = await fetchEventsRangeInternal(fromISO, toISO);
    setDayEvents(list);         // 선택일 상태만 갱신
  };

  // 월 전체
  const fetchMonthEvents = async (year: number, month: number) => {
    const first = `${year}-${String(month).padStart(2,'0')}-01T00:00:00+09:00`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const nextFirst = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01T00:00:00+09:00`;
    await fetchEventsRangeForMonth(first, nextFirst);
  };

  // 일자
  const fetchGoogleCalendarEvents = async (dateISO?: string) => {
    const target = dateISO || selectedDate || toLocalYmd(new Date());
    const { from, to } = kstRange(target);
    await fetchEventsRangeForDay(from, to);
  };

  // (옵션) OAuth 도우미들
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: 'http://localhost:3000/auth/google/callback' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token as string;
    } catch { return null; }
  };

  // 웹훅
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

  // ---- 시간/겹침 유틸 ----
  const eventInterval = (ev: CalendarEvent) => {
    const s = ev.start?.dateTime
        ? new Date(ev.start.dateTime)
        : ev.start?.date
            ? new Date(`${ev.start.date}T00:00:00+09:00`)
            : null;

    const e = ev.end?.dateTime
        ? new Date(ev.end.dateTime)
        : ev.end?.date
            ? new Date(`${ev.end.date}T00:00:00+09:00`) // 구글 종일 종료일은 배타
            : null;

    return { start: s, end: e };
  };

  const dayWindow = (dateString: string) => {
    const start = new Date(`${dateString}T00:00:00+09:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  };

  const overlaps = (aStart: Date | null, aEnd: Date | null, bStart: Date, bEnd: Date) => {
    if (!aStart || !aEnd) return false;
    return aStart < bEnd && aEnd > bStart;
  };

  // 월 격자(점은 월 데이터만 사용)
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
      const { start: dayStart, end: dayEnd } = dayWindow(dateString);
      const hasEvents = events.some(ev => {
        const { start, end } = eventInterval(ev);
        return overlaps(start, end, dayStart, dayEnd);
      });
      days.push({
        date: dateString,
        dayOfMonth: currentDate.getDate(),
        isToday: dateString === todayString,
        isSelected: currentSelectedDate === dateString,
        hasEvents,
        isWeekend: [0, 6].includes(currentDate.getDay()),
      });
    }
    return { year, month, days };
  }, [selectedDate, events]);

  // 선택일 상세는 dayEvents 우선, 없으면 월 데이터에서 필터
  const selectedEvents = useMemo(() => {
    if (dayEvents.length) return dayEvents;
    if (!selectedDate) return [];
    const { start: dayStart, end: dayEnd } = dayWindow(selectedDate);
    return events.filter(ev => {
      const { start, end } = eventInterval(ev);
      return overlaps(start, end, dayStart, dayEnd);
    });
  }, [selectedDate, events, dayEvents]);

  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!date) return [];
    const { start: dayStart, end: dayEnd } = dayWindow(date);
    return events.filter(ev => {
      const { start, end } = eventInterval(ev);
      return overlaps(start, end, dayStart, dayEnd);
    });
  }, [events]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setDayEvents([]); // 선택 바꿀 때 이전 일자 캐시 초기화(선택)
    if (currentMonth) setCurrentMonth(generateCalendarMonth(currentMonth.year, currentMonth.month, date));
  }, [currentMonth, generateCalendarMonth]);

  const changeMonth = (year: number, month: number) => {
    setCurrentMonth(generateCalendarMonth(year, month, selectedDate));
    fetchMonthEvents(year, month);
  };

  // 이벤트 추가
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
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

  // 이벤트 삭제
  const deleteEvent = async (eventId: string) => {
    setLoading(true);
    try {
      const jwt = await getAppJwt();
      const res = await fetch(`${API_BASE}/calendar/events/${eventId}?calendar_id=primary`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error(await res.text());

      // 선택된 날짜와 현재 월 데이터 동기화
      await fetchGoogleCalendarEvents(selectedDate || toLocalYmd(new Date()));
      if (currentMonth) await fetchMonthEvents(currentMonth.year, currentMonth.month);
      return true;
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

  // currentMonth 준비되면 월 전체 조회
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
    deleteEvent,
    fetchGoogleCalendarEvents,
    fetchRealGoogleCalendarEvents,
    getGoogleAuthUrl,
    authenticateGoogle,
    subscribeToWebhook,
    renewWebhookSubscription,
  };
}
