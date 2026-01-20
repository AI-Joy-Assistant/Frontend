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
      const accessToken = await this.getStoredAccessToken();
      if (!accessToken) {
        // Apple 로그인 유저가 아직 Google Calendar 연동 안 했을 경우
        // 에러 대신 빈 배열 반환 (조용히 처리)
        console.log('[CalendarService] 액세스 토큰 없음 - Google Calendar 미연동 상태');
        return [];
      }

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
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        // 401/403 에러는 토큰 만료 또는 권한 없음 - 빈 배열 반환
        if (response.status === 401 || response.status === 403) {
          console.log('[CalendarService] 캘린더 접근 권한 없음 - 빈 배열 반환');
          return [];
        }
        throw new Error('캘린더 이벤트 조회 실패');
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      // 네트워크 에러 등 예외 상황에서도 에러 throw 대신 빈 배열 반환
      console.warn('[CalendarService] 캘린더 이벤트 조회 실패 (무시됨):', error);
      return [];
    }
  }

  async createCalendarEvent(
    eventData: CreateEventRequest,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    try {
      const accessToken = await this.getStoredAccessToken();
      if (!accessToken) {
        throw new Error('액세스 토큰이 없습니다. Google 인증을 먼저 진행해주세요.');
      }

      const params = new URLSearchParams({
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
      const accessToken = await this.getStoredAccessToken();
      if (!accessToken) {
        throw new Error('액세스 토큰이 없습니다. Google 인증을 먼저 진행해주세요.');
      }

      const params = new URLSearchParams({
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events/${eventId}?${params}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
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
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }
}

export const calendarService = new CalendarService();