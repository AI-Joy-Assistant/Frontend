import { create } from 'zustand';

interface RequestMeetingState {
    // Form Data
    title: string;
    location: string;
    selectedFriends: string[];
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    durationNights: number;
    durationHour: number;
    durationMinute: number;

    // Actions
    setTitle: (title: string) => void;
    setLocation: (location: string) => void;
    setSelectedFriends: (friends: string[]) => void;
    setStartDate: (date: string) => void;
    setEndDate: (date: string) => void;
    setStartTime: (time: string) => void;
    setEndTime: (time: string) => void;
    setDurationNights: (nights: number) => void;
    setDurationHour: (hour: number) => void;
    setDurationMinute: (minute: number) => void;

    // Reset
    reset: () => void;
}

export const useRequestMeetingStore = create<RequestMeetingState>((set) => {
    // Initial Date Logic
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}-${tomorrow.getDate().toString().padStart(2, '0')}`;

    return {
        title: '',
        location: '',
        selectedFriends: [],
        startDate: todayStr,
        endDate: tomorrowStr,
        startTime: '09:00',
        endTime: '18:00',
        durationNights: 0,
        durationHour: 1,
        durationMinute: 0,

        setTitle: (title) => set({ title }),
        setLocation: (location) => set({ location }),
        setSelectedFriends: (selectedFriends) => set({ selectedFriends }),
        setStartDate: (startDate) => set({ startDate }),
        setEndDate: (endDate) => set({ endDate }),
        setStartTime: (startTime) => set({ startTime }),
        setEndTime: (endTime) => set({ endTime }),
        setDurationNights: (durationNights) => set({ durationNights }),
        setDurationHour: (durationHour) => set({ durationHour }),
        setDurationMinute: (durationMinute) => set({ durationMinute }),

        reset: () => set({
            title: '',
            location: '',
            selectedFriends: [],
            startDate: todayStr,
            endDate: tomorrowStr,
            startTime: '09:00',
            endTime: '18:00',
            durationNights: 0,
            durationHour: 1,
            durationMinute: 0,
        })
    };
});
