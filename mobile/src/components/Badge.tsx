import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize } from '../constants';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    size?: BadgeSize;
    icon?: React.ReactNode;
    style?: ViewStyle;
}

/**
 * Status badge component for displaying labels, tags, and status indicators.
 */
export const Badge: React.FC<BadgeProps> = ({
    label,
    variant = 'primary',
    size = 'medium',
    icon,
    style,
}) => {
    const { colors } = useTheme();

    const getColors = () => {
        switch (variant) {
            case 'primary':
                return { bg: colors.primary + '20', text: colors.primary };
            case 'secondary':
                return { bg: colors.secondary + '20', text: colors.secondary };
            case 'success':
                return { bg: colors.success + '20', text: colors.success };
            case 'warning':
                return { bg: colors.warning + '20', text: colors.warning };
            case 'danger':
                return { bg: colors.danger + '20', text: colors.danger };
            case 'info':
                return { bg: colors.info + '20', text: colors.info };
            case 'muted':
                return { bg: colors.surfaceSecondary, text: colors.textMuted };
            default:
                return { bg: colors.primary + '20', text: colors.primary };
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    paddingHorizontal: Spacing.sm,
                    paddingVertical: 2,
                    fontSize: FontSize.xs,
                };
            case 'large':
                return {
                    paddingHorizontal: Spacing.lg,
                    paddingVertical: Spacing.sm,
                    fontSize: FontSize.md,
                };
            default:
                return {
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.xs,
                    fontSize: FontSize.sm,
                };
        }
    };

    const badgeColors = getColors();
    const sizeStyles = getSizeStyles();

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: badgeColors.bg,
                    paddingHorizontal: sizeStyles.paddingHorizontal,
                    paddingVertical: sizeStyles.paddingVertical,
                },
                style,
            ]}
        >
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
                style={[
                    styles.text,
                    { color: badgeColors.text, fontSize: sizeStyles.fontSize },
                ]}
            >
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.full,
        alignSelf: 'flex-start',
    },
    iconContainer: {
        marginRight: Spacing.xs,
    },
    text: {
        fontWeight: '600',
    },
});

export default Badge;
