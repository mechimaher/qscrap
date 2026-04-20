import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    TextInput,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    ViewStyle,
    TextInputProps,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize } from '../constants';
import { t } from '../utils/i18nHelper';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    showCharacterCount?: boolean;
    containerStyle?: ViewStyle;
    required?: boolean;
    success?: boolean;
}

/**
 * Enhanced text input component with:
 * - Floating label animation
 * - Error/success states
 * - Icon support
 * - Character count
 * - Password visibility toggle
 * - Accessibility support
 */
export const Input: React.FC<InputProps> = ({
    label,
    error,
    hint,
    icon,
    rightIcon,
    onRightIconPress,
    showCharacterCount = false,
    containerStyle,
    required = false,
    success = false,
    secureTextEntry,
    maxLength,
    value = '',
    onFocus,
    onBlur,
    ...textInputProps
}) => {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
    const borderAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(labelAnim, {
            toValue: isFocused || value ? 1 : 0,
            duration: 150,
            useNativeDriver: false,
        }).start();

        Animated.timing(borderAnim, {
            toValue: isFocused ? 1 : 0,
            duration: 150,
            useNativeDriver: false,
        }).start();
    }, [isFocused, value, labelAnim, borderAnim]);

    const handleFocus = (e: any) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    const getBorderColor = () => {
        if (error) return colors.danger;
        if (success) return colors.success;
        if (isFocused) return colors.primary;
        return colors.border;
    };

    const labelStyle = {
        position: 'absolute' as const,
        left: icon ? 48 : Spacing.lg,
        top: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [16, -8],
        }),
        fontSize: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [FontSize.md, FontSize.xs],
        }),
        color: error
            ? colors.danger
            : isFocused
                ? colors.primary
                : colors.textSecondary,
        backgroundColor: colors.surface,
        paddingHorizontal: 4,
        zIndex: 1,
    };

    const borderWidth = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2],
    });

    const isPassword = secureTextEntry !== undefined;
    const actualSecureTextEntry = isPassword && !showPassword;

    return (
        <View style={[styles.container, containerStyle]}>
            {/* Input Container */}
            <Animated.View
                style={[
                    styles.inputContainer,
                    {
                        backgroundColor: colors.surface,
                        borderColor: getBorderColor(),
                        borderWidth,
                    },
                ]}
            >
                {/* Left Icon */}
                {icon && (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={isFocused ? colors.primary : colors.textMuted}
                        style={styles.leftIcon}
                    />
                )}

                {/* Floating Label */}
                {label && (
                    <Animated.Text style={labelStyle}>
                        {label}{required && <Text style={{ color: colors.danger }}> *</Text>}
                    </Animated.Text>
                )}

                {/* Text Input */}
                <TextInput
                    {...textInputProps}
                    value={value}
                    maxLength={maxLength}
                    secureTextEntry={actualSecureTextEntry}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    style={[
                        styles.input,
                        {
                            color: colors.text,
                            paddingLeft: icon ? 48 : Spacing.lg,
                            paddingRight: (rightIcon || isPassword) ? 48 : Spacing.lg,
                        },
                    ]}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={label}
                    accessibilityState={{ disabled: textInputProps.editable === false }}
                />

                {/* Right Icon / Password Toggle / Success/Error Icon */}
                <View style={styles.rightIconContainer}>
                    {isPassword && (
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.iconButton}
                            accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>
                    )}
                    {!isPassword && success && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    )}
                    {!isPassword && error && (
                        <Ionicons name="alert-circle" size={20} color={colors.danger} />
                    )}
                    {!isPassword && !success && !error && rightIcon && (
                        <TouchableOpacity
                            onPress={onRightIconPress}
                            style={styles.iconButton}
                            disabled={!onRightIconPress}
                        >
                            <Ionicons name={rightIcon} size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>

            {/* Helper Text / Error / Character Count */}
            <View style={styles.helperRow}>
                <View style={styles.helperTextContainer}>
                    {error ? (
                        <Text style={[styles.helperText, { color: colors.danger }]}>{error}</Text>
                    ) : hint ? (
                        <Text style={[styles.helperText, { color: colors.textMuted }]}>{hint}</Text>
                    ) : null}
                </View>
                {showCharacterCount && maxLength && (
                    <Text style={[styles.characterCount, { color: colors.textMuted }]}>
                        {value?.length || 0}/{maxLength}
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        minHeight: 56,
        position: 'relative',
    },
    leftIcon: {
        position: 'absolute',
        left: Spacing.lg,
        zIndex: 1,
    },
    input: {
        flex: 1,
        fontSize: FontSize.md,
        paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    },
    rightIconContainer: {
        position: 'absolute',
        right: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: Spacing.xs,
    },
    helperRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.xs,
    },
    helperTextContainer: {
        flex: 1,
    },
    helperText: {
        fontSize: FontSize.xs,
    },
    characterCount: {
        fontSize: FontSize.xs,
        marginLeft: Spacing.sm,
    },
});

export default Input;
