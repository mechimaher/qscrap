import { log, warn, error as logError } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface LoyaltyData {
    points: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    pointsToNextTier: number;
    nextTier: string;
    totalOrders: number;
    memberSince: string;
    rewards: Reward[];
    history: PointsHistory[];
}

interface Reward {
    id: string;
    title: string;
    description: string;
    pointsCost: number;
    emoji: string;
    type: 'discount' | 'freeDelivery' | 'voucher' | 'exclusive';
    available: boolean;
}

interface PointsHistory {
    id: string;
    description: string;
    points: number;
    type: 'earned' | 'redeemed';
    date: string;
}

interface LoyaltyProgramProps {
    customerId?: string;
}

const TIER_CONFIG = {
    bronze: {
        color: '#CD7F32',
        gradient: ['#CD7F32', '#8B4513'],
        minPoints: 0,
        benefits: ['Basic support', '1% cashback'],
        emoji: '🥉',
    },
    silver: {
        color: '#C0C0C0',
        gradient: ['#C0C0C0', '#A9A9A9'],
        minPoints: 500,
        benefits: ['Priority support', '2% cashback', 'Free delivery 1x/month'],
        emoji: '🥈',
    },
    gold: {
        color: '#FFD700',
        gradient: ['#FFD700', '#FFA500'],
        minPoints: 2000,
        benefits: ['VIP support', '5% cashback', 'Free delivery', 'Early access'],
        emoji: '🥇',
    },
    platinum: {
        color: '#E5E4E2',
        gradient: ['#E5E4E2', '#B0C4DE'],
        minPoints: 5000,
        benefits: ['Dedicated account manager', '10% cashback', 'Free delivery', 'Exclusive deals', 'Priority dispatch'],
        emoji: '💎',
    },
};

/**
 * Premium Loyalty Program Component
 * Points, tiers, rewards, and redemption
 */
export const LoyaltyProgram: React.FC<LoyaltyProgramProps> = ({
    customerId,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
    const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');

    // Animation for points
    const progressAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        loadLoyaltyData();
    }, []);

    useEffect(() => {
        if (loyaltyData) {
            const tierConfig = TIER_CONFIG[loyaltyData.tier];
            const nextTierConfig = TIER_CONFIG[loyaltyData.nextTier as keyof typeof TIER_CONFIG];
            const progress = nextTierConfig
                ? (loyaltyData.points - tierConfig.minPoints) / (nextTierConfig.minPoints - tierConfig.minPoints)
                : 1;

            Animated.timing(progressAnim, {
                toValue: Math.min(progress, 1),
                duration: 1000,
                useNativeDriver: false,
            }).start();
        }
    }, [loyaltyData]);

    const loadLoyaltyData = async () => {
        setIsLoading(true);
        try {
            // Simulated data - replace with API call
            await new Promise(resolve => setTimeout(resolve, 500));

            setLoyaltyData({
                points: 1250,
                tier: 'silver',
                pointsToNextTier: 750,
                nextTier: 'gold',
                totalOrders: 28,
                memberSince: '2024-03-15',
                rewards: [
                    { id: '1', title: 'Free Delivery', description: 'One free delivery on your next order', pointsCost: 100, emoji: '🚗', type: 'freeDelivery', available: true },
                    { id: '2', title: '10% Off', description: '10% discount on your next purchase', pointsCost: 200, emoji: '🏷️', type: 'discount', available: true },
                    { id: '3', title: '50 QAR Voucher', description: 'Voucher valid for 30 days', pointsCost: 500, emoji: '🎁', type: 'voucher', available: true },
                    { id: '4', title: 'Priority Support', description: '1 month of VIP support access', pointsCost: 300, emoji: '⭐', type: 'exclusive', available: true },
                    { id: '5', title: 'Double Points Week', description: 'Earn 2x points for 7 days', pointsCost: 400, emoji: '✨', type: 'exclusive', available: true },
                    { id: '6', title: 'Exclusive Preview', description: 'Early access to new features', pointsCost: 1000, emoji: '🔮', type: 'exclusive', available: false },
                ],
                history: [
                    { id: '1', description: 'Order #QS-2024-156 completed', points: 50, type: 'earned', date: '2024-12-28' },
                    { id: '2', description: 'Review bonus', points: 10, type: 'earned', date: '2024-12-27' },
                    { id: '3', description: 'Free delivery redeemed', points: -100, type: 'redeemed', date: '2024-12-25' },
                    { id: '4', description: 'Order #QS-2024-149 completed', points: 45, type: 'earned', date: '2024-12-22' },
                    { id: '5', description: 'Referral bonus', points: 100, type: 'earned', date: '2024-12-20' },
                ],
            });
        } catch (error) {
            log('Load loyalty error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRedeemReward = (reward: Reward) => {
        if (!loyaltyData || loyaltyData.points < reward.pointsCost) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Insufficient Points', `You need ${reward.pointsCost - (loyaltyData?.points || 0)} more points to redeem this reward.`);
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
            '🎉 Redeem Reward?',
            `Use ${reward.pointsCost} points for "${reward.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Redeem',
                    onPress: () => {
                        // API call to redeem
                        Alert.alert('Success!', 'Your reward has been redeemed!');
                    }
                },
            ]
        );
    };

    if (isLoading && !loyaltyData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!loyaltyData) return null;

    const tierConfig = TIER_CONFIG[loyaltyData.tier];
    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Main Points Card */}
            <LinearGradient
                colors={tierConfig.gradient as [string, string]}
                style={styles.mainCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.tierBadge}>
                    <Text style={styles.tierEmoji}>{tierConfig.emoji}</Text>
                    <Text style={styles.tierName}>{loyaltyData.tier.toUpperCase()}</Text>
                </View>

                <Text style={styles.pointsLabel}>Your Points</Text>
                <Text style={styles.pointsValue}>{loyaltyData.points.toLocaleString()}</Text>

                {loyaltyData.nextTier && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressTrack}>
                            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {loyaltyData.pointsToNextTier} points to {loyaltyData.nextTier.toUpperCase()}
                        </Text>
                    </View>
                )}

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{loyaltyData.totalOrders}</Text>
                        <Text style={styles.statLabel}>Orders</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {Math.floor((new Date().getTime() - new Date(loyaltyData.memberSince).getTime()) / (1000 * 60 * 60 * 24))}
                        </Text>
                        <Text style={styles.statLabel}>Days</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Current Benefits */}
            <View style={styles.benefitsCard}>
                <Text style={styles.sectionTitle}>Your {loyaltyData.tier.charAt(0).toUpperCase() + loyaltyData.tier.slice(1)} Benefits</Text>
                {tierConfig.benefits.map((benefit, index) => (
                    <View key={index} style={styles.benefitRow}>
                        <Text style={styles.benefitIcon}>✓</Text>
                        <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                ))}
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'rewards' && styles.tabActive]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setActiveTab('rewards');
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'rewards' && styles.tabTextActive]}>
                        Rewards
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setActiveTab('history');
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                        History
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Rewards Grid */}
            {activeTab === 'rewards' && (
                <View style={styles.rewardsGrid}>
                    {loyaltyData.rewards.map(reward => (
                        <TouchableOpacity
                            key={reward.id}
                            style={[
                                styles.rewardCard,
                                !reward.available && styles.rewardUnavailable,
                                loyaltyData.points < reward.pointsCost && styles.rewardInsufficient,
                            ]}
                            onPress={() => handleRedeemReward(reward)}
                            disabled={!reward.available}
                        >
                            <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
                            <Text style={styles.rewardTitle}>{reward.title}</Text>
                            <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description}</Text>
                            <View style={styles.rewardCost}>
                                <Text style={[
                                    styles.rewardPoints,
                                    loyaltyData.points >= reward.pointsCost && styles.rewardAffordable
                                ]}>
                                    {reward.pointsCost} pts
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* History List */}
            {activeTab === 'history' && (
                <View style={styles.historyList}>
                    {loyaltyData.history.map(item => (
                        <View key={item.id} style={styles.historyRow}>
                            <View style={[
                                styles.historyIcon,
                                item.type === 'earned' ? styles.historyEarned : styles.historyRedeemed
                            ]}>
                                <Text style={styles.historyIconText}>
                                    {item.type === 'earned' ? '+' : '-'}
                                </Text>
                            </View>
                            <View style={styles.historyInfo}>
                                <Text style={styles.historyDesc}>{item.description}</Text>
                                <Text style={styles.historyDate}>{item.date}</Text>
                            </View>
                            <Text style={[
                                styles.historyPoints,
                                item.type === 'earned' ? styles.pointsEarned : styles.pointsRedeemed
                            ]}>
                                {item.type === 'earned' ? '+' : ''}{item.points}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* How to Earn */}
            <View style={styles.earnCard}>
                <Text style={styles.sectionTitle}>Earn More Points</Text>
                <View style={styles.earnRow}>
                    <Text style={styles.earnEmoji}>🛒</Text>
                    <Text style={styles.earnText}>Complete orders</Text>
                    <Text style={styles.earnPoints}>+5 pts/order</Text>
                </View>
                <View style={styles.earnRow}>
                    <Text style={styles.earnEmoji}>⭐</Text>
                    <Text style={styles.earnText}>Leave reviews</Text>
                    <Text style={styles.earnPoints}>+10 pts</Text>
                </View>
                <View style={styles.earnRow}>
                    <Text style={styles.earnEmoji}>👥</Text>
                    <Text style={styles.earnText}>Refer friends</Text>
                    <Text style={styles.earnPoints}>+100 pts</Text>
                </View>
                <View style={styles.earnRow}>
                    <Text style={styles.earnEmoji}>📸</Text>
                    <Text style={styles.earnText}>Share on social</Text>
                    <Text style={styles.earnPoints}>+25 pts</Text>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainCard: {
        margin: Spacing.md,
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    tierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    tierEmoji: {
        fontSize: 18,
        marginRight: 6,
    },
    tierName: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 1,
    },
    pointsLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    pointsValue: {
        fontSize: 56,
        fontWeight: '800',
        color: '#fff',
        marginVertical: Spacing.xs,
    },
    progressSection: {
        marginTop: Spacing.md,
    },
    progressTrack: {
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 4,
    },
    progressText: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.9)',
        marginTop: Spacing.xs,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        justifyContent: 'center',
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    statValue: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    benefitsCard: {
        backgroundColor: '#fff',
        marginHorizontal: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    benefitIcon: {
        fontSize: 16,
        color: Colors.success,
        marginRight: Spacing.sm,
        fontWeight: '700',
    },
    benefitText: {
        fontSize: FontSizes.md,
        color: '#1a1a1a',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: Spacing.md,
        marginTop: Spacing.lg,
        backgroundColor: '#F0F0F0',
        borderRadius: BorderRadius.lg,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    tabActive: {
        backgroundColor: '#fff',
        ...Shadows.sm,
    },
    tabText: {
        fontSize: FontSizes.md,
        fontWeight: '500',
        color: '#525252',
    },
    tabTextActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    rewardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: Spacing.sm,
        gap: Spacing.sm,
    },
    rewardCard: {
        width: '48%',
        backgroundColor: '#fff',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        ...Shadows.sm,
    },
    rewardUnavailable: {
        opacity: 0.5,
    },
    rewardInsufficient: {
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderStyle: 'dashed',
    },
    rewardEmoji: {
        fontSize: 32,
        marginBottom: Spacing.sm,
    },
    rewardTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    rewardDesc: {
        fontSize: FontSizes.xs,
        color: '#525252',
        textAlign: 'center',
        marginTop: 4,
    },
    rewardCost: {
        marginTop: Spacing.sm,
        backgroundColor: '#F5F5F5',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    rewardPoints: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#525252',
    },
    rewardAffordable: {
        color: Colors.success,
    },
    historyList: {
        backgroundColor: '#fff',
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    historyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyEarned: {
        backgroundColor: '#dcfce7',
    },
    historyRedeemed: {
        backgroundColor: '#fee2e2',
    },
    historyIconText: {
        fontSize: 18,
        fontWeight: '700',
    },
    historyInfo: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    historyDesc: {
        fontSize: FontSizes.sm,
        color: '#1a1a1a',
    },
    historyDate: {
        fontSize: FontSizes.xs,
        color: '#525252',
    },
    historyPoints: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    pointsEarned: {
        color: Colors.success,
    },
    pointsRedeemed: {
        color: Colors.error,
    },
    earnCard: {
        backgroundColor: '#fff',
        marginHorizontal: Spacing.md,
        marginTop: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    earnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    earnEmoji: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    earnText: {
        flex: 1,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
    },
    earnPoints: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.success,
    },
});

export default LoyaltyProgram;
