import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { User, AtSign, Sparkles, ArrowRight } from 'lucide-react-native';
import { COLORS } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from '../utils/environment';
import { useTutorial } from '../store/TutorialContext';

type RegisterScreenRouteProp = RouteProp<RootStackParamList, 'Register'>;

const RegisterScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RegisterScreenRouteProp>();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { resetTutorialState } = useTutorial();

    // route.params가 undefined일 수 있으므로 안전하게 접근
    const { register_token, email, name: initialName, picture, terms_agreed, auth_provider } = route.params || {};

    const [name, setName] = useState(initialName || '');
    const [handle, setHandle] = useState('');

    useEffect(() => {
        if (!register_token) {
            Alert.alert('오류', '잘못된 접근입니다.');
            navigation.replace('Login');
        }
    }, [register_token]);

    const handleSubmit = async () => {
        if (!name.trim() || !handle.trim()) {
            setError('이름과 아이디를 모두 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            // auth_provider에 따라 다른 엔드포인트 호출
            const BACKEND_URL = getBackendUrl();
            const endpoint = auth_provider === 'apple'
                ? `${BACKEND_URL}/auth/register/apple`
                : `${BACKEND_URL}/auth/register/google`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    register_token,
                    name,
                    handle,
                    terms_agreed: terms_agreed ?? true,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || '회원가입에 실패했습니다.');
            }

            // 토큰 저장 및 홈으로 이동
            await AsyncStorage.setItem('accessToken', data.access_token);

            // 튜토리얼 상태 초기화 (Context State + AsyncStorage 동기화)
            await resetTutorialState();

            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
            });

        } catch (e: any) {
            console.error('회원가입 오류:', e);
            // 중복 아이디 에러 메시지 처리
            const errorMessage = e.message || '';
            if (errorMessage.includes('handle') || errorMessage.includes('duplicate') || errorMessage.includes('already') || errorMessage.includes('exists') || errorMessage.includes('중복')) {
                setError('중복된 아이디가 존재합니다.');
            } else {
                setError(errorMessage || '회원가입에 실패했습니다.');
            }
            // Alert 제거 - 하단 에러 메시지로만 표시
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Image
                        source={require('../assets/images/register.png')}
                        style={styles.iconImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.title}>회원가입</Text>
                <Text style={styles.subtitle}>
                    JOYNER 이용을 위해{'\n'}추가 정보를 입력해주세요.
                </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>이름</Text>
                    <View style={styles.inputWrapper}>
                        <User style={styles.inputIcon} size={20} color={COLORS.neutral400} />
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                setError('');
                            }}
                            placeholder="홍길동"
                            placeholderTextColor={COLORS.neutral300}
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>아이디</Text>
                    <View style={styles.inputWrapper}>
                        <AtSign style={styles.inputIcon} size={20} color={COLORS.neutral400} />
                        <TextInput
                            style={styles.input}
                            value={handle}
                            onChangeText={(text) => {
                                setHandle(text);
                                setError('');
                            }}
                            placeholder="joyner_user"
                            placeholderTextColor={COLORS.neutral300}
                            autoCapitalize="none"
                        />
                    </View>
                    <Text style={styles.helperText}>
                        친구들이 나를 검색할 때 사용됩니다.
                    </Text>
                </View>

                {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : null}
            </View>

            {/* Footer Action */}
            <View style={styles.footer}>
                <Text style={styles.termsText}>
                    가입을 진행하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
                </Text>
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!name || !handle || isLoading}
                    style={[
                        styles.button,
                        (name && handle && !isLoading) ? styles.buttonActive : styles.buttonDisabled
                    ]}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <>
                            <Text style={[
                                styles.buttonText,
                                (name && handle) ? styles.buttonTextActive : styles.buttonTextDisabled
                            ]}>
                                가입 완료
                            </Text>
                            <ArrowRight size={18} color={(name && handle) ? COLORS.white : COLORS.neutral400} style={styles.buttonIcon} />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        paddingHorizontal: 32,
        paddingTop: 64,
        paddingBottom: 32,
    },
    iconContainer: {
        width: 48,
        height: 48,
        backgroundColor: COLORS.primaryBg,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    iconImage: {
        width: 24,
        height: 24,
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.neutral400,
        lineHeight: 20,
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 32,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.neutral400,
        marginBottom: 8,
        paddingLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutralLight,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
        outlineStyle: 'none' as any,  // 웹에서 포커스 시 파란 박스 제거
    },
    helperText: {
        fontSize: 10,
        color: COLORS.neutral400,
        marginTop: 8,
        paddingLeft: 4,
    },
    errorText: {
        fontSize: 12,
        color: COLORS.primaryMain,
        fontWeight: '500',
        paddingLeft: 4,
        marginTop: -12,
        marginBottom: 12,
    },
    footer: {
        padding: 32,
        paddingBottom: 48,
    },
    termsText: {
        fontSize: 11,
        color: COLORS.neutral400,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 16,
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    buttonActive: {
        backgroundColor: COLORS.primaryMain,
        shadowColor: COLORS.primaryMain,
        shadowOpacity: 0.3,
    },
    buttonDisabled: {
        backgroundColor: COLORS.neutral200,
        shadowOpacity: 0,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 8,
    },
    buttonTextActive: {
        color: COLORS.white,
    },
    buttonTextDisabled: {
        color: COLORS.neutral400,
    },
    buttonIcon: {
        marginLeft: 4,
    },
});

export default RegisterScreen;
