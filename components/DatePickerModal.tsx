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

    const calendarData = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const days = [];
        // Prev Month
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, type: 'prev', date: new Date(year, month - 1, daysInPrevMonth - i) });
        }
        // Current Month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, type: 'current', date: new Date(year, month, i) });
        }
        // Next Month
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, type: 'next', date: new Date(year, month + 1, i) });
        }
        return days;
    }, [year, month]);

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (date: Date) => {
        onSelect(date);
        onClose();
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

                            <View style={styles.calendarHeader}>
                                <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                                    <ChevronLeft size={24} color={COLORS.neutral600} />
                                </TouchableOpacity>
                                <Text style={styles.monthText}>{year}년 {month + 1}월</Text>
                                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                                    <ChevronRight size={24} color={COLORS.neutral600} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.grid}>
                                <View style={styles.weekRow}>
                                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                                        <Text key={i} style={[styles.weekDay, i === 0 && styles.sunday]}>{d}</Text>
                                    ))}
                                </View>
                                <View style={styles.daysRow}>
                                    {calendarData.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.dayCell}
                                            onPress={() => handleDateClick(item.date)}
                                        >
                                            <Text style={[
                                                styles.dayText,
                                                item.type !== 'current' && styles.grayText,
                                                item.date.toDateString() === new Date().toDateString() && styles.todayText,
                                                item.date.toDateString() === (initialDate || new Date()).toDateString() && styles.selectedText
                                            ]}>
                                                {item.day}
                                            </Text>
                                            {item.date.toDateString() === (initialDate || new Date()).toDateString() && (
                                                <View style={styles.selectedCircle} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
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
        marginBottom: 20,
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
        color: COLORS.neutral900,
    },
    grid: {
        width: '100%',
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDay: {
        flex: 1,
        textAlign: 'center',
        fontSize: 13,
        color: COLORS.neutral400,
        fontWeight: '500',
    },
    sunday: {
        color: '#F87171',
    },
    daysRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dayText: {
        fontSize: 14,
        color: COLORS.neutral900,
        zIndex: 2,
    },
    grayText: {
        color: COLORS.neutral300,
    },
    todayText: {
        color: COLORS.primaryMain,
        fontWeight: 'bold',
    },
    selectedText: {
        color: 'white',
        fontWeight: 'bold',
    },
    selectedCircle: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryMain,
        zIndex: 1,
    },
});
