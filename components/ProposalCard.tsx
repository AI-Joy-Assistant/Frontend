import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Proposal {
  date: string;
  time: string;
  location?: string;
  participants: string[];
  threadId?: string;
  sessionIds?: string[];
}

interface ProposalCardProps {
  proposal: Proposal;
  onApprove: (proposal: Proposal) => void;
  onReject: (proposal: Proposal) => void;
  isApproved?: boolean;
  isRejected?: boolean;
  approvalStatus?: {
    approvedBy: string[];
    totalParticipants: number;
  };
  timestamp?: string; // [추가] 요청 시간 표시를 위한 prop
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onApprove,
  onReject,
  isApproved = false,
  isRejected = false,
  approvalStatus,
  timestamp,
}) => {
  const [localApproved, setLocalApproved] = useState(isApproved);
  const [localRejected, setLocalRejected] = useState(isRejected);

  // props 변경 시 로컬 상태 업데이트
  useEffect(() => {
    setLocalApproved(isApproved);
    setLocalRejected(isRejected);
  }, [isApproved, isRejected]);

  const handleApprove = () => {
    if (localApproved || localRejected) return;
    setLocalApproved(true);
    onApprove(proposal);
  };

  const handleReject = () => {
    if (localApproved || localRejected) return;
    setLocalRejected(true);
    onReject(proposal);
  };

  // [추가] 타임스탬프 포맷팅 함수 (오전/오후 HH:MM)
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // 한국 시간 기준 포맷팅
      return new Intl.DateTimeFormat('ko-KR', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(date);
    } catch (e) {
      return '';
    }
  };

  const participantsText = proposal.participants.length > 0
    ? proposal.participants.join(', ')
    : '참여자';

  const showApprovalStatus = approvalStatus && approvalStatus.totalParticipants > 1;

  return (
    <View style={[
      styles.container,
      localApproved && styles.approvedContainer,
      localRejected && styles.rejectedContainer
    ]}>
      <View style={styles.header}>
        <Ionicons
          name={localApproved ? "checkmark-circle" : "calendar"}
          size={24}
          color={localApproved ? "#4CAF50" : "#4A90E2"}
        />
        <Text style={styles.headerText}>
          {localApproved ? '일정 확정' : '일정 제안'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
          {/* 백엔드에서 변환된 날짜 문자열이 들어옵니다 (예: 2025년 11월 27일) */}
          <Text style={styles.infoText}>{proposal.date}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={18} color="#9CA3AF" />
          <Text style={styles.infoText}>{proposal.time}</Text>
        </View>

        {proposal.location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#9CA3AF" />
            <Text style={styles.infoText}>{proposal.location}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={18} color="#9CA3AF" />
          <Text style={styles.infoText}>{participantsText}</Text>
        </View>

        {showApprovalStatus && (
          <View style={styles.approvalStatusContainer}>
            <Text style={styles.approvalStatusText}>
              승인: {approvalStatus.approvedBy.length} / {approvalStatus.totalParticipants}명
            </Text>
          </View>
        )}
      </View>

      {!localApproved && !localRejected && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={handleApprove}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.buttonText}>승인</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.buttonText}>거절</Text>
          </TouchableOpacity>
        </View>
      )}

      {localApproved && (
        <View style={styles.statusMessage}>
          <Text style={styles.statusMessageText}>
            {approvalStatus && approvalStatus.approvedBy.length >= approvalStatus.totalParticipants
              ? "✓ 일정 확정됨"
              : "✓ 승인 완료. 다른 참여자의 승인을 기다리는 중입니다."}
          </Text>
        </View>
      )}

      {localRejected && (
        <View style={styles.statusMessage}>
          <Text style={styles.statusMessageText}>
            다른 시간으로 재조율을 요청했습니다.
          </Text>
        </View>
      )}

      {/* [추가] 하단 타임스탬프 영역 */}
      {timestamp && (
        <View style={styles.footer}>
          <Text style={styles.timestampText}>{formatTime(timestamp)}</Text>
        </View>
      )}
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
  approvedContainer: {
    borderColor: '#4CAF50',
    backgroundColor: '#1F3A1F',
  },
  rejectedContainer: {
    borderColor: '#EF4444',
    backgroundColor: '#3A1F1F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#E5E7EB',
    fontSize: 15,
    flex: 1,
  },
  approvalStatusContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 8,
  },
  approvalStatusText: {
    color: '#4A90E2',
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#4A90E2',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusMessage: {
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  statusMessageText: {
    color: '#4CAF50',
    fontSize: 14,
    textAlign: 'center',
  },
  // [추가] 푸터 스타일
  footer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  timestampText: {
    color: '#6B7280',
    fontSize: 11,
  },
});

export default ProposalCard;