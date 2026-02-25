/**
 * QScrap Driver App - Accept/Reject Button with Network Validation
 * Prevents assignment actions when offline
 * Shows loading state during API calls
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useNetwork } from '../../hooks/useNetwork';
import { useTheme } from '../../contexts/ThemeContext';

interface AcceptRejectButtonProps {
    type: 'accept' | 'reject';
    onPress: () => Promise<void>;
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export const AcceptRejectButton: React.FC<AcceptRejectButtonProps> = ({
    type,
    onPress,
    disabled = false,
    size = 'large',
}) => {
    const { colors } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const { isConnected } = useNetwork();

    const handlePress = async () => {
        if (!isConnected) {
            Alert.alert(
                'No Internet Connection',
                'Please check your internet connection and try again. Assignment actions require an active connection.',
                [{ text: 'OK' }]
            );
            return;
        }

        setIsLoading(true);
        try {
            await onPress();
        } catch (error: any) {
            Alert.alert(
                type === 'accept' ? 'Accept Failed' : 'Reject Failed',
                error?.message || 'Unable to process your request. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    const buttonStyles = [
        styles.button,
        type === 'accept' ? styles.acceptButton : styles.rejectButton,
        (!isConnected || isLoading || disabled) && styles.disabledButton,
        size === 'small' && styles.smallButton,
        size === 'medium' && styles.mediumButton,
    ];

    const textStyles = [
        styles.text,
        size === 'small' && styles.smallText,
        size === 'medium' && styles.mediumText,
    ];

    return (
        <TouchableOpacity
            style={buttonStyles}
            onPress={handlePress}
            disabled={!isConnected || isLoading || disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={type === 'accept' ? 'Accept Assignment' : 'Reject Assignment'}
            accessibilityState={{ disabled: !isConnected || isLoading || disabled }}
        >
            {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
            ) : (
                <>
                    <Ionicons
                        name={type === 'accept' ? 'checkmark-circle' : 'close-circle'}
                        size={size === 'small' ? 18 : 24}
                        color="#fff"
                    />
                    <Text style={textStyles}>
                        {type === 'accept' ? 'Accept' : 'Reject'}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        paddingVertical: Spacing.md + 2,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.md,
    },
    acceptButton: {
        backgroundColor: Colors.success,
    },
    rejectButton: {
        backgroundColor: Colors.danger,
    },
    disabledButton: {
        opacity: 0.5,
    },
    smallButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    mediumButton: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    text: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
    smallText: {
        fontSize: FontSizes.md,
    },
    mediumText: {
        fontSize: FontSizes.lg,
    },
});

export default AcceptRejectButton;
