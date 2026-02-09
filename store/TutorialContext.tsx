import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from '../utils/environment';
import {
    TUTORIAL_STEPS,
    TutorialStep,
    SubStep,
    TutorialStepData,
    TUTORIAL_GUIDE,
    FAKE_FRIEND_REQUEST,
    FAKE_A2A_REQUEST,
    FAKE_CONFIRMED_SCHEDULE
} from '../constants/tutorialData';

// AsyncStorage 키
const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';
const TUTORIAL_SKIPPED_KEY = 'tutorial_skipped';
const TUTORIAL_ACTIVE_KEY = 'tutorial_active';
const TUTORIAL_STEP_KEY = 'tutorial_current_step';
const TUTORIAL_SUBSTEP_KEY = 'tutorial_current_substep';

// Context 타입 정의
interface TutorialContextType {
    // 상태
    isTutorialActive: boolean;
    currentStep: TutorialStep;
    currentSubStepIndex: number;
    currentStepData: TutorialStepData | null;
    currentSubStep: SubStep | null;
    isCompleted: boolean;

    // 튜토리얼용 데이터
    ghostFriend: typeof TUTORIAL_GUIDE;
    fakeFriendRequest: typeof FAKE_FRIEND_REQUEST;
    fakeRequest: typeof FAKE_A2A_REQUEST;
    fakeSchedule: typeof FAKE_CONFIRMED_SCHEDULE;
    tutorialFriendAdded: boolean;
    tutorialRequestSent: boolean;

    // 액션
    startTutorial: () => void;
    skipTutorial: () => void;
    nextSubStep: () => void;
    prevSubStep: () => void;
    goToStep: (step: TutorialStep) => void;
    completeTutorial: () => void;
    resetTutorial: () => Promise<void>;
    deactivateTutorial: () => Promise<void>;

    // 튜토리얼 친구 추가 완료 표시
    markTutorialFriendAdded: () => void;
    markTutorialRequestSent: () => void;

    // 유틸리티
    isHighlighted: (targetId: string) => boolean;
    shouldAutoFill: (targetId: string) => string | null;

    // 타겟 요소 Layout 등록
    registerTarget: (id: string, ref: any) => void;
    unregisterTarget: (id: string) => void;
    targetRefs: React.MutableRefObject<Record<string, any>>;

    // 액션 콜백 등록 (다음 버튼 누를 때 자동 실행용)
    registerActionCallback: (targetId: string, callback: () => void) => void;
    unregisterActionCallback: (targetId: string) => void;
    triggerCurrentAction: () => boolean; // 현재 타겟의 액션 실행, 성공 시 true
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Provider Props
interface TutorialProviderProps {
    children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
    // 튜토리얼 상태
    const [isTutorialActive, setIsTutorialActive] = useState(false);
    const [currentStep, setCurrentStep] = useState<TutorialStep>('INTRO');
    const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);

    // 튜토리얼 진행 상태
    const [tutorialFriendAdded, setTutorialFriendAdded] = useState(false);
    const [tutorialRequestSent, setTutorialRequestSent] = useState(false);

    // 액션 콜백 저장소
    const actionCallbacks = useRef<Record<string, () => void>>({});

    // 타겟 Refs 저장소
    const targetRefs = React.useRef<Record<string, any>>({});

    // 현재 단계 데이터
    const currentStepData = TUTORIAL_STEPS.find(s => s.step === currentStep) || null;
    const currentSubStep = currentStepData?.subSteps[currentSubStepIndex] || null;

    // 초기 로드 - 튜토리얼 완료 여부 및 진행 상태 확인
    useEffect(() => {
        const checkTutorialStatus = async () => {
            try {
                const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
                const skipped = await AsyncStorage.getItem(TUTORIAL_SKIPPED_KEY);

                if (completed === 'true' || skipped === 'true') {
                    setIsCompleted(true);
                    return;
                }

                // 튜토리얼이 진행 중이었는지 확인하고 복원
                const wasActive = await AsyncStorage.getItem(TUTORIAL_ACTIVE_KEY);
                if (wasActive === 'true') {
                    const savedStep = await AsyncStorage.getItem(TUTORIAL_STEP_KEY);
                    const savedSubStep = await AsyncStorage.getItem(TUTORIAL_SUBSTEP_KEY);

                    setIsTutorialActive(true);
                    if (savedStep) {
                        setCurrentStep(savedStep as TutorialStep);
                    }
                    if (savedSubStep) {
                        setCurrentSubStepIndex(parseInt(savedSubStep, 10));
                    }
                    console.log('[Tutorial] Restored tutorial state:', savedStep, savedSubStep);
                }
            } catch (error) {
                console.error('Failed to check tutorial status:', error);
            }
        };

        checkTutorialStatus();
    }, []);

    // 튜토리얼 시작
    const startTutorial = useCallback(async () => {
        console.log('[Tutorial] Starting tutorial');
        setIsTutorialActive(true);
        setCurrentStep('INTRO');
        setCurrentSubStepIndex(0);
        setTutorialFriendAdded(false);
        setTutorialRequestSent(false);

        // 상태 저장
        try {
            await AsyncStorage.setItem(TUTORIAL_ACTIVE_KEY, 'true');
            await AsyncStorage.setItem(TUTORIAL_STEP_KEY, 'INTRO');
            await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, '0');
        } catch (error) {
            console.error('Failed to save tutorial start state:', error);
        }
    }, []);

    // 튜토리얼 건너뛰기
    const skipTutorial = useCallback(async () => {
        console.log('[Tutorial] Skipping tutorial');
        setIsTutorialActive(false);
        setIsCompleted(true);
        try {
            await AsyncStorage.setItem(TUTORIAL_SKIPPED_KEY, 'true');
            // 진행 상태 삭제
            await AsyncStorage.removeItem(TUTORIAL_ACTIVE_KEY);
            await AsyncStorage.removeItem(TUTORIAL_STEP_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SUBSTEP_KEY);
        } catch (error) {
            console.error('Failed to save skip status:', error);
        }
    }, []);

    // 다음 세부 단계로 이동
    const nextSubStep = useCallback(async () => {
        if (!currentStepData) return;

        const nextIndex = currentSubStepIndex + 1;

        if (nextIndex < currentStepData.subSteps.length) {
            // 같은 단계 내에서 다음 세부 단계로
            setCurrentSubStepIndex(nextIndex);
            // 상태 저장
            try {
                await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, nextIndex.toString());
            } catch (error) {
                console.error('Failed to save substep:', error);
            }
        } else {
            // 다음 메인 단계로
            const currentStepIdx = TUTORIAL_STEPS.findIndex(s => s.step === currentStep);

            if (currentStepIdx < TUTORIAL_STEPS.length - 1) {
                const nextStep = TUTORIAL_STEPS[currentStepIdx + 1];
                setCurrentStep(nextStep.step);
                setCurrentSubStepIndex(0);
                // 상태 저장
                try {
                    await AsyncStorage.setItem(TUTORIAL_STEP_KEY, nextStep.step);
                    await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, '0');
                } catch (error) {
                    console.error('Failed to save step:', error);
                }
            } else {
                // 마지막 단계 완료
                completeTutorial();
            }
        }
    }, [currentStep, currentSubStepIndex, currentStepData]);

    // 이전 세부 단계로 이동
    const prevSubStep = useCallback(async () => {
        if (currentSubStepIndex > 0) {
            const newIndex = currentSubStepIndex - 1;
            setCurrentSubStepIndex(newIndex);
            try {
                await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, newIndex.toString());
            } catch (error) {
                console.error('Failed to save substep:', error);
            }
        } else {
            // 이전 메인 단계로
            const currentStepIdx = TUTORIAL_STEPS.findIndex(s => s.step === currentStep);

            if (currentStepIdx > 0) {
                const prevStep = TUTORIAL_STEPS[currentStepIdx - 1];
                const newSubIndex = prevStep.subSteps.length - 1;
                setCurrentStep(prevStep.step);
                setCurrentSubStepIndex(newSubIndex);
                try {
                    await AsyncStorage.setItem(TUTORIAL_STEP_KEY, prevStep.step);
                    await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, newSubIndex.toString());
                } catch (error) {
                    console.error('Failed to save step:', error);
                }
            }
        }
    }, [currentStep, currentSubStepIndex]);

    // 특정 단계로 이동
    const goToStep = useCallback(async (step: TutorialStep) => {
        setCurrentStep(step);
        setCurrentSubStepIndex(0);
        try {
            await AsyncStorage.setItem(TUTORIAL_STEP_KEY, step);
            await AsyncStorage.setItem(TUTORIAL_SUBSTEP_KEY, '0');
        } catch (error) {
            console.error('Failed to save step:', error);
        }
    }, []);

    // 튜토리얼 완료
    const completeTutorial = useCallback(async () => {
        console.log('[Tutorial] Completing tutorial');
        setIsTutorialActive(false);
        setIsCompleted(true);
        setTutorialFriendAdded(false);  // 가상 친구 상태 초기화

        try {
            await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
            // 진행 상태 삭제
            await AsyncStorage.removeItem(TUTORIAL_ACTIVE_KEY);
            await AsyncStorage.removeItem(TUTORIAL_STEP_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SUBSTEP_KEY);

            // 튜토리얼 가이드 친구 삭제 시도 (실제 DB에 있는 경우)
            const token = await AsyncStorage.getItem('accessToken');
            if (token) {
                try {
                    // 먼저 실제 유저인지 확인하고 삭제 시도
                    const response = await fetch(`${getBackendUrl()}/friends/${TUTORIAL_GUIDE.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    });
                    if (response.ok) {
                        console.log('[Tutorial] Tutorial guide friend deleted successfully');
                    } else {
                        // 가상 친구인 경우 404 에러는 정상
                        console.log('[Tutorial] Tutorial guide was virtual (not in DB)');
                    }
                } catch (deleteError) {
                    console.log('[Tutorial] Error deleting tutorial guide friend:', deleteError);
                }
            }

            // friendsStore 캐시 무효화하여 가상 친구가 표시되지 않도록 함
            // (tutorialFriendAdded = false가 되면 displayedFriends에서 가상 친구가 제외됨)
        } catch (error) {
            console.error('Failed to save completion status:', error);
        }
    }, []);

    // 튜토리얼 초기화 (다시 보기용)
    const resetTutorial = useCallback(async () => {
        console.log('[Tutorial] Resetting tutorial');
        try {
            await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SKIPPED_KEY);
            await AsyncStorage.removeItem(TUTORIAL_ACTIVE_KEY);
            await AsyncStorage.removeItem(TUTORIAL_STEP_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SUBSTEP_KEY);
            setIsCompleted(false);
            setTutorialFriendAdded(false);
            setTutorialRequestSent(false);
            startTutorial();
        } catch (error) {
            console.error('Failed to reset tutorial:', error);
        }
    }, [startTutorial]);

    // 튜토리얼 비활성화 (로그아웃 시 사용)
    const deactivateTutorial = useCallback(async () => {
        console.log('[Tutorial] Deactivating tutorial for logout');
        setIsTutorialActive(false);
        setIsCompleted(false);
        setCurrentStep('INTRO');
        setCurrentSubStepIndex(0);
        setTutorialFriendAdded(false);
        setTutorialRequestSent(false);
        try {
            await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SKIPPED_KEY);
            await AsyncStorage.removeItem(TUTORIAL_ACTIVE_KEY);
            await AsyncStorage.removeItem(TUTORIAL_STEP_KEY);
            await AsyncStorage.removeItem(TUTORIAL_SUBSTEP_KEY);
        } catch (error) {
            console.error('Failed to deactivate tutorial:', error);
        }
    }, []);

    // 튜토리얼 친구 추가 완료 표시
    const markTutorialFriendAdded = useCallback(() => {
        console.log('[Tutorial] Tutorial friend added');
        setTutorialFriendAdded(true);
    }, []);

    // 튜토리얼 요청 전송 완료 표시
    const markTutorialRequestSent = useCallback(() => {
        console.log('[Tutorial] Tutorial request sent');
        setTutorialRequestSent(true);
    }, []);

    // 특정 요소가 현재 하이라이트 대상인지 확인
    const isHighlighted = useCallback((targetId: string): boolean => {
        if (!isTutorialActive || !currentSubStep) return false;
        return currentSubStep.targetId === targetId;
    }, [isTutorialActive, currentSubStep]);

    // 자동 입력 값 반환
    const shouldAutoFill = useCallback((targetId: string): string | null => {
        if (!isTutorialActive || !currentSubStep) return null;
        if (currentSubStep.targetId === targetId && currentSubStep.autoFill) {
            return currentSubStep.autoFill;
        }
        return null;
    }, [isTutorialActive, currentSubStep]);

    // 타겟 등록 함수
    const registerTarget = useCallback((id: string, ref: any) => {
        if (ref) {
            targetRefs.current[id] = ref;
        }
    }, []);

    const unregisterTarget = useCallback((id: string) => {
        delete targetRefs.current[id];
    }, []);

    // 액션 콜백 등록/해제 함수
    const registerActionCallback = useCallback((targetId: string, callback: () => void) => {
        actionCallbacks.current[targetId] = callback;
    }, []);

    const unregisterActionCallback = useCallback((targetId: string) => {
        delete actionCallbacks.current[targetId];
    }, []);

    // 현재 타겟의 액션 실행
    const triggerCurrentAction = useCallback(() => {
        if (currentSubStep?.targetId && currentSubStep?.action) {
            const callback = actionCallbacks.current[currentSubStep.targetId];
            if (callback) {
                callback();
                return true;
            }
        }
        return false;
    }, [currentSubStep]);

    const value: TutorialContextType = {
        // 상태
        isTutorialActive,
        currentStep,
        currentSubStepIndex,
        currentStepData,
        currentSubStep,
        isCompleted,

        // 튜토리얼용 데이터
        ghostFriend: TUTORIAL_GUIDE,
        fakeFriendRequest: FAKE_FRIEND_REQUEST,
        fakeRequest: FAKE_A2A_REQUEST,
        fakeSchedule: FAKE_CONFIRMED_SCHEDULE,
        tutorialFriendAdded,
        tutorialRequestSent,

        // 액션
        startTutorial,
        skipTutorial,
        nextSubStep,
        prevSubStep,
        goToStep,
        completeTutorial,
        resetTutorial,
        deactivateTutorial,
        markTutorialFriendAdded,
        markTutorialRequestSent,

        // 유틸리티
        isHighlighted,
        shouldAutoFill,
        targetRefs,
        registerTarget,
        unregisterTarget,

        // 액션 콜백
        registerActionCallback,
        unregisterActionCallback,
        triggerCurrentAction,
    };

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
};

// Hook
export const useTutorial = (): TutorialContextType => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

export default TutorialContext;
