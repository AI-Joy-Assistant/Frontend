import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AgentStatus {
  step: number;
  message: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface AgentStatusCardProps {
  statuses: AgentStatus[];
  currentStep?: number;
}

const AgentStatusCard: React.FC<AgentStatusCardProps> = ({ statuses, currentStep }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sync" size={20} color="#4A90E2" />
        <Text style={styles.headerText}>AI 에이전트 진행 상황</Text>
      </View>
      <View style={styles.statusList}>
        {statuses.map((status, index) => {
          const isCurrentStep = currentStep !== undefined ? index === currentStep : status.isActive;
          const isPastStep = currentStep !== undefined ? index < currentStep : status.isCompleted;
          
          return (
            <View key={index} style={styles.statusItem}>
              <View style={styles.statusIconContainer}>
                {isPastStep ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                ) : isCurrentStep ? (
                  <ActivityIndicator size="small" color="#4A90E2" />
                ) : (
                  <View style={styles.pendingIcon} />
                )}
              </View>
              <View style={styles.statusContent}>
                <Text style={[
                  styles.statusText,
                  isCurrentStep && styles.activeStatusText,
                  isPastStep && styles.completedStatusText
                ]}>
                  {status.message}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusList: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6B7280',
  },
  statusContent: {
    flex: 1,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  activeStatusText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  completedStatusText: {
    color: '#4CAF50',
  },
});

export default AgentStatusCard;




