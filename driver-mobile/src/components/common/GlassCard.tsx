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
        ? 'rgba(30, 30, 30, 0.7)'
        : 'rgba(255, 255, 255, 0.8)';

    const borderColor = isDarkMode
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.4)';

    return (
        <View style={[
            styles.card,
            {
                backgroundColor,
                borderColor
            },
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        overflow: 'hidden', // Ensures content acts like it's inside glass
    }
});
