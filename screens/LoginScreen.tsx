import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { COLORS } from '../constants/Colors';
import { getBackendUrl, isWeb } from '../utils/environment';

const { height } = Dimensions.get('window');

const LoginScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const handleGoogleLogin = async () => {
        try {
            if (isWeb()) {
                const messageHandler = async (event: MessageEvent) => {
                    if (event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
                        window.removeEventListener('message', messageHandler);
                        await AsyncStorage.setItem('accessToken', event.data.token);
                        navigation.navigate('Home');
                    } else if (event.data.type === 'GOOGLE_REGISTER_REQUIRED') {
                        window.removeEventListener('message', messageHandler);
                        navigation.navigate('Register', {
                            register_token: event.data.register_token,
                            email: event.data.email,
                            name: event.data.name,
                            picture: event.data.picture
                        });
                    }
                };
                window.addEventListener('message', messageHandler);
            }

            const BACKEND_URL = getBackendUrl();
            let redirectUri = Linking.createURL('auth-success', { scheme: 'frontend' });

            if (!isWeb()) {
                if (redirectUri.startsWith('http')) {
                    redirectUri = redirectUri.replace(/^http(s)?/, 'exp');
                }
                if (redirectUri.includes('localhost')) {
                    redirectUri = redirectUri.replace('localhost', '192.168.45.131');
                }
            }

            const authUrl = `${BACKEND_URL}/auth/google?redirect_scheme=${encodeURIComponent(redirectUri)}`;
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (isWeb()) return;

            const finalUrl = (result as any)?.url || '';

            // 회원가입 딥링크
            if (finalUrl.includes('auth-register')) {
                const params = new URLSearchParams(finalUrl.split('?')[1]);
                navigation.navigate('Register', {
                    register_token: params.get('register_token'),
                    email: params.get('email') || '',
                    name: params.get('name') || '',
                    picture: params.get('picture') || ''
                });
                return;
            }

            // 토큰 딥링크
            const tokenMatch = /[?&]token=([^&#]+)/.exec(finalUrl);
            if (tokenMatch && tokenMatch[1]) {
                const token = decodeURIComponent(tokenMatch[1]);
                await AsyncStorage.setItem('accessToken', token);
                navigation.navigate('Home');
                return;
            }

            // 세션 기반 토큰 조회
            const tokenResponse = await fetch(`${BACKEND_URL}/auth/token`, {
                method: 'GET',
                credentials: 'include',
            });

            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                await AsyncStorage.setItem('accessToken', tokenData.accessToken);
                navigation.navigate('Home');
                return;
            }

            Alert.alert('로그인 실패', '토큰을 받아오지 못했습니다. 다시 시도해 주세요.');
        } catch (error) {
            console.error('Google 로그인 오류:', error);
            Alert.alert('로그인 실패', '로그인 중 오류가 발생했습니다.');
        }
    };

    return (
        <View style={styles.container}>
            {/* HEADER 영역 */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={[COLORS.primaryLight, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    {/* 장식 블롭 */}
                    <View style={styles.blob1} />
                    <View style={styles.blob2} />

                    {/* 로고 + 타이틀 */}
                    <Animated.View entering={FadeInUp.duration(1000)} style={styles.logoContainer}>
                        <View style={styles.logoWrapper}>
                            {/* 여기 로고가 '다 커진 상태' 느낌으로 고정 */}
                            <Svg width={80} height={80} viewBox="0 0 100 100">
                                {/* 왼쪽 머리 */}
                                <Circle cx="38" cy="32" r="11" fill="#312E81" />
                                {/* 오른쪽 머리 */}
                                <Circle cx="62" cy="32" r="11" fill="#818CF8" />

                                {/* 목 */}
                                <Rect x="44" y="42" width="4" height="11" rx={2} fill="#312E81" />
                                <Rect x="52" y="42" width="4" height="11" rx={2} fill="#312E81" />

                                {/* 몸통 */}
                                <Rect x="30" y="52" width="40" height="26" rx={9} fill="#312E81" />
                            </Svg>
                        </View>

                        <Text style={styles.title}>JOYNER</Text>
                        <Text style={styles.subtitle}>Your AI Scheduling Assistant</Text>
                    </Animated.View>
                </LinearGradient>
            </View>

            {/* MAIN / ACTION 영역 */}
            <Animated.View entering={FadeInDown.duration(1000).delay(200)} style={styles.actionContainer}>
                <View style={styles.welcomeTextContainer}>
                    <Text style={styles.welcomeTitle}>환영합니다! 👋</Text>
                    <Text style={styles.welcomeDescription}>
                        JOYNER와 함께 복잡한 일정 조율을{'\n'}AI로 스마트하게 해결하세요.
                    </Text>
                </View>

                {/* Google 로그인 버튼 */}
                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    activeOpacity={0.9}
                >
                    <View style={styles.googleIconWrapper}>
                        <Svg width={24} height={24} viewBox="0 0 24 24">
                            <Path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <Path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <Path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                                fill="#FBBC05"
                            />
                            <Path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </Svg>
                    </View>
                    <Text style={styles.googleButtonText}>Google로 시작하기</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    계속 진행하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    headerContainer: {
        height: height * 0.45,
        borderBottomLeftRadius: 48,
        borderBottomRightRadius: 48,
        overflow: 'hidden',
        elevation: 10,
    },
    headerGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    blob1: {
        position: 'absolute',
        bottom: -40,
        right: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    blob2: {
        position: 'absolute',
        top: 40,
        left: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    logoContainer: {
        alignItems: 'center',
    },
    logoWrapper: {
        width: 96,
        height: 96,
        backgroundColor: COLORS.white,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        // 스플래시에서 "다 커진" 느낌을 주기 위해 살짝 확대
        transform: [{ scale: 1.1 }],
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
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
    },
    actionContainer: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: 'center',
        paddingBottom: 48,
    },
    welcomeTextContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
        marginBottom: 12,
    },
    welcomeDescription: {
        fontSize: 14,
        color: COLORS.neutralGray,
        textAlign: 'center',
        lineHeight: 22,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.neutral200,
        paddingVertical: 16,
        borderRadius: 16,
        elevation: 2,
        marginBottom: 32,
    },
    googleIconWrapper: {
        marginRight: 12,
    },
    googleButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
    },
    footerText: {
        fontSize: 10,
        color: COLORS.neutral300,
        textAlign: 'center',
    },
});

export default LoginScreen;
