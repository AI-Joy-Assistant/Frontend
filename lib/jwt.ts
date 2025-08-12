import AsyncStorage from '@react-native-async-storage/async-storage';

// JWT 토큰 관리 유틸리티
export class JWTManager {
  private static readonly ACCESS_TOKEN_KEY = 'accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'refreshToken';

  // 액세스 토큰 저장
  static async setAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ACCESS_TOKEN_KEY, token);
      console.log('✅ JWT 액세스 토큰 저장 완료');
    } catch (error) {
      console.error('❌ JWT 액세스 토큰 저장 실패:', error);
      throw error;
    }
  }

  // 액세스 토큰 가져오기
  static async getAccessToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(this.ACCESS_TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('❌ JWT 액세스 토큰 가져오기 실패:', error);
      return null;
    }
  }

  // 리프레시 토큰 저장
  static async setRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.REFRESH_TOKEN_KEY, token);
      console.log('✅ JWT 리프레시 토큰 저장 완료');
    } catch (error) {
      console.error('❌ JWT 리프레시 토큰 저장 실패:', error);
      throw error;
    }
  }

  // 리프레시 토큰 가져오기
  static async getRefreshToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(this.REFRESH_TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('❌ JWT 리프레시 토큰 가져오기 실패:', error);
      return null;
    }
  }

  // 모든 토큰 삭제 (로그아웃)
  static async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.ACCESS_TOKEN_KEY, this.REFRESH_TOKEN_KEY]);
      console.log('✅ JWT 토큰 삭제 완료');
    } catch (error) {
      console.error('❌ JWT 토큰 삭제 실패:', error);
      throw error;
    }
  }

  // 토큰 존재 여부 확인
  static async hasValidToken(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return token !== null && token.length > 0;
    } catch (error) {
      console.error('❌ JWT 토큰 유효성 확인 실패:', error);
      return false;
    }
  }
}

// API 요청을 위한 헤더 생성
export const createAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await JWTManager.getAccessToken();
  if (token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }
  return {
    'Content-Type': 'application/json'
  };
};

// JWT 토큰 디코딩 (클라이언트 사이드에서 payload 확인용)
export const decodeJWT = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('❌ JWT 디코딩 실패:', error);
    return null;
  }
};

// JWT 토큰 만료 시간 확인
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('❌ JWT 토큰 만료 시간 확인 실패:', error);
    return true;
  }
};
