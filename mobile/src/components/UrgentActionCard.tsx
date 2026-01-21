import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';

interface UrgentActionCardProps {
    type: 'payment_pending' | 'delivery_confirmation' | 'bid_expiring' | 'technician_arriving' | 'counter_offer_pending';
    data: any;
    onPress: () => void;
}

const UrgentActionCard: React.FC<UrgentActionCardProps> = ({ type, data, onPress }) => {
    const [countdown, setCountdown] = useState<string>('');

    // Countdown timer for expiring items
    useEffect(() => {
        if (type === 'bid_expiring' || type === 'counter_offer_pending') {
            const updateCountdown = () => {
                const seconds = data.expires_in_seconds || 0;
                if (seconds <= 0) {
                    setCountdown('Expired');
                    return;
                }

                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;

                if (hours > 0) {
                    setCountdown(`${hours}h ${minutes}m`);
                } else if (minutes > 0) {
                    setCountdown(`${minutes}m ${secs}s`);
                } else {
                    setCountdown(`${secs}s`);
                }
            };

            updateCountdown();
            const interval = setInterval(updateCountdown, 1000);
            return () => clearInterval(interval);
        }
    }, [type, data.expires_in_seconds]);

    const getConfig = () => {
        switch (type) {
            case 'payment_pending':
                return {
                    icon: '💳',
                    title: 'Payment Required',
                    subtitle: `Order #${data.order_number?.substring(0, 8)}`,
                    description: `Complete payment of ${data.amount} QAR`,
                    gradientColors: ['#EF4444', '#DC2626'],
                    actionText: 'Pay Now',
                };
            case 'delivery_confirmation':
                return {
                    icon: '📦',
                    title: 'Confirm Delivery',
                    subtitle: `Order #${data.order_number?.substring(0, 8)}`,
                    description: 'Confirm you received your order',
                    gradientColors: ['#F59E0B', '#D97706'],
                    actionText: 'Confirm',
                };
            case 'bid_expiring':
                return {
                    icon: '⏰',
                    title: 'Bid Expiring Soon',
                    subtitle: `${data.garage_name}`,
                    description: `${data.amount} QAR • Expires in ${countdown}`,
                    gradientColors: ['#F59E0B', '#D97706'],
                    actionText: 'Review Bid',
                };
            case 'technician_arriving':
                return {
                    icon: '🚗',
                    title: 'Technician On The Way',
                    subtitle: `${data.service_type} Service`,
                    description: data.location,
                    gradientColors: ['#8B5CF6', '#7C3AED'],
                    actionText: 'Track',
                };
            case 'counter_offer_pending':
                return {
                    icon: '💬',
                    title: 'Counter-Offer Received',
                    subtitle: `${data.garage_name}`,
                    description: `New price: ${data.new_amount} QAR • Expires in ${countdown}`,
                    gradientColors: ['#3B82F6', '#2563EB'],
                    actionText: 'Respond',
                };
            default:
                return {
                    icon: '⚠️',
                    title: 'Action Required',
                    subtitle: '',
                    description: '',
                    gradientColors: ['#6B7280', '#4B5563'],
                    actionText: 'View',
                };
        }
    };

    const config = getConfig();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={styles.container}
        >
            <LinearGradient
                colors={config.gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>{config.icon}</Text>
                    </View>

                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>{config.title}</Text>
                        {config.subtitle && (
                            <Text style={styles.subtitle}>{config.subtitle}</Text>
                        )}
                        <Text style={styles.description}>{config.description}</Text>
                    </View>

                    {/* Action Button */}
                    <View style={styles.actionButton}>
                        <Text style={styles.actionText}>{config.actionText}</Text>
                        <Text style={styles.arrow}>→</Text>
                    </View>
                </View>

                {/* Urgency Indicator */}
                {(type === 'payment_pending' || type === 'delivery_confirmation') && (
                    <View style={styles.urgencyBadge}>
                        <Text style={styles.urgencyText}>URGENT</Text>
                    </View>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    gradient: {
        padding: Spacing.lg,
        position: 'relative',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    icon: {
        fontSize: 28,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 4,
    },
    description: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.85)',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        marginRight: 4,
    },
    arrow: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    urgencyBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    urgencyText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
});

export default UrgentActionCard;
