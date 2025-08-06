export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  htmlLink?: string;
}

export interface CreateEventRequest {
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  attendees?: string[];
  location?: string;
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  isWeekend: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
} 