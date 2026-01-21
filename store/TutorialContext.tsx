import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
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

    // 타겟 Refs 저장소
    const targetRefs = React.useRef<Record<string, any>>({});

    // 현재 단계 데이터
    const currentStepData = TUTORIAL_STEPS.find(s => s.step === currentStep) || null;
    const currentSubStep = currentStepData?.subSteps[currentSubStepIndex] || null;

    // 초기 로드 - 튜토리얼 완료 여부 확인
    useEffect(() => {
        const checkTutorialStatus = async () => {
            try {
                const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
                const skipped = await AsyncStorage.getItem(TUTORIAL_SKIPPED_KEY);

                if (completed === 'true' || skipped === 'true') {
                    setIsCompleted(true);
                }
            } catch (error) {
                console.error('Failed to check tutorial status:', error);
            }
        };

        checkTutorialStatus();
    }, []);

    // 튜토리얼 시작
    const startTutorial = useCallback(() => {
        console.log('[Tutorial] Starting tutorial');
        setIsTutorialActive(true);
        setCurrentStep('INTRO');
        setCurrentSubStepIndex(0);
        setTutorialFriendAdded(false);
        setTutorialRequestSent(false);
    }, []);

    // 튜토리얼 건너뛰기
    const skipTutorial = useCallback(async () => {
        console.log('[Tutorial] Skipping tutorial');
        setIsTutorialActive(false);
        setIsCompleted(true);
        try {
            await AsyncStorage.setItem(TUTORIAL_SKIPPED_KEY, 'true');
        } catch (error) {
            console.error('Failed to save skip status:', error);
        }
    }, []);

    // 다음 세부 단계로 이동
    const nextSubStep = useCallback(() => {
        if (!currentStepData) return;

        const nextIndex = currentSubStepIndex + 1;

        if (nextIndex < currentStepData.subSteps.length) {
            // 같은 단계 내에서 다음 세부 단계로
            setCurrentSubStepIndex(nextIndex);
        } else {
            // 다음 메인 단계로
            const currentStepIdx = TUTORIAL_STEPS.findIndex(s => s.step === currentStep);

            if (currentStepIdx < TUTORIAL_STEPS.length - 1) {
                const nextStep = TUTORIAL_STEPS[currentStepIdx + 1];
                setCurrentStep(nextStep.step);
                setCurrentSubStepIndex(0);
            } else {
                // 마지막 단계 완료
                completeTutorial();
            }
        }
    }, [currentStep, currentSubStepIndex, currentStepData]);

    // 이전 세부 단계로 이동
    const prevSubStep = useCallback(() => {
        if (currentSubStepIndex > 0) {
            setCurrentSubStepIndex(currentSubStepIndex - 1);
        } else {
            // 이전 메인 단계로
            const currentStepIdx = TUTORIAL_STEPS.findIndex(s => s.step === currentStep);

            if (currentStepIdx > 0) {
                const prevStep = TUTORIAL_STEPS[currentStepIdx - 1];
                setCurrentStep(prevStep.step);
                setCurrentSubStepIndex(prevStep.subSteps.length - 1);
            }
        }
    }, [currentStep, currentSubStepIndex]);

    // 특정 단계로 이동
    const goToStep = useCallback((step: TutorialStep) => {
        setCurrentStep(step);
        setCurrentSubStepIndex(0);
    }, []);

    // 튜토리얼 완료
    const completeTutorial = useCallback(async () => {
        console.log('[Tutorial] Completing tutorial');
        setIsTutorialActive(false);
        setIsCompleted(true);
        setTutorialFriendAdded(false);  // 가상 친구 상태 초기화

        try {
            await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');

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
            setIsCompleted(false);
            setTutorialFriendAdded(false);
            setTutorialRequestSent(false);
            startTutorial();
        } catch (error) {
            console.error('Failed to reset tutorial:', error);
        }
    }, [startTutorial]);

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
        markTutorialFriendAdded,
        markTutorialRequestSent,

        // 유틸리티
        isHighlighted,
        shouldAutoFill,
        targetRefs,
        registerTarget,
        unregisterTarget,
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
