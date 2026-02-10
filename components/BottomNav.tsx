import React, { useEffect, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Tab } from '../types';
import { useTutorial } from '../store/TutorialContext';


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

// 튜토리얼 탭 ID 매핑
const TUTORIAL_TAB_MAP: Record<string, string> = {
    'tab_friends': 'friends',
    'tab_request': 'request',
    'tab_a2a': 'events',
    'tab_home': 'home',
};

const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isTutorialActive, currentSubStep, nextSubStep, registerTarget } = useTutorial();

    const navItems = [
        { id: Tab.HOME, label: '홈', icon: 'home', route: 'Home' },
        { id: Tab.REQUEST, label: '조율', icon: 'add-circle', route: 'RequestMeeting' },
        { id: Tab.CHAT, label: '채팅', icon: 'chatbubble', route: 'Chat' },
        { id: Tab.FRIENDS, label: '친구', icon: 'people', route: 'Friends' },
        { id: Tab.A2A, label: '이벤트', icon: 'calendar', route: 'A2A' },
        { id: Tab.USER, label: '프로필', icon: 'information-circle', route: 'User' },
    ];

    const handlePress = (item: any) => {
        // 튜토리얼 모드일 때 탭 클릭 감지
        if (isTutorialActive && currentSubStep?.targetId) {
            const expectedTabId = `tab_${item.id.toLowerCase()}`;

            // 현재 튜토리얼 단계에서 기대하는 탭인지 확인
            if (currentSubStep.targetId === expectedTabId ||
                currentSubStep.targetId === `tab_${item.label.toLowerCase()}`) {
                console.log(`[Tutorial] Tab clicked: ${expectedTabId}, advancing to next step`);
                // 다음 튜토리얼 단계로 진행
                setTimeout(() => nextSubStep(), 300);
            }
        }

        if (activeTab !== item.id) {
            navigation.navigate(item.route as any);
        }
    };

    return (
        <View
            style={styles.container}
            testID="bottom-nav"
            // @ts-ignore - 웹에서 CSS 선택자로 사용하기 위한 className
            className="bottom-nav-hide-on-keyboard"
        >
            <View style={styles.content}>
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const iconName = isActive ? item.icon : `${item.icon}-outline`;

                    // 튜토리얼에서 하이라이트 할 탭인지 확인
                    const expectedTabId = `tab_${item.id.toLowerCase()}`;
                    const isHighlighted = isTutorialActive &&
                        currentSubStep?.targetId === expectedTabId;

                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handlePress(item)}
                            style={[
                                styles.tabButton,
                                isHighlighted && styles.highlightedTab
                            ]}
                            activeOpacity={0.7}
                            testID={`tab_${item.id.toLowerCase()}`}
                            ref={(r) => { if (r) registerTarget(`tab_${item.id.toLowerCase()}`, r); }}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons
                                    name={iconName as any}
                                    size={28}
                                    color={isActive ? COLORS.white : COLORS.lightGray}
                                    style={{ opacity: isActive ? 1 : 0.7 }}
                                />
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
    highlightedTab: {
        backgroundColor: 'rgba(129, 140, 248, 0.3)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.lightIndigo,
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
