export interface ScheduleItem {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    time: string; // "HH:mm - HH:mm"
    participants: string[];
    type: 'NORMAL' | 'A2A';
    hasConflict?: boolean;        // 다른 일정과 시간 겹침 여부
    conflictWith?: string[];      // 충돌하는 일정 ID 목록
    location?: string;
    source?: string;
    googleEventId?: string;
    sessionId?: string;
}
