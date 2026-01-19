// Personalized Empty State Component - P2 Feature
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';

interface Vehicle {
    make: string;
    model: string;
    year: number;
}

interface PersonalizedEmptyStateProps {
    type: 'requests' | 'orders' | 'notifications';
    userVehicles?: Vehicle[];
    onAction: () => void;
}

export const PersonalizedEmptyState: React.FC<PersonalizedEmptyStateProps> = ({
    type,
    userVehicles = [],
    onAction,
}) => {
    const mainVehicle = userVehicles[0];

    const getContent = () => {
        switch (type) {
            case 'requests':
                return {
                    icon: '🚗',
                    title: mainVehicle
                        ? `No requests for your ${mainVehicle.make} ${mainVehicle.model}`
                        : 'No active requests yet',
                    message: mainVehicle
                        ? `Start a new request for parts specific to your ${mainVehicle.year} ${mainVehicle.make}`
                        : 'Create your first request to get competitive quotes from garages',
                    actionText: '+ Request a Part',
                };
            case 'orders':
                return {
                    icon: '📦',
                    title: 'No orders yet',
                    message: mainVehicle
                        ? `Order quality parts for your ${mainVehicle.make} ${mainVehicle.model}`
                        : 'Accept a bid to create your first order',
                    actionText: 'Browse Active Requests',
                };
            case 'notifications':
                return {
                    icon: '🔔',
                    title: 'All caught up',
                    message: "You'll receive notifications here when garages bid on your requests",
                    actionText: 'View Requests',
                };
            default:
                return {
                    icon: '📭',
                    title: 'Nothing here yet',
                    message: 'Get started to see content here',
                    actionText: 'Get Started',
                };
        }
    };

    const content = getContent();

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Text style={styles.icon}>{content.icon}</Text>
            </View>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.message}>{content.message}</Text>
            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onAction();
                }}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#8D1B3D', '#C9A227']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                >
                    <Text style={styles.actionText}>{content.actionText}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxl,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        ...Shadows.lg,
    },
    icon: {
        fontSize: 64,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.theme.text,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    message: {
        fontSize: FontSizes.md,
        color: Colors.theme.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    actionButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    actionGradient: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    actionText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default PersonalizedEmptyState;
