/**
 * QScrap Driver App - Assignment Error State Component
 * Displays user-friendly error message with retry option
 * Used when assignment loading fails
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

interface AssignmentErrorStateProps {
    error?: string;
    onRetry: () => void;
    message?: string;
}

export const AssignmentErrorState: React.FC<AssignmentErrorStateProps> = ({
    error,
    onRetry,
    message,
}) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="alert-circle" size={64} color={Colors.danger} />
            </View>
            
            <Text style={[styles.title, { color: colors.text }]}>
                Failed to Load Assignments
            </Text>
            
            <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message || error || 'Unable to fetch your assignments. Please check your connection and try again.'}
            </Text>
            
            <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.8}
            >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            
            <Text style={styles.hintText}>
                Make sure you have an internet connection
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        ...Shadows.lg,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        textAlign: 'center',
    },
    message: {
        fontSize: FontSizes.md,
        textAlign: 'center',
        marginTop: Spacing.md,
        lineHeight: 22,
    },
    retryButton: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md + 2,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.full,
        marginTop: Spacing.lg,
        alignItems: 'center',
        ...Shadows.md,
    },
    retryText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
    hintText: {
        fontSize: FontSizes.sm,
        color: '#999',
        marginTop: Spacing.md,
        textAlign: 'center',
    },
});

export default AssignmentErrorState;
