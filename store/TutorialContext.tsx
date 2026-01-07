import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 각 화면별 튜토리얼 키
export type TutorialScreen = 'home' | 'request' | 'chat' | 'event';

// 아이템 위치 타입
export type ItemPosition = 'top-left' | 'top-right' | 'top-center' | 'center' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'mid-center-left' | 'mid-center-right' | 'custom-friend-select' | 'custom-time-select' | 'custom-send-btn';

// 각 화면별 튜토리얼 설정
export interface TutorialItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    position: ItemPosition;
    arrowDirection?: 'up' | 'down' | 'left' | 'right' | 'none'; // 화살표 방향 지정
}

export const SCREEN_TUTORIALS: Record<TutorialScreen, {
    title: string;
    subtitle: string;
    items: TutorialItem[];
}> = {
    home: {
        title: '홈 화면',
        subtitle: '캘린더와 일정을 한눈에 확인하세요',
        items: [
            {
                id: 'notification',
                title: '알림',
                description: '새로운 일정 요청과\n알림을 확인하세요',
                icon: 'notifications-outline',
                position: 'top-right',
            },
            {
                id: 'calendar',
                title: '캘린더',
                description: '날짜를 선택하면\n해당 날짜의 일정을 볼 수 있어요',
                icon: 'calendar-outline',
                position: 'center',
            },
            {
                id: 'add-schedule',
                title: '일정 추가',
                description: '새로운 일정을\n추가할 수 있어요',
                icon: 'add-circle-outline',
                position: 'bottom-right',
            },
        ],
    },
    request: {
        title: '일정 요청',
        subtitle: '친구에게 일정을 요청해보세요',
        items: [
            {
                id: 'friend-select',
                title: '친구 선택',
                description: '함께할 친구들을\n선택하세요',
                icon: 'people-outline',
                position: 'custom-friend-select', // 커스텀 위치
            },
            {
                id: 'date-time',
                title: '날짜/시간',
                description: '원하는 날짜와\n시간을 선택하세요',
                icon: 'time-outline',
                position: 'custom-time-select', // 커스텀 위치
            },
            {
                id: 'send-request',
                title: '요청 보내기',
                description: 'AI가 자동으로\n일정을 조율해드려요',
                icon: 'send-outline',
                position: 'custom-send-btn', // 커스텀 위치 (하단 탭 위)
            },
        ],
    },
    chat: {
        title: '채팅',
        subtitle: 'AI와 대화하며 일정을 조율하세요',
        items: [
            {
                id: 'ai-chat',
                title: 'AI 채팅',
                description: '자연어로 일정을\n요청할 수 있어요',
                icon: 'chatbubble-outline',
                position: 'mid-center-left', // 화면 중앙 좌측
            },
            {
                id: 'chat-history',
                title: '대화 기록',
                description: '이전 대화 내용을\n확인할 수 있어요',
                icon: 'list-outline',
                position: 'mid-center-right', // 화면 중앙 우측
            },
        ],
    },
    event: {
        title: '일정 협의',
        subtitle: '협의 중인 일정을 관리하세요',
        items: [
            {
                id: 'waiting',
                title: '대기 중 일정',
                description: '협의가 필요한\n일정들이에요',
                icon: 'hourglass-outline',
                position: 'top-left',
            },
            {
                id: 'reschedule',
                title: '재조율',
                description: '다른 시간을\n제안할 수 있어요',
                icon: 'refresh-outline',
                position: 'bottom-left',
            },
            {
                id: 'approve',
                title: '승인/거절',
                description: '일정을 승인하거나\n거절할 수 있어요',
                icon: 'checkmark-circle-outline',
                position: 'bottom-right',
            }
        ],
    },
};

interface TutorialContextType {
    activeScreen: TutorialScreen | null;
    showScreenTutorial: (screen: TutorialScreen) => void;
    hideScreenTutorial: () => void;
    checkAndShowTutorial: (screen: TutorialScreen) => Promise<boolean>;
    markTutorialComplete: (screen: TutorialScreen) => Promise<void>;
    isNewUser: boolean;
    setIsNewUser: (value: boolean) => void;
    resetTutorialState: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

interface TutorialProviderProps {
    children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
    const [activeScreen, setActiveScreen] = useState<TutorialScreen | null>(null);
    const [isNewUser, setIsNewUser] = useState(false);
    const [completedTutorials, setCompletedTutorials] = useState<Set<TutorialScreen>>(new Set());

    useEffect(() => {
        const loadTutorialState = async () => {
            try {
                const newUserFlag = await AsyncStorage.getItem('isNewUser');
                setIsNewUser(newUserFlag === 'true');

                const completed = await AsyncStorage.getItem('completedTutorials');
                if (completed) {
                    setCompletedTutorials(new Set(JSON.parse(completed)));
                }
            } catch (error) {
                console.error('Failed to load tutorial state:', error);
            }
        };
        loadTutorialState();
    }, []);

    const showScreenTutorial = useCallback((screen: TutorialScreen) => {
        setActiveScreen(screen);
    }, []);

    const hideScreenTutorial = useCallback(() => {
        setActiveScreen(null);
    }, []);

    const markTutorialComplete = useCallback(async (screen: TutorialScreen) => {
        const newCompleted = new Set(completedTutorials);
        newCompleted.add(screen);
        setCompletedTutorials(newCompleted);
        setActiveScreen(null);

        try {
            await AsyncStorage.setItem('completedTutorials', JSON.stringify([...newCompleted]));

            if (newCompleted.size >= 4) {
                await AsyncStorage.removeItem('isNewUser');
                setIsNewUser(false);
            }
        } catch (error) {
            console.error('Failed to save tutorial completion:', error);
        }
    }, [completedTutorials]);

    const checkAndShowTutorial = useCallback(async (screen: TutorialScreen): Promise<boolean> => {
        try {
            console.log(`[Tutorial] Checking ${screen}: context.isNewUser=${isNewUser}`);

            // Context state priority check (for immediate updates after register)
            if (!isNewUser) {
                // Double check storage just in case state wasn't synced yet (fallback)
                const persistedFlag = await AsyncStorage.getItem('isNewUser');
                if (persistedFlag !== 'true') {
                    console.log(`[Tutorial] ${screen} skipped: Not a new user`);
                    return false;
                }
            }

            // Check State first (Source of Truth for active session)
            if (!completedTutorials.has(screen)) {
                console.log(`[Tutorial] Triggering ${screen} tutorial`);
                setTimeout(() => {
                    showScreenTutorial(screen);
                }, 600);
                return true;
            } else {
                console.log(`[Tutorial] ${screen} skipped: Already completed in state`);
            }
            return false;
        } catch (error) {
            console.error('Failed to check tutorial status:', error);
            return false;
        }
    }, [showScreenTutorial, isNewUser, completedTutorials]);

    const resetTutorialState = useCallback(async () => {
        console.log('[Tutorial] Resetting all tutorial state for new user');
        setIsNewUser(true);
        setCompletedTutorials(new Set());
        setActiveScreen(null);
        try {
            await AsyncStorage.setItem('isNewUser', 'true');
            await AsyncStorage.removeItem('completedTutorials');
        } catch (error) {
            console.error('Failed to reset tutorial state:', error);
        }
    }, []);

    return (
        <TutorialContext.Provider
            value={{
                activeScreen,
                showScreenTutorial,
                hideScreenTutorial,
                checkAndShowTutorial,
                markTutorialComplete,
                isNewUser,
                setIsNewUser,
                resetTutorialState,
            }}
        >
            {children}
        </TutorialContext.Provider>
    );
};

export default TutorialContext;
