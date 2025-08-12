# AI Joy Assistant Frontend

AI Joy Assistant의 프론트엔드 애플리케이션입니다.

## 주요 변경사항

### JWT 인증으로 통일 (2024년 12월)

- **기존**: AsyncStorage를 직접 사용하여 토큰 관리
- **변경**: JWTManager와 공통 API 함수를 통한 체계적인 토큰 관리
- **제거된 기능**: 
  - 직접적인 AsyncStorage 사용
  - 하드코딩된 API URL
  - 중복된 인증 로직
- **추가된 기능**:
  - JWT 토큰 관리 유틸리티 (`JWTManager`)
  - 공통 API 클라이언트 (`ApiClient`)
  - 타입 안전한 API 함수들

## 기술 스택

- **Framework**: React Native + Expo
- **언어**: TypeScript
- **상태 관리**: React Hooks
- **인증**: JWT (JSON Web Token)
- **네비게이션**: React Navigation
- **아이콘**: Expo Vector Icons

## 프로젝트 구조

```
Frontend/
├── app/                    # Expo Router 기반 화면
├── components/             # 재사용 가능한 컴포넌트
├── screens/                # 화면 컴포넌트
├── lib/                    # 유틸리티 라이브러리
│   ├── jwt.ts             # JWT 토큰 관리
│   ├── api.ts             # 공통 API 함수
│   └── supabase.ts        # Supabase 설정
├── hooks/                  # 커스텀 훅
├── types/                  # TypeScript 타입 정의
└── constants/              # 상수 정의
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 설정

`config/google.ts` 파일에서 Google OAuth 설정을 확인하세요.

### 3. 개발 서버 실행

```bash
npm start
```

## JWT 인증 시스템

### JWTManager 클래스

JWT 토큰을 안전하게 관리하는 유틸리티 클래스입니다.

```typescript
import { JWTManager } from '../lib/jwt';

// 액세스 토큰 저장
await JWTManager.setAccessToken(token);

// 액세스 토큰 가져오기
const token = await JWTManager.getAccessToken();

// 모든 토큰 삭제 (로그아웃)
await JWTManager.clearTokens();

// 토큰 유효성 확인
const isValid = await JWTManager.hasValidToken();
```

### 공통 API 함수

타입 안전한 API 호출을 위한 공통 함수들입니다.

```typescript
import { authApi, chatApi, friendsApi } from '../lib/api';

// 사용자 정보 조회
const result = await authApi.getMe();
if (result.success) {
  console.log(result.data);
}

// 채팅방 목록 조회
const result = await chatApi.getRooms();
if (result.success) {
  console.log(result.data);
}

// 친구 추가
const result = await friendsApi.addFriend('user@example.com');
if (result.success) {
  console.log('친구 추가 성공');
}
```

## 화면 구성

### 1. 인증 화면

- **LoginScreen**: Google OAuth 로그인
- **SplashScreen**: 앱 시작 화면

### 2. 메인 화면

- **HomeScreen**: 메인 대시보드
- **ChatScreen**: 채팅 기능
- **FriendsScreen**: 친구 관리
- **MyPageScreen**: 사용자 프로필

### 3. 공통 컴포넌트

- **GoogleLogin**: Google 로그인 버튼
- **ThemedText**: 테마 적용된 텍스트
- **ThemedView**: 테마 적용된 뷰

## API 통신

### 기본 설정

- **Base URL**: `http://localhost:8000`
- **인증 방식**: Bearer Token (JWT)
- **Content-Type**: `application/json`

### 인증 헤더 자동 생성

```typescript
import { createAuthHeaders } from '../lib/jwt';

const headers = await createAuthHeaders();
// Authorization: Bearer <token> 헤더가 자동으로 포함됨
```

### 에러 처리

모든 API 함수는 일관된 응답 형식을 반환합니다:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 성공 시
if (result.success && result.data) {
  // 데이터 처리
} else {
  // 에러 처리
  console.error(result.error);
}
```

## 상태 관리

### React Hooks 사용

```typescript
const [userInfo, setUserInfo] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const result = await authApi.getMe();
      if (result.success) {
        setUserInfo(result.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  fetchUserInfo();
}, []);
```

## 개발 가이드

### 새로운 화면 추가 시

1. `screens/` 폴더에 새 화면 컴포넌트 생성
2. `types.ts`에 네비게이션 타입 추가
3. `app/` 폴더에 라우팅 설정 추가

### 새로운 API 엔드포인트 추가 시

1. `lib/api.ts`에 새로운 API 함수 추가
2. 적절한 타입 정의 추가
3. 화면에서 API 함수 사용

### JWT 토큰 만료 처리

```typescript
import { ApiClient } from '../lib/api';

// API 호출 시 자동으로 토큰 갱신 시도
const result = await ApiClient.get('/protected-endpoint');
if (!result.success && result.error?.includes('401')) {
  // 토큰 갱신 시도
  const refreshed = await ApiClient.refreshToken();
  if (refreshed) {
    // 원래 요청 재시도
    const retryResult = await ApiClient.get('/protected-endpoint');
  }
}
```

## 문제 해결

### 일반적인 오류

1. **JWT 토큰 만료**: `/auth/refresh` 엔드포인트로 토큰 갱신
2. **네트워크 오류**: API Base URL 확인
3. **타입 오류**: TypeScript 타입 정의 확인

### 디버깅

- 개발자 도구에서 네트워크 탭 확인
- 콘솔 로그에서 JWT 토큰 상태 확인
- AsyncStorage에 저장된 토큰 확인

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.
