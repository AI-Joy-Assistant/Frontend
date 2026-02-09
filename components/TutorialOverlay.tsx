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
import { TUTORIAL_STEPS } from '../constants/tutorialData';

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
        triggerCurrentAction,
    } = useTutorial();

    // 스킵 확인 모달 상태
    const [showSkipModal, setShowSkipModal] = useState(false);

    // 타겟 레이아웃 상태
    const [targetLayout, setTargetLayout] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // 애니메이션 값
    const slideAnim = useRef(new Animated.Value(-100)).current;

    // 표시 애니메이션
    useEffect(() => {
        if (isTutorialActive && currentSubStep) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: false,
                tension: 50,
                friction: 8,
            }).start();
        }
    }, [isTutorialActive, currentSubStep, currentSubStepIndex]);

    // 타겟 위치 측정 (requestAnimationFrame 사용)
    useEffect(() => {
        if (!isTutorialActive || !currentSubStep?.targetId) {
            setTargetLayout(null);
            return;
        }

        let animationFrameId: number;

        const updatePosition = () => {
            const targetRef = targetRefs.current[currentSubStep.targetId!];

            if (targetRef && targetRef.measure) {
                targetRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                    if (width > 0 && height > 0) {
                        setTargetLayout(prev => {
                            if (prev &&
                                Math.abs(prev.x - pageX) < 1 &&
                                Math.abs(prev.y - pageY) < 1 &&
                                Math.abs(prev.width - width) < 1 &&
                                Math.abs(prev.height - height) < 1
                            ) {
                                return prev;
                            }
                            return { x: pageX, y: pageY, width, height };
                        });
                    }
                });
            } else {
                setTargetLayout(null);
            }

            animationFrameId = requestAnimationFrame(updatePosition);
        };

        updatePosition();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isTutorialActive, currentSubStep, targetRefs]);

    // 자동 진행 처리
    useEffect(() => {
        if (currentSubStep?.autoComplete && currentSubStep?.delay) {
            const timer = setTimeout(() => {
                nextSubStep();
            }, currentSubStep.delay);
            return () => clearTimeout(timer);
        }
    }, [currentSubStep, nextSubStep]);

    // 렌더링 조건 체크
    if (!isTutorialActive || !currentSubStep || !currentStepData) {
        return null;
    }

    const totalSubSteps = currentStepData.subSteps.length;
    const isCompleteStep = currentStep === 'COMPLETE';
    const position = currentSubStep.position || 'top';

    // 툴팁 위치 계산
    const getTooltipStyle = () => {
        const screenHeight = Dimensions.get('window').height;
        const tooltipHeight = 160;
        const safeTop = insets.top + 10;
        const safeBottom = insets.bottom + 90;

        const baseStyle: any = {
            position: 'absolute',
            left: 16,
            right: 16,
            transform: [{ translateY: slideAnim }],
        };

        // screen_top: 항상 화면 상단에 배치
        if (position === 'screen_top') {
            baseStyle.top = safeTop + 10;
            return baseStyle;
        }

        // center: 화면 중앙에 배치
        if (position === 'center') {
            baseStyle.top = (screenHeight / 2) - (tooltipHeight / 2);
            return baseStyle;
        }

        // 타겟이 있는 경우
        if (targetLayout && targetLayout.y > 0) {
            const targetCenterY = targetLayout.y + targetLayout.height / 2;
            const isTargetInUpperHalf = targetCenterY < screenHeight / 2;

            if (position === 'top' || (position !== 'bottom' && !isTargetInUpperHalf)) {
                // 타겟 위에 표시
                let topPosition = targetLayout.y - tooltipHeight - 16;
                if (topPosition < safeTop) {
                    topPosition = targetLayout.y + targetLayout.height + 16;
                }
                baseStyle.top = Math.max(safeTop, topPosition);
            } else {
                // 타겟 아래에 표시
                let topPosition = targetLayout.y + targetLayout.height + 16;
                if (topPosition + tooltipHeight > screenHeight - safeBottom) {
                    topPosition = targetLayout.y - tooltipHeight - 16;
                }
                baseStyle.top = Math.max(safeTop, topPosition);
            }
        } else {
            // 타겟 없는 경우
            if (position === 'bottom') {
                baseStyle.bottom = safeBottom;
            } else {
                baseStyle.top = safeTop + 50;
            }
        }

        return baseStyle;
    };

    // 다음 버튼 핸들러
    const handleNext = () => {
        if (isCompleteStep) {
            completeTutorial();
        } else if (currentSubStep?.action && triggerCurrentAction()) {
            // 액션이 트리거되면 콜백 내에서 nextSubStep 처리
        } else {
            nextSubStep();
        }
    };

    // 단계 표시 텍스트
    const getStepLabel = () => {
        if (currentStep === 'INTRO') return '시작';
        if (currentStep === 'COMPLETE') return '완료';
        const stepIndex = TUTORIAL_STEPS.findIndex(s => s.step === currentStep);
        return `${stepIndex + 1}/${TUTORIAL_STEPS.length - 2}`;
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* 반투명 마스크 - 타겟 영역만 구멍 뚫기 */}
            {targetLayout ? (
                <>
                    {/* 상단 마스크 */}
                    <View
                        style={[styles.mask, {
                            top: 0,
                            left: 0,
                            right: 0,
                            height: Math.max(0, targetLayout.y - 4)
                        }]}
                        pointerEvents="auto"
                    />
                    {/* 하단 마스크 */}
                    <View
                        style={[styles.mask, {
                            top: targetLayout.y + targetLayout.height + 4,
                            left: 0,
                            right: 0,
                            bottom: 0
                        }]}
                        pointerEvents="auto"
                    />
                    {/* 좌측 마스크 */}
                    <View
                        style={[styles.mask, {
                            top: targetLayout.y - 4,
                            left: 0,
                            width: Math.max(0, targetLayout.x - 4),
                            height: targetLayout.height + 8
                        }]}
                        pointerEvents="auto"
                    />
                    {/* 우측 마스크 */}
                    <View
                        style={[styles.mask, {
                            top: targetLayout.y - 4,
                            left: targetLayout.x + targetLayout.width + 4,
                            right: 0,
                            height: targetLayout.height + 8
                        }]}
                        pointerEvents="auto"
                    />
                </>
            ) : null}


            {/* 툴팁 */}
            <Animated.View style={[styles.tooltip, getTooltipStyle()]} pointerEvents="box-none">
                {/* 헤더 */}
                <View style={styles.tooltipHeader}>
                    {/* 진행률 표시 */}
                    <View style={styles.progressContainer}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>{getStepLabel()}</Text>
                        </View>
                        <View style={styles.progressDots}>
                            {Array.from({ length: totalSubSteps }).map((_, i) => (
                                <View
                                    key={i}
                                    style={[styles.dot, i <= currentSubStepIndex && styles.dotActive]}
                                />
                            ))}
                        </View>
                    </View>
                    {/* 닫기 버튼 */}
                    {!isCompleteStep && (
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setShowSkipModal(true)}
                        >
                            <X size={18} color={COLORS.neutral400} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* 단계 제목 */}
                {currentStepData?.title && (
                    <Text style={styles.tooltipTitle}>{currentStepData.title}</Text>
                )}

                {/* 메시지 */}
                <Text style={styles.tooltipMessage}>{currentSubStep.message}</Text>

                {/* 버튼 영역 */}
                <View style={styles.buttonRow}>
                    {/* 이전 버튼 */}
                    {currentSubStepIndex > 0 && (
                        <TouchableOpacity style={styles.prevBtn} onPress={prevSubStep}>
                            <ChevronLeft size={16} color={COLORS.primaryDark} />
                            <Text style={styles.prevBtnText}>이전</Text>
                        </TouchableOpacity>
                    )}

                    {/* 다음 버튼 */}
                    <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                        <Text style={styles.nextBtnText}>
                            {isCompleteStep ? '완료' : '다음'}
                        </Text>
                        <ChevronRight size={16} color={COLORS.white} />
                    </TouchableOpacity>
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
                        <Text style={styles.modalMessage}>
                            나중에 설정에서 다시 시작할 수 있습니다.
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowSkipModal(false)}
                            >
                                <Text style={styles.modalCancelText}>계속하기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={() => { setShowSkipModal(false); skipTutorial(); }}
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
    mask: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.01)', // 거의 투명하지만 터치는 차단
    },
    targetHighlight: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: COLORS.primaryMain,
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    tooltip: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    tooltipHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepBadge: {
        backgroundColor: COLORS.primaryBg || '#EDE9FE',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    stepBadgeText: {
        color: COLORS.primaryDark,
        fontSize: 12,
        fontWeight: '600',
    },
    progressDots: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
    },
    dotActive: {
        backgroundColor: COLORS.primaryDark,
    },
    closeBtn: {
        padding: 4,
    },
    tooltipTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.neutralSlate || '#1E293B',
        marginBottom: 8,
    },
    tooltipMessage: {
        fontSize: 14,
        color: COLORS.neutral600 || '#475569',
        lineHeight: 22,
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
    },
    prevBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.primaryDark,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    prevBtnText: {
        color: COLORS.primaryDark,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 2,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryDark,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    nextBtnText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '600',
        marginRight: 4,
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
        width: '85%',
        maxWidth: 320,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.neutralSlate || '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 14,
        color: COLORS.neutral500 || '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: COLORS.neutral100 || '#F1F5F9',
        alignItems: 'center',
    },
    modalCancelText: {
        color: COLORS.neutralSlate || '#334155',
        fontSize: 14,
        fontWeight: '600',
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: COLORS.primaryDark,
        alignItems: 'center',
    },
    modalConfirmText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default TutorialOverlay;
