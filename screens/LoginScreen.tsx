import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { COLORS } from '../constants/Colors';
import { getBackendUrl, isWeb } from '../utils/environment';

const { height } = Dimensions.get('window');

const LoginScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // [Web only] 팝업에서 로그인 완료 후 토큰을 부모 창으로 전달하고 닫기
    useEffect(() => {
        if (isWeb()) {
            const url = new URL(window.location.href);
            // auth-success 경로로 들어왔는지 확인 (토큰이 있는 경우)
            const token = url.searchParams.get('token');
            const registerToken = url.searchParams.get('register_token');

            if (token || registerToken) {
                if (window.opener) {
                    // 부모 창이 있으면 메시지 전달
                    if (token) {
                        window.opener.postMessage({ type: 'GOOGLE_LOGIN_SUCCESS', token }, '*');
                    } else if (registerToken) {
                        window.opener.postMessage({
                            type: 'GOOGLE_REGISTER_REQUIRED',
                            register_token: registerToken,
                            email: url.searchParams.get('email'),
                            name: url.searchParams.get('name'),
                            picture: url.searchParams.get('picture')
                        }, '*');
                    }
                    // 팝업 닫기
                    window.close();
                }
            }
        } else {
            // [Native] 브라우저 세션 예열 (Android Custom Tabs 안정성 향상)
            WebBrowser.warmUpAsync();
            return () => {
                WebBrowser.coolDownAsync();
            };
        }
    }, []);

    // 딥링크 이벤트 리스너 (Android Linking.openURL 대응)
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            if (!url) return;

            // 이미 처리된 URL인지 확인 (중복 호출 방지)
            // ... (필요하다면 로직 추가)

            handleAuthRedirect(url);
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        // 앱이 이미 켜져있는 상태에서 URL로 열렸을 때 (Cold Start 등) 체크
        Linking.getInitialURL().then((url) => {
            if (url) handleAuthRedirect(url);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleAuthRedirect = async (url: string) => {
        // 회원가입 딥링크 (auth-register 또는 auth_action=register)
        if (url.includes('auth-register') || url.includes('auth_action=register')) {
            const params = new URLSearchParams(url.split('?')[1]);
            navigation.navigate('TermsAgreement', {
                register_token: params.get('register_token') || '',
                email: params.get('email') || '',
                name: params.get('name') || '',
                picture: params.get('picture') || ''
            });
            return;
        }

        // 토큰 딥링크
        const tokenMatch = /[?&]token=([^&#]+)/.exec(url);
        if (tokenMatch && tokenMatch[1]) {
            const token = decodeURIComponent(tokenMatch[1]);
            await AsyncStorage.setItem('accessToken', token);
            await AsyncStorage.setItem('authProvider', 'google');
            navigation.navigate('Home');
        }
    };

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
                // Expo Go 개발 환경 (localhost -> 실제 IP)
                if (redirectUri.includes('localhost')) {
                    // 주의: 사용자의 로컬 IP로 변경해야 함. 현재는 하드코딩된 값 사용 중인 것으로 보임.
                    // 필요시 Constants.expoConfig.hostUri 등을 활용 가능
                    redirectUri = redirectUri.replace('localhost', '10.50.110.9');
                }
            }

            const authUrl = `${BACKEND_URL}/auth/google?redirect_scheme=${encodeURIComponent(redirectUri)}`;

            if (Platform.OS === 'android') {
                // [Android] 403 오류 방지를 위해 외부 브라우저(Chrome) 강제 사용
                await Linking.openURL(authUrl);
            } else {
                // [iOS/Web] 기존 방식 유지 (WebBrowser or openAuthSessionAsync)
                const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
                if (result.type === 'success' && result.url) {
                    handleAuthRedirect(result.url);
                }
            }

        } catch (error) {
            console.error('Google 로그인 오류:', error);
            Alert.alert('로그인 실패', '로그인 중 오류가 발생했습니다.');
        }
    };

    // Apple 로그인 핸들러
    const handleAppleLogin = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            // 이름 조합 (Apple은 처음 로그인 시에만 이름 제공)
            const fullName = credential.fullName
                ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
                : '';

            // 백엔드로 Apple 토큰 전송
            const BACKEND_URL = getBackendUrl();
            const response = await fetch(`${BACKEND_URL}/auth/apple`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    identity_token: credential.identityToken,
                    user_id: credential.user,
                    email: credential.email,
                    full_name: fullName,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.access_token) {
                    // 기존 사용자 - 바로 로그인
                    await AsyncStorage.setItem('accessToken', data.access_token);
                    await AsyncStorage.setItem('authProvider', 'apple');
                    navigation.navigate('Home');
                } else if (data.register_token) {
                    // 신규 사용자 - 회원가입 화면으로
                    navigation.navigate('TermsAgreement', {
                        register_token: data.register_token,
                        email: data.email || credential.email || '',
                        name: fullName || data.name || '',
                        picture: '',
                        auth_provider: 'apple'
                    });
                }
            } else {
                throw new Error(data.detail || 'Apple 로그인 실패');
            }
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                // 사용자가 취소한 경우
                console.log('Apple 로그인 취소됨');
            } else {
                console.error('Apple 로그인 오류:', error);
                Alert.alert('로그인 실패', error.message || 'Apple 로그인 중 오류가 발생했습니다.');
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
                            <Image
                                source={require('../assets/images/logo.png')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
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

                {/* Apple 로그인 버튼 (iOS만 표시) */}
                {Platform.OS === 'ios' && (
                    <TouchableOpacity
                        style={styles.appleButton}
                        onPress={handleAppleLogin}
                        activeOpacity={0.9}
                    >
                        <View style={styles.appleIconWrapper}>
                            <Svg width={20} height={24} viewBox="0 0 170 170">
                                <Path
                                    d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925s12.793-5.51 19.948-5.629c3.915 0 9.049 1.211 15.429 3.591 6.362 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002.11 10.337 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.252 8.99-3.497 13.1-3.71.12 1.083.17 2.166.17 3.24z"
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
        marginBottom: 16,
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
