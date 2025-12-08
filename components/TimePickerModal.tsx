import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS } from '../constants/Colors';

interface TimePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    initialTime?: Date;
}

type Period = '오전' | '오후';

export default function TimePickerModal({ visible, onClose, onSelect, initialTime }: TimePickerModalProps) {
    // Initialize state based on initialTime
    const getInitialState = () => {
        const time = initialTime || new Date();
        const h = time.getHours();
        const m = time.getMinutes();
        const period: Period = h >= 12 ? '오후' : '오전';
        const displayHour = h % 12 || 12; // Convert 0-23 to 1-12
        return { period, hour: displayHour, minute: m };
    };

    const [selectedPeriod, setSelectedPeriod] = useState<Period>('오전');
    const [selectedHour, setSelectedHour] = useState(12);
    const [selectedMinute, setSelectedMinute] = useState(0);

    // Update state when modal becomes visible or initialTime changes
    useEffect(() => {
        if (visible) {
            const { period, hour, minute } = getInitialState();
            setSelectedPeriod(period);
            setSelectedHour(hour);
            setSelectedMinute(minute);
        }
    }, [visible, initialTime]);

    const periods: Period[] = ['오전', '오후'];
    const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
    const minutes = Array.from({ length: 60 }, (_, i) => i); // 0-59

    const handleConfirm = () => {
        const date = new Date();
        let finalHour = selectedHour;

        if (selectedPeriod === '오전') {
            if (finalHour === 12) finalHour = 0;
        } else {
            // 오후
            if (finalHour !== 12) finalHour += 12;
        }

        date.setHours(finalHour);
        date.setMinutes(selectedMinute);
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
                                <Text style={styles.title}>시간 선택</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <X size={24} color={COLORS.neutral400} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.pickerContainer}>
                                {/* AM/PM Column */}
                                <View style={[styles.column, { justifyContent: 'center' }]}>
                                    {periods.map((p) => (
                                        <TouchableOpacity
                                            key={p}
                                            style={[styles.item, selectedPeriod === p && styles.selectedItem]}
                                            onPress={() => setSelectedPeriod(p)}
                                        >
                                            <Text style={[styles.itemText, selectedPeriod === p && styles.selectedItemText]}>
                                                {p}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.divider} />

                                {/* Hour Column */}
                                <View style={styles.column}>
                                    <Text style={styles.columnLabel}>시</Text>
                                    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                                        {hours.map((h) => (
                                            <TouchableOpacity
                                                key={h}
                                                style={[styles.item, selectedHour === h && styles.selectedItem]}
                                                onPress={() => setSelectedHour(h)}
                                            >
                                                <Text style={[styles.itemText, selectedHour === h && styles.selectedItemText]}>
                                                    {h.toString()}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <View style={styles.divider} />

                                {/* Minute Column */}
                                <View style={styles.column}>
                                    <Text style={styles.columnLabel}>분</Text>
                                    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                                        {minutes.map((m) => (
                                            <TouchableOpacity
                                                key={m}
                                                style={[styles.item, selectedMinute === m && styles.selectedItem]}
                                                onPress={() => setSelectedMinute(m)}
                                            >
                                                <Text style={[styles.itemText, selectedMinute === m && styles.selectedItemText]}>
                                                    {m.toString().padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                                <Text style={styles.confirmButtonText}>확인</Text>
                            </TouchableOpacity>
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
        maxWidth: 340, // Slightly wider for 3 columns
        height: 400,
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
    pickerContainer: {
        flex: 1,
        flexDirection: 'row',
        marginBottom: 20,
    },
    column: {
        flex: 1,
        alignItems: 'center',
    },
    columnLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutral500,
        marginBottom: 8,
    },
    scroll: {
        width: '100%',
    },
    item: {
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
        width: '100%',
    },
    selectedItem: {
        backgroundColor: '#F0F9FF',
    },
    itemText: {
        fontSize: 18,
        color: COLORS.neutral400,
    },
    selectedItemText: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
        fontSize: 20,
    },
    divider: {
        width: 1,
        backgroundColor: COLORS.neutral200,
        marginHorizontal: 10,
    },
    confirmButton: {
        backgroundColor: COLORS.primaryDark,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
