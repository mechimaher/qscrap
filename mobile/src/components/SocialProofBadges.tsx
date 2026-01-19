// Social Proof Badges Component
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface SocialProofBadgesProps {
    avgResponseTime?: number; // in minutes
    ratingAverage?: number;
    totalTransactions?: number;
}

export const SocialProofBadges: React.FC<SocialProofBadgesProps> = ({
    avgResponseTime,
    ratingAverage,
    totalTransactions,
}) => {
    const badges: Array<{ icon: string; text: string; gradient: string[] }> = [];

    // Fast Response Badge (< 60 min)
    if (avgResponseTime && avgResponseTime < 60) {
        badges.push({
            icon: '⚡',
            text: 'Fast Response',
            gradient: ['#F59E0B', '#D97706'],
        });
    }

    // Top Rated Badge (>= 4.5 stars)
    if (ratingAverage && ratingAverage >= 4.5) {
        badges.push({
            icon: '⭐',
            text: 'Top Rated',
            gradient: ['#8D1B3D', '#C9A227'],
        });
    }

    // Trusted Seller Badge (>= 100 transactions)
    if (totalTransactions && totalTransactions >= 100) {
        badges.push({
            icon: '🏆',
            text: 'Trusted Seller',
            gradient: ['#3B82F6', '#2563EB'],
        });
    }

    if (badges.length === 0) return null;

    return (
        <View style={styles.container}>
            {badges.map((badge, index) => (
                <LinearGradient
                    key={index}
                    colors={badge.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.badge}
                >
                    <Text style={styles.badgeIcon}>{badge.icon}</Text>
                    <Text style={styles.badgeText}>{badge.text}</Text>
                </LinearGradient>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        gap: 4,
        ...Shadows.sm,
    },
    badgeIcon: {
        fontSize: 12,
    },
    badgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SocialProofBadges;
