import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    Image,
    TextInput,
    SafeAreaView,
    ActivityIndicator,
    Dimensions,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, A2ALog, Tab } from '../types';
import BottomNav from '../components/BottomNav';

// API Configuration
const API_BASE = 'http://127.0.0.1:8000'; // Android Emulator: 10.0.2.2

// Colors based on the provided React/Tailwind code
const COLORS = {
    primaryMain: '#5B4DFF', // text-primary-main (Approximate from previous context/screenshot)
    primaryLight: '#8B80FF',
    primaryDark: '#4338CA',
    primaryBg: '#EEF2FF',   // bg-primary-bg
    neutralLight: '#F9FAFB', // bg-neutral-light
    neutral50: '#F9FAFB',    // Alias
    neutralSlate: '#1F2937', // text-neutral-slate
    neutral100: '#F3F4F6',   // border-neutral-100
    neutral200: '#E5E7EB',
    neutral300: '#D1D5DB',
    neutral400: '#9CA3AF',   // text-neutral-400
    neutral500: '#6B7280',   // text-neutral-500
    neutral600: '#4B5563',
    white: '#FFFFFF',
    green600: '#16A34A',
    green50: '#F0FDF4',
    green100: '#DCFCE7',
    amber600: '#D97706',
    amber50: '#FFFBEB',
    amber100: '#FEF3C7',
    background: '#F9FAFB', // bg-neutral-light
    cardBg: '#FFFFFF',     // bg-white
    approveBtn: '#0E004E'  // The dark blue button color from the snippet
};

const A2AScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'A2A'>>();
    const initialLogId = route.params?.initialLogId;

    const [logs, setLogs] = useState<A2ALog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<A2ALog | null>(null);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [isProcessExpanded, setIsProcessExpanded] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [preferredTime, setPreferredTime] = useState('');

    const fetchA2ALogs = useCallback(async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                console.error("No access token found");
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE}/a2a/sessions`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const mappedLogs: A2ALog[] = data.sessions.map((session: any) => ({
                    id: session.id,
                    title: session.title || "일정 조율",
                    status: session.status === 'completed' ? 'COMPLETED' : 'IN_PROGRESS',
                    summary: session.summary || `${session.participant_names?.join(', ')}`,
                    timeRange: session.details?.proposedTime || "미정",
                    createdAt: session.created_at,
                    details: session.details
                }));
                setLogs(mappedLogs);

                // Handle deep link if present
                if (initialLogId) {
                    const targetLog = mappedLogs.find(l => l.id === initialLogId);
                    if (targetLog) {
                        handleLogClick(targetLog);
                    }
                }
            } else {
                console.error("Failed to fetch sessions:", response.status);
            }
        } catch (error) {
            console.error("Error fetching A2A logs:", error);
        } finally {
            setLoading(false);
        }
    }, [initialLogId]);

    useEffect(() => {
        fetchA2ALogs();
    }, [fetchA2ALogs]);

    const handleClose = () => {
        setSelectedLog(null);
        setIsRescheduling(false);
        setIsConfirmed(false);
        setSelectedReason(null);
        setIsProcessExpanded(false);
        setManualInput('');
        setPreferredTime('');
    };

    const handleLogClick = async (log: A2ALog) => {
        setSelectedLog(log);
        setIsProcessExpanded(false);
        setIsConfirmed(false);
        setIsRescheduling(false);

        // Fetch full details including process
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${log.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Merge details
                const newDetails = data.details;
                // Preserve proposer name if backend returns "알 수 없음" but we have it in list (though list might not have it either)
                if (newDetails.proposer === "알 수 없음" && log.details?.proposer) {
                    newDetails.proposer = log.details.proposer;
                }

                setSelectedLog((prev: A2ALog | null) => prev ? { ...prev, details: newDetails } : null);
            }
        } catch (e) {
            console.error("Failed to fetch log details:", e);
        }
    };

    const handleRescheduleClick = () => {
        setIsRescheduling(true);
    };

    const handleBackToDetail = () => {
        setIsRescheduling(false);
    };

    const handleApproveClick = async () => {
        if (!selectedLog) return;
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${selectedLog.id}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            if (res.ok) {
                setIsConfirmed(true);
                fetchA2ALogs(); // Refresh list
            } else {
                console.error("Approve failed");
            }
        } catch (e) {
            console.error("Approve error", e);
        }
    };

    const handleSubmitReschedule = async () => {
        if (!selectedLog) return;
        try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/a2a/session/${selectedLog.id}/reschedule`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: selectedReason,
                    preferred_time: preferredTime,
                    manual_input: manualInput
                })
            });
            if (res.ok) {
                alert("재조율 요청이 접수되었습니다.");
                handleClose();
                fetchA2ALogs();
            } else {
                console.error("Reschedule failed");
            }
        } catch (e) {
            console.error("Reschedule error", e);
        }
    };

    const reasons = [
        "날짜를 변경하고 싶어요",
        "시간을 조금 미루고 싶어요",
        "더 일찍 만나고 싶어요",
        "장소를 변경하고 싶어요"
    ];

    const formatTimeAgo = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return '방금 전';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
        return `${Math.floor(diffInSeconds / 86400)}일 전`;
    };

    const renderLogItem = ({ item }: { item: A2ALog }) => (
        <TouchableOpacity
            style={styles.logItem}
            onPress={() => handleLogClick(item)}
            activeOpacity={0.7}
        >
            <View style={styles.logHeader}>
                <Text style={styles.logTitle}>{item.title}</Text>
                <View style={[
                    styles.statusBadge,
                    item.status === 'COMPLETED' ? styles.statusCompleted : styles.statusInProgress
                ]}>
                    <Ionicons
                        name={item.status === 'COMPLETED' ? "checkmark-circle" : "time"}
                        size={12}
                        color={item.status === 'COMPLETED' ? COLORS.green600 : COLORS.amber600}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[
                        styles.statusText,
                        { color: item.status === 'COMPLETED' ? COLORS.green600 : COLORS.amber600 }
                    ]}>
                        {item.status === 'COMPLETED' ? '완료' : '진행중'}
                    </Text>
                </View>
            </View>

            <View style={styles.logSummary}>
                <Text style={styles.logSummaryText}>👥 {item.summary}</Text>
            </View>

            <View style={styles.logFooter}>
                <Text style={styles.logTime}>{item.timeRange}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.neutral300} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>히스토리</Text>
            </View>

            {/* List */}
            <View style={styles.listContainer}>
                {loading && logs.length === 0 ? (
                    <ActivityIndicator size="large" color={COLORS.primaryMain} style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={logs}
                        renderItem={renderLogItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>히스토리가 없습니다.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <BottomNav activeTab={Tab.A2A} />

            {/* Modal */}
            <Modal
                visible={!!selectedLog}
                transparent
                animationType="slide"
                onRequestClose={handleClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        {isConfirmed ? (
                            /* --- CONFIRMATION VIEW --- */
                            <View style={styles.confirmationContainer}>
                                <TouchableOpacity onPress={handleClose} style={styles.closeButtonAbsolute}>
                                    <Ionicons name="close" size={24} color={COLORS.neutral400} />
                                </TouchableOpacity>

                                <View style={styles.confirmIconContainer}>
                                    <Ionicons name="calendar" size={40} color={COLORS.primaryMain} />
                                </View>

                                <Text style={styles.confirmTitle}>It's Official!</Text>
                                <Text style={styles.confirmDesc}>
                                    "{selectedLog?.title}" 일정이 캘린더에 추가되었으며,{'\n'}참가자들에게 초대장이 발송되었습니다.
                                </Text>

                                {/* Ticket Card */}
                                <View style={styles.ticketCard}>
                                    {/* Decorative Circles */}
                                    <View style={[styles.ticketCircle, { left: -12 }]} />
                                    <View style={[styles.ticketCircle, { right: -12 }]} />

                                    <View style={styles.ticketHeader}>
                                        <View>
                                            <Text style={styles.ticketLabel}>DATE</Text>
                                            <Text style={styles.ticketValue}>Dec 01</Text>
                                            <Text style={styles.ticketSub}>Monday</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.ticketLabel}>TIME</Text>
                                            <Text style={[styles.ticketValue, { color: COLORS.primaryMain }]}>7:00 PM</Text>
                                        </View>
                                    </View>

                                    <View style={styles.ticketFooter}>
                                        <View>
                                            <Text style={styles.ticketLocationTitle}>{selectedLog?.details?.location?.split(',')[0] || 'Location'}</Text>
                                            <Text style={styles.ticketLocationSub}>{selectedLog?.details?.location?.split(',')[1] || 'Downtown Area'}</Text>
                                        </View>
                                        <View style={styles.attendeeStack}>
                                            <Image source={{ uri: selectedLog?.details?.proposerAvatar || 'https://via.placeholder.com/150' }} style={styles.attendeeAvatar} />
                                            <View style={[styles.attendeeAvatar, styles.attendeeYou]}>
                                                <Text style={styles.attendeeYouText}>You</Text>
                                            </View>
                                            <View style={[styles.attendeeAvatar, styles.attendeePlus]}>
                                                <Text style={styles.attendeePlusText}>+1</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.viewCalendarBtn} onPress={handleClose}>
                                    <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                                    <Text style={styles.viewCalendarText}>View in Calendar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : isRescheduling ? (
                            /* --- RESCHEDULE VIEW --- */
                            <View style={{ flex: 1 }}>
                                <View style={styles.rescheduleHeader}>
                                    <View>
                                        <Text style={styles.rescheduleTitle}>일정 재조율</Text>
                                        <Text style={styles.rescheduleSub}>AI가 자동으로 재협상을 시작합니다</Text>
                                    </View>
                                    <TouchableOpacity onPress={handleClose}>
                                        <Ionicons name="close" size={24} color={COLORS.neutral400} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.rescheduleContent}>
                                    {/* Reasons */}
                                    <View style={styles.section}>
                                        <Text style={styles.sectionLabel}>재조율 이유</Text>
                                        <View style={styles.reasonGrid}>
                                            {reasons.map((reason, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => setSelectedReason(reason)}
                                                    style={[
                                                        styles.reasonChip,
                                                        selectedReason === reason ? styles.reasonChipSelected : styles.reasonChipUnselected
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.reasonText,
                                                        selectedReason === reason ? styles.reasonTextSelected : styles.reasonTextUnselected
                                                    ]}>{reason}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Manual Input */}
                                    <View style={styles.section}>
                                        <Text style={styles.sectionLabel}>직접 입력 (선택)</Text>
                                        <TextInput
                                            style={styles.textArea}
                                            multiline
                                            numberOfLines={3}
                                            placeholder="재조율이 필요한 이유를 입력하세요..."
                                            placeholderTextColor={COLORS.neutral300}
                                            value={manualInput}
                                            onChangeText={setManualInput}
                                        />
                                    </View>

                                    {/* Preferred Time */}
                                    <View style={styles.section}>
                                        <Text style={styles.sectionLabel}>희망 시간 (선택)</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="time-outline" size={18} color={COLORS.neutral400} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="예: 내일 오후 8시, 이번주 금요일 저녁"
                                                placeholderTextColor={COLORS.neutral300}
                                                value={preferredTime}
                                                onChangeText={setPreferredTime}
                                            />
                                        </View>
                                    </View>
                                </ScrollView>

                                <View style={styles.rescheduleFooter}>
                                    <TouchableOpacity onPress={handleBackToDetail} style={styles.cancelButton}>
                                        <Text style={styles.cancelButtonText}>취소</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSubmitReschedule}
                                        disabled={!selectedReason}
                                        style={[
                                            styles.submitButton,
                                            !selectedReason && styles.submitButtonDisabled
                                        ]}
                                    >
                                        <Text style={styles.submitButtonText}>AI에게 재협상 요청</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            /* --- DETAIL VIEW --- */
                            <View style={{ flex: 1 }}>
                                <LinearGradient
                                    colors={[COLORS.primaryLight, COLORS.primaryMain]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.detailHeader}
                                >
                                    <View style={styles.detailHeaderContent}>
                                        <View style={styles.detailHeaderIcon}>
                                            <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                                        </View>
                                        <View>
                                            <Text style={styles.detailHeaderSub}>새로운 일정 요청</Text>
                                            <Text style={styles.detailHeaderTime}>{formatTimeAgo(selectedLog?.createdAt || '')}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={handleClose} style={styles.detailCloseBtn}>
                                        <Ionicons name="close" size={24} color="white" />
                                    </TouchableOpacity>
                                </LinearGradient>

                                <ScrollView style={styles.detailContent}>
                                    {selectedLog?.details && (
                                        <>
                                            {/* Proposer */}
                                            <View style={styles.proposerCard}>
                                                <Image source={{ uri: selectedLog.details.proposerAvatar }} style={styles.proposerAvatar} />
                                                <View>
                                                    <Text style={styles.proposerLabel}>보낸 사람</Text>
                                                    <Text style={styles.proposerName}>{selectedLog.details.proposer}</Text>
                                                </View>
                                            </View>

                                            {/* Info Cards */}
                                            <View style={styles.infoStack}>
                                                <View style={styles.infoCard}>
                                                    <View style={styles.infoIconBox}>
                                                        <Ionicons name="restaurant-outline" size={20} color={COLORS.neutral400} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>약속 목적</Text>
                                                        <Text style={styles.infoValue}>{selectedLog.details.purpose}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.infoCard}>
                                                    <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                        <Ionicons name="time-outline" size={20} color={COLORS.primaryMain} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>Proposed Time</Text>
                                                        <Text style={styles.infoValue}>{selectedLog.details.proposedTime}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.infoCard}>
                                                    <View style={[styles.infoIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                                        <Ionicons name="location-outline" size={20} color={COLORS.primaryMain} />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.infoLabel}>Location</Text>
                                                        <Text style={styles.infoValue}>{selectedLog.details.location}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Attendees */}
                                            <View style={styles.attendeesSection}>
                                                <Text style={styles.attendeesLabel}>Attendees</Text>
                                                <View style={styles.attendeeStack}>
                                                    <Image source={{ uri: selectedLog.details.proposerAvatar }} style={styles.attendeeAvatar} />
                                                    {/* Dynamic Attendees: For now, just show You + Proposer.
                                                        If we had more info, we would map them.
                                                        Assuming 1:1 for now based on typical A2A. */}
                                                    <View style={[styles.attendeeAvatar, styles.attendeeYou]}>
                                                        <Text style={styles.attendeeYouText}>You</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Process */}
                                            <View style={styles.processCard}>
                                                <TouchableOpacity
                                                    style={styles.processHeader}
                                                    onPress={() => setIsProcessExpanded(!isProcessExpanded)}
                                                >
                                                    <Text style={styles.processTitle}>A2A 협상 과정 보기</Text>
                                                    <Ionicons
                                                        name="chevron-forward"
                                                        size={16}
                                                        color={COLORS.neutral300}
                                                        style={{ transform: [{ rotate: isProcessExpanded ? '90deg' : '0deg' }] }}
                                                    />
                                                </TouchableOpacity>

                                                {isProcessExpanded && (
                                                    <View style={styles.processList}>
                                                        <View style={styles.processLine} />
                                                        {selectedLog.details.process.map((step: any, idx: number) => (
                                                            <View key={idx} style={styles.processItem}>
                                                                <View style={styles.processDot} />
                                                                <View>
                                                                    <Text style={styles.processStep}>[{step.step}]</Text>
                                                                    <Text style={styles.processDesc}>{step.description}</Text>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <View style={styles.buttonRow}>
                                        <TouchableOpacity onPress={handleRescheduleClick} style={styles.rescheduleButton}>
                                            <Text style={styles.rescheduleButtonText}>재조율</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleApproveClick} style={styles.approveButton}>
                                            <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.approveButtonText}>승인</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.neutralLight },

    // Header
    headerContainer: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        marginBottom: 4,
        zIndex: 10
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate },

    // List
    listContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    listContent: { paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.neutral500, fontSize: 16 },

    logItem: {
        backgroundColor: COLORS.white,
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.neutral100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    logTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.neutralSlate },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    statusCompleted: { backgroundColor: COLORS.green50, borderColor: COLORS.green100 },
    statusInProgress: { backgroundColor: COLORS.amber50, borderColor: COLORS.amber100 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    logSummary: { marginBottom: 16 },
    logSummaryText: { fontSize: 12, color: COLORS.neutral500 },
    logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.neutral50 },
    logTime: { fontSize: 12, color: COLORS.neutral400 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '90%',
        overflow: 'hidden'
    },

    // Confirmation View
    confirmationContainer: { flex: 1, alignItems: 'center', padding: 24, backgroundColor: COLORS.neutralLight },
    closeButtonAbsolute: { position: 'absolute', top: 24, right: 24, zIndex: 10 },
    confirmIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24, marginTop: 32 },
    confirmTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 8 },
    confirmDesc: { fontSize: 14, color: COLORS.neutral500, textAlign: 'center', lineHeight: 20, marginBottom: 32 },

    ticketCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: COLORS.neutral50,
        position: 'relative',
        overflow: 'hidden'
    },
    ticketCircle: { position: 'absolute', top: '50%', width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.neutralLight, marginTop: -12 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    ticketLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutral400, marginBottom: 4, letterSpacing: 0.5 },
    ticketValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    ticketSub: { fontSize: 14, fontWeight: '500', color: COLORS.neutral400 },
    ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.neutral200, borderStyle: 'dashed' },
    ticketLocationTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 2 },
    ticketLocationSub: { fontSize: 12, color: COLORS.neutral400 },

    viewCalendarBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.approveBtn, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    viewCalendarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Reschedule View
    rescheduleHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.neutral100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white },
    rescheduleTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.neutralSlate },
    rescheduleSub: { fontSize: 12, color: COLORS.neutral500, marginTop: 2 },
    rescheduleContent: { flex: 1, padding: 20, backgroundColor: COLORS.white },
    section: { marginBottom: 24 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate, marginBottom: 12 },
    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    reasonChip: { width: '48%', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    reasonChipSelected: { borderColor: COLORS.primaryMain, backgroundColor: COLORS.primaryBg },
    reasonChipUnselected: { borderColor: COLORS.neutral200, backgroundColor: COLORS.white },
    reasonText: { fontSize: 12, fontWeight: 'bold' },
    reasonTextSelected: { color: COLORS.primaryMain },
    reasonTextUnselected: { color: COLORS.neutral500 },
    textArea: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.neutral200, borderRadius: 16, padding: 16, fontSize: 14, color: COLORS.neutralSlate, textAlignVertical: 'top' },
    inputWrapper: { position: 'relative', justifyContent: 'center' },
    inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
    textInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.neutral200, borderRadius: 16, paddingLeft: 44, paddingRight: 16, paddingVertical: 14, fontSize: 14, color: COLORS.neutralSlate },

    rescheduleFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.neutral100, flexDirection: 'row', gap: 12, backgroundColor: COLORS.white },
    cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral200, alignItems: 'center' },
    cancelButtonText: { color: COLORS.neutral600, fontWeight: 'bold', fontSize: 14 },
    submitButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primaryMain, alignItems: 'center', shadowColor: COLORS.primaryMain, shadowOpacity: 0.3, shadowRadius: 8 },
    submitButtonDisabled: { backgroundColor: COLORS.neutral300, shadowOpacity: 0 },
    submitButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Detail View
    detailHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailHeaderContent: { flexDirection: 'row', alignItems: 'center' },
    detailHeaderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    detailHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    detailHeaderTime: { fontSize: 12, fontWeight: 'bold', color: 'white' },
    detailCloseBtn: { padding: 4 },
    detailContent: { flex: 1, padding: 24, backgroundColor: COLORS.neutralLight },

    proposerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: COLORS.neutral100, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    proposerAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 16 },
    proposerLabel: { fontSize: 12, color: COLORS.neutral500, fontWeight: '500' },
    proposerName: { fontSize: 16, fontWeight: 'bold', color: COLORS.neutralSlate },

    infoStack: { gap: 12, marginBottom: 24 },
    infoCard: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    infoIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.neutral50, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    infoLabel: { fontSize: 12, color: COLORS.neutral400, fontWeight: 'bold', marginBottom: 4 },
    infoValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.neutralSlate },

    attendeesSection: { marginBottom: 24 },
    attendeesLabel: { fontSize: 12, color: COLORS.neutral400, fontWeight: 'bold', marginBottom: 8, paddingLeft: 4 },
    attendeeStack: { flexDirection: 'row', marginLeft: 8 },
    attendeeAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.white, marginLeft: -8 },
    attendeeYou: { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' },
    attendeeYouText: { fontSize: 10, fontWeight: 'bold', color: COLORS.primaryMain },
    attendeePlus: { backgroundColor: COLORS.neutral100, justifyContent: 'center', alignItems: 'center' },
    attendeePlusText: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutral400 },

    processCard: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.neutral100, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
    processHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    processTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.neutral500 },
    processList: { marginTop: 16, paddingLeft: 8, position: 'relative' },
    processLine: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, backgroundColor: COLORS.neutral100 },
    processItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 1 },
    processDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.neutral200, borderWidth: 2, borderColor: COLORS.white, marginRight: 16, marginTop: 4 },
    processStep: { fontSize: 10, fontWeight: 'bold', color: COLORS.neutral400, marginBottom: 2 },
    processDesc: { fontSize: 12, color: COLORS.neutral600 },

    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.neutral100, backgroundColor: COLORS.white },
    buttonRow: { flexDirection: 'row', gap: 12 },
    rescheduleButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral200, alignItems: 'center' },
    rescheduleButtonText: { color: COLORS.neutralSlate, fontWeight: 'bold', fontSize: 14 },
    approveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primaryMain, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: COLORS.primaryMain, shadowOpacity: 0.3, shadowRadius: 8 },
    approveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

export default A2AScreen;
