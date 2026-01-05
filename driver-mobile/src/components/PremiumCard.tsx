// QScrap Driver App - Premium Card Component
// Glassmorphism card with shadow effects and consistent styling

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows, BorderRadius } from '../constants/theme';

interface PremiumCardProps {
    children: ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'sm' | 'md' | 'lg';
}

export function PremiumCard({
    children,
    style,
    variant = 'default',
    padding = 'md'
}: PremiumCardProps) {
    const paddingValue = {
        sm: 12,
        md: 16,
        lg: 24,
    }[padding];

    const variantStyles = {
        default: {
            backgroundColor: Colors.theme.surface,
            ...Shadows.sm,
        },
        elevated: {
            backgroundColor: Colors.theme.surface,
            ...Shadows.md,
        },
        outlined: {
            backgroundColor: Colors.theme.surface,
            borderWidth: 1,
            borderColor: Colors.theme.border,
        },
    }[variant];

    return (
        <View style={[
            styles.card,
            variantStyles,
            { padding: paddingValue },
            style,
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
});

export default PremiumCard;
