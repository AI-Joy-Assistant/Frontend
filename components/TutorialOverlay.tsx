import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, X } from 'lucide-react-native';
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
        skipTutorial,
        completeTutorial,
        targetRefs,
    } = useTutorial();

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
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();

            // 펄스 애니메이션
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
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

    // 타겟 위치 측정
    useEffect(() => {
        if (isTutorialActive && currentSubStep?.targetId) {
            const ref = targetRefs.current[currentSubStep.targetId];
            if (ref) {
                // 약간의 지연 후 측정 (UI 렌더링 완료 대기)
                const timer = setTimeout(() => {
                    ref.measureInWindow((x: number, y: number, width: number, height: number) => {
                        console.log(`[Tutorial] Measured ${currentSubStep.targetId}:`, { x, y, width, height });
                        setTargetLayout({ x, y, width, height });
                    });
                }, 100);
                return () => clearTimeout(timer);
            } else {
                setTargetLayout(null);
            }
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
            {/* 컴팩트 메시지 바 */}
            <Animated.View
                style={[
                    styles.compactBar,
                    getBarStyle(),
                    {
                        borderWidth: 2,
                        borderColor: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [COLORS.primaryLight || '#E0E7FF', COLORS.primaryMain]
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
                {/* 진행률 표시 */}
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

                {/* 메시지 */}
                <Text style={styles.compactMessage}>
                    {currentSubStep.message}
                </Text>

                {/* 버튼들 */}
                <View style={styles.buttonRow}>
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

                    {!isCompleteStep && (
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={skipTutorial}
                        >
                            <X size={16} color={COLORS.neutral400 || '#94A3B8'} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    compactBar: {
        position: 'absolute',
        left: 12,
        right: 12,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 10,
    },
    progressDots: {
        flexDirection: 'row',
        marginRight: 12,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
        marginRight: 4,
    },
    dotActive: {
        backgroundColor: COLORS.primaryMain,
    },
    compactMessage: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutralSlate || '#334155',
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMain,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    nextBtnText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: 'bold',
        marginRight: 2,
    },
    skipBtn: {
        marginLeft: 8,
        padding: 4,
    },
    loadingIndicator: {
        paddingHorizontal: 12,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primaryLight,
    },
});

export default TutorialOverlay;
