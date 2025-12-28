import React from 'react';
import {
    View,
    ActivityIndicator,
    StyleSheet,
    Text,
    ViewStyle,
} from 'react-native';
import { useTheme } from '../contexts';
import { Spacing, FontSize } from '../constants';

interface LoadingSpinnerProps {
    size?: 'small' | 'large';
    color?: string;
    message?: string;
    fullScreen?: boolean;
    overlay?: boolean;
    style?: ViewStyle;
}

/**
 * Reusable loading spinner component with consistent styling.
 * Supports full-screen mode, overlay mode, and optional message.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'large',
    color,
    message,
    fullScreen = false,
    overlay = false,
    style,
}) => {
    const { colors } = useTheme();
    const spinnerColor = color || colors.primary;

    const content = (
        <View style={[styles.content, style]}>
            <ActivityIndicator size={size} color={spinnerColor} />
            {message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {message}
                </Text>
            )}
        </View>
    );

    if (fullScreen) {
        return (
            <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
                {content}
            </View>
        );
    }

    if (overlay) {
        return (
            <View style={styles.overlay}>
                <View style={[styles.overlayContent, { backgroundColor: colors.surface }]}>
                    {content}
                </View>
            </View>
        );
    }

    return content;
};

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    fullScreen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    overlayContent: {
        borderRadius: 16,
        padding: Spacing.xl,
        minWidth: 120,
        alignItems: 'center',
    },
    message: {
        marginTop: Spacing.md,
        fontSize: FontSize.md,
        textAlign: 'center',
    },
});

export default LoadingSpinner;
