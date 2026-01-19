// QScrap Mobile - VIN Scan Button Component
// Reusable button for integrating VIN scanner into any screen

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';

interface VINScanButtonProps {
    onVINScanned: (vehicleData: VehicleData) => void;
    variant?: 'primary' | 'secondary' | 'icon';
    label?: string;
}

interface VehicleData {
    vin: string;
    make: string;
    model: string;
    year: number;
    confidence?: number;
}

export function VINScanButton({
    onVINScanned,
    variant = 'primary',
    label = 'Scan VIN'
}: VINScanButtonProps) {
    const navigation = useNavigation<any>();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('VINScanner', {
            onVINScanned
        });
    };

    if (variant === 'icon') {
        return (
            <TouchableOpacity style={styles.iconButton} onPress={handlePress}>
                <Ionicons name="scan" size={24} color={Colors.primary} />
            </TouchableOpacity>
        );
    }

    if (variant === 'secondary') {
        return (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePress}>
                <Ionicons name="scan-outline" size={20} color={Colors.primary} />
                <Text style={styles.secondaryText}>{label}</Text>
            </TouchableOpacity>
        );
    }

    // Primary variant
    return (
        <TouchableOpacity style={styles.primaryButton} onPress={handlePress}>
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.primaryText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary + '20',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
    },
    primaryText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.primary + '10',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    secondaryText: {
        color: Colors.primary,
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
});
