import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent, CreateEventRequest } from '../types/calendar';
import { API_BASE } from '../constants/config';

const API_BASE_URL = API_BASE;

class CalendarService {
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
    try {
      const jwtToken = await this.getStoredAccessToken();
      if (!jwtToken) {
        console.log('[CalendarService] 로그인 안됨 - 빈 배열 반환');
        return [];
      }

      // Google Calendar 연동 여부 확인
      const isLinked = await this.isGoogleCalendarLinked();

      if (!isLinked) {
        // 앱 자체 캘린더에서 조회
        console.log('[CalendarService] Google Calendar 미연동 - 앱 자체 캘린더 조회');
        const params = new URLSearchParams();
        if (timeMin) {
          params.append('time_min', timeMin.toISOString());
        }
        if (timeMax) {
          params.append('time_max', timeMax.toISOString());
        }

        const response = await fetch(`${API_BASE_URL}/calendar/app-events?${params}`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });

        if (!response.ok) {
          console.warn('[CalendarService] 앱 자체 캘린더 조회 실패:', response.status);
          return [];
        }

        const data = await response.json();
        return data.events || [];
      }

      // Google Calendar API 사용
      console.log('[CalendarService] Google Calendar 연동됨 - Google API 사용');
      const params = new URLSearchParams({
        calendar_id: calendarId,
      });

      if (timeMin) {
        params.append('time_min', timeMin.toISOString());
      }
      if (timeMax) {
        params.append('time_max', timeMax.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (!response.ok) {
        // 401/403 에러는 토큰 만료 또는 권한 없음 - 앱 자체 캘린더로 폴백
        if (response.status === 401 || response.status === 403) {
          console.log('[CalendarService] Google Calendar 접근 실패 - 앱 자체 캘린더로 폴백');
          this.googleCalendarLinked = false;
          return this.getCalendarEvents(timeMin, timeMax, calendarId);
        }
        throw new Error('캘린더 이벤트 조회 실패');
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.warn('[CalendarService] 캘린더 이벤트 조회 실패 (무시됨):', error);
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

      if (!isLinked) {
        // 앱 자체 캘린더 API 사용
        console.log('[CalendarService] Google Calendar 미연동 - 앱 자체 캘린더에서 삭제');
        const response = await fetch(`${API_BASE_URL}/calendar/app-events/${eventId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });

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
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }
}

export const calendarService = new CalendarService();