import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Dimensions,
    FlatList,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { ArrowLeft, Calendar, Bell, Users, X, Check } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';

const COLORS = {
    primaryMain: '#3730A3',
    primaryLight: '#818CF8',
    primaryBg: '#EEF2FF',
    neutralSlate: '#334155',
    neutral100: '#F1F5F9',
    neutral200: '#E2E8F0',
    neutral300: '#CBD5E1',
    neutral400: '#94A3B8',
    neutral500: '#64748B',
    neutral600: '#475569',
    neutral700: '#334155',
    neutralLight: '#F8FAFC',
    white: '#FFFFFF',
    orange400: '#FB923C',
    orange50: '#FFF7ED',
    blue400: '#60A5FA',
    blue50: '#EFF6FF',
    red400: '#F87171',
    red50: '#FEF2F2',
    green400: '#4ADE80',
    green50: '#F0FDF4',
    purple400: '#A855F7',
    purple50: '#FAF5FF',
};

interface PendingRequest {
    id: string;
    title: string;
    summary?: string;
    initiator_id: string;
    initiator_name: string;
    initiator_avatar: string;
    participant_count: number;
    proposed_date?: string;
    proposed_time?: string;
    location?: string;
    status: string;
    created_at: string;
    reschedule_requested_at?: string; // 재조율 요청 시간
    type?: 'new' | 'reschedule';
}

interface Notification {
    id: string;
    type: 'schedule_rejected' | 'schedule_rejection' | 'friend_request' | 'friend_accepted' | 'friend_rejected' | 'general' | 'schedule_confirmed';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    metadata?: {
        session_ids?: string[];
        thread_id?: string;
        from_user_id?: string;
        schedule_date?: string;
        schedule_time?: string;
        schedule_activity?: string;
        [key: string]: any;
    };
}

interface NotificationPanelProps {
    visible: boolean;
    onClose: () => void;
    pendingRequests: PendingRequest[];
    notifications?: Notification[];
    onNavigateToA2A: (id: string) => void;
    onNavigateToFriends?: (tab?: 'friends' | 'requests') => void;
    onAcceptFriendRequest?: (id: string) => void;
    onRejectFriendRequest?: (id: string) => void;
    onDismissRequest?: (id: string) => void;
    onDismissNotification?: (id: string) => void;
}

export default function NotificationPanel({
    visible,
    onClose,
    pendingRequests,
    notifications = [],
    onNavigateToA2A,
    onNavigateToFriends,
    onDismissRequest,
    onDismissNotification,
}: NotificationPanelProps) {
    const { width: screenWidth } = useWindowDimensions();
    const panelWidth = Math.min(screenWidth * 1, 600);

    const [activeTab, setActiveTab] = useState<'requests' | 'notifications'>('requests');
    const slideAnim = useRef(new Animated.Value(screenWidth)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: screenWidth - panelWidth,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: screenWidth,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, screenWidth, panelWidth]);

    // 시간순 정렬 (최신순) - 재조율 요청은 reschedule_requested_at 사용
    const sortedRequests = [...pendingRequests].sort((a, b) => {
        // 재조율 요청인 경우 reschedule_requested_at, 아니면 created_at 사용
        const aTime = a.type === 'reschedule' && a.reschedule_requested_at
            ? a.reschedule_requested_at
            : a.created_at;
        const bTime = b.type === 'reschedule' && b.reschedule_requested_at
            ? b.reschedule_requested_at
            : b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? '오후' : '오전';
        const displayHour = hours % 12 || 12;
        return `${month}. ${day}. ${ampm} ${displayHour}:${minutes}`;
    };

    const renderRequestItem = ({ item, isReschedule }: { item: PendingRequest; isReschedule?: boolean }) => (
        <TouchableOpacity
            style={[
                styles.requestCard,
                isReschedule ? styles.rescheduleCard : styles.newRequestCard
            ]}
            onPress={() => {
                onNavigateToA2A(item.id);
                onClose();
            }}
            activeOpacity={0.7}
        >
            <View style={styles.requestHeader}>
                <View style={styles.requestHeaderLeft}>
                    <View style={[
                        styles.requestTypeBadge,
                        isReschedule ? styles.rescheduleBadge : styles.newBadge
                    ]}>
                        <Text style={[
                            styles.requestTypeBadgeText,
                            isReschedule ? styles.rescheduleBadgeText : styles.newBadgeText
                        ]}>
                            {isReschedule ? '재조율' : '새 일정'}
                        </Text>
                    </View>
                    <Text style={styles.requestTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <View style={styles.requestHeaderRight}>
                    <Text style={styles.requestDate}>
                        {formatDateTime(isReschedule && item.reschedule_requested_at ? item.reschedule_requested_at : item.created_at)}
                    </Text>
                    <TouchableOpacity
                        style={styles.dismissButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onDismissRequest?.(item.id);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={16} color={COLORS.neutral400} />
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.requestSubInfo}>
                {item.initiator_name} · {item.proposed_date} {item.proposed_time || ''}{item.location ? ` · ${item.location}` : ''}
            </Text>
        </TouchableOpacity>
    );

    const renderNotificationItem = ({ item }: { item: Notification }) => {
        let icon = <Bell size={16} color={COLORS.neutral500} />;
        let bgColor = styles.notificationGeneral;

        switch (item.type) {
            case 'schedule_rejected':
            case 'schedule_rejection':
                icon = <X size={16} color={COLORS.red400} />;
                bgColor = styles.notificationRejected;
                break;
            case 'friend_request':
                icon = <Users size={16} color={COLORS.blue400} />;
                bgColor = styles.notificationFriend;
                break;
            case 'friend_accepted':
                icon = <Users size={16} color={COLORS.green400} />;
                bgColor = styles.notificationAccepted;
                break;
            case 'friend_rejected':
                icon = <X size={16} color={COLORS.red400} />;
                bgColor = styles.notificationRejected;
                break;
            case 'schedule_confirmed':
                icon = <Check size={16} color={COLORS.green400} />;
                bgColor = styles.notificationAccepted;
                break;
        }

        const handleNotificationPress = () => {
            onClose();
            switch (item.type) {
                case 'friend_request':
                    onNavigateToFriends?.('requests');
                    break;
                case 'friend_accepted':
                    onNavigateToFriends?.('friends');
                    break;
                case 'schedule_rejected':
                    // 관련 A2A 세션으로 이동
                    if (item.metadata?.session_ids?.[0]) {
                        onNavigateToA2A(item.metadata.session_ids[0]);
                    }
                    break;
                case 'schedule_confirmed':
                    if (item.metadata?.session_id) {
                        onNavigateToA2A(item.metadata.session_id);
                    }
                    break;
                default:
                    break;
            }
        };

        return (
            <View style={[styles.notificationCard, bgColor, !item.read && styles.unread]}>
                <TouchableOpacity
                    style={styles.notificationTouchable}
                    onPress={handleNotificationPress}
                    activeOpacity={0.7}
                >
                    <View style={styles.notificationIcon}>{icon}</View>
                    <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={styles.notificationMessage} numberOfLines={1}>{item.message}</Text>
                        <Text style={styles.notificationDate}>
                            {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.notificationDismiss}
                    onPress={() => {
                        console.log('🔴 X button pressed for notification:', item.id);
                        onDismissNotification?.(item.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={14} color={COLORS.neutral400} />
                </TouchableOpacity>
            </View>
        );
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} activeOpacity={1} />
                <Animated.View
                    style={[
                        styles.panel,
                        { width: panelWidth, transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <SafeAreaView style={styles.safeArea}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.backButton}>
                                <ArrowLeft size={24} color={COLORS.neutralSlate} />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>알림</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        {/* Tabs */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                                onPress={() => setActiveTab('requests')}
                            >
                                <Calendar size={16} color={activeTab === 'requests' ? COLORS.white : COLORS.neutral500} />
                                <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                                    일정 요청
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
                                onPress={() => setActiveTab('notifications')}
                            >
                                <Bell size={16} color={activeTab === 'notifications' ? COLORS.white : COLORS.neutral500} />
                                <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
                                    알림
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        {activeTab === 'requests' ? (
                            <ScrollView
                                style={styles.content}
                                contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {pendingRequests.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Calendar size={40} color={COLORS.neutral300} />
                                        <Text style={styles.emptyText}>일정 요청이 없습니다</Text>
                                    </View>
                                ) : (
                                    <>
                                        {sortedRequests.map(item => (
                                            <View key={item.id}>
                                                {renderRequestItem({ item, isReschedule: item.type === 'reschedule' })}
                                            </View>
                                        ))}
                                    </>
                                )}
                            </ScrollView>
                        ) : (
                            <View style={styles.content}>
                                {notifications.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Bell size={40} color={COLORS.neutral300} />
                                        <Text style={styles.emptyText}>알림이 없습니다</Text>
                                    </View>
                                ) : (
                                    <ScrollView
                                        contentContainerStyle={{ paddingBottom: 20 }}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        {notifications.map(item => (
                                            <View key={item.id}>
                                                {renderNotificationItem({ item })}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        )}
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    overlayTouchable: {
        flex: 1,
    },
    panel: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral100,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: COLORS.neutral100,
        gap: 6,
    },
    activeTab: {
        backgroundColor: COLORS.primaryMain,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutral500,
    },
    activeTabText: {
        color: COLORS.white,
    },
    badge: {
        backgroundColor: COLORS.red400,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.neutral500,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    requestCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    newRequestCard: {
        backgroundColor: COLORS.blue50,
    },
    rescheduleCard: {
        backgroundColor: COLORS.purple50,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    requestHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    requestHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requestTypeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: COLORS.white,
    },
    newBadge: {
        borderColor: COLORS.blue400,
    },
    rescheduleBadge: {
        borderColor: COLORS.purple400,
    },
    requestTypeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    newBadgeText: {
        color: COLORS.blue400,
    },
    rescheduleBadgeText: {
        color: COLORS.purple400,
    },
    requestDate: {
        fontSize: 12,
        color: COLORS.neutral400,
    },
    dismissButton: {
        padding: 4,
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.neutralSlate,
        flex: 1,
    },
    requestSubInfo: {
        fontSize: 13,
        color: COLORS.neutral500,
    },
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    notificationTouchable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    notificationGeneral: {
        backgroundColor: COLORS.neutral100,
    },
    notificationRejected: {
        backgroundColor: COLORS.red50,
    },
    notificationFriend: {
        backgroundColor: COLORS.blue50,
    },
    notificationAccepted: {
        backgroundColor: COLORS.green50,
    },
    unread: {
        // removed left border
    },
    notificationIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    notificationDismiss: {
        padding: 4,
        marginLeft: 8,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutralSlate,
        marginBottom: 4,
    },
    notificationMessage: {
        fontSize: 13,
        color: COLORS.neutral500,
        marginBottom: 6,
    },
    notificationDate: {
        fontSize: 11,
        color: COLORS.neutral400,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.neutral400,
    },
});
