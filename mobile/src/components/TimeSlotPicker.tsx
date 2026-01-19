// QScrap Time Slot Picker - Delivery Scheduling
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface TimeSlot {
    id: string;
    label: string;
    value: string;
    icon: string;
}

const TIME_SLOTS: TimeSlot[] = [
    { id: '1', label: 'Morning', value: '09:00-12:00', icon: '🌅' },
    { id: '2', label: 'Afternoon', value: '12:00-15:00', icon: '☀️' },
    { id: '3', label: 'Evening', value: '15:00-18:00', icon: '🌆' },
    { id: '4', label: 'Night', value: '18:00-21:00', icon: '🌙' },
];

interface TimeSlotPickerProps {
    selected?: string;
    onSelect: (value: string) => void;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({ selected, onSelect }) => {
    const handleSelect = (value: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(value);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Select Delivery Time</Text>
            <Text style={styles.subtitle}>Choose your preferred delivery window</Text>

            <View style={styles.slotsGrid}>
                {TIME_SLOTS.map((slot) => {
                    const isSelected = selected === slot.value;

                    return (
                        <TouchableOpacity
                            key={slot.id}
                            onPress={() => handleSelect(slot.value)}
                            style={styles.slotButton}
                        >
                            {isSelected ? (
                                <LinearGradient
                                    colors={['#8D1B3D', '#C9A227']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.slotGradient}
                                >
                                    <Text style={styles.slotIcon}>{slot.icon}</Text>
                                    <Text style={styles.slotLabelSelected}>{slot.label}</Text>
                                    <Text style={styles.slotTimeSelected}>{slot.value}</Text>
                                    <View style={styles.checkmark}>
                                        <Text style={styles.checkmarkText}>✓</Text>
                                    </View>
                                </LinearGradient>
                            ) : (
                                <View style={styles.slotContent}>
                                    <Text style={styles.slotIcon}>{slot.icon}</Text>
                                    <Text style={styles.slotLabel}>{slot.label}</Text>
                                    <Text style={styles.slotTime}>{slot.value}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.theme.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: FontSizes.sm,
        color: Colors.theme.textSecondary,
        marginBottom: Spacing.xl,
    },
    slotsGrid: {
        gap: Spacing.md,
    },
    slotButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    slotGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    slotContent: {
        padding: Spacing.lg,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E8E8E8',
    },
    slotIcon: {
        fontSize: 32,
        marginBottom: Spacing.sm,
    },
    slotLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.theme.text,
        marginBottom: Spacing.xs,
    },
    slotLabelSelected: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: Spacing.xs,
    },
    slotTime: {
        fontSize: FontSizes.sm,
        color: Colors.theme.textSecondary,
    },
    slotTimeSelected: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.9)',
    },
    checkmark: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
});

export default TimeSlotPicker;
