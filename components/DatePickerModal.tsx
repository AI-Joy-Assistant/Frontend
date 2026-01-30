import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { COLORS } from '../constants/Colors';

interface DatePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    initialDate?: Date;
}

export default function DatePickerModal({ visible, onClose, onSelect, initialDate }: DatePickerModalProps) {
    const [viewDate, setViewDate] = useState(initialDate || new Date());

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // 오늘 날짜 문자열 (과거 날짜 비교용)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 달력 데이터 (주 단위로 구성)
    const weeks = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const weeksArr: (number | null)[][] = [];
        let currentWeek: (number | null)[] = Array(firstDay).fill(null);

        for (let day = 1; day <= daysInMonth; day++) {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weeksArr.push(currentWeek);
        }
        return weeksArr;
    }, [year, month]);

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (day: number) => {
        const selectedDate = new Date(year, month, day);
        onSelect(selectedDate);
        onClose();
    };

    // 날짜 문자열 생성
    const getDateStr = (day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // 선택된 날짜인지 확인
    const isSelectedDate = (day: number) => {
        if (!initialDate) return false;
        const dateStr = getDateStr(day);
        const initialStr = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}`;
        return dateStr === initialStr;
    };

    // 과거 날짜인지 확인
    const isPastDate = (day: number) => {
        const dateStr = getDateStr(day);
        return new Date(dateStr) < new Date(todayStr);
    };

    // 오늘인지 확인
    const isTodayDate = (day: number) => {
        const dateStr = getDateStr(day);
        return dateStr === todayStr;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.container}>
                            <View style={styles.header}>
                                <Text style={styles.title}>날짜 선택</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <X size={24} color={COLORS.neutral400} />
                                </TouchableOpacity>
                            </View>

                            {/* A2A 스타일 달력 헤더 */}
                            <View style={styles.calendarHeader}>
                                <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                                    <ChevronLeft size={20} color={COLORS.neutral500} />
                                </TouchableOpacity>
                                <Text style={styles.monthText}>
                                    {year}.{String(month + 1).padStart(2, '0')}
                                </Text>
                                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                                    <ChevronRight size={20} color={COLORS.neutral500} />
                                </TouchableOpacity>
                            </View>

                            {/* 요일 헤더 */}
                            <View style={styles.weekRow}>
                                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                                    <Text
                                        key={i}
                                        style={[
                                            styles.weekDay,
                                            i === 0 && styles.sundayText
                                        ]}
                                    >
                                        {d}
                                    </Text>
                                ))}
                            </View>

                            {/* 날짜 그리드 - A2A 스타일 */}
                            <View style={styles.daysGrid}>
                                {weeks.map((week, wIdx) => (
                                    <View key={wIdx} style={styles.weekRowDays}>
                                        {week.map((day, dIdx) => {
                                            if (!day) {
                                                return <View key={dIdx} style={styles.emptyCell} />;
                                            }

                                            const isSelected = isSelectedDate(day);
                                            const isToday = isTodayDate(day);
                                            const isSunday = dIdx === 0;

                                            return (
                                                <TouchableOpacity
                                                    key={dIdx}
                                                    onPress={() => handleDateClick(day)}
                                                    style={styles.dayCell}
                                                >
                                                    <View style={[
                                                        styles.dayCircle,
                                                        isSelected && styles.selectedCircle,
                                                        isToday && !isSelected && styles.todayCircle
                                                    ]}>
                                                        <Text style={[
                                                            styles.dayText,
                                                            isSelected && styles.selectedDayText,
                                                            isSunday && !isSelected && styles.sundayDayText,
                                                            isToday && !isSelected && styles.todayDayText
                                                        ]}>
                                                            {day}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 360,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.neutral900,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    navButton: {
        padding: 4,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.neutralSlate || COLORS.neutral900,
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDay: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: COLORS.neutral500,
        fontWeight: '500',
    },
    sundayText: {
        color: '#EF4444',
    },
    daysGrid: {
        width: '100%',
    },
    weekRowDays: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    emptyCell: {
        flex: 1,
        height: 40,
    },
    dayCell: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    selectedCircle: {
        backgroundColor: COLORS.primaryMain,
    },
    todayCircle: {
        backgroundColor: COLORS.primaryBg || '#F0F4FF',
    },
    dayText: {
        fontSize: 14,
        color: COLORS.neutralSlate || COLORS.neutral900,
        fontWeight: '400',
    },
    selectedDayText: {
        color: 'white',
        fontWeight: 'bold',
    },
    pastDayText: {
        color: COLORS.neutral300,
    },
    sundayDayText: {
        color: '#EF4444',
    },
    todayDayText: {
        fontWeight: '700',
        color: COLORS.primaryMain,
    },
});
