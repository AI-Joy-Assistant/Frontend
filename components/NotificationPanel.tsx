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
import { ArrowLeft, Calendar, Bell, Users, X } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.9;

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
    status: string;
    created_at: string;
    type?: 'new' | 'reschedule';
}

interface Notification {
    id: string;
    type: 'schedule_rejected' | 'friend_request' | 'friend_accepted' | 'general';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
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
}

export default function NotificationPanel({
    visible,
    onClose,
    pendingRequests,
    notifications = [],
    onNavigateToA2A,
    onNavigateToFriends,
}: NotificationPanelProps) {
    const [activeTab, setActiveTab] = useState<'requests' | 'notifications'>('requests');
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: SCREEN_WIDTH - PANEL_WIDTH,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_WIDTH,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const newRequests = pendingRequests.filter(r => r.type !== 'reschedule');
    const rescheduleRequests = pendingRequests.filter(r => r.type === 'reschedule');

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
        >
            <View style={styles.requestHeader}>
                <View style={[
                    styles.requestTypeBadge,
                    isReschedule ? styles.rescheduleBadge : styles.newBadge
                ]}>
                    <Text style={[
                        styles.requestTypeBadgeText,
                        isReschedule ? styles.rescheduleBadgeText : styles.newBadgeText
                    ]}>
                        {isReschedule ? '재조율' : '새 요청'}
                    </Text>
                </View>
                <Text style={styles.requestDate}>
                    {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </Text>
            </View>
            <Text style={styles.requestTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.requestInfo}>
                <Text style={styles.requestInitiator}>👤 {item.initiator_name}</Text>
                {item.proposed_date && (
                    <Text style={styles.requestProposed}>📅 {item.proposed_date}</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderNotificationItem = ({ item }: { item: Notification }) => {
        let icon = <Bell size={16} color={COLORS.neutral500} />;
        let bgColor = styles.notificationGeneral;

        switch (item.type) {
            case 'schedule_rejected':
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
                    // Could navigate to A2A or stay
                    break;
                default:
                    break;
            }
        };

        return (
            <TouchableOpacity
                style={[styles.notificationCard, bgColor, !item.read && styles.unread]}
                onPress={handleNotificationPress}
            >
                <View style={styles.notificationIcon}>{icon}</View>
                <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationMessage} numberOfLines={2}>{item.message}</Text>
                    <Text style={styles.notificationDate}>
                        {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </TouchableOpacity>
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
                        { transform: [{ translateX: slideAnim }] }
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
                                {pendingRequests.length > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{pendingRequests.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
                                onPress={() => setActiveTab('notifications')}
                            >
                                <Bell size={16} color={activeTab === 'notifications' ? COLORS.white : COLORS.neutral500} />
                                <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
                                    알림
                                </Text>
                                {notifications.filter(n => !n.read).length > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{notifications.filter(n => !n.read).length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        {activeTab === 'requests' ? (
                            <ScrollView
                                style={styles.content}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {pendingRequests.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Calendar size={40} color={COLORS.neutral300} />
                                        <Text style={styles.emptyText}>일정 요청이 없습니다</Text>
                                    </View>
                                ) : (
                                    <>
                                        {newRequests.length > 0 && (
                                            <>
                                                <Text style={styles.sectionTitle}>새로운 요청</Text>
                                                {newRequests.map(item => (
                                                    <View key={item.id}>
                                                        {renderRequestItem({ item, isReschedule: false })}
                                                    </View>
                                                ))}
                                            </>
                                        )}
                                        {rescheduleRequests.length > 0 && (
                                            <>
                                                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>재조율 요청</Text>
                                                {rescheduleRequests.map(item => (
                                                    <View key={item.id}>
                                                        {renderRequestItem({ item, isReschedule: true })}
                                                    </View>
                                                ))}
                                            </>
                                        )}
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
                                    <FlatList
                                        data={notifications}
                                        keyExtractor={(item) => item.id}
                                        renderItem={renderNotificationItem}
                                        contentContainerStyle={{ paddingBottom: 20 }}
                                        showsVerticalScrollIndicator={false}
                                    />
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
        width: PANEL_WIDTH,
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
        borderRadius: 12,
        marginBottom: 10,
        borderLeftWidth: 4,
    },
    newRequestCard: {
        backgroundColor: COLORS.blue50,
        borderLeftColor: COLORS.blue400,
    },
    rescheduleCard: {
        backgroundColor: COLORS.orange50,
        borderLeftColor: COLORS.orange400,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    requestTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    newBadge: {
        backgroundColor: COLORS.blue400,
    },
    rescheduleBadge: {
        backgroundColor: COLORS.orange400,
    },
    requestTypeBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    newBadgeText: {
        color: COLORS.white,
    },
    rescheduleBadgeText: {
        color: COLORS.white,
    },
    requestDate: {
        fontSize: 12,
        color: COLORS.neutral400,
    },
    requestTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.neutralSlate,
        marginBottom: 8,
    },
    requestInfo: {
        flexDirection: 'row',
        gap: 12,
    },
    requestInitiator: {
        fontSize: 13,
        color: COLORS.neutral500,
    },
    requestProposed: {
        fontSize: 13,
        color: COLORS.primaryMain,
        fontWeight: '500',
    },
    notificationCard: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
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
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primaryMain,
    },
    notificationIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
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
