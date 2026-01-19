import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  TouchableWithoutFeedback,
  Image,
  Animated,
  Dimensions,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Tab } from "../types";
import BottomNav from "../components/BottomNav";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../constants/config";
import WebSocketService from "../services/WebSocketService";
import { badgeStore } from "../store/badgeStore";
import { useTutorial } from "../store/TutorialContext";

import { LinearGradient } from "expo-linear-gradient";
import {
  Send,
  Sparkles,
  X,
  Search,
  Check,
  Menu,
  MoreHorizontal,
  Edit2,
  Trash2,
  Plus,
  MessageSquare,
} from "lucide-react-native";
import { COLORS } from "../constants/Colors";
import { BlurView } from "expo-blur";

interface Friend {
  id: string;
  friend: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
  created_at: string;
}

// --- Types for Chat Management ---
interface Message {
  sender: string;
  text: string;
  needsApproval?: boolean;
  proposal?: any;
  threadId?: string;
  sessionIds?: string[];
  approvalStatus?: {
    approvedBy: string[];
    totalParticipants: number;
  };
  isApproved?: boolean;
  isRejected?: boolean;
  allApproved?: boolean;
  shouldShowProposalCard?: boolean;
  timestamp?: string;
  id?: string;
  // 충돌 선택지 관련 필드
  type?: string;  // "schedule_conflict_choice" | "majority_recommendation" etc
  conflictChoice?: {
    sessionId: string;
    initiatorName: string;
    otherCount: number;
    proposedDate: string;
    proposedTime: string;
    conflictEventName: string;
    choices: Array<{ id: string; label: string }>;
    selectedChoice?: string;  // "skip" | "adjust" | null
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  isDefault?: boolean; // 기본 채팅 세션 여부
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { checkAndShowTutorial } = useTutorial();

  // 튜토리얼 체크
  useFocusEffect(
    useCallback(() => {
      checkAndShowTutorial('chat');
    }, [])
  );

  // --- Chat Session State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // UI State for Management
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(
    null
  );
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modals
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    sessionId: string | null;
    currentTitle: string;
  }>({ isOpen: false, sessionId: null, currentTitle: "" });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    sessionId: string | null;
  }>({ isOpen: false, sessionId: null });

  // Chat State
  const [input, setInput] = useState("");
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태를 true로 설정
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [userName, setUserName] = useState("User");

  const isAtBottom = useRef(true);
  const messagesEndRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // --- Helpers ---

  const toggleFriendSelection = (id: string) => {
    setSelectedFriends((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fid) => fid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(`${API_BASE}/friends/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserName(data.name || data.nickname || "User");
        setUserId(data.id); // WebSocket 연결에 필요
      }
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  // 기본 채팅 세션 조회/생성
  const fetchDefaultSession = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return null;

      const res = await fetch(`${API_BASE}/chat/default-session`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        return data; // { id, title, is_new }
      }
      return null;
    } catch (e) {
      console.error("Failed to fetch default session", e);
      return null;
    }
  };

  // 기본 세션 초기화 여부 추적
  const defaultSessionInitialized = useRef(false);

  // 채팅 세션 목록 불러오기
  const fetchSessions = async (forceDefaultCheck = false) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      // 기본 세션 확인/생성은 최초 1회만 수행
      if (!defaultSessionInitialized.current || forceDefaultCheck) {
        await fetchDefaultSession();
        defaultSessionInitialized.current = true;
      }

      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const backendSessions = data.sessions || [];

        if (backendSessions.length > 0) {
          // 백엔드 세션을 로컬 형식으로 변환
          const loadedSessions: ChatSession[] = backendSessions.map((s: any) => ({
            id: s.id,
            title: s.title || "새 채팅",
            updatedAt: s.updated_at ? new Date(s.updated_at) : new Date(),
            messages: [], // 메시지는 별도로 로드
            isDefault: s.is_default || false, // 기본 채팅 여부
          }));

          setSessions(loadedSessions);

          // 현재 세션이 없으면 기본 채팅 또는 첫 번째 세션 선택
          if (!currentSessionId) {
            const lastActiveId = await AsyncStorage.getItem('lastActiveSessionId');
            const defaultSession = loadedSessions.find(s => s.title === "기본 채팅");

            // 저장된 마지막 세션이 있고 실제 목록에도 존재하면 해당 세션 복구
            if (lastActiveId && loadedSessions.some(s => s.id === lastActiveId)) {
              setCurrentSessionId(lastActiveId);
            } else {
              setCurrentSessionId(defaultSession?.id || backendSessions[0].id);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  };

  // 세션 ID가 변경될 때마다 저장
  useEffect(() => {
    if (currentSessionId) {
      AsyncStorage.setItem('lastActiveSessionId', currentSessionId).catch(err =>
        console.error("Failed to save last active session", err)
      );
    }
  }, [currentSessionId]);

  // 세션 변경 시 저장된 draft 불러오기
  useEffect(() => {
    const loadDraft = async () => {
      if (currentSessionId) {
        try {
          const draft = await AsyncStorage.getItem(`chatDraft_${currentSessionId}`);
          if (draft) {
            setInput(draft);
          } else {
            setInput('');
          }
        } catch (err) {
          console.error('Failed to load draft:', err);
        }
      }
    };
    loadDraft();
  }, [currentSessionId]);

  // 입력 변경 시 draft 저장 (debounced)
  useEffect(() => {
    if (!currentSessionId) return;
    const timeoutId = setTimeout(() => {
      if (input.trim()) {
        AsyncStorage.setItem(`chatDraft_${currentSessionId}`, input).catch(err =>
          console.error('Failed to save draft:', err)
        );
      } else {
        AsyncStorage.removeItem(`chatDraft_${currentSessionId}`).catch(err =>
          console.error('Failed to remove draft:', err)
        );
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timeoutId);
  }, [input, currentSessionId]);

  // 세션 변경 시 선택된 친구 불러오기
  useEffect(() => {
    const loadSelectedFriends = async () => {
      if (currentSessionId) {
        try {
          const saved = await AsyncStorage.getItem(`selectedFriends_${currentSessionId}`);
          if (saved) {
            setSelectedFriends(JSON.parse(saved));
          } else {
            setSelectedFriends([]);
          }
        } catch (err) {
          console.error('Failed to load selected friends:', err);
        }
      }
    };
    loadSelectedFriends();
  }, [currentSessionId]);

  // 친구 선택 변경 시 저장
  useEffect(() => {
    if (!currentSessionId) return;
    if (selectedFriends.length > 0) {
      AsyncStorage.setItem(`selectedFriends_${currentSessionId}`, JSON.stringify(selectedFriends)).catch(err =>
        console.error('Failed to save selected friends:', err)
      );
    } else {
      AsyncStorage.removeItem(`selectedFriends_${currentSessionId}`).catch(err =>
        console.error('Failed to remove selected friends:', err)
      );
    }
  }, [selectedFriends, currentSessionId]);

  useEffect(() => {
    fetchFriends();
    fetchUserProfile();
    fetchSessions();
  }, []);

  // Fixed formatTime (Korean Standard Time)
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      // 백엔드 timestamp를 Date 객체로 변환
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "";

      // KST는 UTC+9
      const KST_OFFSET = 9 * 60 * 60 * 1000;
      const kstDate = new Date(date.getTime() + KST_OFFSET);

      // 오늘인지 확인 (KST 기준)
      const now = new Date();
      const kstNow = new Date(now.getTime() + KST_OFFSET);

      const isToday =
        kstDate.getUTCDate() === kstNow.getUTCDate() &&
        kstDate.getUTCMonth() === kstNow.getUTCMonth() &&
        kstDate.getUTCFullYear() === kstNow.getUTCFullYear();

      // 시간 포맷 (오전/오후)
      const hours = kstDate.getUTCHours();
      const minutes = kstDate.getUTCMinutes();
      const ampm = hours < 12 ? "오전" : "오후";
      const displayHours = hours % 12 || 12;
      const timeStr = `${ampm} ${displayHours}:${minutes.toString().padStart(2, "0")}`;


      if (isToday) {
        return timeStr;
      } else {
        const month = kstDate.getUTCMonth() + 1;
        const day = kstDate.getUTCDate();
        return `${month}월 ${day}일 ${timeStr}`;
      }
    } catch (e) {
      return "";
    }
  };

  // --- Session Management Logic ---

  const currentMessages = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId)?.messages || [];
  }, [sessions, currentSessionId]);

  const currentSessionTitle = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId)?.title || "새 채팅";
  }, [sessions, currentSessionId]);

  const createNewSession = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        console.warn("액세스 토큰 없음 – 세션을 만들 수 없습니다.");
        return;
      }

      // 1) 백엔드에 실제 chat_sessions row 생성 요청
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "새 채팅" }),
      });

      if (!res.ok) {
        console.error("세션 생성 실패", res.status);
        return;
      }

      const json = await res.json();
      const session = json.data ?? json;

      const now = new Date();

      const newSessionId: string = session.id; // uuid
      const newSessionTitle: string = session.title ?? "새 채팅";
      const updatedAt: Date = session.updated_at
        ? new Date(session.updated_at)
        : now;

      const newSession: ChatSession = {
        id: newSessionId,
        title: newSessionTitle,
        updatedAt,
        messages: [
          {
            id: "init",
            sender: "ai",
            text: "새로운 대화를 시작합니다. 무엇을 도와드릴까요?",
            timestamp: now.toISOString(),
          },
        ],
      };

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSessionId);

      setIsSidebarOpen(false);
      setActiveMenuSessionId(null);
    } catch (e) {
      console.error("세션 생성 중 오류", e);
    }
  };

  const updateSessionTitle = async () => {
    if (renameModal.sessionId && renameModal.currentTitle.trim()) {
      const sessionIdToUpdate = renameModal.sessionId;
      const newTitle = renameModal.currentTitle.trim();

      // 백엔드에서 세션 이름 변경 (uuid 형식인 경우에만)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionIdToUpdate);

      if (isUUID) {
        try {
          const token = await AsyncStorage.getItem("accessToken");
          if (token) {
            await fetch(`${API_BASE}/chat/sessions/${sessionIdToUpdate}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ title: newTitle }),
            });
          }
        } catch (e) {
          console.error("Failed to update session title on backend", e);
        }
      }

      // 로컬 상태 업데이트
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionIdToUpdate
            ? { ...s, title: newTitle }
            : s
        )
      );
      setRenameModal({ isOpen: false, sessionId: null, currentTitle: "" });
      setActiveMenuSessionId(null);
    }
  };

  const deleteSession = async () => {
    if (deleteModal.sessionId) {
      const sessionIdToDelete = deleteModal.sessionId;

      // 백엔드에서 세션 삭제 (uuid 형식인 경우에만)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionIdToDelete);

      if (isUUID) {
        try {
          const token = await AsyncStorage.getItem("accessToken");
          if (token) {
            await fetch(`${API_BASE}/chat/sessions/${sessionIdToDelete}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } catch (e) {
          console.error("Failed to delete session from backend", e);
        }
      }

      // 로컬 상태에서 제거
      const newSessions = sessions.filter(
        (s) => s.id !== sessionIdToDelete
      );
      setSessions(newSessions);

      if (currentSessionId === sessionIdToDelete) {
        if (newSessions.length > 0) {
          setCurrentSessionId(newSessions[0].id);
        } else {
          // 완전 비면 프론트 단에서만 임시 세션 하나 만들어둘 수도 있음
          const now = new Date();
          const tmpId = now.getTime().toString();
          setSessions([
            {
              id: tmpId,
              title: "새 채팅",
              updatedAt: now,
              messages: [],
            },
          ]);
          setCurrentSessionId(tmpId);
        }
      }
      setDeleteModal({ isOpen: false, sessionId: null });
      setActiveMenuSessionId(null);
    }
  };

  const groupedSessions = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    const startOfWeek =
      startOfToday - today.getDay() * 24 * 60 * 60 * 1000;

    const groups = {
      today: [] as ChatSession[],
      thisWeek: [] as ChatSession[],
      older: [] as ChatSession[],
    };

    sessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      const time = isNaN(date.getTime()) ? 0 : date.getTime();

      if (time >= startOfToday) {
        groups.today.push(session);
      } else if (time >= startOfWeek) {
        groups.thisWeek.push(session);
      } else {
        groups.older.push(session);
      }
    });

    const sorter = (a: ChatSession, b: ChatSession) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

    groups.today.sort(sorter);
    groups.thisWeek.sort(sorter);
    groups.older.sort(sorter);

    return groups;
  }, [sessions]);

  // --- Chat History Load Logic ---

  const isValidUUID = (value?: string | null): boolean => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  };

  const loadChatHistory = async (
    showLoadingUI: boolean,
    sessionIdArg?: string | null
  ) => {
    try {
      if (showLoadingUI) setLoading(true);

      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        if (showLoadingUI) setLoading(false);
        return;
      }

      const targetSessionId = sessionIdArg ?? currentSessionId;

      // 세션이 선택되지 않은 상태면 아무 것도 안 함
      if (!targetSessionId) {
        if (showLoadingUI) setLoading(false);
        return;
      }

      let url = `${API_BASE}/chat/history`;

      // uuid 형식일 때만 session_id 파라미터로 전달
      if (isValidUUID(targetSessionId)) {
        url += `?session_id=${encodeURIComponent(targetSessionId)}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401) {
        if (showLoadingUI) setLoading(false);
        await AsyncStorage.removeItem("accessToken");
        return;
      }

      if (!res.ok) {
        if (showLoadingUI) setLoading(false);
        console.error("채팅 히스토리 불러오기 실패", res.status);
        return;
      }

      const chatLogs = await res.json();
      const loadedMessages: Message[] = [];

      if (Array.isArray(chatLogs)) {
        chatLogs.forEach((log: any) => {
          // user message
          if (log.request_text) {
            loadedMessages.push({
              sender: "user",
              text: log.request_text,
              timestamp: log.created_at,
              id: `${log.id}-user`,  // 고유 ID 생성
            });
          }

          // ai message
          if (log.response_text) {
            loadedMessages.push({
              sender: "ai",
              text: log.response_text,
              timestamp: log.created_at,
              id: `${log.id}-ai`,  // 고유 ID 생성
            });
          }
        });

        loadedMessages.sort(
          (a, b) =>
            new Date(a.timestamp || 0).getTime() -
            new Date(b.timestamp || 0).getTime()
        );

        const now = new Date();

        setSessions((prev) => {
          const exists = prev.some((s) => s.id === targetSessionId);

          if (!exists) {
            return [
              {
                id: targetSessionId,
                title: "새 채팅",
                updatedAt: now,
                messages: loadedMessages,
              },
              ...prev,
            ];
          }

          return prev.map((s) =>
            s.id === targetSessionId
              ? { ...s, messages: loadedMessages, updatedAt: now }
              : s
          );
        });
      }
    } catch (error) {
      console.error("채팅 기록 불러오기 오류:", error);
    } finally {
      if (showLoadingUI) setLoading(false);
    }
  };
  // legacy 세션 코드 제거 - fetchDefaultSession에서 기본 채팅 세션 생성/조회 처리
  // (더 이상 가상의 'legacy' ID를 사용하지 않고 DB에서 실제 UUID 사용)

  // 화면 포커스 시에만 실행 (1회)
  useFocusEffect(
    React.useCallback(() => {
      // 화면 들어올 때 세션 목록 불러오기
      fetchSessions();

      // 채팅 화면 들어오면 lastReadAt을 현재 시간으로 강제 리셋 (배지 즉시 제거)
      badgeStore.forceResetLastReadAt();

      // 30초마다 폴링 (WebSocket 백업용 - 연결 끊김 대비)
      const interval = setInterval(() => {
        loadChatHistory(false);
      }, 30000);

      return () => {
        clearInterval(interval);
        // 화면을 떠날 때도 읽음 처리 (채팅 중 받은 메시지들도 읽음으로 표시)
        badgeStore.forceResetLastReadAt();
      };
    }, []) // 의존성 배열 비움 - 화면 포커스 시 1회만 실행
  );

  // WebSocket 연결 (using singleton service)
  useEffect(() => {
    if (!userId) return;

    // 싱글톤 서비스 연결 (이미 연결되어 있으면 스킵)
    WebSocketService.connect(userId);

    // ChatScreen에서 필요한 메시지 구독
    const unsubscribe = WebSocketService.subscribe(
      'ChatScreen',
      ['new_message', 'a2a_request'],
      (data) => {
        if (data.type === "new_message") {
          loadChatHistory(false);
          setTimeout(() => {
            messagesEndRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else if (data.type === "a2a_request") {
          console.log("[WS] A2A 요청 도착:", data.from_user);
          loadChatHistory(false);
          fetchSessions();
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // 세션 변경 시 히스토리 로드 (깜빡임 없이)
  useEffect(() => {
    if (currentSessionId) {
      // 이미 메시지가 있으면 로딩 표시 안함 (깜빡임 방지)
      const hasMessages = sessions.find(s => s.id === currentSessionId)?.messages.length ?? 0;
      loadChatHistory(hasMessages === 0);
    }
  }, [currentSessionId]);

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const { layoutMeasurement, contentOffset, contentSize } =
      event.nativeEvent;
    const paddingToBottom = 100;
    isAtBottom.current =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  const addMessage = (
    sender: string,
    text: string,
    needsApproval?: boolean,
    proposal?: any,
    threadId?: string,
    sessionIds?: string[],
    targetSessionId?: string | null
  ) => {
    const sid = targetSessionId ?? currentSessionId;
    if (!sid) {
      console.error("ChatScreen: addMessage called without sessionId");
      return;
    }

    const newMsg: Message = {
      id: Date.now().toString(),
      sender,
      text,
      needsApproval,
      proposal,
      threadId,
      sessionIds,
      timestamp: new Date().toISOString(),
    };

    console.log("ChatScreen: addMessage called", { sender, text, sessionId: sid });

    setSessions((prev) => {
      const sessionExists = prev.some((s) => s.id === sid);

      if (!sessionExists) {
        // 세션이 존재하지 않으면 새 세션을 생성하며 메시지 추가
        console.log("ChatScreen: Creating new session for message", sid);
        return [
          {
            id: sid,
            title: "새 채팅",
            messages: [newMsg],
            updatedAt: new Date(),
          },
          ...prev,
        ];
      }

      // 기존 세션에 메시지 추가
      return prev.map((s) =>
        s.id === sid
          ? {
            ...s,
            messages: [...s.messages, newMsg],
            updatedAt: new Date(),
          }
          : s
      );
    });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput("");

    // Clear draft and selected friends after sending
    if (currentSessionId) {
      AsyncStorage.removeItem(`chatDraft_${currentSessionId}`).catch(err =>
        console.error('Failed to clear draft:', err)
      );
      AsyncStorage.removeItem(`selectedFriends_${currentSessionId}`).catch(err =>
        console.error('Failed to clear selected friends:', err)
      );
    }

    const friendsToSend = selectedFriends;
    setSelectedFriends([]);

    // Capture the current session ID at the start of the request
    const activeSessionId = currentSessionId;
    if (!activeSessionId) {
      console.error("No active session ID");
      return;
    }

    const userMsg: Message = {
      sender: "user",
      text: userText,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    };

    setSessions((prev) => {
      const sessionExists = prev.some((s) => s.id === activeSessionId);

      if (!sessionExists) {
        // 세션이 존재하지 않으면 새 세션을 생성하며 메시지 추가
        console.log("ChatScreen: Creating new session for user message", activeSessionId);
        const newTitle =
          userText.length > 15
            ? userText.substring(0, 15) + "..."
            : userText;
        return [
          {
            id: activeSessionId,
            title: newTitle,
            messages: [userMsg],
            updatedAt: new Date(),
          },
          ...prev,
        ];
      }

      return prev.map((s) => {
        if (s.id === activeSessionId) {
          const isFirstUserMsg = s.messages.length <= 1;
          let newTitle = s.title;
          if (isFirstUserMsg && s.title === "새 채팅") {
            newTitle =
              userText.length > 15
                ? userText.substring(0, 15) + "..."
                : userText;
          }
          return {
            ...s,
            title: newTitle,
            updatedAt: new Date(),
            messages: [...s.messages, userMsg],
          };
        }
        return s;
      });
    });

    isAtBottom.current = true;
    setTimeout(() => {
      messagesEndRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const token = await AsyncStorage.getItem("accessToken");
      console.log("DEBUG: Sending message with session_id:", activeSessionId); // 디버깅용 로그
      const res = await fetch(`${API_BASE}/chat/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          date: pendingDate ?? undefined,
          selected_friends:
            friendsToSend.length > 0 ? friendsToSend : undefined,
          session_id: activeSessionId,
        }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: `서버 오류 (${res.status})` }));
        addMessage(
          "system",
          `❌ 오류: ${errorData.detail || "알 수 없는 오류"}`,
          undefined, undefined, undefined, undefined,
          activeSessionId
        );
        return;
      }

      const response = await res.json();
      const data = response.data || response;

      const aiResponse = data.ai_response || data.response;
      const scheduleInfo = data.schedule_info || {};
      const needsApproval = scheduleInfo.needs_approval || false;
      const proposal = scheduleInfo.proposal;
      const threadId = scheduleInfo.thread_id;
      const sessionIds = scheduleInfo.session_ids || [];

      if (aiResponse) {
        console.log("ChatScreen: Received AI response", aiResponse);
        if (needsApproval && proposal) {
          addMessage(
            "ai",
            aiResponse,
            true,
            proposal,
            threadId,
            sessionIds,
            activeSessionId
          );
        } else {
          addMessage("ai", aiResponse, undefined, undefined, undefined, undefined, activeSessionId);
        }

        // [✅ FIX] 메시지 추가 후 즉시 히스토리 동기화 (다중 메시지 대응)
        // 백엔드에서 여러 메시지가 생성되었을 수 있으므로 동기화
        setTimeout(() => {
          loadChatHistory(false);
        }, 500);
      } else {
        console.log("ChatScreen: No AI response in data", data);
      }

      // [추가] 첫 메시지 전송 시 세션 제목 업데이트 (로컬 반영 + 백엔드 명시적 요청)
      setSessions((prev) => {
        return prev.map((s) => {
          // [수정] 이미 로컬 타이틀이 업데이트된 경우("안녕")에도 백엔드 동기화를 위해 조건 포함
          // 메시지가 아직 많지 않을 때(첫 메시지)만 제목 변경 시도
          const isNewChat = s.title === "새 채팅" || s.title.includes("새 채팅") || s.title === "New Chat";
          const newTitle = userText.length > 20 ? userText.substring(0, 20) + "..." : userText;
          const isLocallyUpdated = s.title === newTitle;

          // 타이틀이 "새 채팅"이거나, 이미 로컬에서 변경된 상태(동기화 필요)이고 메시지 수가 적다면 업데이트 시도
          if (s.id === activeSessionId && (isNewChat || isLocallyUpdated)) {

            // 백엔드 명시적 요청 (비동기) - 중복 호출 방지를 위해 로컬 상태 확인
            (async () => {
              try {
                const token = await AsyncStorage.getItem("accessToken");
                if (!token) return;
                // console.log("Updating session title on backend:", newTitle);
                await fetch(`${API_BASE}/chat/sessions/${activeSessionId}`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ title: newTitle })
                });
                loadChatHistory(true);
              } catch (e) { console.error(e); }
            })();

            return { ...s, title: newTitle };
          }
          return s;
        });
      });



    } catch (e) {
      console.error("ChatScreen: Error sending message", e);
      addMessage(
        "system",
        "❌ 메시지 전송 중 오류가 발생했습니다.",
        undefined, undefined, undefined, undefined,
        activeSessionId
      );
    }
  };

  const handleScheduleApproval = async (
    approved: boolean,
    proposal: any,
    threadId: string,
    sessionIds: string[]
  ) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const res = await fetch(`${API_BASE}/chat/approve-schedule`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thread_id: threadId,
          session_ids: sessionIds,
          approved: approved,
          proposal: proposal,
        }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: "승인 처리 실패" }));
        addMessage(
          "system",
          `❌ 오류: ${errorData.detail || "승인 처리 실패"}`
        );
        return;
      }

      const result = await res.json();

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s;

          const updatedMessages = s.messages.map((msg) => {
            if (!msg.proposal) return msg;

            const matchesThreadId =
              threadId && msg.threadId === threadId;
            const matchesSessionIds =
              msg.sessionIds &&
              sessionIds &&
              msg.sessionIds.length > 0 &&
              sessionIds.length > 0 &&
              msg.sessionIds.some((sid) => sessionIds.includes(sid));

            const proposalMatches =
              proposal &&
              msg.proposal &&
              proposal.date === msg.proposal.date &&
              proposal.time === msg.proposal.time;

            if (proposalMatches && (matchesThreadId || matchesSessionIds)) {
              const updatedApprovalStatus =
                result.all_approved !== undefined
                  ? {
                    approvedBy: result.approved_by_list || [],
                    totalParticipants:
                      msg.approvalStatus?.totalParticipants || 2,
                  }
                  : msg.approvalStatus;

              return {
                ...msg,
                needsApproval: false,
                isApproved: approved || result.all_approved,
                isRejected: !approved && !result.all_approved,
                allApproved: result.all_approved || false,
                approvalStatus: updatedApprovalStatus,
              };
            }
            return msg;
          });

          return { ...s, messages: updatedMessages };
        })
      );

      if (approved) {
        addMessage(
          "ai",
          result.message ||
          "일정이 확정되어 모든 참여자 캘린더에 추가되었습니다."
        );
      } else {
        // [수정] 거절 시에도 명확하게 메시지 추가
        // 백엔드에서 "일정을 거절했습니다." 메시지를 내려주므로 그것을 우선 사용
        const rejectionMsg = result.message || "일정이 거절되었습니다.";
        addMessage("ai", rejectionMsg);

        // [추가] 메시지 목록 전체 리로드 (백엔드에서 생성된 시스템 메시지 동기화)
        // A2A 서비스에서 거절 시 ChatRepository.create_chat_log로 메시지를 DB에 추가했으므로,
        // 새로고침하면 해당 메시지들이 불러와짐.
        // 여기서는 UX를 위해 즉시 리로드를 수행하는 것이 좋음.
        loadChatHistory(true);
      }
    } catch (error) {
      console.error("승인 처리 오류:", error);
      addMessage(
        "system",
        "❌ 승인 처리 중 오류가 발생했습니다."
      );
    }
  };

  // 충돌 선택지 처리 함수
  const handleConflictChoice = async (sessionId: string, choice: "skip" | "adjust", messageIndex: number) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(`${API_BASE}/a2a/session/${sessionId}/conflict-choice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ choice }),
      });

      if (response.ok) {
        // 메시지 업데이트 - 선택 결과 표시
        const currentSessionData = sessions.find(s => s.id === currentSessionId);
        const updatedMessages = [...(currentSessionData?.messages || [])];
        if (updatedMessages[messageIndex] && updatedMessages[messageIndex].conflictChoice) {
          updatedMessages[messageIndex].conflictChoice!.selectedChoice = choice;
        }

        // 세션 업데이트
        setSessions((prev) =>
          prev.map((sess) =>
            sess.id === currentSessionId
              ? { ...sess, messages: updatedMessages, updatedAt: new Date() }
              : sess
          )
        );

        // 결과 메시지 추가
        const resultText = choice === "skip"
          ? "참석 불가로 처리되었습니다. 다른 참여자들끼리 일정이 진행됩니다."
          : "일정 조정을 선택하셨습니다. 캐린더에서 기존 일정을 수정해주세요.";

        addMessage("ai", resultText);
      }
    } catch (error) {
      console.error("Error handling conflict choice:", error);
      addMessage("ai", "선택 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const renderItem = ({ item, index }: { item: Message; index?: number }) => {
    // 충돌 선택지 메시지 렌더링
    if (item.type === "schedule_conflict_choice" && item.conflictChoice) {
      const { sessionId, initiatorName, otherCount, proposedDate, proposedTime, conflictEventName, choices, selectedChoice } = item.conflictChoice;

      return (
        <View style={styles.conflictChoiceContainer}>
          <View style={styles.conflictChoiceCard}>
            <View style={styles.conflictChoiceHeader}>
              <Text style={styles.conflictChoiceIcon}>🔔</Text>
              <Text style={styles.conflictChoiceTitle}>일정 조율 알림</Text>
            </View>
            <Text style={styles.conflictChoiceText}>
              {initiatorName}님 외 {otherCount}명이 {proposedDate} {proposedTime}에 일정을 잡으려 합니다.
            </Text>
            <View style={styles.conflictEventBadge}>
              <Text style={styles.conflictEventText}>그 시간에 [{conflictEventName}]이 있으시네요.</Text>
            </View>

            {selectedChoice ? (
              <View style={styles.conflictChoiceResult}>
                <Text style={styles.conflictChoiceResultText}>
                  {selectedChoice === "skip" ? "❌ 참석 불가 선택됨" : "✅ 일정 조정 선택됨"}
                </Text>
              </View>
            ) : (
              <View style={styles.conflictChoiceButtons}>
                {choices.map((choice) => (
                  <TouchableOpacity
                    key={choice.id}
                    style={[
                      styles.conflictChoiceButton,
                      choice.id === "skip" ? styles.conflictSkipButton : styles.conflictAdjustButton
                    ]}
                    onPress={() => handleConflictChoice(sessionId, choice.id as "skip" | "adjust", index || 0)}
                  >
                    <Text style={[
                      styles.conflictChoiceButtonText,
                      choice.id === "skip" ? styles.conflictSkipButtonText : styles.conflictAdjustButtonText
                    ]}>
                      {choice.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    }

    // 일반 메시지 렌더링
    return (
      <View
        style={[
          styles.messageItem,
          item.sender === "user" ? styles.userMessage : styles.aiMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            item.sender === "user"
              ? styles.userBubble
              : styles.aiBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              item.sender === "user"
                ? styles.userMessageText
                : styles.aiMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.timestampText,
              item.sender === "user"
                ? styles.userTimestamp
                : styles.aiTimestamp,
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // Keyboard Visibility
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const keyboardHideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(
      keyboardShowEvent,
      () => {
        setKeyboardVisible(true);
      }
    );
    const hideSubscription = Keyboard.addListener(
      keyboardHideEvent,
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 1. Header */}
      <LinearGradient
        colors={['#818CF8', '#3730A3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerDecor} />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Image
                source={require("../assets/images/agent.png")}
                style={styles.headerIconImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>
                {userName}님의 비서
              </Text>
              <Text style={styles.headerSubtitle}>
                {currentSessionTitle}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setIsSidebarOpen(true)}
            style={styles.menuButton}
          >
            <Menu size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 2. Chat Sidebar */}
      {isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <TouchableWithoutFeedback
            onPress={() => setIsSidebarOpen(false)}
          >
            <BlurView
              intensity={20}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </TouchableWithoutFeedback>

          <View style={styles.sidebarPanel}>
            <View style={[styles.sidebarHeader, { paddingTop: insets.top + 20 }]}>
              <Text style={styles.sidebarTitle}>채팅방</Text>
              <TouchableOpacity
                onPress={createNewSession}
                style={styles.newChatButton}
              >
                <Plus size={20} color={COLORS.primaryMain} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={["today", "thisWeek", "older"]}
              keyExtractor={(item) => item}
              renderItem={({ item: groupKey }) => {
                const groupItems =
                  groupedSessions[
                  groupKey as keyof typeof groupedSessions
                  ];
                if (groupItems.length === 0) return null;

                let label = "";
                if (groupKey === "today") label = "오늘";
                else if (groupKey === "thisWeek") label = "이번 주";
                else label = "이전";

                return (
                  <View style={styles.sessionGroup}>
                    <Text style={styles.sessionGroupLabel}>
                      {label}
                    </Text>
                    {groupItems.map((session) => {
                      const isActive =
                        session.id === currentSessionId;
                      return (
                        <TouchableOpacity
                          key={session.id}
                          style={[
                            styles.sessionItem,
                            isActive && styles.sessionItemActive,
                          ]}
                          onPress={() => {
                            setCurrentSessionId(session.id);
                            setIsSidebarOpen(false);
                            // 선택하자마자 해당 세션 히스토리 로드
                            loadChatHistory(true, session.id);
                          }}
                        >
                          <MessageSquare
                            size={16}
                            color={
                              isActive
                                ? COLORS.primaryMain
                                : COLORS.neutral400
                            }
                            style={{ marginRight: 12 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.sessionTitle,
                                isActive &&
                                styles.sessionTitleActive,
                              ]}
                              numberOfLines={1}
                            >
                              {session.title}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.sessionOptionButton}
                            onPress={(event) => {
                              // 버튼의 화면 위치 가져오기
                              const { pageX, pageY } = event.nativeEvent;
                              setMenuPosition({ x: pageX, y: pageY });
                              setActiveMenuSessionId(
                                activeMenuSessionId === session.id
                                  ? null
                                  : session.id
                              );
                            }}
                          >
                            <MoreHorizontal
                              size={16}
                              color={COLORS.neutral400}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              }}
              style={styles.sidebarList}
            />
          </View>
        </View>
      )}

      {/* 3. Messages Area */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading && currentMessages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={COLORS.primaryMain}
            />
          </View>
        ) : (
          <FlatList
            ref={messagesEndRef}
            data={[
              {
                id: 'welcome-message',
                // [수정] 기본 멘트
                text: `안녕하세요! ${userName}님, 저는 당신의 AI 비서입니다.\n무엇을 도와드릴까요?`,
                sender: 'ai',
                timestamp: sessions.find(s => s.id === currentSessionId)?.messages[0]?.timestamp || new Date().toISOString(), // 첫 메시지 시간 또는 현재 시간
              },
              ...currentMessages
            ]}
            keyExtractor={(item, index) =>
              item.id || index.toString()
            }
            renderItem={renderItem}
            contentContainerStyle={[
              styles.messagesContainer,
              (currentMessages.length > 0 || true) && // 항상 컨텐츠가 있다고 가정 (웰컴 메시지 포함)
              styles.messagesContainerWithContent,
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (
                messagesEndRef.current &&
                currentMessages.length > 0 &&
                isAtBottom.current
              ) {
                messagesEndRef.current.scrollToEnd({
                  animated: false,
                });
              }
            }}
            ListEmptyComponent={null}
            style={{ flex: 1 }}
          />
        )}

        <View
          style={[
            styles.inputWrapper,
            {
              paddingBottom: isKeyboardVisible
                ? 10
                : Platform.OS === "ios"
                  ? 90
                  : 80,
            },
          ]}
        >
          {/* Friend Selection Area */}
          <View style={styles.friendSelectionArea}>
            <TouchableOpacity
              onPress={() => setShowFriendModal(true)}
              style={styles.friendSelectButton}
            >
              <Text style={styles.friendSelectButtonText}>
                친구 선택
              </Text>
            </TouchableOpacity>

            <FlatList
              data={selectedFriends}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const friendData = friends.find(
                  (f) => f.friend.id === item
                );
                if (!friendData) return null;
                return (
                  <View style={styles.selectedFriendChip}>
                    <Image
                      source={{
                        uri:
                          friendData.friend.picture ||
                          "https://picsum.photos/150",
                      }}
                      style={styles.chipAvatar}
                    />
                    <Text style={styles.chipName}>
                      {friendData.friend.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        toggleFriendSelection(item)
                      }
                    >
                      <X
                        size={12}
                        color={COLORS.neutral400}
                      />
                    </TouchableOpacity>
                  </View>
                );
              }}
              style={styles.selectedFriendsList}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="AI에게 메시지 보내기..."
              placeholderTextColor={COLORS.neutral400}
              style={[
                styles.input,
                // @ts-ignore
                Platform.OS === "web" && { outlineStyle: "none" },
              ]}
              underlineColorAndroid="transparent"
              selectionColor={COLORS.primaryMain}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!input.trim()}
              style={[
                styles.sendButton,
                !input.trim() && styles.sendButtonDisabled,
              ]}
            >
              <Send
                size={18}
                color={
                  input.trim()
                    ? "white"
                    : COLORS.neutral400
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomNav activeTab={Tab.CHAT} />

      {/* Friend Selection Modal */}
      <Modal
        visible={showFriendModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowFriendModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>
                      친구 선택
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      일정을 잡을 친구를 선택하세요
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowFriendModal(false)}
                  >
                    <X
                      size={24}
                      color={COLORS.neutral400}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearch}>
                  <Search
                    size={18}
                    color={COLORS.neutral400}
                    style={styles.modalSearchIcon}
                  />
                  <TextInput
                    placeholder="친구 검색"
                    placeholderTextColor={COLORS.neutral400}
                    style={styles.modalSearchInput}
                    value={friendSearchQuery}
                    onChangeText={setFriendSearchQuery}
                  />
                </View>

                <FlatList
                  data={friends.filter(
                    (f) =>
                      friendSearchQuery === "" ||
                      f.friend.name
                        .toLowerCase()
                        .includes(
                          friendSearchQuery.toLowerCase()
                        ) ||
                      f.friend.email
                        .toLowerCase()
                        .includes(
                          friendSearchQuery.toLowerCase()
                        )
                  )}
                  keyExtractor={(item) => item.friend.id}
                  renderItem={({ item }) => {
                    const isSelected = selectedFriends.includes(
                      item.friend.id
                    );
                    return (
                      <TouchableOpacity
                        onPress={() =>
                          toggleFriendSelection(item.friend.id)
                        }
                        style={[
                          styles.friendListItem,
                          isSelected &&
                          styles.friendListItemSelected,
                        ]}
                      >
                        <View style={styles.friendListInfo}>
                          <View
                            style={
                              styles.friendListAvatarContainer
                            }
                          >
                            <Image
                              source={{
                                uri:
                                  item.friend.picture ||
                                  "https://picsum.photos/150",
                              }}
                              style={styles.friendListAvatar}
                            />
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.friendListName,
                                isSelected &&
                                styles.friendListNameSelected,
                              ]}
                            >
                              {item.friend.name}
                            </Text>
                            <Text
                              style={styles.friendListEmail}
                            >
                              {item.friend.email}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected &&
                            styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <Check size={14} color="white" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.friendList}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    onPress={() => setShowFriendModal(false)}
                    style={styles.modalDoneButton}
                  >
                    <Text style={styles.modalDoneButtonText}>
                      완료{" "}
                      {selectedFriends.length > 0 &&
                        `(${selectedFriends.length})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Context Menu Modal */}
      <Modal
        visible={activeMenuSessionId !== null}
        transparent={true}
        animationType="none"
        onRequestClose={() => setActiveMenuSessionId(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveMenuSessionId(null)}>
          <View style={styles.contextMenuOverlay}>
            <View style={[
              styles.contextMenuModal,
              { position: "absolute", top: menuPosition.y - 10, left: menuPosition.x - 180 }
            ]}>
              <TouchableOpacity
                onPress={() => {
                  const session = sessions.find(s => s.id === activeMenuSessionId);
                  if (session) {
                    setRenameModal({
                      isOpen: true,
                      sessionId: session.id,
                      currentTitle: session.title,
                    });
                  }
                  setActiveMenuSessionId(null);
                }}
                style={styles.contextMenuItem}
              >
                <Edit2
                  size={16}
                  color={COLORS.neutral600}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.contextMenuText}>
                  이름 변경
                </Text>
              </TouchableOpacity>
              <View style={styles.contextMenuDivider} />
              <TouchableOpacity
                onPress={() => {
                  if (activeMenuSessionId) {
                    setDeleteModal({
                      isOpen: true,
                      sessionId: activeMenuSessionId,
                    });
                  }
                  setActiveMenuSessionId(null);
                }}
                style={styles.contextMenuItem}
              >
                <Trash2
                  size={16}
                  color="#EF4444"
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.contextMenuText, { color: "#EF4444" }]}>
                  삭제
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModal.isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setRenameModal({
            isOpen: false,
            sessionId: null,
            currentTitle: "",
          })
        }
      >
        <View style={styles.alertModalOverlay}>
          <View style={styles.alertModalContent}>
            <Text style={styles.alertModalTitle}>
              채팅방 이름 변경
            </Text>
            <TextInput
              value={renameModal.currentTitle}
              onChangeText={(text) =>
                setRenameModal((prev) => ({
                  ...prev,
                  currentTitle: text,
                }))
              }
              style={styles.alertInput}
              autoFocus
            />
            <View style={styles.alertButtonContainer}>
              <TouchableOpacity
                onPress={() =>
                  setRenameModal({
                    isOpen: false,
                    sessionId: null,
                    currentTitle: "",
                  })
                }
                style={styles.alertButtonCancel}
              >
                <Text style={styles.alertButtonCancelText}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={updateSessionTitle}
                style={styles.alertButtonConfirm}
              >
                <Text style={styles.alertButtonConfirmText}>
                  저장
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={deleteModal.isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setDeleteModal({ isOpen: false, sessionId: null })
        }
      >
        <View style={styles.alertModalOverlay}>
          <View style={styles.alertModalContent}>
            <View style={styles.deleteIconContainer}>
              <Trash2 size={24} color="#EF4444" />
            </View>
            <Text style={styles.alertModalTitle}>
              채팅방 삭제
            </Text>
            <Text style={styles.alertModalMessage}>
              이 채팅방을 삭제하시겠습니까?{"\n"}삭제된 대화
              내용은 복구할 수 없습니다.
            </Text>
            <View style={styles.alertButtonContainer}>
              <TouchableOpacity
                onPress={() =>
                  setDeleteModal({
                    isOpen: false,
                    sessionId: null,
                  })
                }
                style={styles.alertButtonCancel}
              >
                <Text style={styles.alertButtonCancelText}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteSession}
                style={[
                  styles.alertButtonConfirm,
                  { backgroundColor: "#EF4444" },
                ]}
              >
                <Text style={styles.alertButtonConfirmText}>
                  삭제하기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutralLight,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
    position: "relative",
  },
  headerDecor: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    backgroundColor: "white",
    opacity: 0.1,
    borderRadius: 64,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerIconImage: {
    width: 26,
    height: 26,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    fontWeight: "500",
  },
  menuButton: {
    padding: 8,
    marginRight: -8,
    borderRadius: 20,
  },

  // Sidebar
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sidebarPanel: {
    width: "80%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.neutralSlate,
  },
  newChatButton: {
    padding: 8,
    backgroundColor: COLORS.primaryBg,
    borderRadius: 20,
  },
  sidebarList: {
    flex: 1,
    padding: 12,
    overflow: "visible",
  },
  sessionGroup: {
    marginBottom: 16,
  },
  sessionGroupLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.neutral400,
    marginBottom: 4,
    marginLeft: 12,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 2,
    position: "relative",
    overflow: "visible",
  },
  sessionItemActive: {
    backgroundColor: COLORS.primaryBg,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.neutralSlate,
  },
  sessionTitleActive: {
    color: COLORS.primaryMain,
  },
  sessionOptionButton: {
    padding: 6,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  contextMenuModal: {
    width: 200,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  contextMenu: {
    position: "absolute",
    right: 0,
    top: 36,
    width: 120,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    zIndex: 1000,
    padding: 4,
  },
  contextMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
  },
  contextMenuText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.neutral600,
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: COLORS.neutral100,
    marginVertical: 2,
  },

  // Alert Modals
  alertModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertModalContent: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  alertModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.neutralSlate,
    marginBottom: 16,
    textAlign: "center",
  },
  alertModalMessage: {
    fontSize: 14,
    color: COLORS.neutral400,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  alertInput: {
    backgroundColor: COLORS.neutralLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.neutralSlate,
    marginBottom: 24,
  },
  alertButtonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  alertButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    alignItems: "center",
  },
  alertButtonCancelText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.neutral500,
  },
  alertButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMain,
    alignItems: "center",
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  alertButtonConfirmText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  deleteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  messagesContainerWithContent: {
    flexGrow: 1,
  },
  messageItem: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  aiMessage: {
    justifyContent: "flex-start",
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 14,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: COLORS.primaryMain,
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "white",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: "white",
  },
  aiMessageText: {
    color: COLORS.neutralSlate,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: "flex-end",
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  aiTimestamp: {
    color: COLORS.neutral400,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral100,
    height: 40,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neutral400,
    marginHorizontal: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.neutral400,
    fontSize: 16,
    fontWeight: "500",
  },
  inputWrapper: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
    paddingTop: 12,
  },
  friendSelectionArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  friendSelectButton: {
    backgroundColor: COLORS.neutral100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  friendSelectButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.neutral500,
  },
  selectedFriendsList: {
    flexGrow: 0,
  },
  selectedFriendChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  chipName: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.neutral500,
    marginRight: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: COLORS.neutralLight,
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.neutralSlate,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMain,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.neutral200,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.neutral200,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.neutralSlate,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.neutral400,
  },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.neutralLight,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 24,
  },
  modalSearchIcon: {
    marginRight: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.neutralSlate,
  },
  friendList: {
    paddingHorizontal: 24,
    maxHeight: 300,
  },
  friendListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  friendListItemSelected: {
    backgroundColor: COLORS.primaryBg,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  friendListInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendListAvatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  friendListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral200,
  },
  friendListStatus: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: "white",
  },
  friendListName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.neutralSlate,
    marginBottom: 2,
  },
  friendListNameSelected: {
    color: COLORS.primaryMain,
  },
  friendListEmail: {
    fontSize: 12,
    color: COLORS.neutral400,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.neutral200,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primaryMain,
    borderColor: COLORS.primaryMain,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  modalDoneButton: {
    backgroundColor: COLORS.primaryMain,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.primaryMain,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalDoneButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  // 충돌 선택지 스타일
  conflictChoiceContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%",
  },
  conflictChoiceCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  conflictChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  conflictChoiceIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  conflictChoiceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
  },
  conflictChoiceText: {
    fontSize: 14,
    color: "#78350F",
    lineHeight: 20,
    marginBottom: 8,
  },
  conflictEventBadge: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  conflictEventText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
  },
  conflictChoiceResult: {
    paddingVertical: 8,
    alignItems: "center",
  },
  conflictChoiceResultText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#78350F",
  },
  conflictChoiceButtons: {
    flexDirection: "row",
    gap: 8,
  },
  conflictChoiceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  conflictSkipButton: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  conflictAdjustButton: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  conflictChoiceButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  conflictSkipButtonText: {
    color: "#DC2626",
  },
  conflictAdjustButtonText: {
    color: "#059669",
  },
});

