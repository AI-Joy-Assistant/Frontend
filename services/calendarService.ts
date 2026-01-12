import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent, CreateEventRequest } from '../types/calendar';
import { API_BASE } from '../constants/config';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

const API_BASE_URL = API_BASE;

// 디바이스 캘린더 권한 요청
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// 디바이스 캘린더 목록 조회
export async function getDeviceCalendars(): Promise<Calendar.Calendar[]> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    throw new Error('캘린더 접근 권한이 없습니다.');
  }
  return await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
}

// 디바이스 캘린더 이벤트 조회 (모든 캘린더)
export async function getDeviceCalendarEvents(
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    throw new Error('캘린더 접근 권한이 없습니다.');
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars.map(c => c.id);

  const startDate = timeMin || new Date();
  const endDate = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 기본 30일

  const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

  // expo-calendar Event를 CalendarEvent 형식으로 변환
  return events.map(event => {
    const startDateStr = typeof event.startDate === 'string'
      ? event.startDate
      : new Date(event.startDate).toISOString();
    const endDateStr = typeof event.endDate === 'string'
      ? event.endDate
      : new Date(event.endDate).toISOString();

    return {
      id: event.id,
      summary: event.title,
      description: event.notes || '',
      location: event.location || '',
      start: {
        dateTime: startDateStr,
        date: event.allDay ? startDateStr.split('T')[0] : undefined,
      },
      end: {
        dateTime: endDateStr,
        date: event.allDay ? endDateStr.split('T')[0] : undefined,
      },
      attendees: [],
    };
  });
}

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
        throw new Error('액세스 토큰이 없습니다. Google 인증을 먼저 진행해주세요.');
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
        throw new Error('캘린더 이벤트 조회 실패');
      }

      const data = await response.json();
      return data.events || [];
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