/**
 * Tutorial Data - 튜토리얼 단계별 데이터 정의
 * 
 * 변경: 친구 추가 → 받은 친구 요청 수락 방식으로 변경
 */

// 튜토리얼용 가이드 계정 정보
export const TUTORIAL_GUIDE = {
    id: 'tutorial_guide_joyner',
    name: 'JOYNER 가이드',
    handle: 'joyner_guide',
    email: 'guide@joyner.app',
    picture: require('../assets/images/icon.png')
};

// 튜토리얼 단계 타입
export type TutorialStep =
    | 'INTRO'
    | 'ACCEPT_FRIEND'
    | 'CREATE_REQUEST'
    | 'VIEW_EVENTS'
    | 'RESPOND_TO_REQUEST'
    | 'CHECK_HOME'
    | 'EXPLORE_CHAT'
    | 'EXPLORE_FRIENDS'
    | 'COMPLETE';

// 세부 단계 타입
export interface SubStep {
    id: string;
    message: string;
    targetId?: string;
    autoFill?: string;
    autoComplete?: boolean;
    delay?: number;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'screen_top';
    action?: 'navigate' | 'click' | 'input' | 'wait';
}

export interface TutorialStepData {
    step: TutorialStep;
    title: string;
    description: string;
    subSteps: SubStep[];
}

// 튜토리얼 전체 데이터
export const TUTORIAL_STEPS: TutorialStepData[] = [
    {
        step: 'INTRO',
        title: '환영합니다! ',
        description: 'JOYNER 앱 사용법을 알려드릴게요.',
        subSteps: [
            {
                id: 'intro_welcome',
                message: 'JOYNER에 오신 것을 환영합니다! 🎉\n친구들과 일정을 조율하는 가장 스마트한 방법을 알려드릴게요.',
                position: 'center',
            },
            {
                id: 'intro_feature_1',
                message: 'JOYNER는 AI가 친구들의 캘린더를 분석해 모두가 가능한 최적의 시간을 찾아줍니다.',
                position: 'center',
            },
            {
                id: 'intro_feature_google',
                message: '🔗 Google 캘린더를 연동하면 기존 일정을 자동으로 불러와 충돌 없는 시간을 찾을 수 있어요.',
                position: 'center',
            },
            {
                id: 'intro_feature_2',
                message: '복잡한 대화 없이, 버튼 한 번으로 일정을 조율하고 확정할 수 있어요.',
                position: 'center',
            },
            {
                id: 'intro_start',
                message: '지금부터 간단한 튜토리얼을 시작해볼까요? 약 2분 정도 소요됩니다.',
                position: 'center',
            }
        ]
    },
    {
        step: 'ACCEPT_FRIEND',
        title: '친구 요청 수락',
        description: '받은 친구 요청을 수락해보세요.',
        subSteps: [
            {
                id: 'go_to_friends',
                message: '친구 탭을 눌러주세요',
                targetId: 'tab_friends',
                action: 'navigate'
            },
            {
                id: 'friends_page_intro',
                message: '여기는 친구 탭이에요!\n친구 목록을 확인하고, 새로운 친구를 추가하거나 친구 요청을 수락할 수 있어요.',
                position: 'center'
            },
            {
                id: 'go_to_requests',
                message: '"받은 요청" 탭을 눌러주세요',
                targetId: 'tab_requests',
                position: 'bottom',
                action: 'click'
            },
            {
                id: 'accept_request',
                message: 'JOYNER 가이드의 친구 요청을 수락해주세요',
                targetId: 'btn_accept_friend',
                position: 'bottom',
                action: 'click'
            },
            {
                id: 'friend_accepted',
                message: '친구가 되었어요! 이제 일정을 조율할 수 있어요.',
                position: 'center'
            }
        ]
    },
    {
        step: 'CREATE_REQUEST',
        title: '일정 요청',
        description: '친구와 일정을 잡아보세요.',
        subSteps: [
            {
                id: 'go_to_request',
                message: '조율 탭을 눌러주세요',
                targetId: 'tab_request',
                action: 'navigate'
            },
            {
                id: 'request_page_intro',
                message: '여기는 조율 탭이에요!\n친구들과 함께 일정을 잡을 때 사용해요.\nAI가 모두의 캘린더를 분석해 최적의 시간을 찾아줍니다!',
                position: 'center'
            },
            {
                id: 'add_participant',
                message: '참여자 추가(+) 버튼을 눌러 JOYNER 가이드를 추가해보세요.',
                targetId: 'btn_add_participant',
                position: 'bottom',
                action: 'click'
            },
            {
                id: 'explain_duration_nights',
                message: '1박 2일 이상의 일정은 여기서 설정할 수 있어요.',
                targetId: 'section_duration_nights',
                position: 'top',
                delay: 1000
            },
            {
                id: 'explain_date_range',
                message: '조율 날짜 범위: 시작일 ~ 종료일 사이에 가능한 날짜를 설정합니다.',
                targetId: 'section_date',
                position: 'top'
            },
            {
                id: 'explain_time_window',
                message: '선호 시간대: 일정 후보를 찾을 시간 범위를 지정합니다.',
                targetId: 'section_time',
                position: 'top'
            },
            {
                id: 'explain_duration',
                message: '미팅 소요 시간: 일정이 얼마나 걸릴지 설정해주세요.',
                targetId: 'section_duration',
                position: 'top',
                delay: 1000
            },
            {
                id: 'enter_title',
                message: '일정 제목을 입력해보세요 (자동 입력됩니다)',
                targetId: 'input_meeting_title',
                action: 'input',
                position: 'bottom'
            },
            {
                id: 'explain_analyze',
                message: '"최적의 일정 분석하기"는 친구들의 캘린더를 분석해 최상의 시간을 찾아줍니다.\n"최적의 일정 분석하기" 버튼을 눌러보세요!',
                targetId: 'btn_analyze_schedule',
                position: 'center',  // 중앙에 표시하여 버튼 가림 방지
                action: 'click'
            },
            {
                id: 'check_result',
                message: 'AI가 찾아낸 최적의 추천 일정입니다!\n일정을 클릭한 후 스크롤을 내려 "선택한 일정으로 요청 보내기" 버튼을 눌러주세요.',
                position: 'screen_top'
            },
            {
                id: 'request_sent',
                message: '성공적으로 일정을 요청했습니다.',
                position: 'center'
            }
        ]
    },
    {
        step: 'VIEW_EVENTS',
        title: '이벤트 확인',
        description: '보낸 요청을 확인해보세요.',
        subSteps: [
            {
                id: 'go_to_events',
                message: '이벤트 탭을 눌러주세요',
                targetId: 'tab_a2a',
                action: 'navigate'
            },
            {
                id: 'view_events_intro',
                message: '여기는 이벤트 탭이에요!\n보낸 요청과 받은 요청을 모두 확인하고\n일정 상태를 관리할 수 있어요.',
                position: 'center'
            },
            {
                id: 'explain_status',
                message: '방금 보낸 요청이 "진행중" 상태로 표시됩니다.\n친구가 응답하면 상태가 변경돼요.',
                position: 'center',
            }
        ]
    },
    {
        step: 'RESPOND_TO_REQUEST',
        title: '요청 응답하기',
        description: '받은 일정 요청에 응답해보세요.',
        subSteps: [
            {
                id: 'view_received_request',
                message: 'JOYNER 가이드님이 보낸 "팀 회식" 요청이 도착했어요.\n요청 카드를 눌러 상세 내용을 확인하세요.',
                targetId: 'card_tutorial_received_request',
                position: 'bottom',
                action: 'click'
            },
            {
                id: 'explain_actions',
                message: '여기서 수락, 거절, 재조율을 할 수 있어요.\n"재조율" 버튼을 눌러보세요.',
                targetId: 'btn_reschedule',
                action: 'click'
            },
            {
                id: 'select_reschedule_time',
                message: '시간을 변경하고 "AI에게 재협상 요청" 버튼을 눌러 전송하세요.',
                position: 'screen_top'
            },
            {
                id: 'reschedule_completed',
                message: '재조율 요청이 완료되었습니다.',
                position: 'center'
            },
            {
                id: 'try_approve',
                message: '"승인" 버튼을 눌러 일정을 확정하세요.',
                targetId: 'btn_approve',
                action: 'click'
            },
            {
                id: 'approved_success',
                message: '일정이 확정되었습니다! 해당 일정은 캘린더에 자동으로 추가됩니다.',
                position: 'center'
            },
            {
                id: 'event_guide',
                message: '이벤트 탭의 각 일정 요청은 약속날짜가 지나면 자동으로 삭제됩니다.',
                action: 'click'
            },
            {
                id: 'go_to_home_final',
                message: '창을 닫고 홈 탭을 눌러주세요.\n홈 화면의 기능들을 살펴볼게요!',
                targetId: 'tab_home',
                action: 'navigate'
            }
        ]
    },
    {
        step: 'CHECK_HOME',
        title: '홈 화면 둘러보기',
        description: '홈 화면의 주요 기능을 알아보세요.',
        subSteps: [
            {
                id: 'home_calendar_intro',
                message: '홈 화면에 오신 것을 환영합니다!\n여기서 일정을 한눈에 확인할 수 있어요.',
                position: 'center',
            },
            {
                id: 'home_calendar_view',
                message: '캘린더에서 날짜를 탭하면 해당 날짜의 일정을 확인할 수 있어요.',
                targetId: 'calendar_area',
                position: 'bottom'
            },
            {
                id: 'home_add_button',
                message: '➕버튼을 누르면 개인일정 추가가 가능하고, 빠르게 일정 조율 요청도 보낼 수 있어요!',
                targetId: 'btn_home_add',
                position: 'top'
            },
            {
                id: 'home_notification',
                message: '🔔 오른쪽 위 알림 버튼을 누르면\n친구 요청이나 일정 알림을 확인할 수 있어요.',
                targetId: 'btn_notification',
                position: 'bottom'
            }
        ]
    },
    {
        step: 'EXPLORE_CHAT',
        title: '채팅 화면 둘러보기',
        description: 'AI 채팅 기능을 알아보세요.',
        subSteps: [
            {
                id: 'go_to_chat',
                message: '채팅 탭을 눌러주세요',
                targetId: 'tab_chat',
                action: 'navigate'
            },
            {
                id: 'chat_intro',
                message: '채팅 화면에서는 AI와 대화하며\n일정을 조율하거나 질문할 수 있어요.',
                position: 'center'
            },
            {
                id: 'chat_feature',
                message: '"다음주 금요일에 누구랑 만남 잡아줘"\n이렇게 자연스럽게 요청하면 AI가 대신 처리해요!',
                position: 'center'
            }
        ]
    },
    {
        step: 'EXPLORE_FRIENDS',
        title: '친구 화면 둘러보기',
        description: '친구 관리 기능을 알아보세요.',
        subSteps: [
            {
                id: 'go_to_friends_explore',
                message: '친구 탭을 눌러주세요',
                targetId: 'tab_friends',
                action: 'navigate'
            },
            {
                id: 'friends_intro',
                message: '친구 탭에서는 친구 목록을 확인하고\n새 친구를 추가할 수 있어요.',
                position: 'center'
            },
            {
                id: 'friends_add_feature',
                message: '오른쪽 위에 친구 추가 버튼을 누르면\n이메일이나 핸들로 친구를 검색해 추가할 수 있어요.',
                targetId: 'btn_add_friend',
                position: 'bottom'
            },
            {
                id: 'friends_requests_tab',
                message: '"받은 요청" 탭에서는 다른 사람이 보낸\n친구 요청을 확인하고 수락할 수 있어요.',
                targetId: 'tab_requests',
                position: 'bottom'
            }
        ]
    },
    {
        step: 'COMPLETE',
        title: '완료! ',
        description: '이제 자유롭게 사용해보세요!',
        subSteps: [
            {
                id: 'complete_message',
                message: '축하합니다!\nJOYNER의 모든 기능을 배우셨어요.\n이제 친구들과 스마트하게 일정을 조율하세요!',
                position: 'center',
            }
        ]
    }
];

// 가짜 친구 요청 (튜토리얼용) - 조이너 가이드가 보낸 요청
export const FAKE_FRIEND_REQUEST = {
    id: 'tutorial_friend_request',
    from_user: {
        id: TUTORIAL_GUIDE.id,
        name: TUTORIAL_GUIDE.name,
        email: TUTORIAL_GUIDE.email,
        picture: TUTORIAL_GUIDE.picture
    },
    status: 'pending',
    created_at: new Date().toISOString()
};

// 가짜 A2A 요청 (튜토리얼용)
export const FAKE_A2A_REQUEST = {
    id: 'tutorial_fake_request',
    thread_id: 'tutorial_thread',
    title: '팀 회식',
    summary: '나: 다음주 금요일 팀 회식 일정 제안합니다.',
    initiator_id: TUTORIAL_GUIDE.id,
    initiator_name: TUTORIAL_GUIDE.name,
    initiator_avatar: TUTORIAL_GUIDE.picture,
    participant_count: 2,
    proposed_date: (() => {
        const nextFri = new Date();
        nextFri.setDate(nextFri.getDate() + (5 - nextFri.getDay() + 7) % 7);
        return `${nextFri.getMonth() + 1}월 ${nextFri.getDate()}일`;
    })(),
    proposed_time: '18:30',
    status: 'pending',
    created_at: new Date().toISOString(),
    type: 'new' as const
};

// [NEW] 가짜 받은 요청 (튜토리얼용) - 조이너 가이드가 보낸 것
export const FAKE_RECEIVED_REQUEST = {
    id: 'tutorial_received_request',
    thread_id: 'tutorial_thread_received',
    title: '팀 회식',
    summary: '조이너 가이드: 이번주 금요일에 회식 어때요?',
    initiator_id: TUTORIAL_GUIDE.id,
    initiator_name: TUTORIAL_GUIDE.name,
    initiator_avatar: TUTORIAL_GUIDE.picture,
    participant_count: 2,
    proposed_date: (() => {
        const nextFri = new Date();
        nextFri.setDate(nextFri.getDate() + (5 - nextFri.getDay() + 7) % 7);
        return `${nextFri.getMonth() + 1}월 ${nextFri.getDate()}일`;
    })(),
    proposed_time: '18:30',
    status: 'pending_approval', // 승인 대기 상태
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
    type: 'new' as const,
    // [NEW] 상세 정보 추가 (협상 로그 포함)
    details: {
        proposer: TUTORIAL_GUIDE.name,
        proposerAvatar: TUTORIAL_GUIDE.picture,
        purpose: '팀 회식',
        proposedDate: (() => {
            const nextFri = new Date();
            nextFri.setDate(nextFri.getDate() + (5 - nextFri.getDay() + 7) % 7);
            return `${nextFri.getMonth() + 1}월 ${nextFri.getDate()}일`;
        })(),
        proposedTime: '18:30',
        location: '강남역',
        participants: ['나', TUTORIAL_GUIDE.name],
        attendees: [
            { id: 'current_user', name: '나', avatar: null },
            { id: TUTORIAL_GUIDE.id, name: TUTORIAL_GUIDE.name, avatar: TUTORIAL_GUIDE.picture }
        ],
        // 협상 로그 (process)
        process: [
            {
                step: '요청 생성',
                description: 'JOYNER 가이드님이 "팀 회식" 일정을 제안했습니다.',
                created_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
                step: '일정 분석',
                description: 'AI가 참여자들의 캘린더를 분석했습니다.',
                created_at: new Date(Date.now() - 3500000).toISOString()
            },
            {
                step: '시간 제안',
                description: '금요일 18:30 시간이 제안되었습니다.',
                created_at: new Date(Date.now() - 3400000).toISOString()
            },
            {
                step: '승인 대기',
                description: '귀하의 승인을 기다리고 있습니다.',
                created_at: new Date(Date.now() - 3300000).toISOString()
            }
        ]
    }
};

// 가짜 확정 일정 (튜토리얼용)
export const FAKE_CONFIRMED_SCHEDULE = {
    id: 'tutorial_confirmed_schedule',
    title: '팀 회식',
    date: (() => {
        const nextFri = new Date();
        nextFri.setDate(nextFri.getDate() + (5 - nextFri.getDay() + 7) % 7);
        const year = nextFri.getFullYear();
        const month = String(nextFri.getMonth() + 1).padStart(2, '0');
        const day = String(nextFri.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })(),
    time: '18:30 - 20:30',
    participants: ['나', TUTORIAL_GUIDE.name],
    type: 'A2A' as const,
    location: '강남역'
};
