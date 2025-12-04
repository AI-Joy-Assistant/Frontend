export interface ScheduleItem {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    time: string; // "HH:mm - HH:mm"
    participants: string[];
    type: 'NORMAL' | 'A2A';
}
