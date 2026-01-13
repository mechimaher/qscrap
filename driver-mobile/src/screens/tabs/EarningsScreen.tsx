// QScrap Driver App - Earnings Screen
// Earnings summary and payout history

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { api, DriverStats, Wallet, WalletTransaction } from '../../services/api';
import { Colors, Spacing } from '../../constants/theme';

export default function EarningsScreen() {
    const { colors } = useTheme();

    const [stats, setStats] = useState<DriverStats | null>(null);
    const [trendData, setTrendData] = useState<{ labels: string[], data: number[] }>({
        labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        data: [0, 0, 0, 0, 0, 0, 0]
    });
    const [payouts, setPayouts] = useState<any[]>([]);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        try {
            const [statsRes, trendRes, payoutsRes, walletRes, historyRes] = await Promise.all([
                api.getStats(),
                api.getEarningsTrend(),
                api.getPayoutHistory(),
                api.getWallet(),
                api.getWalletHistory()
            ]);

            setStats(statsRes.stats);
            setPayouts(payoutsRes.payouts);
            setWallet(walletRes.wallet);
            setTransactions(historyRes.history);

            if (trendRes.trend && trendRes.trend.length > 0) {
                setTrendData({
                    labels: trendRes.trend.map((t: any) => t.day_label),
                    data: trendRes.trend.map((t: any) => parseFloat(t.amount) || 0)
                });
            }
        } catch (err) {
            console.error('[Earnings] Load error:', err);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadAllData();
        setIsRefreshing(false);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Earnings</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Wallet Balance Card (Gig Economy Style) */}
                <LinearGradient
                    colors={wallet && wallet.balance < 0 ? [Colors.danger, '#D32F2F'] : [Colors.success, '#388E3C']}
                    style={styles.totalCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={styles.totalLabel}>Wallet Balance</Text>
                    <Text style={styles.totalAmount}>
                        {formatNum(wallet?.balance)} QAR
                    </Text>
                    <Text style={styles.totalDeliveries}>
                        {wallet && wallet.balance < 0
                            ? 'You owe QScrap (Please Deposit)'
                            : 'Available for Payout'}
                    </Text>

                    <View style={styles.walletStatsRow}>
                        <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Total Earned</Text>
                            <Text style={styles.walletStatValue}>{formatNum(wallet?.total_earned)}</Text>
                        </View>
                        <View style={styles.walletStatDivider} />
                        <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Cash in Hand</Text>
                            <Text style={styles.walletStatValue}>{formatNum(wallet?.cash_collected)}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* VVIP Earnings Chart */}
                <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Weekly Trend</Text>
                    <LineChart
                        data={{
                            labels: trendData.labels,
                            datasets: [{
                                data: trendData.data
                            }]
                        }}
                        width={Dimensions.get("window").width - 56} // from react-native
                        height={220}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surface,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(141, 27, 61, ${opacity})`, // Qatar Maroon
                            labelColor: (opacity = 1) => colors.textSecondary,
                            style: { borderRadius: 16 },
                            propsForDots: {
                                r: "6",
                                strokeWidth: "2",
                                stroke: Colors.secondary // Gold accent
                            }
                        }}
                        bezier
                        style={styles.chart}
                    />
                </View>

                {/* Period Stats */}
                <View style={styles.periodGrid}>
                    <View style={[styles.periodCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.periodIcon}>📅</Text>
                        <Text style={[styles.periodValue, { color: colors.text }]}>
                            {formatNum(stats?.today_earnings)} QAR
                        </Text>
                        <Text style={[styles.periodLabel, { color: colors.textMuted }]}>Today</Text>
                    </View>
                    <View style={[styles.periodCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.periodIcon}>📊</Text>
                        <Text style={[styles.periodValue, { color: colors.text }]}>
                            {formatNum(stats?.week_earnings)} QAR
                        </Text>
                        <Text style={[styles.periodLabel, { color: colors.textMuted }]}>This Week</Text>
                    </View>
                </View>

                {/* Performance Stats */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>

                    <View style={[styles.performanceCard, { backgroundColor: colors.surface }]}>
                        <PerformanceRow
                            icon="⭐"
                            label="Rating"
                            value={`${formatRating(stats?.rating_average)} (${stats?.rating_count || 0} reviews)`}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <PerformanceRow
                            icon="📦"
                            label="Total Deliveries"
                            value={`${stats?.total_deliveries || 0}`}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <PerformanceRow
                            icon="💵"
                            label="Avg. Per Delivery"
                            value={`${formatNum(stats?.total_deliveries ? Number(stats.total_earnings) / Number(stats.total_deliveries) : 0)} QAR`}
                            colors={colors}
                        />
                    </View>
                </View>

                {/* Recent Payouts */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Payouts</Text>
                    {payouts.length > 0 ? (
                        <View style={[styles.performanceCard, { backgroundColor: colors.surface }]}>
                            {payouts.map((payout, index) => (
                                <View key={payout.payout_id}>
                                    <View style={styles.payoutRow}>
                                        <View style={styles.payoutInfo}>
                                            <Text style={[styles.payoutNum, { color: colors.text }]}>#{payout.order_number}</Text>
                                            <Text style={[styles.payoutDate, { color: colors.textMuted }]}>
                                                {new Date(payout.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View style={styles.payoutRight}>
                                            <Text style={[styles.payoutAmount, { color: Colors.success }]}>
                                                +{payout.amount} QAR
                                            </Text>
                                            <View style={[styles.payoutStatus, { backgroundColor: getPayoutStatusColor(payout.status) + '15' }]}>
                                                <Text style={[styles.payoutStatusText, { color: getPayoutStatusColor(payout.status) }]}>
                                                    {payout.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {index < payouts.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={[styles.infoCard, { backgroundColor: colors.surface, justifyContent: 'center' }]}>
                            <Text style={[styles.infoDescription, { color: colors.textSecondary, textAlign: 'center' }]}>
                                No payout history found.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Transaction History */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
                    {transactions.length > 0 ? (
                        <View style={[styles.performanceCard, { backgroundColor: colors.surface }]}>
                            {transactions.map((tx, index) => (
                                <View key={tx.transaction_id}>
                                    <View style={styles.payoutRow}>
                                        <View style={styles.payoutInfo}>
                                            <Text style={[styles.payoutNum, { color: colors.text }]}>{tx.description}</Text>
                                            <Text style={[styles.payoutDate, { color: colors.textMuted }]}>
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View style={styles.payoutRight}>
                                            <Text style={[styles.payoutAmount, { color: tx.amount >= 0 ? Colors.success : Colors.danger }]}>
                                                {tx.amount >= 0 ? '+' : ''}{tx.amount} QAR
                                            </Text>
                                            <View style={[styles.payoutStatus, { backgroundColor: (tx.amount >= 0 ? Colors.success : Colors.danger) + '15' }]}>
                                                <Text style={[styles.payoutStatusText, { color: tx.amount >= 0 ? Colors.success : Colors.danger }]}>
                                                    {tx.type.toUpperCase().replace('_', ' ')}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {index < transactions.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={[styles.infoCard, { backgroundColor: colors.surface, justifyContent: 'center' }]}>
                            <Text style={[styles.infoDescription, { color: colors.textSecondary, textAlign: 'center' }]}>
                                No transactions found.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Payout Info */}
                <View style={[styles.section, { marginBottom: 40 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout Cycle</Text>

                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.infoIcon}>💳</Text>
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoTitle, { color: colors.text }]}>
                                Weekly Bank Transfers
                            </Text>
                            <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                                Your accumulated earnings are automatically transferred every Sunday to your registered bank account.
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Helper functions for safe number formatting
function formatRating(value: any): string {
    if (value === null || value === undefined) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(1);
}

function formatNum(value: any): string {
    if (value === null || value === undefined) return '0.00';
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
}

function PerformanceRow({ icon, label, value, colors }: any) {
    return (
        <View style={styles.performanceRow}>
            <Text style={styles.performanceIcon}>{icon}</Text>
            <Text style={[styles.performanceLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.performanceValue, { color: colors.text }]}>{value}</Text>
        </View>
    );
}

function getPayoutStatusColor(status: string) {
    switch (status) {
        case 'paid': return Colors.success;
        case 'pending': return Colors.warning;
        case 'failed': return Colors.danger;
        default: return Colors.textMuted;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 8,
        paddingBottom: Spacing.BOTTOM_NAV_HEIGHT,
    },
    totalCard: {
        padding: 32,
        borderRadius: 24,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    totalLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    totalAmount: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '900',
        marginTop: 12,
    },
    totalDeliveries: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        marginTop: 12,
        fontWeight: '500',
    },
    periodGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    periodCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    periodIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    periodValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    periodLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    periodDeliveries: {
        fontSize: 11,
        marginTop: 2,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    performanceCard: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    performanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    performanceIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    performanceLabel: {
        flex: 1,
        fontSize: 14,
    },
    performanceValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    infoCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
    },
    infoIcon: {
        fontSize: 32,
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    infoDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    // New Chart Styles
    chartCard: {
        marginBottom: 24,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    // Payout Row Styles
    payoutRow: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    payoutInfo: {
        flex: 1,
    },
    payoutNum: {
        fontSize: 15,
        fontWeight: '700',
    },
    payoutDate: {
        fontSize: 12,
        marginTop: 2,
    },
    payoutRight: {
        alignItems: 'flex-end',
    },
    payoutAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    payoutStatus: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    payoutStatusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    walletStatsRow: {
        flexDirection: 'row',
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 12,
        width: '100%',
    },
    walletStat: {
        flex: 1,
        alignItems: 'center',
    },
    walletStatDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    walletStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginBottom: 4,
    },
    walletStatValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
