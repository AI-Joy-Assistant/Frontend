import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarEvent } from '../../types/calendar';

interface EventDetailsProps {
  selectedDate: string;
  events: CalendarEvent[];
}

export default function EventDetails({ selectedDate, events }: EventDetailsProps) {
  console.log('=== EventDetails 렌더링 ===');
  console.log('받은 selectedDate:', selectedDate);
  console.log('받은 events 개수:', events.length);
  console.log('받은 events:', events);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    return `${year}년 ${month}월 ${day}일 ${hour > 12 ? '오후' : '오전'} ${hour > 12 ? hour - 12 : hour}시${minute > 0 ? ` ${minute}분` : ''}`;
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
    const date = new Date(dateString + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일 일정`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{formatSelectedDate(selectedDate)}</Text>
      
      {events.length === 0 ? (
        <Text style={styles.noEventsText}>해당 날짜에 일정이 없습니다.</Text>
      ) : (
        events.map((event, index) => (
          <View key={event.id} style={styles.eventItem}>
            {event.attendees && event.attendees.length > 0 && (
              <Text style={styles.eventDetail}>
                참석자: {formatAttendees(event.attendees)}
              </Text>
            )}
            
            {event.start.dateTime && (
              <Text style={styles.eventDetail}>
                일자: {formatDate(event.start.dateTime)}
              </Text>
            )}
            
            {event.location && (
              <Text style={styles.eventDetail}>
                장소: {event.location}
              </Text>
            )}
            
            <Text style={styles.eventDetail}>
              내용: {event.summary}
            </Text>
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
  eventDetail: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
}); 