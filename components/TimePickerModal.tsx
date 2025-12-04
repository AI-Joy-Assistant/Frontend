import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS } from '../constants/Colors';

interface TimePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    initialTime?: Date;
}

export default function TimePickerModal({ visible, onClose, onSelect, initialTime }: TimePickerModalProps) {
    const [selectedHour, setSelectedHour] = useState(initialTime ? initialTime.getHours() : 9);
    const [selectedMinute, setSelectedMinute] = useState(initialTime ? initialTime.getMinutes() : 0);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10...

    const handleConfirm = () => {
        const date = new Date();
        date.setHours(selectedHour);
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
                                                    {h.toString().padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <View style={styles.divider} />

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
        maxWidth: 320,
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
    },
    selectedItem: {
        backgroundColor: '#F0F9FF',
    },
    itemText: {
        fontSize: 18,
        color: COLORS.neutral400,
    },
    selectedItemText: {
        color: COLORS.primaryMain,
        fontWeight: 'bold',
        fontSize: 20,
    },
    divider: {
        width: 1,
        backgroundColor: COLORS.neutral200,
        marginHorizontal: 10,
    },
    confirmButton: {
        backgroundColor: COLORS.primaryMain,
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
