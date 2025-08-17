import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CalendarEvent } from '../../types/calendar';

interface EventDetailsProps {
  selectedDate: string;
  events: CalendarEvent[];
  onDeleteEvent?: (eventId: string) => void;
}

export default function EventDetails({ selectedDate, events, onDeleteEvent }: EventDetailsProps) {
  // 선택된 날짜의 이벤트만 필터링
  // const filteredEvents = events.filter(event => {
  //   let eventDate: string;
  //
  //   if (event.start.dateTime) {
  //     const eventDateTime = new Date(event.start.dateTime);
  //     eventDate = eventDateTime.toISOString().split('T')[0];
  //   } else if (event.start.date) {
  //     eventDate = event.start.date;
  //   } else {
  //     return false;
  //   }
  //
  //   return eventDate === selectedDate;
  // });
  const filteredEvents = events;
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();
      const ampm = hour >= 12 ? '오후' : '오전';
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const timeString = `${hour > 12 ? '오후' : '오전'} ${hour > 12 ? hour - 12 : hour}시${minute > 0 ? ` ${minute}분` : ''}`;
      return `${month}월 ${day}일 ${timeString}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatTimeRange = (startDateTime: string, endDateTime: string) => {
    try {
      const s = new Date(startDateTime);
      const e = new Date(endDateTime);
      const fmt = (d: Date) => {
        const ampm = d.getHours() >= 12 ? '오후' : '오전';
        const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
        const mm = d.getMinutes();
        return `${ampm} ${h12}시${mm ? ` ${mm}분` : ''}`;
      };
      
      // 시작시간과 종료시간이 같으면 시작시간만 표시
      if (s.getTime() === e.getTime()) {
        return fmt(s);
      }
      
      return `${fmt(s)} - ${fmt(e)}`;
    } catch {
      return `${startDateTime} - ${endDateTime}`;
    }
  };

  const formatAttendees = (attendees?: CalendarEvent['attendees']) => {
    if (!attendees?.length) return '';
    return attendees
        .map(a => (a.displayName || a.email.split('@')[0]).replace(/(.{1}).*/, '$1○○'))
        .join(', ');
  };

  const formatSelectedDate = (dateString: string) => {
    if (!dateString) return '오늘 일정';
    try {
      const [y, m, d] = dateString.split('-').map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return '오늘 일정';
      return `${m}월 ${d}일 일정`;
    } catch {
      return '오늘 일정';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{formatSelectedDate(selectedDate)}</Text>
      
      {filteredEvents.length === 0 ? (
        <Text style={styles.noEventsText}>해당 날짜에 일정이 없습니다.</Text>
      ) : (
        filteredEvents.map((event, index) => (
          <View key={event.id} style={styles.eventItem}>
            <Text style={styles.eventTitle}>{event.summary}</Text>
            {!!onDeleteEvent && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteEvent(event.id)}>
                  <Text style={styles.deleteButtonText}>삭제</Text>
                </TouchableOpacity>
            )}
            {event.start.dateTime && event.end.dateTime && (
              <Text style={styles.eventDetail}>
                시간: {formatTimeRange(event.start.dateTime, event.end.dateTime)}
              </Text>
            )}
            
            {event.location && (
              <Text style={styles.eventDetail}>
                장소: {event.location}
              </Text>
            )}
            
            {event.description && (
              <Text style={styles.eventDetail}>
                설명: {event.description}
              </Text>
            )}
            
            {event.attendees && event.attendees.length > 0 && (
              <Text style={styles.eventDetail}>
                참석자: {formatAttendees(event.attendees)}
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  noEventsText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontStyle: 'italic',
  },
  eventItem: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    position: 'relative',
  },
  eventTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  eventDetail: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
}); 