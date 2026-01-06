// QScrap Driver App - Achievement Badges Component
// Premium gamification with milestone badges and progress tracking
// VVIP cutting-edge feature to boost driver engagement

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
    ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { DriverStats } from '../services/api';

// Achievement definitions
interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    requirement: number;
    type: 'deliveries' | 'earnings' | 'rating' | 'streak';
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

const ACHIEVEMENTS: Achievement[] = [
    // Delivery milestones
    { id: 'first_delivery', title: 'First Mile', description: 'Complete your first delivery', icon: '🎯', requirement: 1, type: 'deliveries', tier: 'bronze' },
    { id: '10_deliveries', title: 'Rising Star', description: 'Complete 10 deliveries', icon: '⭐', requirement: 10, type: 'deliveries', tier: 'bronze' },
    { id: '50_deliveries', title: 'Road Warrior', description: 'Complete 50 deliveries', icon: '🛣️', requirement: 50, type: 'deliveries', tier: 'silver' },
    { id: '100_deliveries', title: 'Century Club', description: 'Complete 100 deliveries', icon: '💯', requirement: 100, type: 'deliveries', tier: 'silver' },
    { id: '250_deliveries', title: 'Elite Driver', description: 'Complete 250 deliveries', icon: '🏆', requirement: 250, type: 'deliveries', tier: 'gold' },
    { id: '500_deliveries', title: 'Legend', description: 'Complete 500 deliveries', icon: '👑', requirement: 500, type: 'deliveries', tier: 'platinum' },
    { id: '1000_deliveries', title: 'Master of Roads', description: 'Complete 1000 deliveries', icon: '💎', requirement: 1000, type: 'deliveries', tier: 'diamond' },

    // Rating achievements
    { id: 'rating_4', title: 'Trusted', description: 'Maintain 4.0+ rating', icon: '👍', requirement: 4.0, type: 'rating', tier: 'bronze' },
    { id: 'rating_4.5', title: 'Excellent', description: 'Maintain 4.5+ rating', icon: '🌟', requirement: 4.5, type: 'rating', tier: 'silver' },
    { id: 'rating_4.8', title: 'Outstanding', description: 'Maintain 4.8+ rating', icon: '✨', requirement: 4.8, type: 'rating', tier: 'gold' },
    { id: 'rating_5', title: 'Perfect', description: 'Achieve 5.0 rating', icon: '💫', requirement: 5.0, type: 'rating', tier: 'diamond' },

    // Earnings milestones
    { id: 'earnings_1000', title: 'First Thousand', description: 'Earn 1,000 QAR', icon: '💵', requirement: 1000, type: 'earnings', tier: 'bronze' },
    { id: 'earnings_5000', title: 'Money Maker', description: 'Earn 5,000 QAR', icon: '💰', requirement: 5000, type: 'earnings', tier: 'silver' },
    { id: 'earnings_10000', title: 'Big Earner', description: 'Earn 10,000 QAR', icon: '🤑', requirement: 10000, type: 'earnings', tier: 'gold' },
    { id: 'earnings_50000', title: 'Top Earner', description: 'Earn 50,000 QAR', icon: '💎', requirement: 50000, type: 'earnings', tier: 'diamond' },
];

const TIER_COLORS = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
};

interface AchievementBadgesProps {
    stats: DriverStats | null;
    compact?: boolean;
}

export default function AchievementBadges({ stats, compact = false }: AchievementBadgesProps) {
    const { colors } = useTheme();

    if (!stats) return null;

    // Calculate unlocked achievements
    const unlockedAchievements = ACHIEVEMENTS.filter(achievement => {
        switch (achievement.type) {
            case 'deliveries':
                return stats.total_deliveries >= achievement.requirement;
            case 'rating':
                return stats.rating_average >= achievement.requirement;
            case 'earnings':
                return stats.total_earnings >= achievement.requirement;
            default:
                return false;
        }
    });

    // Get next achievement for each type
    const getNextAchievement = (type: string) => {
        const typeAchievements = ACHIEVEMENTS.filter(a => a.type === type);
        return typeAchievements.find(a => {
            switch (type) {
                case 'deliveries':
                    return stats.total_deliveries < a.requirement;
                case 'rating':
                    return stats.rating_average < a.requirement;
                case 'earnings':
                    return stats.total_earnings < a.requirement;
                default:
                    return false;
            }
        });
    };

    const getProgress = (achievement: Achievement) => {
        let current = 0;
        switch (achievement.type) {
            case 'deliveries':
                current = stats.total_deliveries;
                break;
            case 'rating':
                current = stats.rating_average;
                break;
            case 'earnings':
                current = stats.total_earnings;
                break;
        }
        return Math.min(current / achievement.requirement, 1);
    };

    if (compact) {
        // Show just the count and top badge
        const topBadge = unlockedAchievements[unlockedAchievements.length - 1];
        return (
            <View style={[styles.compactContainer, { backgroundColor: colors.surface }]}>
                <Text style={styles.compactIcon}>{topBadge?.icon || '🏅'}</Text>
                <Text style={[styles.compactCount, { color: colors.text }]}>
                    {unlockedAchievements.length} / {ACHIEVEMENTS.length}
                </Text>
                <Text style={[styles.compactLabel, { color: colors.textMuted }]}>
                    Achievements
                </Text>
            </View>
        );
    }

    const nextDelivery = getNextAchievement('deliveries');
    const nextRating = getNextAchievement('rating');
    const nextEarnings = getNextAchievement('earnings');

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.text }]}>
                🏆 Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </Text>

            {/* Unlocked badges - horizontal scroll */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgesScroll}
            >
                {unlockedAchievements.map((achievement, index) => (
                    <AchievementBadge
                        key={achievement.id}
                        achievement={achievement}
                        unlocked={true}
                        delay={index * 100}
                        colors={colors}
                    />
                ))}
            </ScrollView>

            {/* Next goals */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                🎯 Next Goals
            </Text>

            <View style={styles.goalsContainer}>
                {nextDelivery && (
                    <GoalProgress
                        achievement={nextDelivery}
                        progress={getProgress(nextDelivery)}
                        current={stats.total_deliveries}
                        colors={colors}
                    />
                )}
                {nextEarnings && (
                    <GoalProgress
                        achievement={nextEarnings}
                        progress={getProgress(nextEarnings)}
                        current={stats.total_earnings}
                        colors={colors}
                    />
                )}
            </View>
        </View>
    );
}

// Individual badge component with animation
function AchievementBadge({
    achievement,
    unlocked,
    delay = 0,
    colors,
}: {
    achievement: Achievement;
    unlocked: boolean;
    delay?: number;
    colors: any;
}) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (unlocked) {
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 4,
                        tension: 50,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 400,
                        easing: Easing.out(Easing.back(2)),
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        }
    }, [unlocked, delay]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-15deg', '0deg'],
    });

    return (
        <Animated.View
            style={[
                styles.badge,
                {
                    backgroundColor: TIER_COLORS[achievement.tier] + '20',
                    borderColor: TIER_COLORS[achievement.tier],
                    transform: [{ scale: scaleAnim }, { rotate }],
                },
            ]}
        >
            <Text style={styles.badgeIcon}>{achievement.icon}</Text>
            <Text style={[styles.badgeTitle, { color: colors.text }]} numberOfLines={1}>
                {achievement.title}
            </Text>
        </Animated.View>
    );
}

// Goal progress component
function GoalProgress({
    achievement,
    progress,
    current,
    colors,
}: {
    achievement: Achievement;
    progress: number;
    current: number;
    colors: any;
}) {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const formattedCurrent = achievement.type === 'earnings'
        ? `${current.toLocaleString()} QAR`
        : achievement.type === 'rating'
            ? current.toFixed(1)
            : current;

    const formattedRequirement = achievement.type === 'earnings'
        ? `${achievement.requirement.toLocaleString()} QAR`
        : achievement.requirement;

    return (
        <View style={[styles.goalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.goalHeader}>
                <Text style={styles.goalIcon}>{achievement.icon}</Text>
                <View style={styles.goalInfo}>
                    <Text style={[styles.goalTitle, { color: colors.text }]}>
                        {achievement.title}
                    </Text>
                    <Text style={[styles.goalProgress, { color: colors.textMuted }]}>
                        {formattedCurrent} / {formattedRequirement}
                    </Text>
                </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <Animated.View
                    style={[
                        styles.progressFill,
                        {
                            width: progressWidth,
                            backgroundColor: TIER_COLORS[achievement.tier],
                        },
                    ]}
                />
            </View>
        </View>
    );
}

// Export for unlocking notifications
export function checkNewAchievements(
    oldStats: DriverStats | null,
    newStats: DriverStats
): Achievement[] {
    if (!oldStats) return [];

    const newlyUnlocked: Achievement[] = [];

    ACHIEVEMENTS.forEach(achievement => {
        let wasUnlocked = false;
        let isUnlocked = false;

        switch (achievement.type) {
            case 'deliveries':
                wasUnlocked = oldStats.total_deliveries >= achievement.requirement;
                isUnlocked = newStats.total_deliveries >= achievement.requirement;
                break;
            case 'rating':
                wasUnlocked = oldStats.rating_average >= achievement.requirement;
                isUnlocked = newStats.rating_average >= achievement.requirement;
                break;
            case 'earnings':
                wasUnlocked = oldStats.total_earnings >= achievement.requirement;
                isUnlocked = newStats.total_earnings >= achievement.requirement;
                break;
        }

        if (!wasUnlocked && isUnlocked) {
            newlyUnlocked.push(achievement);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    });

    return newlyUnlocked;
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    badgesScroll: {
        paddingRight: 20,
        gap: 12,
    },
    badge: {
        width: 80,
        height: 90,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    badgeIcon: {
        fontSize: 32,
        marginBottom: 4,
    },
    badgeTitle: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    goalsContainer: {
        gap: 12,
    },
    goalCard: {
        padding: 16,
        borderRadius: 16,
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    goalIcon: {
        fontSize: 28,
    },
    goalInfo: {
        flex: 1,
    },
    goalTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    goalProgress: {
        fontSize: 12,
        marginTop: 2,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    // Compact mode
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    compactIcon: {
        fontSize: 24,
    },
    compactCount: {
        fontSize: 16,
        fontWeight: '700',
    },
    compactLabel: {
        fontSize: 12,
    },
});
