import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ChevronLeft, X } from 'lucide-react-native';
import { useTutorial } from '../store/TutorialContext';
import { COLORS } from '../constants/Colors';

const TutorialOverlay: React.FC = () => {
    const insets = useSafeAreaInsets();
    const {
        isTutorialActive,
        currentStep,
        currentSubStep,
        currentStepData,
        currentSubStepIndex,
        nextSubStep,
        prevSubStep,
        skipTutorial,
        completeTutorial,
        targetRefs,
    } = useTutorial();

    // 스킵 확인 모달 상태
    const [showSkipModal, setShowSkipModal] = useState(false);

    // 타겟 레이아웃 상태
    const [targetLayout, setTargetLayout] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // 애니메이션 값
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current; // 글로우 애니메이션

    // 표시/숨김 및 펄스 애니메이션
    useEffect(() => {
        if (isTutorialActive && currentSubStep) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: false, // glowAnim과 같은 View에서 사용하므로 JS driver 사용
                tension: 50,
                friction: 8,
            }).start();

            // 펄스 애니메이션
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: false,
                    }),
                ])
            );
            pulse.start();

            // 글로우 애니메이션 (주의 끌기)
            const glow = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: false,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 800,
                        useNativeDriver: false,
                    }),
                ])
            );
            glow.start();

            return () => {
                pulse.stop();
                glow.stop();
            };
        }
    }, [isTutorialActive, currentSubStep, currentSubStepIndex]);

    // 타겟 위치 측정 (스크롤 시 위치 업데이트를 위해 주기적으로 측정)
    useEffect(() => {
        if (isTutorialActive && currentSubStep?.targetId) {
            const measureTarget = () => {
                const ref = targetRefs.current[currentSubStep.targetId!];
                if (ref) {
                    ref.measureInWindow((x: number, y: number, width: number, height: number) => {
                        // 유효한 측정값인 경우에만 업데이트
                        if (width > 0 && height > 0) {
                            setTargetLayout(prev => {
                                // 위치가 변경된 경우에만 상태 업데이트
                                if (!prev || prev.x !== x || prev.y !== y) {
                                    return { x, y, width, height };
                                }
                                return prev;
                            });
                        }
                    });
                } else {
                    setTargetLayout(null);
                }
            };

            // 초기 측정 (약간의 지연 후)
            const initialTimer = setTimeout(measureTarget, 0.5);

            // 스크롤 대응을 위해 주기적으로 위치 측정 (0.5ms 간격)
            const interval = setInterval(measureTarget, 0.5);

            return () => {
                clearTimeout(initialTimer);
                clearInterval(interval);
            };
        } else {
            setTargetLayout(null);
        }
    }, [isTutorialActive, currentSubStep]);

    // 자동 진행 처리
    useEffect(() => {
        if (currentSubStep?.autoComplete && currentSubStep?.delay) {
            const timer = setTimeout(() => {
                nextSubStep();
            }, currentSubStep.delay);
            return () => clearTimeout(timer);
        }
    }, [currentSubStep, nextSubStep]);

    if (!isTutorialActive || !currentSubStep || !currentStepData) {
        return null;
    }

    // 현재 진행률
    const totalSubSteps = currentStepData.subSteps.length;
    const isCompleteStep = currentStep === 'COMPLETE';
    const isAutoComplete = currentSubStep.autoComplete;
    const position = currentSubStep.position || 'top'; // 기본값 상단

    // 동적 스타일 계산
    const getBarStyle = () => {
        const baseStyle: any = {
            transform: [{ translateY: slideAnim }]
        };

        // center 위치인 경우 화면 중앙에 배치
        if (position === 'center') {
            const screenHeight = Dimensions.get('window').height;
            baseStyle.top = (screenHeight / 2) - 50; // 툴팁 높이의 절반을 빼서 정중앙
            baseStyle.bottom = undefined;
            return baseStyle;
        }

        if (targetLayout) {
            if (position === 'top') {
                // 타겟 바로 위에 표시
                const screenHeight = Dimensions.get('window').height;
                baseStyle.bottom = screenHeight - targetLayout.y + 12;
                baseStyle.top = undefined;
            } else {
                // 타겟 바로 아래에 표시
                baseStyle.top = targetLayout.y + targetLayout.height + 12;
                baseStyle.bottom = undefined;
            }
        } else {
            // 타겟 없을 경우 기본 위치 (상단/하단)
            if (position === 'bottom') {
                baseStyle.bottom = insets.bottom + 80;
                baseStyle.top = undefined;
            } else {
                baseStyle.top = insets.top + 8;
                baseStyle.bottom = undefined;
            }
        }
        return baseStyle;
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* 타겟 요소 하이라이트 박스 - 특정 section만 표시 */}
            {targetLayout && currentSubStep?.targetId &&
                ['section_duration_nights', 'section_date', 'section_time', 'section_duration'].includes(currentSubStep.targetId) && (
                    <View
                        style={[
                            styles.targetHighlight,
                            {
                                position: 'absolute',
                                left: targetLayout.x - 10,
                                top: targetLayout.y - 10,
                                width: targetLayout.width + 20,
                                height: targetLayout.height + 20,
                            }
                        ]}
                        pointerEvents="none"
                    />
                )}

            {/* 컴팩트 메시지 바 */}
            <Animated.View
                style={[
                    styles.compactBar,
                    getBarStyle(),
                    {
                        borderWidth: 2,
                        borderColor: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [COLORS.primaryMain || '#E0E7FF', COLORS.primaryDark]
                        }),
                        shadowColor: COLORS.primaryMain,
                        shadowOpacity: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.15, 0.5]
                        }),
                        shadowRadius: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 20]
                        }),
                    }
                ]}
                pointerEvents="auto"
            >
                {/* 상단: 진행률 표시 + 닫기 버튼 */}
                <View style={styles.topRow}>
                    <View style={styles.progressDots}>
                        {Array.from({ length: totalSubSteps }).map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i <= currentSubStepIndex && styles.dotActive
                                ]}
                            />
                        ))}
                    </View>
                    {!isCompleteStep && (
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => setShowSkipModal(true)}
                        >
                            <X size={16} color={COLORS.neutral400 || '#94A3B8'} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* 메시지 */}
                <Text style={styles.compactMessage}>
                    {currentSubStep.message}
                </Text>

                {/* 하단: 버튼 */}
                <View style={styles.bottomRow}>
                    {/* 이전 버튼 */}
                    {currentSubStepIndex > 0 && !isAutoComplete && (
                        <TouchableOpacity
                            style={styles.prevBtn}
                            onPress={prevSubStep}
                        >
                            <ChevronLeft size={14} color={COLORS.primaryDark} />
                            <Text style={styles.prevBtnText}>이전</Text>
                        </TouchableOpacity>
                    )}

                    {isAutoComplete ? (
                        <View style={styles.loadingIndicator}>
                            <Animated.View
                                style={[styles.loadingDot, { transform: [{ scale: pulseAnim }] }]}
                            />
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.nextBtn}
                            onPress={isCompleteStep ? completeTutorial : nextSubStep}
                        >
                            <Text style={styles.nextBtnText}>
                                {isCompleteStep ? '완료' : '다음'}
                            </Text>
                            <ChevronRight size={14} color={COLORS.white} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>

            {/* 스킵 확인 모달 */}
            <Modal
                visible={showSkipModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSkipModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>튜토리얼을 건너뛰시겠습니까?</Text>
                        <Text style={styles.modalMessage}>나중에 프로필 메뉴에서 다시 시작할 수 있습니다.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowSkipModal(false)}
                            >
                                <Text style={styles.modalCancelText}>계속하기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={() => {
                                    setShowSkipModal(false);
                                    skipTutorial();
                                }}
                            >
                                <Text style={styles.modalConfirmText}>건너뛰기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    targetHighlight: {
        borderWidth: 2,
        borderColor: COLORS.primaryDark,
        borderRadius: 12,
        backgroundColor: 'transparent',
        shadowColor: COLORS.primaryMain,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    compactBar: {
        position: 'absolute',
        left: 12,
        right: 12,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'column',  // 세로 레이아웃으로 변경
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 10,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressDots: {
        flexDirection: 'row',
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#E2E8F0',
        marginRight: 3,
    },
    dotActive: {
        backgroundColor: COLORS.primaryDark,
    },
    compactMessage: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutralSlate || '#334155',
        lineHeight: 22,
        marginBottom: 12,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryDark,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    nextBtnText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: 'bold',
        marginRight: 2,
    },
    skipBtn: {
        padding: 4,
    },
    loadingIndicator: {
        paddingHorizontal: 12,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primaryDark,
    },
    prevBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.primaryDark,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        marginRight: 8,
    },
    prevBtnText: {
        color: COLORS.primaryDark,
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 32,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.neutralSlate || '#334155',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        color: COLORS.neutral400 || '#94A3B8',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: COLORS.neutral100 || '#F1F5F9',
    },
    modalCancelText: {
        color: COLORS.neutralSlate || '#334155',
        fontSize: 14,
        fontWeight: '600',
    },
    modalConfirmBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: COLORS.primaryDark,
    },
    modalConfirmText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default TutorialOverlay;
