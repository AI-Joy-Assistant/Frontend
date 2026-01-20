import React, { useEffect, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Tab } from '../types';


interface BottomNavProps {
    activeTab: Tab;
}

// Colors provided by user
const COLORS = {
    bg: '#0E004E',      // Deep Indigo - Background
    indigo: '#3730A3',  // Indigo
    lightIndigo: '#818CF8', // Light Indigo - Active?
    lightGray: '#CBD5E1',   // Light Gray - Inactive
    darkGray: '#334155',    // Dark Gray
    white: '#FFFFFF',
    badge: '#FF3B30',       // 배지 색상 (빨간색)
};

const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();





    const navItems = [
        { id: Tab.HOME, label: 'Home', icon: 'home', route: 'Home' },
        { id: Tab.REQUEST, label: 'Request', icon: 'add-circle', route: 'RequestMeeting' },
        { id: Tab.CHAT, label: 'Chat', icon: 'chatbubble', route: 'Chat' },
        { id: Tab.FRIENDS, label: 'Friends', icon: 'people', route: 'Friends' },
        { id: Tab.A2A, label: 'Event', icon: 'calendar', route: 'A2A' },
        { id: Tab.USER, label: 'User', icon: 'information-circle', route: 'User' },
    ];

    const handlePress = (item: any) => {


        if (activeTab !== item.id) {
            navigation.navigate(item.route as any);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const iconName = isActive ? item.icon : `${item.icon}-outline`;


                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handlePress(item)}
                            style={styles.tabButton}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons
                                    name={iconName as any}
                                    size={28}
                                    color={isActive ? COLORS.white : COLORS.lightGray}
                                    style={{ opacity: isActive ? 1 : 0.7 }}
                                />
                                {/* 배지 표시 */}

                            </View>
                            <Text style={[
                                styles.label,
                                { color: isActive ? COLORS.white : COLORS.lightGray, opacity: isActive ? 1 : 0.7 }
                            ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

// 플랫폼별 하단 패딩 계산
const getBottomPadding = () => {
    if (Platform.OS === 'ios') return 20;
    if (Platform.OS === 'web') return 24; // 웹에서 더 큰 패딩 (CSS env()가 추가로 적용됨)
    return 12; // Android
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 24, // Slightly reduced radius for shorter bar
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 20,
        paddingHorizontal: 24,
        paddingBottom: getBottomPadding(),
        paddingTop: 12, // Reduced top padding
        zIndex: 50,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 450,
        alignSelf: 'center',
        width: '100%',
    },
    tabButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50, // Reduced width
        height: 50, // Reduced height
    },
    iconContainer: {
        marginBottom: 4,
        position: 'relative',
    },
    label: {
        fontSize: 10,
        fontWeight: '500',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: COLORS.badge,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default BottomNav;
