import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'light' | 'dark';
}

/**
 * Premium Glassmorphism Container
 * Uses semi-transparent background with border highlight
 * Note: Real backdrop-filter is expensive/complex in RN, so we fake it with opacity + border
 */
export const GlassCard: React.FC<GlassCardProps> = ({ children, style, variant = 'dark' }) => {
    const { colors, isDarkMode } = useTheme();

    const backgroundColor = isDarkMode
        ? 'rgba(30, 30, 30, 0.85)'
        : 'rgba(255, 255, 255, 0.95)';

    const borderColor = isDarkMode
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.3)';

    return (
        <View style={[
            styles.card,
            {
                backgroundColor,
                borderColor,
                // Apply a subtle tint for light mode premium feel
                borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.5)',
            },
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 24, // VVIP Roundness
        borderWidth: 1.5,
        padding: 20,
        // Premium depth shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 12,
        },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        overflow: 'hidden',
    }
});
