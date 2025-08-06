import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent, CreateEventRequest } from '../types/calendar';

const API_BASE_URL = 'http://localhost:3000';

class CalendarService {
  private async getStoredAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('google_access_token');
    } catch (error) {
      console.error('액세스 토큰 조회 실패:', error);
      return null;
    }
  }

  private async storeAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('google_access_token', token);
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
        throw new Error('액세스 토큰이 없습니다. Google 인증을 먼저 진행해주세요.');
      }

      const params = new URLSearchParams({
        access_token: accessToken,
        calendar_id: calendarId,
      });

      if (timeMin) {
        params.append('time_min', timeMin.toISOString());
      }
      if (timeMax) {
        params.append('time_max', timeMax.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`);
      
      if (!response.ok) {
        throw new Error('캘린더 이벤트 조회 실패');
      }

      return await response.json();
    } catch (error) {
      console.error('캘린더 이벤트 조회 실패:', error);
      throw error;
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
        access_token: accessToken,
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        access_token: accessToken,
        calendar_id: calendarId,
      });

      const response = await fetch(`${API_BASE_URL}/calendar/events/${eventId}?${params}`, {
        method: 'DELETE',
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
      await AsyncStorage.removeItem('google_access_token');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }
}

export const calendarService = new CalendarService(); 