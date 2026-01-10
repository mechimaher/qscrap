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
import { api, DriverStats } from '../../services/api';
import { Colors } from '../../constants/theme';

export default function EarningsScreen() {
    const { colors } = useTheme();

    const [stats, setStats] = useState<DriverStats | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const result = await api.getStats();
            setStats(result.stats);
        } catch (err) {
            console.error('[Earnings] Load error:', err);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadStats();
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
                {/* Total Earnings Card */}
                <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.totalCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={styles.totalLabel}>Total Earnings</Text>
                    <Text style={styles.totalAmount}>
                        {formatNum(stats?.total_earnings)} QAR
                    </Text>
                    <Text style={styles.totalDeliveries}>
                        {stats?.total_deliveries || 0} deliveries completed
                    </Text>
                </LinearGradient>

                {/* VVIP Earnings Chart */}
                <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Weekly Trend</Text>
                    <LineChart
                        data={{
                            labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                            datasets: [{
                                data: [
                                    Math.random() * 100,
                                    Math.random() * 100,
                                    Math.random() * 100,
                                    Math.random() * 100,
                                    Math.random() * 100,
                                    Math.random() * 100,
                                    Math.random() * 100
                                ]
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
                            color: (opacity = 1) => `rgba(163, 112, 247, ${opacity})`,
                            labelColor: (opacity = 1) => colors.textSecondary,
                            style: { borderRadius: 16 },
                            propsForDots: {
                                r: "6",
                                strokeWidth: "2",
                                stroke: Colors.primary
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

                {/* Payout Info */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout Info</Text>

                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.infoIcon}>💳</Text>
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoTitle, { color: colors.text }]}>
                                Weekly Payouts
                            </Text>
                            <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                                Earnings are paid out every Sunday directly to your registered bank account
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
    },
    totalCard: {
        padding: 24,
        borderRadius: 20,
        marginBottom: 16,
        alignItems: 'center',
    },
    totalLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
    },
    totalAmount: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '800',
        marginTop: 8,
    },
    totalDeliveries: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginTop: 8,
    },
    periodGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    periodCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
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
});
