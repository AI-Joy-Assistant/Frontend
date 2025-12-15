// types.ts
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: { register_token: string; email: string; name: string; picture: string };
  LoginDetailScreen: undefined;
  Home: undefined;
  Chat: undefined;
  Friends: { initialTab?: 'friends' | 'requests' } | undefined;
  A2A: { initialLogId?: string } | undefined;
  User: undefined;
  MyPage: undefined;
  Test: undefined;
  A2AChatDetail: { sessionId: string; title: string };
};

export enum Tab {
  HOME = 'Home',
  CHAT = 'Chat',
  FRIENDS = 'Friends',
  A2A = 'A2A',
  USER = 'User',
}

export interface A2ALog {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'pending_approval' | 'completed' | 'failed';
  summary: string;
  timeRange: string;
  createdAt: string;
  details?: {
    proposer: string;
    proposerAvatar: string;
    purpose: string;
    proposedDate: string;
    proposedTime: string;
    location: string;
    process: { step: string; description: string }[];
    participants?: string[];
    thread_id?: string;
    rescheduleRequestedBy?: string;
  };
  initiator_user_id?: string;
}
