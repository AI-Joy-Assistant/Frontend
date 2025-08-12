import { JWTManager, createAuthHeaders } from './jwt';

// API 기본 설정
const API_BASE_URL = 'http://localhost:3000';

// 공통 API 응답 타입
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// API 요청 함수들
export class ApiClient {
  // GET 요청
  static async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const headers = await createAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.detail || `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      console.error('API GET 요청 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  // POST 요청
  static async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    try {
      const headers = await createAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.detail || `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      console.error('API POST 요청 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  // PUT 요청
  static async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    try {
      const headers = await createAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.detail || `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      console.error('API PUT 요청 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  // DELETE 요청
  static async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const headers = await createAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.detail || `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      console.error('API DELETE 요청 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  // 토큰 갱신
  static async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await JWTManager.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await JWTManager.setAccessToken(data.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('토큰 갱신 오류:', error);
      return false;
    }
  }

  // 인증 상태 확인
  static async checkAuth(): Promise<boolean> {
    try {
      const token = await JWTManager.getAccessToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
      return false;
    }
  }
}

// 인증 관련 API 함수들
export const authApi = {
  // 사용자 정보 조회
  getMe: () => ApiClient.get('/auth/me'),
  
  // 사용자 정보 수정
  updateMe: (userData: any) => ApiClient.put('/auth/me', userData),
  
  // 사용자 계정 삭제
  deleteMe: () => ApiClient.delete('/auth/me'),
  
  // 로그아웃
  logout: () => ApiClient.post('/auth/logout', {}),
};

// 채팅 관련 API 함수들
export const chatApi = {
  // 채팅방 목록 조회
  getRooms: () => ApiClient.get('/chat/rooms'),
  
  // 채팅 메시지 조회
  getMessages: (otherUserId: string) => ApiClient.get(`/chat/messages/${otherUserId}`),
  
  // 메시지 전송
  sendMessage: (messageData: any) => ApiClient.post('/chat/send', messageData),
  
  // 친구 목록 조회
  getFriends: () => ApiClient.get('/chat/friends'),
};

// 친구 관련 API 함수들
export const friendsApi = {
  // 친구 요청 목록 조회
  getRequests: () => ApiClient.get('/friends/requests'),
  
  // 친구 요청 수락
  acceptRequest: (requestId: string) => ApiClient.post(`/friends/requests/${requestId}/accept`, {}),
  
  // 친구 요청 거절
  rejectRequest: (requestId: string) => ApiClient.post(`/friends/requests/${requestId}/reject`, {}),
  
  // 친구 목록 조회
  getFriends: () => ApiClient.get('/friends/list'),
  
  // 친구 삭제
  deleteFriend: (friendId: string) => ApiClient.delete(`/friends/${friendId}`),
  
  // 친구 추가
  addFriend: (email: string) => ApiClient.post('/friends/add', { email }),
};
