import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Sparkles } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { COLORS } from '../constants/Colors';
import { getBackendUrl, isWeb } from '../utils/environment';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const handleGoogleLogin = async () => {
        try {
            console.log('🔐 Google 로그인 시작...');

            // 웹 환경에서는 postMessage 리스너 등록
            if (isWeb()) {
                const messageHandler = async (event: MessageEvent) => {
                    console.log('📨 [Web] postMessage 수신:', event.data);

                    if (event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
                        window.removeEventListener('message', messageHandler);
                        const token = event.data.token;
                        await AsyncStorage.setItem('accessToken', token);
                        console.log('✅ [Web] 로그인 성공, 토큰 저장 완료');
                        navigation.navigate('Home');
                    } else if (event.data.type === 'GOOGLE_REGISTER_REQUIRED') {
                        window.removeEventListener('message', messageHandler);
                        console.log('📝 [Web] 회원가입 필요 -> RegisterScreen 이동');
                        navigation.navigate('Register', {
                            register_token: event.data.register_token,
                            email: event.data.email,
                            name: event.data.name,
                            picture: event.data.picture
                        });
                    }
                };

                window.addEventListener('message', messageHandler);
                console.log('🎧 [Web] postMessage 리스너 등록 완료');
            }

            // 백엔드 URL (환경에 따라 자동 선택)
            const BACKEND_URL = getBackendUrl();

            // 현재 환경에 맞는 리다이렉트 URI 생성
            let redirectUri = Linking.createURL('auth-success', { scheme: 'frontend' });

            // 웹이 아닌 경우에만 exp:// 스킴으로 변환
            if (!isWeb()) {
                // Expo Go 개발 환경 보정: http -> exp, localhost -> IP
                if (redirectUri.startsWith('http')) {
                    redirectUri = redirectUri.replace(/^http(s)?/, 'exp');
                }
                if (redirectUri.includes('localhost')) {
                    redirectUri = redirectUri.replace('localhost', '192.168.45.131');
                }
            }
            // 웹 환경에서는 http://localhost 그대로 유지

            console.log('🔗 생성된 Redirect URI:', redirectUri);
            console.log('🌐 백엔드 URL:', BACKEND_URL);

            // Google OAuth URL로 브라우저 열기
            const authUrl = `${BACKEND_URL}/auth/google?redirect_scheme=${encodeURIComponent(redirectUri)}`;
            console.log('🌐 브라우저에서 Google 로그인 열기:', authUrl);

            const result = await WebBrowser.openAuthSessionAsync(
                authUrl,
                redirectUri
            );

            console.log('🔍 로그인 결과:', result);

            // 웹 환경에서는 postMessage로 처리하므로 여기서 종료
            if (isWeb()) {
                console.log('🌐 [Web] postMessage로 처리 중, WebBrowser 결과 무시');
                return;
            }

            if (result.type === 'success' || result.type === 'dismiss') {
                // 성공 또는 dismiss(자동 창 닫기) 모두 성공으로 처리
                console.log('✅ Google 로그인 성공!');

                // 1) 모바일/네이티브: 앱 스킴으로 리다이렉트된 URL에서 토큰 파싱 시도
                const finalUrl = (result as any)?.url || '';
                console.log('🔍 [DEBUG] finalUrl:', finalUrl);
                console.log('🔍 [DEBUG] result object:', JSON.stringify(result, null, 2));

                // 회원가입 필요 시 (auth-register 또는 auth_action=register)
                if (finalUrl.includes('auth-register') || finalUrl.includes('auth_action=register')) {
                    const params = new URLSearchParams(finalUrl.split('?')[1]);
                    const register_token = params.get('register_token');
                    const email = params.get('email');
                    const name = params.get('name');
                    const picture = params.get('picture');

                    if (register_token) {
                        console.log('📝 회원가입 필요 -> RegisterScreen 이동');
                        navigation.navigate('Register', {
                            register_token,
                            email: email || '',
                            name: name || '',
                            picture: picture || ''
                        });
                        return;
                    }
                }

                // 로그인 성공 시 (auth-success)
                const tokenMatch = /[?&]token=([^&#]+)/.exec(finalUrl);
                if (tokenMatch && tokenMatch[1]) {
                    const token = decodeURIComponent(tokenMatch[1]);
                    await AsyncStorage.setItem('accessToken', token);
                    console.log('💾 토큰 저장 완료(딥링크)');
                    navigation.navigate('Home');
                    return;
                }

                // 2) 웹/로컬 환경 등 쿠키 공유 가능한 경우: 백엔드 세션에서 토큰 조회
                try {
                    console.log('🔑 백엔드에서 토큰 받아오는 중...');
                    const tokenResponse = await fetch(`${BACKEND_URL}/auth/token`, {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (tokenResponse.ok) {
                        const tokenData = await tokenResponse.json();
                        await AsyncStorage.setItem('accessToken', tokenData.accessToken);
                        console.log('💾 토큰 저장 완료(세션)');
                        navigation.navigate('Home');
                    } else {
                        console.log('❌ 토큰 받아오기 실패:', tokenResponse.status);
                        throw new Error(`토큰 받아오기 실패: ${tokenResponse.status}`);
                    }
                } catch (tokenError) {
                    console.error('❌ 토큰 받아오기 오류:', tokenError);
                    Alert.alert('로그인 실패', '토큰을 받아오는데 실패했습니다. 다시 시도해 주세요.');
                    return;
                }
            } else if (result.type === 'cancel') {
                console.log('❌ 사용자가 로그인을 취소했습니다.');
                Alert.alert('로그인 취소', '로그인이 취소되었습니다.');
            } else {
                console.log('❌ 로그인 실패:', result);
                Alert.alert('로그인 실패', '다시 시도해 주세요.');
            }
        } catch (error) {
            console.error('❌ Google 로그인 오류:', error);
            Alert.alert('로그인 실패', '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
        }
    };

    return (
        <View style={styles.container}>
            {/* Header Graphic */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={[COLORS.primaryLight, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    {/* Decorative Blobs */}
                    <View style={styles.blob1} />
                    <View style={styles.blob2} />

                    <Animated.View
                        entering={FadeInUp.duration(1000)}
                        style={styles.logoContainer}
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
                </LinearGradient>
            </View>

            {/* Action Section */}
            <Animated.View
                entering={FadeInDown.duration(1000).delay(200)}
                style={styles.actionContainer}
            >
                <View style={styles.welcomeTextContainer}>
                    <Text style={styles.welcomeTitle}>환영합니다! 👋</Text>
                    <Text style={styles.welcomeDescription}>
                        JOYNER와 함께 복잡한 일정 조율을{'\n'}AI로 스마트하게 해결하세요.
                    </Text>
                </View>

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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
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
