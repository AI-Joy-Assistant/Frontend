import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Sparkles } from 'lucide-react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { COLORS } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from '../utils/environment';

const SplashScreen = ({ navigation }: { navigation: any }) => {
    useEffect(() => {
        const checkLogin = async () => {
            try {
                console.log('🚀 [SplashScreen] 자동 로그인 확인 시작');

                // 최소 2초 대기 (스플래시 효과)
                await new Promise(resolve => setTimeout(resolve, 2000));

                const token = await AsyncStorage.getItem('accessToken');
                console.log('🔑 [SplashScreen] 저장된 토큰:', token ? '있음' : '없음');

                if (token) {
                    // 토큰 유효성 검증 (백엔드에 사용자 존재 여부 확인)
                    try {
                        const BACKEND_URL = getBackendUrl();
                        console.log('🌐 [SplashScreen] 백엔드 URL:', BACKEND_URL);
                        console.log('📡 [SplashScreen] /auth/me 요청 시작...');

                        const response = await fetch(`${BACKEND_URL}/auth/me`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });

                        console.log('📡 [SplashScreen] /auth/me 응답 상태:', response.status);

                        if (response.ok) {
                            const userData = await response.json();
                            console.log('✅ [SplashScreen] 자동 로그인 성공. 사용자:', userData.email);
                            navigation.replace('Home');
                        } else {
                            console.log('❌ [SplashScreen] 토큰 검증 실패 (상태 코드:', response.status, ')');
                            console.log('🗑️ [SplashScreen] 토큰 삭제 및 로그인 화면으로 이동');
                            await AsyncStorage.removeItem('accessToken');
                            navigation.replace('Login');
                        }
                    } catch (error) {
                        console.error('❌ [SplashScreen] 토큰 검증 중 네트워크 오류:', error);
                        // 네트워크 오류 시에도 일단 로그인 화면으로 보내거나, 
                        // 오프라인 모드가 있다면 홈으로 보낼 수도 있음. 
                        // 여기서는 안전하게 로그인 화면으로 이동.
                        console.log('🔄 [SplashScreen] 로그인 화면으로 이동');
                        navigation.replace('Login');
                    }
                } else {
                    console.log('ℹ️ [SplashScreen] 토큰 없음 -> 로그인 화면으로 이동');
                    navigation.replace('Login');
                }
            } catch (e) {
                console.error('❌ [SplashScreen] 자동 로그인 확인 실패:', e);
                navigation.replace('Login');
            }
        };

        checkLogin();
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[COLORS.primaryMain, COLORS.primaryDark]}
                style={StyleSheet.absoluteFill}
            />

            {/* Background Decoration */}
            <Animated.View
                entering={ZoomIn.duration(1500)}
                style={styles.decorationCircle}
            />

            <Animated.View
                entering={FadeInUp.duration(1000).springify()}
                style={styles.contentContainer}
            >
                <View style={styles.logoWrapper}>
                    <Calendar size={48} color={COLORS.primaryMain} strokeWidth={2.5} />
                    <View style={styles.sparkleBadge}>
                        <Sparkles size={16} color={COLORS.white} fill={COLORS.white} />
                    </View>
                </View>

                <Text style={styles.title}>JOYNER</Text>
                <Text style={styles.subtitle}>Your AI Scheduling Assistant</Text>
            </Animated.View>

            <View style={styles.footer}>
                <ActivityIndicator size="large" color={COLORS.white} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMain,
    },
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
    contentContainer: {
        alignItems: 'center',
        zIndex: 10,
    },
    logoWrapper: {
        width: 96,
        height: 96,
        backgroundColor: COLORS.white,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    sparkleBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: COLORS.primaryLight,
        padding: 6,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: COLORS.primaryMain,
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
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
});

export default SplashScreen;
