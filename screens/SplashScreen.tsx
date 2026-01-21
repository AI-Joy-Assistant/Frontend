import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import Animated, {
    FadeInUp,
    ZoomIn,
    withRepeat,
    withTiming,
    useSharedValue,
    useAnimatedStyle,
    Easing
} from 'react-native-reanimated';
import Svg, { Circle, Rect, Path, Defs, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/Colors';
import { fontAssets } from '../constants/Fonts';
import { getBackendUrl } from '../utils/environment';
import { dataCache, CACHE_KEYS } from '../utils/dataCache';

const SplashScreen = ({ navigation }: { navigation: any }) => {

    // 🔥 Font Loading (iOS/Android only, 웹은 시스템 폰트)
    const [fontsLoaded] = Platform.OS === 'web'
        ? [true]  // 웹에서는 폰트 로딩 스킵
        : useFonts(fontAssets);

    // 🔥 Pulse Animation (Tailwind animate-ping 대체)
    const pulse = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.2);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: pulseOpacity.value,
    }));

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1.4, { duration: 1200, easing: Easing.out(Easing.ease) }),
            -1,
            true
        );
        pulseOpacity.value = withRepeat(
            withTiming(0, { duration: 1200 }),
            -1,
            true
        );
    }, []);

    // 🚀 프리페칭: 주요 API 데이터를 미리 불러와 캐시에 저장
    const prefetchData = async (token: string, userData: any) => {
        const BACKEND_URL = getBackendUrl();
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        // 사용자 정보는 이미 받았으므로 바로 캐시 저장
        dataCache.set(CACHE_KEYS.USER_ME, userData, 5 * 60 * 1000);

        // 나머지 API 병렬 호출 (에러 무시)
        const prefetchPromises = [
            // 채팅 세션 목록 (Date 객체 변환 필요)
            fetch(`${BACKEND_URL}/chat/sessions`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.sessions) {
                        // 프론트엔드 모델에 맞게 변환
                        const formattedSessions = data.sessions.map((s: any) => ({
                            id: s.id,
                            title: s.title || "새 채팅",
                            updatedAt: s.updated_at ? new Date(s.updated_at) : new Date(),
                            messages: [],
                            isDefault: s.is_default || false,
                        }));
                        dataCache.set(CACHE_KEYS.CHAT_SESSIONS, formattedSessions, 2 * 60 * 1000);
                    }
                })
                .catch(() => { }),

            // 채팅 기본 세션 (채팅 탭 진입 시 즉시 표시)
            fetch(`${BACKEND_URL}/chat/default-session`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data && dataCache.set('chat:default-session', data, 5 * 60 * 1000))
                .catch(() => { }),

            // 친구 목록
            fetch(`${BACKEND_URL}/friends/list`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data?.friends && dataCache.set(CACHE_KEYS.FRIENDS_LIST, data.friends, 2 * 60 * 1000))
                .catch(() => { }),

            // 친구 요청 목록
            fetch(`${BACKEND_URL}/friends/requests`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data?.requests && dataCache.set(CACHE_KEYS.FRIEND_REQUESTS, data.requests, 2 * 60 * 1000))
                .catch(() => { }),

            // 캘린더 연동 상태
            fetch(`${BACKEND_URL}/calendar/link-status`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data && dataCache.set('calendar:link-status', data, 10 * 60 * 1000))
                .catch(() => { }),

            // 알림
            fetch(`${BACKEND_URL}/chat/notifications`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data?.notifications && dataCache.set(CACHE_KEYS.NOTIFICATIONS, data.notifications, 2 * 60 * 1000))
                .catch(() => { }),

            // 이벤트(A2A) 목록
            fetch(`${BACKEND_URL}/a2a/sessions`, { headers })
                .then(res => res.ok ? res.json() : null)
                .then(data => data?.sessions && dataCache.set('a2a:sessions', data.sessions, 5 * 60 * 1000))
                .catch(() => { }),
        ];

        // 모든 프리페칭 완료 대기 (최대 3초)
        await Promise.race([
            Promise.all(prefetchPromises),
            new Promise(resolve => setTimeout(resolve, 3000))
        ]);
    };

    // 🔥 자동 로그인 로직 (폰트 로드 후)
    useEffect(() => {
        if (!fontsLoaded) return;

        // iOS/Android에서만 전역 폰트 적용
        if (Platform.OS !== 'web') {
            const { applyGlobalFonts } = require('../utils/globalFonts');
            applyGlobalFonts();
        }

        const checkLogin = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1500)); // 애니메이션 시간 단축
                const token = await AsyncStorage.getItem('accessToken');

                if (token) {
                    try {
                        const BACKEND_URL = getBackendUrl();
                        const response = await fetch(`${BACKEND_URL}/auth/me`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });

                        if (response.ok) {
                            const userData = await response.json();
                            // 🚀 프리페칭 실행 (홈 이동 전에 데이터 캐싱)
                            await prefetchData(token, userData);
                            navigation.replace('Home');
                        } else {
                            await AsyncStorage.removeItem('accessToken');
                            navigation.replace('Login');
                        }
                    } catch {
                        navigation.replace('Login');
                    }
                } else {
                    navigation.replace('Login');
                }
            } catch {
                navigation.replace('Login');
            }
        };

        checkLogin();
    }, [fontsLoaded]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[COLORS.primaryMain, COLORS.primaryDark]}
                style={StyleSheet.absoluteFill}
            />

            {/* Background circle */}
            <Animated.View entering={ZoomIn.duration(1500)} style={styles.decorationCircle} />

            {/* LOGO AREA */}
            <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.logoContainer}>

                {/* 🔥 Pulse Background */}
                <Animated.View style={[styles.pulseCircle, pulseStyle]} />

                {/* 🔥 Rotating + Scaling Logo Box */}
                <Animated.View
                    entering={ZoomIn.duration(800)}
                    style={styles.logoWrapper}
                >
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* App Name */}
                <Text style={styles.title}>JOYNER</Text>

                {/* Tagline */}
                <Text style={styles.subtitle}>AI Scheduler</Text>
            </Animated.View>

            <View style={styles.footer}>
                <ActivityIndicator size="large" color={COLORS.white} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    decorationCircle: {
        position: 'absolute',
        top: -100,
        left: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: COLORS.primaryLight,
        opacity: 0.3,
        transform: [{ scale: 1.5 }],
    },

    logoContainer: { alignItems: 'center', zIndex: 10 },

    logoWrapper: {
        width: 96,
        height: 96,
        backgroundColor: COLORS.white,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 10,
    },

    logoImage: {
        width: 64,
        height: 64,
    },

    pulseCircle: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        opacity: 0.2,
    },

    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 8,
        letterSpacing: 1,
    },

    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: 0.5,
    },

    footer: { position: 'absolute', bottom: 50 },
});

export default SplashScreen;
