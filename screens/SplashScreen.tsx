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
                await new Promise(resolve => setTimeout(resolve, 2000));
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
