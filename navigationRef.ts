// navigationRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types'; // 타입 정의 파일 경로에 맞게 수정

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
