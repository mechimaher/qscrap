// QScrap Driver App - StatCard Component
// Extracted from HomeScreen for reusability
// Displays animated stats in a premium glass card

import React, { useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { Colors } from '../../constants/theme';
import { AnimatedNumber, AnimatedRating } from '../index';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: number | string;
    label: string;
    color: string;
    colors: any; // Theme colors
    delay?: number;
    isRating?: boolean;
    isCurrency?: boolean;
}

export function StatCard({
    icon,
    value,
    label,
    color,
    colors,
    delay = 0,
    isRating = false,
    isCurrency = false
}: StatCardProps) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    // Format currency with compact notation for large amounts
    const formatCurrency = (num: number): { value: string; suffix: string } => {
        if (num >= 10000) {
            return { value: (num / 1000).toFixed(1), suffix: 'K QAR' };
        } else if (num >= 1000) {
            return { value: num.toFixed(0), suffix: ' QAR' };
        } else {
            return { value: num.toFixed(num % 1 === 0 ? 0 : 2), suffix: ' QAR' };
        }
    };

    // Parse numeric value
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

    // Get display values based on type
    let displayValue = numericValue;
    let suffix = '';

    if (isCurrency) {
        const formatted = formatCurrency(numericValue);
        displayValue = parseFloat(formatted.value);
        suffix = formatted.suffix;
    }

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.wrapper}
        >
            <Animated.View style={[
                styles.card,
                { backgroundColor: colors.surface, transform: [{ scale: scaleAnim }] }
            ]}>
                <Ionicons name={icon} size={24} color={color} />
                {isRating ? (
                    <AnimatedRating value={numericValue} delay={delay} style={{ color: colors.text }} />
                ) : (
                    <View style={styles.valueContainer}>
                        <AnimatedNumber
                            value={displayValue}
                            delay={delay}
                            suffix={suffix}
                            style={styles.valueText}
                        />
                    </View>
                )}
                <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    card: {
        flex: 1,
        padding: 16,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 110,
        // VVIP 2026: Glassmorphism effect
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        borderTopColor: 'rgba(255,255,255,0.8)',
        // Premium shadow
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    valueText: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    label: {
        fontSize: 12,
        marginTop: 4,
    },
});

export default StatCard;
