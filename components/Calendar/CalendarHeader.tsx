import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CalendarHeaderProps {
  year: number;
  month: number;
  onAddEvent: () => void;
  onMonthChange?: (direction: 'prev' | 'next') => void;
  onRefresh?: () => void;
}

export default function CalendarHeader({ year, month, onAddEvent, onMonthChange, onRefresh }: CalendarHeaderProps) {
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.logoContainer}>
          <Ionicons name="calendar" size={24} color="#4A90E2" />
          <Text style={styles.logoText}>JOYNER</Text>
        </View>
      </View>
      
      <View style={styles.centerSection}>
        <TouchableOpacity 
          style={styles.monthButton} 
          onPress={() => onMonthChange?.('prev')}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.monthYearText}>
          {year}년 {monthNames[month - 1]}
        </Text>
        <TouchableOpacity 
          style={styles.monthButton} 
          onPress={() => onMonthChange?.('next')}
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.rightSection}>
        {onRefresh && (
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.addButton} onPress={onAddEvent}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileButton}>
          <Image
            source={{ uri: 'https://via.placeholder.com/40x40/FFD700/000000?text=🐻' }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#0F111A',
    height: 60,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  refreshButton: {
    backgroundColor: '#374151',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  monthYearText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  monthButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
}); 