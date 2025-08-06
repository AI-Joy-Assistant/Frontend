import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarEvent } from '../../types/calendar';

interface EventDetailsProps {
  selectedDate: string;
  events: CalendarEvent[];
}

export default function EventDetails({ selectedDate, events }: EventDetailsProps) {
  // 선택된 날짜의 이벤트만 필터링
  const filteredEvents = events.filter(event => {
    let eventDate: string;
    
    if (event.start.dateTime) {
      const eventDateTime = new Date(event.start.dateTime);
      eventDate = eventDateTime.toISOString().split('T')[0];
    } else if (event.start.date) {
      eventDate = event.start.date;
    } else {
      return false;
    }
    
    return eventDate === selectedDate;
  });
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      const timeString = `${hour > 12 ? '오후' : '오전'} ${hour > 12 ? hour - 12 : hour}시${minute > 0 ? ` ${minute}분` : ''}`;
      return `${month}월 ${day}일 ${timeString}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatTimeRange = (startDateTime: string, endDateTime: string) => {
    try {
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      const startHour = startDate.getHours();
      const startMinute = startDate.getMinutes();
      const endHour = endDate.getHours();
      const endMinute = endDate.getMinutes();
      
      const startTimeString = `${startHour > 12 ? '오후' : '오전'} ${startHour > 12 ? startHour - 12 : startHour}시${startMinute > 0 ? ` ${startMinute}분` : ''}`;
      const endTimeString = `${endHour > 12 ? '오후' : '오전'} ${endHour > 12 ? endHour - 12 : endHour}시${endMinute > 0 ? ` ${endMinute}분` : ''}`;
      
      return `${startTimeString} - ${endTimeString}`;
    } catch (error) {
      return `${startDateTime} - ${endDateTime}`;
    }
  };

  const formatAttendees = (attendees?: CalendarEvent['attendees']) => {
    if (!attendees || attendees.length === 0) return '';
    
    return attendees.map(attendee => {
      const name = attendee.displayName || attendee.email.split('@')[0];
      return name.replace(/(.{1}).*/, '$1○○');
    }).join(', ');
  };

  const formatSelectedDate = (dateString: string) => {
    if (!dateString) return '오늘 일정';
    
    try {
      // YYYY-MM-DD 형식을 직접 파싱하여 로컬 시간으로 처리
      const [year, month, day] = dateString.split('-').map(Number);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return '오늘 일정';
      }
      
      return `${month}월 ${day}일 일정`;
    } catch (error) {
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
}); 