import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { Spacing, FontSize } from '../constants';
import { Button } from './Button';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'offline';

interface EmptyStateProps {
    variant?: EmptyStateVariant;
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

/**
 * Beautiful empty state component with illustration, title, message, and action button.
 * Use for empty lists, search results, errors, and offline states.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    variant = 'default',
    icon,
    title,
    message,
    actionLabel,
    onAction,
    style,
}) => {
    const { colors } = useTheme();

    const getIcon = (): keyof typeof Ionicons.glyphMap => {
        if (icon) return icon;
        switch (variant) {
            case 'search':
                return 'search-outline';
            case 'error':
                return 'warning-outline';
            case 'offline':
                return 'cloud-offline-outline';
            default:
                return 'folder-open-outline';
        }
    };

    const getIconColor = (): string => {
        switch (variant) {
            case 'error':
                return colors.danger;
            case 'offline':
                return colors.warning;
            default:
                return colors.primary;
        }
    };

    return (
        <View style={[styles.container, style]}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '15' }]}>
                <Ionicons name={getIcon()} size={48} color={getIconColor()} />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

            {/* Message */}
            {message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
            )}

            {/* Action Button */}
            {actionLabel && onAction && (
                <Button
                    title={actionLabel}
                    onPress={onAction}
                    variant={variant === 'error' ? 'danger' : 'primary'}
                    style={styles.actionButton}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xxxl,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
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
        minWidth: 160,
    },
});

export default EmptyState;
