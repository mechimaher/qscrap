import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface EarningsData {
    today: number;
    week: number;
    month: number;
    total: number;
    deliveries: {
        today: number;
        week: number;
        month: number;
    };
    averagePerDelivery: number;
    bonus: number;
    tips: number;
    recentDeliveries: RecentDelivery[];
}

interface RecentDelivery {
    id: string;
    orderNumber: string;
    amount: number;
    tip: number;
    timestamp: string;
    status: 'completed' | 'pending';
}

interface DriverEarningsDashboardProps {
    driverId?: string;
    onRefresh?: () => Promise<void>;
}

/**
 * Premium Driver Earnings Dashboard
 * Real-time earnings tracking with breakdowns
 */
export const DriverEarningsDashboard: React.FC<DriverEarningsDashboardProps> = ({
    driverId,
    onRefresh,
}) => {
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [earnings, setEarnings] = useState<EarningsData | null>(null);

    useEffect(() => {
        loadEarnings();
    }, []);

    const loadEarnings = async () => {
        setIsLoading(true);
        try {
            // Simulated data - replace with API call
            await new Promise(resolve => setTimeout(resolve, 500));

            setEarnings({
                today: 245,
                week: 1250,
                month: 4850,
                total: 28500,
                deliveries: {
                    today: 8,
                    week: 42,
                    month: 165,
                },
                averagePerDelivery: 30,
                bonus: 150,
                tips: 85,
                recentDeliveries: [
                    { id: '1', orderNumber: 'QS-2024-001', amount: 35, tip: 5, timestamp: '10:30 AM', status: 'completed' },
                    { id: '2', orderNumber: 'QS-2024-002', amount: 28, tip: 0, timestamp: '11:15 AM', status: 'completed' },
                    { id: '3', orderNumber: 'QS-2024-003', amount: 42, tip: 10, timestamp: '12:00 PM', status: 'completed' },
                    { id: '4', orderNumber: 'QS-2024-004', amount: 25, tip: 0, timestamp: '1:30 PM', status: 'completed' },
                    { id: '5', orderNumber: 'QS-2024-005', amount: 38, tip: 8, timestamp: '2:45 PM', status: 'pending' },
                ],
            });
        } catch (error) {
            console.log('Load earnings error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadEarnings();
        if (onRefresh) await onRefresh();
        setIsRefreshing(false);
    };

    const getEarningsForPeriod = () => {
        if (!earnings) return 0;
        switch (period) {
            case 'today': return earnings.today;
            case 'week': return earnings.week;
            case 'month': return earnings.month;
        }
    };

    const getDeliveriesForPeriod = () => {
        if (!earnings) return 0;
        switch (period) {
            case 'today': return earnings.deliveries.today;
            case 'week': return earnings.deliveries.week;
            case 'month': return earnings.deliveries.month;
        }
    };

    if (isLoading && !earnings) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={Colors.primary}
                />
            }
        >
            {/* Main Earnings Card */}
            <LinearGradient
                colors={Colors.gradients.premium}
                style={styles.mainCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Text style={styles.mainLabel}>Your Earnings</Text>
                <Text style={styles.mainAmount}>
                    {getEarningsForPeriod().toFixed(0)} <Text style={styles.currency}>QAR</Text>
                </Text>
                <Text style={styles.deliveryCount}>
                    {getDeliveriesForPeriod()} deliveries • Avg {earnings?.averagePerDelivery || 0} QAR/delivery
                </Text>

                {/* Period Tabs */}
                <View style={styles.periodTabs}>
                    {(['today', 'week', 'month'] as const).map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[
                                styles.periodTab,
                                period === p && styles.periodTabActive,
                            ]}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setPeriod(p);
                            }}
                        >
                            <Text style={[
                                styles.periodTabText,
                                period === p && styles.periodTabTextActive,
                            ]}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statIcon}>💰</Text>
                    <Text style={styles.statValue}>{earnings?.total || 0}</Text>
                    <Text style={styles.statLabel}>Total Earned</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🎁</Text>
                    <Text style={styles.statValue}>{earnings?.bonus || 0}</Text>
                    <Text style={styles.statLabel}>Bonuses</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statIcon}>💵</Text>
                    <Text style={styles.statValue}>{earnings?.tips || 0}</Text>
                    <Text style={styles.statLabel}>Tips</Text>
                </View>
            </View>

            {/* Earnings Breakdown */}
            <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Earnings Breakdown</Text>

                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Base Earnings</Text>
                    <Text style={styles.breakdownValue}>
                        {(getEarningsForPeriod() - (earnings?.tips || 0) - (earnings?.bonus || 0)).toFixed(0)} QAR
                    </Text>
                </View>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tips</Text>
                    <Text style={[styles.breakdownValue, styles.tipsValue]}>
                        +{earnings?.tips || 0} QAR
                    </Text>
                </View>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Performance Bonus</Text>
                    <Text style={[styles.breakdownValue, styles.bonusValue]}>
                        +{earnings?.bonus || 0} QAR
                    </Text>
                </View>
                <View style={[styles.breakdownRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                        {getEarningsForPeriod().toFixed(0)} QAR
                    </Text>
                </View>
            </View>

            {/* Recent Deliveries */}
            <View style={styles.recentCard}>
                <Text style={styles.recentTitle}>Recent Deliveries</Text>

                {earnings?.recentDeliveries.map(delivery => (
                    <View key={delivery.id} style={styles.deliveryRow}>
                        <View style={styles.deliveryIcon}>
                            <Text style={styles.deliveryEmoji}>📦</Text>
                        </View>
                        <View style={styles.deliveryInfo}>
                            <Text style={styles.deliveryOrder}>{delivery.orderNumber}</Text>
                            <Text style={styles.deliveryTime}>{delivery.timestamp}</Text>
                        </View>
                        <View style={styles.deliveryAmounts}>
                            <Text style={styles.deliveryAmount}>{delivery.amount} QAR</Text>
                            {delivery.tip > 0 && (
                                <Text style={styles.deliveryTip}>+{delivery.tip} tip</Text>
                            )}
                        </View>
                        <View style={[
                            styles.statusBadge,
                            delivery.status === 'completed' ? styles.statusCompleted : styles.statusPending
                        ]}>
                            <Text style={styles.statusText}>
                                {delivery.status === 'completed' ? '✓' : '⏳'}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Fuel Calculator Hint */}
            <TouchableOpacity style={styles.fuelCard}>
                <Text style={styles.fuelIcon}>⛽</Text>
                <View style={styles.fuelInfo}>
                    <Text style={styles.fuelTitle}>Fuel Cost Calculator</Text>
                    <Text style={styles.fuelHint}>Track your expenses →</Text>
                </View>
            </TouchableOpacity>

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
    mainLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    mainAmount: {
        fontSize: 48,
        fontWeight: '800',
        color: '#fff',
        marginVertical: Spacing.sm,
    },
    currency: {
        fontSize: FontSizes.xl,
        fontWeight: '600',
    },
    deliveryCount: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.9)',
    },
    periodTabs: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    periodTab: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    periodTabActive: {
        backgroundColor: '#fff',
    },
    periodTabText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
    },
    periodTabTextActive: {
        color: Colors.primary,
    },
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        ...Shadows.sm,
    },
    statIcon: {
        fontSize: 24,
        marginBottom: Spacing.xs,
    },
    statValue: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    statLabel: {
        fontSize: FontSizes.xs,
        color: '#525252', // Previously Colors.dark.textSecondary
        marginTop: 2,
    },
    breakdownCard: {
        backgroundColor: '#fff',
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    breakdownTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a', // Previously Colors.dark.text
        marginBottom: Spacing.md,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    breakdownLabel: {
        fontSize: FontSizes.md,
        color: '#525252', // Previously Colors.dark.textSecondary
    },
    breakdownValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    tipsValue: {
        color: Colors.success,
    },
    bonusValue: {
        color: Colors.secondary,
    },
    totalRow: {
        borderBottomWidth: 0,
        paddingTop: Spacing.md,
        marginTop: Spacing.xs,
        borderTopWidth: 2,
        borderTopColor: '#F0F0F0',
    },
    totalLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    totalValue: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.primary,
    },
    recentCard: {
        backgroundColor: '#fff',
        marginHorizontal: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    recentTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a', // Previously Colors.dark.text
        marginBottom: Spacing.md,
    },
    deliveryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    deliveryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deliveryEmoji: {
        fontSize: 18,
    },
    deliveryInfo: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    deliveryOrder: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    deliveryTime: {
        fontSize: FontSizes.xs,
        color: '#525252', // Previously Colors.dark.textSecondary
    },
    deliveryAmounts: {
        alignItems: 'flex-end',
        marginRight: Spacing.sm,
    },
    deliveryAmount: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    deliveryTip: {
        fontSize: FontSizes.xs,
        color: Colors.success,
    },
    statusBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusCompleted: {
        backgroundColor: '#dcfce7',
    },
    statusPending: {
        backgroundColor: '#fef3c7',
    },
    statusText: {
        fontSize: 12,
    },
    fuelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderStyle: 'dashed',
    },
    fuelIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    fuelInfo: {
        flex: 1,
    },
    fuelTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a', // Previously Colors.dark.text
    },
    fuelHint: {
        fontSize: FontSizes.sm,
        color: '#525252', // Previously Colors.dark.textSecondary
    },
});

export default DriverEarningsDashboard;
