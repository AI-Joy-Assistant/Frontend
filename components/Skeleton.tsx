import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { COLORS } from '../constants/Colors';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * 기본 Skeleton 컴포넌트 - 로딩 중 placeholder 표시
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 4,
    style,
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width: width as any,
                    height,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

/**
 * 텍스트 라인 Skeleton
 */
export const SkeletonText: React.FC<{ lines?: number; style?: ViewStyle }> = ({
    lines = 1,
    style,
}) => {
    return (
        <View style={style}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    width={index === lines - 1 && lines > 1 ? '60%' : '100%'}
                    height={14}
                    style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
                />
            ))}
        </View>
    );
};

/**
 * 카드 형태의 Skeleton
 */
export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    return (
        <View style={[styles.card, style]}>
            <View style={styles.cardHeader}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <View style={styles.cardHeaderText}>
                    <Skeleton width={120} height={16} />
                    <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
                </View>
            </View>
            <SkeletonText lines={2} style={{ marginTop: 12 }} />
        </View>
    );
};

/**
 * 리스트 아이템 Skeleton
 */
export const SkeletonListItem: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    return (
        <View style={[styles.listItem, style]}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.listItemContent}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
            </View>
        </View>
    );
};

/**
 * 캘린더 이벤트 Skeleton
 */
export const SkeletonCalendarEvent: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    return (
        <View style={[styles.calendarEvent, style]}>
            <Skeleton width={4} height={40} borderRadius={2} />
            <View style={styles.calendarEventContent}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
            </View>
        </View>
    );
};

/**
 * Pending Request Card Skeleton
 */
export const SkeletonPendingRequest: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    return (
        <View style={[styles.pendingRequest, style]}>
            <View style={styles.pendingRequestHeader}>
                <View style={styles.pendingRequestIcon}>
                    <Skeleton width={20} height={20} borderRadius={10} />
                </View>
                <Skeleton width={60} height={12} />
            </View>
            <Skeleton width="90%" height={16} style={{ marginTop: 8 }} />
            <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
            <View style={styles.pendingRequestActions}>
                <Skeleton width={80} height={32} borderRadius={16} />
                <Skeleton width={80} height={32} borderRadius={16} />
            </View>
        </View>
    );
};

/**
 * 친구 요청 카드 Skeleton
 */
export const SkeletonFriendRequest: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    return (
        <View style={[styles.friendRequest, style]}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.friendRequestContent}>
                <Skeleton width={100} height={16} />
                <Skeleton width={150} height={12} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.friendRequestActions}>
                <Skeleton width={36} height={36} borderRadius={18} />
                <Skeleton width={36} height={36} borderRadius={18} style={{ marginLeft: 8 }} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: COLORS.neutral200,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        marginLeft: 12,
        flex: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    listItemContent: {
        marginLeft: 12,
        flex: 1,
    },
    calendarEvent: {
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minHeight: 44,
    },
    calendarEventContent: {
        marginLeft: 8,
        flex: 1,
        justifyContent: 'center',
    },
    pendingRequest: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.neutral200,
    },
    pendingRequestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pendingRequestIcon: {
        marginRight: 8,
    },
    pendingRequestActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 8,
    },
    friendRequest: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    friendRequestContent: {
        flex: 1,
        marginLeft: 12,
    },
    friendRequestActions: {
        flexDirection: 'row',
    },
});

export default Skeleton;
