import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    ViewStyle,
    TextStyle,
    View,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: keyof typeof Ionicons.glyphMap;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    haptic?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

/**
 * Premium button component with multiple variants, haptic feedback,
 * loading states, and proper accessibility support.
 */
export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
    textStyle,
    haptic = true,
    accessibilityLabel,
    accessibilityHint,
}) => {
    const { colors } = useTheme();

    const handlePress = async () => {
        if (haptic && Platform.OS !== 'web') {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
                // Haptics not available
            }
        }
        onPress();
    };

    const getButtonStyles = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            ...styles.button,
            ...getSizeStyles(),
        };

        if (fullWidth) {
            baseStyle.width = '100%';
        }

        switch (variant) {
            case 'primary':
                return {
                    ...baseStyle,
                    backgroundColor: disabled ? colors.textMuted : colors.primary,
                    ...Shadows.md,
                };
            case 'secondary':
                return {
                    ...baseStyle,
                    backgroundColor: disabled ? colors.surfaceSecondary : colors.surfaceSecondary,
                };
            case 'outline':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: disabled ? colors.textMuted : colors.primary,
                };
            case 'ghost':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                };
            case 'danger':
                return {
                    ...baseStyle,
                    backgroundColor: disabled ? colors.textMuted : colors.danger,
                    ...Shadows.md,
                };
            default:
                return baseStyle;
        }
    };

    const getTextStyles = (): TextStyle => {
        const baseStyle: TextStyle = {
            ...styles.text,
            ...getTextSizeStyles(),
        };

        switch (variant) {
            case 'primary':
            case 'danger':
                return { ...baseStyle, color: '#fff' };
            case 'secondary':
                return { ...baseStyle, color: colors.text };
            case 'outline':
            case 'ghost':
                return { ...baseStyle, color: disabled ? colors.textMuted : colors.primary };
            default:
                return baseStyle;
        }
    };

    const getSizeStyles = (): ViewStyle => {
        switch (size) {
            case 'small':
                return { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md };
            case 'large':
                return { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl };
            default:
                return { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl };
        }
    };

    const getTextSizeStyles = (): TextStyle => {
        switch (size) {
            case 'small':
                return { fontSize: FontSize.sm };
            case 'large':
                return { fontSize: FontSize.lg };
            default:
                return { fontSize: FontSize.md };
        }
    };

    const getIconSize = (): number => {
        switch (size) {
            case 'small':
                return 16;
            case 'large':
                return 24;
            default:
                return 20;
        }
    };

    const iconColor = variant === 'primary' || variant === 'danger'
        ? '#fff'
        : variant === 'outline' || variant === 'ghost'
            ? colors.primary
            : colors.text;

    return (
        <TouchableOpacity
            style={[getButtonStyles(), style]}
            onPress={handlePress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: disabled || loading }}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
                />
            ) : (
                <View style={styles.content}>
                    {icon && iconPosition === 'left' && (
                        <Ionicons
                            name={icon}
                            size={getIconSize()}
                            color={disabled ? colors.textMuted : iconColor}
                            style={styles.iconLeft}
                        />
                    )}
                    <Text style={[getTextStyles(), disabled && { color: colors.textMuted }, textStyle]}>
                        {title}
                    </Text>
                    {icon && iconPosition === 'right' && (
                        <Ionicons
                            name={icon}
                            size={getIconSize()}
                            color={disabled ? colors.textMuted : iconColor}
                            style={styles.iconRight}
                        />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontWeight: '600',
    },
    iconLeft: {
        marginRight: Spacing.sm,
    },
    iconRight: {
        marginLeft: Spacing.sm,
    },
});

export default Button;
