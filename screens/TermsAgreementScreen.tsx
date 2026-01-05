import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/Colors';
import { Shield, ChevronDown, ChevronUp, Check, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

const { height } = Dimensions.get('window');

type TermsAgreementRouteProp = RouteProp<RootStackParamList, 'TermsAgreement'>;

// 개인정보 처리방침 내용
const PRIVACY_POLICY_CONTENT = `제 1조 (수집하는 개인정보 항목)
본앱은 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.
• 필수항목
  - Apple 계정 정보(식별자, 이메일, 이름), Google 계정 정보(식별자, 이메일, 이름), Google 캘린더 일정 데이터
• 서비스 이용 과정에서 생성되는 항목
  - 사용자가 입력한 채팅 메시지(텍스트 데이터), 서비스 이용 기록, 접속 로그

제 2조 (개인정보의 수집 및 이용 목적)
• 사용자의 일정에 기반한 AI 스케줄링 및 비서 서비스(A2A) 제공
• Llama 기반 AI 모델의 답변 생성 및 개별 사용자 최적화
• 서비스 품질 개선 및 성능 향상을 위한 AI 모델 학습 및 데이터 분석

제 3조 (Google 사용자 데이터 정책 준수 및 제한적 사용)
• 본 서비스는 Google API로부터 받은 정보를 사용할 때 Google API 서비스 사용자 데이터 정책을 준수합니다.
• 특히, Google API를 통해 획득한 데이터의 사용 및 타사 앱으로의 전송은 해당 정책의 제한적 사용(Limited Use) 요구사항을 엄격히 준수하며, 사용자의 명시적인 동의 없이 광고 목적이나 제3자에게 데이터를 판매하는 행위를 일체 하지 않습니다.

제 4조 (개인정보의 보유 및 이용 기간)
• 사용자의 개인정보는 서비스 탈퇴 시 또는 연동 해제 시까지 보관하며, 목적 달성 후에는 지체 없이 파기합니다.
• 단, 모델 학습에 활용된 데이터는 별도의 익명화(Anonymization) 절차를 거쳐 개인을 식별할 수 없는 형태로 변환된 후 보관될 수 있습니다.

제 5조 (이용자의 권리 및 데이터 삭제 요청)
• 이용자는 언제든지 앱 내 설정 또는 아래 연락처를 통해 자신의 개인정보 및 계정 삭제를 요청할 수 있습니다.
• 데이터 삭제 요청 방법: 앱 내 '계정 탈퇴' 기능을 이용하거나, sungshinjoy@gmail.com으로 계정 정보와 함께 삭제를 요청하시면 7일 이내에 모든 데이터를 영구 파기합니다.

제 6조 (AI 모델 이용 및 데이터 처리 정책)
• 본 서비스는 답변 생성을 위해 Llama 기반의 언어 모델을 활용합니다.
• 사용자가 입력한 채팅 데이터는 비서 서비스의 정확도 향상 및 AI 모델 학습을 위해 활용될 수 있으며, 이 과정에서 모든 개인 식별 정보는 비식별화 처리됩니다.

제 7조 (개인정보 보호책임자)
• 성명: 성신조이(SungshinJoy) 팀
• 연락처: sungshinjoy@gmail.com`;

// 서비스 이용약관 내용
const TERMS_OF_SERVICE_CONTENT = `제 1조 (목적)
본 약관은 성신조이 팀(이하 "회사")이 제공하는 JOYNER 서비스(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.

제 2조 (서비스 내용)
• AI 기반 일정 조율 및 스케줄링 서비스
• Google 캘린더 연동을 통한 일정 관리
• AI 비서를 통한 자연어 기반 일정 생성

제 3조 (이용자 의무)
1. 타인의 개인정보를 수집하거나 도용하지 않습니다.
2. 서비스를 불법적인 목적으로 사용하지 않습니다.
3. 시스템에 부하를 주는 행위를 하지 않습니다.

제 4조 (서비스 중단)
회사는 시스템 점검, 천재지변 등의 사유로 서비스를 일시 중단할 수 있습니다.

제 5조 (면책조항)
• AI가 제공하는 일정 추천은 참고용이며, 최종 결정은 사용자의 책임입니다.
• 서비스 이용 중 발생한 데이터 손실에 대해 회사는 책임지지 않습니다.

제 6조 (문의)
서비스 관련 문의: sungshinjoy@gmail.com`;

const TermsAgreementScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<TermsAgreementRouteProp>();
    const { register_token, email, name, picture } = route.params || {};

    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
    const [expandedTerms, setExpandedTerms] = useState(false);
    const [expandedPrivacy, setExpandedPrivacy] = useState(false);

    const allAgreed = agreedToTerms && agreedToPrivacy;

    const handleAgreeAll = () => {
        setAgreedToTerms(true);
        setAgreedToPrivacy(true);
    };

    const handleContinue = () => {
        if (allAgreed) {
            navigation.navigate('Register', {
                register_token,
                email,
                name,
                picture,
                terms_agreed: true,
            });
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
                <View style={styles.iconContainer}>
                    <Shield size={28} color={COLORS.primaryMain} />
                </View>
                <Text style={styles.title}>서비스 이용 동의</Text>
                <Text style={styles.subtitle}>
                    JOYNER 서비스 이용을 위해{'\n'}아래 약관에 동의해 주세요.
                </Text>
            </Animated.View>

            {/* Content */}
            <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.content}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* 전체 동의 */}
                    <TouchableOpacity
                        style={[styles.agreeAllCard, allAgreed && styles.agreeAllCardActive]}
                        onPress={handleAgreeAll}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.checkbox, allAgreed && styles.checkboxActive]}>
                            {allAgreed && <Check size={16} color={COLORS.white} />}
                        </View>
                        <Text style={[styles.agreeAllText, allAgreed && styles.agreeAllTextActive]}>
                            전체 동의하기
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* 서비스 이용약관 */}
                    <View style={styles.termSection}>
                        <View style={styles.termItem}>
                            <TouchableOpacity
                                style={styles.termCheckArea}
                                onPress={() => setAgreedToTerms(!agreedToTerms)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                                    {agreedToTerms && <Check size={16} color={COLORS.white} />}
                                </View>
                                <Text style={styles.termLabel}>
                                    <Text style={styles.required}>[필수]</Text> 서비스 이용약관
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setExpandedTerms(!expandedTerms)}
                                style={styles.expandButton}
                            >
                                {expandedTerms ? (
                                    <ChevronUp size={20} color={COLORS.neutral400} />
                                ) : (
                                    <ChevronDown size={20} color={COLORS.neutral400} />
                                )}
                            </TouchableOpacity>
                        </View>
                        {expandedTerms && (
                            <View style={styles.expandedContent}>
                                <ScrollView style={styles.contentScroll} nestedScrollEnabled>
                                    <Text style={styles.contentText}>{TERMS_OF_SERVICE_CONTENT}</Text>
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* 개인정보 처리방침 */}
                    <View style={styles.termSection}>
                        <View style={styles.termItem}>
                            <TouchableOpacity
                                style={styles.termCheckArea}
                                onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, agreedToPrivacy && styles.checkboxActive]}>
                                    {agreedToPrivacy && <Check size={16} color={COLORS.white} />}
                                </View>
                                <Text style={styles.termLabel}>
                                    <Text style={styles.required}>[필수]</Text> 개인정보 처리방침
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setExpandedPrivacy(!expandedPrivacy)}
                                style={styles.expandButton}
                            >
                                {expandedPrivacy ? (
                                    <ChevronUp size={20} color={COLORS.neutral400} />
                                ) : (
                                    <ChevronDown size={20} color={COLORS.neutral400} />
                                )}
                            </TouchableOpacity>
                        </View>
                        {expandedPrivacy && (
                            <View style={styles.expandedContent}>
                                <ScrollView style={styles.contentScroll} nestedScrollEnabled>
                                    <Text style={styles.contentText}>{PRIVACY_POLICY_CONTENT}</Text>
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, allAgreed ? styles.buttonActive : styles.buttonDisabled]}
                    onPress={handleContinue}
                    disabled={!allAgreed}
                    activeOpacity={0.9}
                >
                    <Text style={[styles.buttonText, allAgreed ? styles.buttonTextActive : styles.buttonTextDisabled]}>
                        동의하고 계속하기
                    </Text>
                    <ArrowRight size={18} color={allAgreed ? COLORS.white : COLORS.neutral400} />
                </TouchableOpacity>
            </Animated.View>
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
        paddingTop: 80,
        paddingBottom: 24,
    },
    iconContainer: {
        width: 56,
        height: 56,
        backgroundColor: COLORS.primaryBg,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.neutral400,
        lineHeight: 20,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    agreeAllCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutralLight,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    agreeAllCardActive: {
        backgroundColor: COLORS.primaryBg,
    },
    agreeAllText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.neutralSlate,
        marginLeft: 12,
    },
    agreeAllTextActive: {
        color: COLORS.primaryMain,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.neutral200,
        marginVertical: 8,
    },
    termSection: {
        marginBottom: 8,
    },
    termItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    termCheckArea: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.neutral300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: COLORS.primaryMain,
        borderColor: COLORS.primaryMain,
    },
    termLabel: {
        fontSize: 14,
        color: COLORS.neutralSlate,
        marginLeft: 12,
    },
    required: {
        color: COLORS.primaryMain,
        fontWeight: 'bold',
    },
    expandButton: {
        padding: 8,
    },
    expandedContent: {
        backgroundColor: COLORS.neutralLight,
        borderRadius: 12,
        marginHorizontal: 8,
        marginBottom: 8,
    },
    contentScroll: {
        maxHeight: 200,
        padding: 16,
    },
    contentText: {
        fontSize: 12,
        color: COLORS.neutral500 || COLORS.neutralSlate,
        lineHeight: 20,
    },
    footer: {
        padding: 24,
        paddingBottom: 48,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 16,
    },
    buttonActive: {
        backgroundColor: COLORS.primaryMain,
    },
    buttonDisabled: {
        backgroundColor: COLORS.neutral200,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 8,
    },
    buttonTextActive: {
        color: COLORS.white,
    },
    buttonTextDisabled: {
        color: COLORS.neutral400,
    },
});

export default TermsAgreementScreen;
