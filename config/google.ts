// Google OAuth 설정
export const GOOGLE_CONFIG = {
  // Google Cloud Console에서 가져온 OAuth 2.0 클라이언트 ID
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
  
  // 리디렉션 URI (Expo 개발 서버)
  REDIRECT_URI: 'http://localhost:8081/auth/callback',
  
  // 요청할 권한 범위
  SCOPES: [
    'openid',
    'email', 
    'profile',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  
  // OAuth URL 생성
  getAuthUrl: () => {
    const scope = GOOGLE_CONFIG.SCOPES.join(' ');
    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CONFIG.CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(GOOGLE_CONFIG.REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;
  }
};

// 설정 확인
export const validateGoogleConfig = () => {
  if (GOOGLE_CONFIG.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    console.error('❌ Google OAuth 클라이언트 ID가 설정되지 않았습니다!');
    console.error('📝 Frontend/config/google.ts 파일에서 CLIENT_ID를 설정해주세요.');
    return false;
  }
  return true;
};
