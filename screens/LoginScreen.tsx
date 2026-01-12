import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { COLORS } from '../constants/Colors';
import { getBackendUrl, isWeb } from '../utils/environment';

// Apple Authentication은 네이티브 빌드에서만 사용 가능
let AppleAuthentication: any = null;
try {
    AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
    console.log('expo-apple-authentication not available (Expo Go)');
}

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
                        navigation.navigate('TermsAgreement', {
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
                navigation.navigate('TermsAgreement', {
                    register_token: params.get('register_token') || '',
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

    const handleAppleLogin = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            console.log('Apple 인증 성공:', credential);

            const BACKEND_URL = getBackendUrl();

            // 백엔드로 Apple 인증 정보 전송
            const response = await fetch(`${BACKEND_URL}/auth/apple`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity_token: credential.identityToken,
                    authorization_code: credential.authorizationCode,
                    user_id: credential.user,
                    email: credential.email,
                    full_name: credential.fullName
                        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
                        : null,
                }),
            });

            const data = await response.json();

            if (data.status === 'register_required') {
                // 신규 사용자 - 약관 동의 화면으로 이동
                navigation.navigate('TermsAgreement', {
                    register_token: data.register_token,
                    email: data.email || '',
                    name: data.name || '',
                    picture: '',
                    provider: 'apple'
                });
            } else if (data.access_token) {
                // 기존 사용자 - 바로 로그인
                await AsyncStorage.setItem('accessToken', data.access_token);
                navigation.navigate('Home');
            } else {
                throw new Error(data.detail || 'Apple 로그인 실패');
            }
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                console.log('사용자가 Apple 로그인을 취소했습니다.');
            } else {
                console.error('Apple 로그인 오류:', error);
                Alert.alert('로그인 실패', 'Apple 로그인 중 오류가 발생했습니다.');
            }
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
                            <Svg width={64} height={64} viewBox="0 0 64 64">
                                <Defs>
                                    <SvgLinear id="grad1" x1="12" y1="16" x2="28" y2="32">
                                        <Stop offset="0%" stopColor="#3730A3" />
                                        <Stop offset="100%" stopColor="#818CF8" />
                                    </SvgLinear>
                                    <SvgLinear id="grad2" x1="36" y1="16" x2="52" y2="32">
                                        <Stop offset="0%" stopColor="#818CF8" />
                                        <Stop offset="100%" stopColor="#3730A3" />
                                    </SvgLinear>
                                    <SvgLinear id="grad3" x1="28" y1="24" x2="36" y2="24">
                                        <Stop offset="0%" stopColor="#3730A3" />
                                        <Stop offset="100%" stopColor="#818CF8" />
                                    </SvgLinear>
                                    <SvgLinear id="grad4" x1="16" y1="38" x2="48" y2="58">
                                        <Stop offset="0%" stopColor="#3730A3" />
                                        <Stop offset="100%" stopColor="#818CF8" />
                                    </SvgLinear>
                                </Defs>

                                <Circle cx="20" cy="24" r="8" fill="url(#grad1)" />
                                <Circle cx="44" cy="24" r="8" fill="url(#grad2)" />

                                <Path d="M28 24 L36 24" stroke="url(#grad3)" strokeWidth="3" strokeLinecap="round" />

                                <Rect x="16" y="38" width="32" height="20" rx="4" fill="url(#grad4)" />

                                <Rect x="20" y="34" width="4" height="6" rx="2" fill="#3730A3" />
                                <Rect x="40" y="34" width="4" height="6" rx="2" fill="#3730A3" />
                            </Svg>
                        </View>

                        <Text style={styles.title}>JOYNER</Text>
                        <Text style={styles.subtitle}>AI Scheduling Assistant</Text>
                    </Animated.View>
                </LinearGradient>
            </View>

            {/* MAIN / ACTION 영역 */}
            <Animated.View entering={FadeInDown.duration(1000).delay(200)} style={styles.actionContainer}>
                <View style={styles.welcomeTextContainer}>
                    <Text style={styles.welcomeTitle}>환영합니다!</Text>
                    <Text style={styles.welcomeDescription}>
                        내 손안의 AI 스케줄링 비서, JOYNER를 지금 만나보세요.
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
                    <Text style={styles.googleButtonText}>Google로 로그인하기</Text>
                </TouchableOpacity>

                {/* Apple 로그인 버튼 (iOS + 네이티브 빌드에서만 표시) */}
                {Platform.OS === 'ios' && AppleAuthentication && (
                    <TouchableOpacity
                        style={styles.appleButton}
                        onPress={handleAppleLogin}
                        activeOpacity={0.9}
                    >
                        <View style={styles.appleIconWrapper}>
                            <Svg width={20} height={24} viewBox="0 0 170 170">
                                <Path
                                    d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.93.21-9.84-1.96-14.75-6.52-3.13-2.73-7.04-7.4-11.74-14.03-5.02-7.08-9.15-15.29-12.38-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.85 2.35-20.22 7.03-28.08 3.68-6.32 8.58-11.3 14.7-14.96 6.13-3.66 12.76-5.53 19.87-5.64 3.91 0 9.05 1.21 15.43 3.59 6.36 2.39 10.45 3.6 12.26 3.6 1.35 0 5.94-1.42 13.72-4.24 7.35-2.62 13.56-3.71 18.66-3.28 13.79 1.11 24.15 6.55 31.04 16.35-12.33 7.48-18.43 17.96-18.32 31.4.1 10.46 3.91 19.17 11.4 26.1 3.39 3.22 7.18 5.71 11.4 7.47-.91 2.65-1.88 5.19-2.91 7.63zM119.11 7.24c0 8.2-2.99 15.85-8.93 22.95-7.18 8.4-15.86 13.25-25.28 12.49-.12-.98-.19-2.01-.19-3.09 0-7.87 3.43-16.3 9.52-23.19 3.04-3.49 6.9-6.39 11.58-8.69 4.66-2.27 9.08-3.53 13.25-3.75.12 1.1.05 2.2.05 3.28z"
                                    fill="#FFFFFF"
                                />
                            </Svg>
                        </View>
                        <Text style={styles.appleButtonText}>Apple로 로그인하기</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.footerText}>
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
        elevation: 10,
    },
    logoImage: {
        width: 64,
        height: 64,
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
    appleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        paddingVertical: 16,
        borderRadius: 16,
        elevation: 2,
        marginBottom: 32,
    },
    appleIconWrapper: {
        marginRight: 12,
    },
    appleButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    footerText: {
        fontSize: 10,
        color: COLORS.neutral300,
        textAlign: 'center',
    },
});

export default LoginScreen;
