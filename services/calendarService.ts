import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent, CreateEventRequest } from '../types/calendar';
import { API_BASE } from '../constants/config';

const API_BASE_URL = API_BASE;

// 캐시 엔트리 타입
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  expiresIn: number;
};

class CalendarService {
  // 캘린더 이벤트 캐시 (월별로 저장)
  private eventsCache: Map<string, CacheEntry<any[]>> = new Map();
  private readonly EVENTS_CACHE_TTL = 5 * 60 * 1000; // 5분

  // 캐시 키 생성 (월별)
  private getCacheKey(timeMin?: Date, timeMax?: Date): string {
    const minStr = timeMin ? `${timeMin.getFullYear()}-${timeMin.getMonth()}` : 'none';
    const maxStr = timeMax ? `${timeMax.getFullYear()}-${timeMax.getMonth()}` : 'none';
    return `events:${minStr}:${maxStr}`;
  }

  // 캐시에서 이벤트 가져오기
  getCachedEvents(timeMin?: Date, timeMax?: Date): { data: any[]; isStale: boolean; exists: boolean } {
    const key = this.getCacheKey(timeMin, timeMax);
    const entry = this.eventsCache.get(key);

    if (!entry) {
      return { data: [], isStale: true, exists: false };
    }

    const isStale = Date.now() - entry.timestamp > entry.expiresIn;
    return { data: entry.data, isStale, exists: true };
  }

  // 캐시에 이벤트 저장
  private setCachedEvents(timeMin: Date | undefined, timeMax: Date | undefined, events: any[]): void {
    const key = this.getCacheKey(timeMin, timeMax);
    this.eventsCache.set(key, {
      data: events,
      timestamp: Date.now(),
      expiresIn: this.EVENTS_CACHE_TTL,
    });
  }

  // 캘린더 캐시 무효화 (일정 추가/삭제 시 호출)
  invalidateEventsCache(): void {
    this.eventsCache.clear();
  }

  private async getStoredAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('accessToken');
    } catch (error) {
      console.error('액세스 토큰 조회 실패:', error);
      return null;
    }
  }

  private async storeAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('accessToken', token);
    } catch (error) {
      console.error('액세스 토큰 저장 실패:', error);
    }
  }

  // Google Calendar 연동 여부 확인 (캐시 포함)
  private googleCalendarLinked: boolean | null = null;

  async isGoogleCalendarLinked(): Promise<boolean> {
    // 이미 확인한 경우 캐시 반환
    if (this.googleCalendarLinked !== null) {
      return this.googleCalendarLinked;
    }

    try {
      const jwtToken = await this.getStoredAccessToken();
      if (!jwtToken) {
        this.googleCalendarLinked = false;
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/calendar/link-status`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.googleCalendarLinked = data.is_linked === true;
        console.log('[CalendarService] Google Calendar 연동 상태:', this.googleCalendarLinked);
        return this.googleCalendarLinked;
      }

      this.googleCalendarLinked = false;
      return false;
    } catch (error) {
      console.warn('[CalendarService] 연동 상태 확인 실패:', error);
      this.googleCalendarLinked = false;
      return false;
    }
  }

  // 캐시 무효화 (로그인/로그아웃 시 호출)
  clearLinkStatusCache(): void {
    this.googleCalendarLinked = null;
  }

  async getGoogleAuthUrl(): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/calendar/auth-url`);
      const data = await response.json();
      return data.auth_url;
    } catch (error) {
      console.error('Google 인증 URL 조회 실패:', error);
      throw error;
    }
  }

  async authenticateGoogle(code: string, redirectUri: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/calendar/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error('Google 인증 실패');
      }

      const data = await response.json();
      await this.storeAccessToken(data.access_token);
      return data;
    } catch (error) {
      console.error('Google 인증 실패:', error);
      throw error;
    }
  }

  async getCalendarEvents(
    timeMin?: Date,
    timeMax?: Date,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent[]> {
    // 1. 캐시 먼저 확인
    const cached = this.getCachedEvents(timeMin, timeMax);
    if (cached.exists && !cached.isStale) {
      console.log('[CalendarService] 캐시된 이벤트 사용');
      return cached.data;
    }

    try {
      const jwtToken = await this.getStoredAccessToken();
      if (!jwtToken) {
        console.log('[CalendarService] 로그인 안됨 - 빈 배열 반환');
        return [];
      }

      // Google Calendar 연동 여부 확인
      const isLinked = await this.isGoogleCalendarLinked();

      let events: CalendarEvent[] = [];

      // 앱 자체 캘린더 조회 (항상 실행)
      const fetchAppEvents = async () => {
        try {
          console.log('[CalendarService] 앱 자체 캘린더 조회');
          const params = new URLSearchParams();
          if (timeMin) params.append('time_min', timeMin.toISOString());
          if (timeMax) params.append('time_max', timeMax.toISOString());

          const response = await fetch(`${API_BASE_URL}/calendar/app-events?${params}`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
          });

          if (!response.ok) {
            console.warn('[CalendarService] 앱 자체 캘린더 조회 실패:', response.status);
            return [];
          }
          const data = await response.json();
          return data.events || [];
        } catch (e) {
          console.error('[CalendarService] 앱 일정 조회 중 오류:', e);
          return [];
        }
      };

      if (!isLinked) {
        // 미연동 시 앱 일정만 조회
        events = await fetchAppEvents();
      } else {
        // 연동 시 구글 일정 + 앱 일정 병합
        console.log('[CalendarService] Google Calendar 연동됨 - 병합 조회 시작');

        const fetchGoogleEvents = async () => {
          try {
            const params = new URLSearchParams({ calendar_id: calendarId });
            if (timeMin) params.append('time_min', timeMin.toISOString());
            if (timeMax) params.append('time_max', timeMax.toISOString());

            const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
              headers: { 'Authorization': `Bearer ${jwtToken}` }
            });

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                console.log('[CalendarService] Google 접근 실패 - 연동 해제 처리');
                this.googleCalendarLinked = false;
                throw new Error('AUTH_ERROR');
              }
              return [];
            }
            const data = await response.json();
            return data.events || [];
          } catch (e: any) {
            if (e.message === 'AUTH_ERROR') throw e;
            console.warn('[CalendarService] 구글 일정 조회 실패:', e);
            return [];
          }
        };

        try {
          const [appEvents, googleEvents] = await Promise.all([
            fetchAppEvents(),
            fetchGoogleEvents()
          ]);
          events = [...appEvents, ...googleEvents];
        } catch (e: any) {
          if (e.message === 'AUTH_ERROR') {
            // 토큰 만료 등으로 연동 풀리면 앱 일정이라도 반환 (재귀 호출 대신 바로 처리)
            events = await fetchAppEvents();
          } else {
            // 그 외 에러 시 가능한 일정만이라도? 일단 빈 배열 보단 앱 일정이라도..
            // 하지만 Promise.all 실패면 여기로 옴. 개별 catch 처리했으므로 여기 안 옴.
            // AUTH_ERROR만 throw 했음.
            events = await fetchAppEvents();
          }
        }
      }

      // 캐시에 저장
      this.setCachedEvents(timeMin, timeMax, events);
      return events;
    } catch (error) {
      console.warn('[CalendarService] 캘린더 이벤트 조회 실패:', error);

      // 2. 실패 시 만료된 캐시라도 있으면 반환 (일정 사라짐 방지)
      if (cached.exists) {
        console.log('[CalendarService] API 실패 -> 만료된 캐시 데이터 사용');
        return cached.data;
      }
      return [];
    }
  }

  async createCalendarEvent(
    eventData: CreateEventRequest,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    try {
      const jwtToken = await this.getStoredAccessToken();
      if (!jwtToken) {
        throw new Error('로그인이 필요합니다.');
      }

      // Google Calendar 연동 여부 확인
      const isLinked = await this.isGoogleCalendarLinked();

      if (!isLinked) {
        // 앱 자체 캘린더 API 사용
        console.log('[CalendarService] Google Calendar 미연동 - 앱 자체 캘린더에 저장');
        const response = await fetch(`${API_BASE_URL}/calendar/app-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(eventData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '이벤트 생성 실패');
        }

        this.invalidateEventsCache(); // 캐시 무효화
        return await response.json();
      }

      // Google Calendar API 사용
      console.log('[CalendarService] Google Calendar 연동됨 - Google API에 저장');
      const params = new URLSearchParams({
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error('이벤트 생성 실패');
      }

      this.invalidateEventsCache(); // 캐시 무효화
      return await response.json();
    } catch (error) {
      console.error('이벤트 생성 실패:', error);
      throw error;
    }
  }

  async deleteCalendarEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<boolean> {
    try {
      const jwtToken = await this.getStoredAccessToken();
      if (!jwtToken) {
        throw new Error('로그인이 필요합니다.');
      }

      // Google Calendar 연동 여부 확인
      const isLinked = await this.isGoogleCalendarLinked();

      const isAppEvent = eventId.startsWith('app_');

      if (isAppEvent || !isLinked) {
        // 앱 자체 캘린더 API 사용 (ID가 앱 형식이거나 미연동 상태일 때)
        console.log(`[CalendarService] 앱 자체 캘린더에서 삭제 (ID: ${eventId})`);
        const response = await fetch(`${API_BASE_URL}/calendar/app-events/${eventId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });

        if (response.ok) this.invalidateEventsCache(); // 캐시 무효화
        return response.ok;
      }

      // Google Calendar API 사용
      console.log('[CalendarService] Google Calendar 연동됨 - Google API에서 삭제');
      const params = new URLSearchParams({
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events/${eventId}?${params}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (response.ok) this.invalidateEventsCache(); // 캐시 무효화
      return response.ok;
    } catch (error) {
      console.error('이벤트 삭제 실패:', error);
      throw error;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredAccessToken();
    return !!token;
  }

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem('accessToken');
      this.clearLinkStatusCache();
      this.invalidateEventsCache(); // 이벤트 캐시도 삭제
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }
}

export const calendarService = new CalendarService();