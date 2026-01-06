import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ViewStyle,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../constants/theme';

type EmptyStateVariant = 'default' | 'assignments' | 'error' | 'offline' | 'earnings';

interface EmptyStateProps {
    variant?: EmptyStateVariant;
    emoji?: string;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, { emoji: string; color: string }> = {
    default: { emoji: '📭', color: Colors.primary },
    assignments: { emoji: '🚚', color: Colors.primary },
    error: { emoji: '⚠️', color: Colors.danger },
    offline: { emoji: '📡', color: Colors.warning },
    earnings: { emoji: '💰', color: Colors.success },
};

/**
 * Premium empty state component with illustration, title, message, and action button.
 * Use for empty lists, no assignments, errors, and offline states.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    variant = 'default',
    emoji,
    title,
    message,
    actionLabel,
    onAction,
    style,
}) => {
    const { colors } = useTheme();
    const config = VARIANT_CONFIG[variant];

    return (
        <View style={[styles.container, style]}>
            {/* Emoji Icon */}
            <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
                <Text style={styles.emoji}>{emoji || config.emoji}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

            {/* Message */}
            {message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
            )}

            {/* Action Button */}
            {actionLabel && onAction && (
                <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[Colors.primary, Colors.primaryDark]}
                        style={styles.actionButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.actionText}>{actionLabel}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xxl,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    emoji: {
        fontSize: 48,
    },
    title: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    message: {
        fontSize: FontSize.md,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
    actionButton: {
        marginTop: Spacing.xl,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    actionText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
});

export default EmptyState;
