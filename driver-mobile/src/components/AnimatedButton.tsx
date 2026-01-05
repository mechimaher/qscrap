// QScrap Driver App - Animated Button Component
// Premium gradient button with haptic feedback and loading states

import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, FontWeights } from '../constants/theme';

interface AnimatedButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export function AnimatedButton({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    style,
    textStyle,
}: AnimatedButtonProps) {
    const handlePress = () => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
    };

    const sizeStyles = {
        sm: { height: 40, paddingHorizontal: 16, fontSize: 14 },
        md: { height: 48, paddingHorizontal: 20, fontSize: 16 },
        lg: { height: 56, paddingHorizontal: 24, fontSize: 18 },
    }[size];

    const getGradientColors = (): readonly [string, string] => {
        switch (variant) {
            case 'secondary':
                return Colors.gradients.gold;
            case 'danger':
                return [Colors.danger, '#b91c1c'] as const;
            case 'outline':
                return ['transparent', 'transparent'] as const;
            default:
                return Colors.gradients.primary;
        }
    };

    const isOutline = variant === 'outline';
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            disabled={isDisabled}
            style={[
                styles.container,
                { height: sizeStyles.height },
                isDisabled && styles.disabled,
                style,
            ]}
        >
            <LinearGradient
                colors={getGradientColors()}
                style={[
                    styles.gradient,
                    { paddingHorizontal: sizeStyles.paddingHorizontal },
                    isOutline && styles.outlineGradient,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                {loading ? (
                    <ActivityIndicator
                        color={isOutline ? Colors.primary : '#fff'}
                        size="small"
                    />
                ) : (
                    <>
                        {icon && <Text style={styles.icon}>{icon}</Text>}
                        <Text style={[
                            styles.text,
                            { fontSize: sizeStyles.fontSize },
                            isOutline && styles.outlineText,
                            textStyle,
                        ]}>
                            {title}
                        </Text>
                    </>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    outlineGradient: {
        borderWidth: 2,
        borderColor: Colors.primary,
        borderRadius: BorderRadius.md,
    },
    text: {
        color: '#fff',
        fontWeight: FontWeights.bold,
    },
    outlineText: {
        color: Colors.primary,
    },
    icon: {
        fontSize: 18,
    },
    disabled: {
        opacity: 0.6,
    },
});

export default AnimatedButton;
