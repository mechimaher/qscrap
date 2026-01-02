import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface PriceTrend {
    period: string;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    volume: number;
    change: number; // percentage
}

interface PartPricing {
    partName: string;
    category: string;
    currentPrice: number;
    suggestedPrice: number;
    marketAverage: number;
    trends: PriceTrend[];
    demand: 'low' | 'medium' | 'high' | 'very_high';
    priceConfidence: number; // 0-100
}

interface SmartPricingProps {
    partName: string;
    category?: string;
    condition?: 'new' | 'used' | 'refurbished';
    onPriceSelect?: (price: number) => void;
}

/**
 * Premium Smart Pricing Component
 * Shows market trends and AI-suggested pricing
 */
export const SmartPricing: React.FC<SmartPricingProps> = ({
    partName,
    category = 'engine',
    condition = 'used',
    onPriceSelect,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [pricing, setPricing] = useState<PartPricing | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

    const chartAnimations = useRef(
        Array.from({ length: 6 }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        loadPricingData();
    }, [partName, category, condition]);

    useEffect(() => {
        if (pricing) {
            animateChart();
        }
    }, [pricing, selectedPeriod]);

    const animateChart = () => {
        chartAnimations.forEach((anim, index) => {
            Animated.timing(anim, {
                toValue: 1,
                duration: 500,
                delay: index * 100,
                useNativeDriver: false,
            }).start();
        });
    };

    const loadPricingData = async () => {
        setIsLoading(true);
        try {
            // Simulated API data - matches analytics.routes.ts patterns
            await new Promise(resolve => setTimeout(resolve, 600));

            // Generate realistic pricing data based on part type
            const basePrice = category === 'engine' ? 800 :
                category === 'brake' ? 150 :
                    category === 'transmission' ? 1200 : 300;

            const conditionMultiplier = condition === 'new' ? 1.5 :
                condition === 'refurbished' ? 1.1 : 1;

            const currentPrice = Math.round(basePrice * conditionMultiplier);

            setPricing({
                partName,
                category,
                currentPrice,
                suggestedPrice: Math.round(currentPrice * 0.95),
                marketAverage: Math.round(currentPrice * 1.02),
                demand: ['medium', 'high', 'very_high'][Math.floor(Math.random() * 3)] as 'medium' | 'high' | 'very_high',
                priceConfidence: 85 + Math.floor(Math.random() * 10),
                trends: [
                    { period: 'Week 1', averagePrice: currentPrice * 0.92, minPrice: currentPrice * 0.85, maxPrice: currentPrice * 1.05, volume: 12, change: -3 },
                    { period: 'Week 2', averagePrice: currentPrice * 0.95, minPrice: currentPrice * 0.88, maxPrice: currentPrice * 1.08, volume: 18, change: 3.2 },
                    { period: 'Week 3', averagePrice: currentPrice * 0.98, minPrice: currentPrice * 0.90, maxPrice: currentPrice * 1.10, volume: 15, change: 2.5 },
                    { period: 'Week 4', averagePrice: currentPrice * 1.00, minPrice: currentPrice * 0.92, maxPrice: currentPrice * 1.12, volume: 22, change: 2.1 },
                    { period: 'Current', averagePrice: currentPrice, minPrice: currentPrice * 0.90, maxPrice: currentPrice * 1.15, volume: 8, change: 0 },
                ],
            });
        } catch (error) {
            console.log('Load pricing error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getDemandColor = (demand: string) => {
        switch (demand) {
            case 'very_high': return '#22c55e';
            case 'high': return '#84cc16';
            case 'medium': return '#f59e0b';
            case 'low': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getDemandLabel = (demand: string) => {
        switch (demand) {
            case 'very_high': return '🔥 Very High';
            case 'high': return '📈 High';
            case 'medium': return '➡️ Medium';
            case 'low': return '📉 Low';
            default: return 'Unknown';
        }
    };

    const handlePriceSelect = (price: number) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onPriceSelect) onPriceSelect(price);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Analyzing market prices...</Text>
            </View>
        );
    }

    if (!pricing) return null;

    const maxPrice = Math.max(...pricing.trends.map(t => t.maxPrice));
    const minPrice = Math.min(...pricing.trends.map(t => t.minPrice));
    const priceRange = maxPrice - minPrice;

    return (
        <View style={styles.container}>
            {/* Header Card */}
            <LinearGradient
                colors={['#059669', '#10b981']}
                style={styles.headerCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <Text style={styles.headerLabel}>Suggested Price</Text>
                    <Text style={styles.suggestedPrice}>
                        {pricing.suggestedPrice} <Text style={styles.currency}>QAR</Text>
                    </Text>
                    <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                            {pricing.priceConfidence}% Confidence
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.useButton}
                    onPress={() => handlePriceSelect(pricing.suggestedPrice)}
                >
                    <Text style={styles.useButtonText}>Use This Price</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* Market Overview */}
            <View style={styles.overviewCard}>
                <Text style={styles.sectionTitle}>Market Overview</Text>

                <View style={styles.overviewGrid}>
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewValue}>{pricing.marketAverage} QAR</Text>
                        <Text style={styles.overviewLabel}>Market Average</Text>
                    </View>
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewValue}>
                            {Math.round(pricing.trends[0].minPrice)}-{Math.round(pricing.trends[pricing.trends.length - 1].maxPrice)}
                        </Text>
                        <Text style={styles.overviewLabel}>Price Range</Text>
                    </View>
                    <View style={styles.overviewItem}>
                        <View style={[styles.demandBadge, { backgroundColor: getDemandColor(pricing.demand) + '20' }]}>
                            <Text style={[styles.demandText, { color: getDemandColor(pricing.demand) }]}>
                                {getDemandLabel(pricing.demand)}
                            </Text>
                        </View>
                        <Text style={styles.overviewLabel}>Demand</Text>
                    </View>
                </View>
            </View>

            {/* Price Chart */}
            <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>Price Trend</Text>
                    <View style={styles.periodTabs}>
                        {(['7d', '30d', '90d'] as const).map(period => (
                            <TouchableOpacity
                                key={period}
                                style={[
                                    styles.periodTab,
                                    selectedPeriod === period && styles.periodTabActive,
                                ]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedPeriod(period);
                                }}
                            >
                                <Text style={[
                                    styles.periodText,
                                    selectedPeriod === period && styles.periodTextActive,
                                ]}>
                                    {period}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Simple Bar Chart */}
                <View style={styles.chartContainer}>
                    {pricing.trends.map((trend, index) => {
                        const barHeight = chartAnimations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, ((trend.averagePrice - minPrice) / priceRange) * 100],
                        });

                        return (
                            <View key={index} style={styles.chartBarContainer}>
                                <Animated.View
                                    style={[
                                        styles.chartBar,
                                        { height: barHeight },
                                        index === pricing.trends.length - 1 && styles.chartBarCurrent,
                                    ]}
                                />
                                <Text style={styles.chartLabel}>{trend.period.substring(0, 3)}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Price Legend */}
                <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                        <Text style={styles.legendText}>Average Price</Text>
                    </View>
                </View>
            </View>

            {/* Quick Price Options */}
            <View style={styles.quickPriceCard}>
                <Text style={styles.sectionTitle}>Quick Price Options</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.priceOptions}
                >
                    <TouchableOpacity
                        style={[styles.priceOption, styles.priceOptionCompetitive]}
                        onPress={() => handlePriceSelect(Math.round(pricing.marketAverage * 0.9))}
                    >
                        <Text style={styles.priceOptionLabel}>Competitive</Text>
                        <Text style={styles.priceOptionValue}>
                            {Math.round(pricing.marketAverage * 0.9)} QAR
                        </Text>
                        <Text style={styles.priceOptionHint}>10% below market</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.priceOption, styles.priceOptionSuggested]}
                        onPress={() => handlePriceSelect(pricing.suggestedPrice)}
                    >
                        <Text style={styles.priceOptionLabel}>⭐ Suggested</Text>
                        <Text style={styles.priceOptionValue}>{pricing.suggestedPrice} QAR</Text>
                        <Text style={styles.priceOptionHint}>Best balance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.priceOption, styles.priceOptionMarket]}
                        onPress={() => handlePriceSelect(pricing.marketAverage)}
                    >
                        <Text style={styles.priceOptionLabel}>Market</Text>
                        <Text style={styles.priceOptionValue}>{pricing.marketAverage} QAR</Text>
                        <Text style={styles.priceOptionHint}>Average price</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.priceOption, styles.priceOptionPremium]}
                        onPress={() => handlePriceSelect(Math.round(pricing.marketAverage * 1.1))}
                    >
                        <Text style={styles.priceOptionLabel}>Premium</Text>
                        <Text style={styles.priceOptionValue}>
                            {Math.round(pricing.marketAverage * 1.1)} QAR
                        </Text>
                        <Text style={styles.priceOptionHint}>Higher margin</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Info Note */}
            <View style={styles.infoNote}>
                <Text style={styles.infoIcon}>💡</Text>
                <Text style={styles.infoText}>
                    Prices are based on {pricing.trends.reduce((sum, t) => sum + t.volume, 0)} recent transactions
                    for similar {condition} parts in Qatar.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        fontSize: FontSizes.md,
        color: '#525252',
    },
    headerCard: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.lg,
    },
    headerContent: {
        flex: 1,
    },
    headerLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    suggestedPrice: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
        marginVertical: 4,
    },
    currency: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
    },
    confidenceBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        alignSelf: 'flex-start',
    },
    confidenceText: {
        fontSize: FontSizes.xs,
        color: '#fff',
        fontWeight: '500',
    },
    useButton: {
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    useButtonText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#059669',
    },
    overviewCard: {
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
    overviewGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    overviewItem: {
        alignItems: 'center',
        flex: 1,
    },
    overviewValue: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    overviewLabel: {
        fontSize: FontSizes.xs,
        color: '#525252',
        marginTop: 2,
    },
    demandBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    demandText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    chartCard: {
        backgroundColor: '#fff',
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    periodTabs: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
        padding: 2,
    },
    periodTab: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    periodTabActive: {
        backgroundColor: '#fff',
    },
    periodText: {
        fontSize: FontSizes.xs,
        color: '#525252',
        fontWeight: '500',
    },
    periodTextActive: {
        color: Colors.primary,
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 120,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
    },
    chartBarContainer: {
        flex: 1,
        alignItems: 'center',
    },
    chartBar: {
        width: 24,
        backgroundColor: Colors.primary + '60',
        borderRadius: 4,
        minHeight: 8,
    },
    chartBarCurrent: {
        backgroundColor: Colors.primary,
    },
    chartLabel: {
        fontSize: 10,
        color: '#525252',
        marginTop: 4,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        fontSize: FontSizes.xs,
        color: '#525252',
    },
    quickPriceCard: {
        marginHorizontal: Spacing.md,
    },
    priceOptions: {
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    priceOption: {
        width: 120,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        ...Shadows.sm,
    },
    priceOptionCompetitive: {
        backgroundColor: '#dbeafe',
    },
    priceOptionSuggested: {
        backgroundColor: '#dcfce7',
        borderWidth: 2,
        borderColor: '#22c55e',
    },
    priceOptionMarket: {
        backgroundColor: '#fef3c7',
    },
    priceOptionPremium: {
        backgroundColor: '#fce7f3',
    },
    priceOptionLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    priceOptionValue: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginVertical: 4,
    },
    priceOptionHint: {
        fontSize: 10,
        color: '#525252',
    },
    infoNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        margin: Spacing.md,
        padding: Spacing.md,
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
    },
    infoIcon: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    infoText: {
        flex: 1,
        fontSize: FontSizes.xs,
        color: '#525252',
        lineHeight: 18,
    },
});

export default SmartPricing;
