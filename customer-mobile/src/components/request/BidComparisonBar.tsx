// BidComparisonBar - Visual price range bar for multiple bids
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bid } from '../../services/api';
import { Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

const BidComparisonBar = ({ bids, colors }: { bids: Bid[]; colors: any }) => {
    const { t, isRTL } = useTranslation();
    if (bids.length < 2) return null;

    const prices = bids.map(b => Number(b.bid_amount));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    if (range === 0) return null;

    return (
        <View style={[styles.comparisonContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.comparisonTitle, { textAlign: rtlTextAlign(isRTL) }]}>{t('requestDetail.priceRange')}</Text>
            <View style={styles.comparisonBar}>
                <LinearGradient
                    colors={['#22C55E', '#F59E0B', '#EF4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.comparisonGradient}
                >
                    {bids.map((bid) => {
                        const position = range > 0 ? ((Number(bid.bid_amount) - minPrice) / range) * 100 : 50;
                        return (
                            <View
                                key={bid.bid_id}
                                style={[styles.comparisonDot, { left: isRTL ? undefined : `${position}%`, right: isRTL ? `${position}%` : undefined }]}
                            >
                                <View style={styles.comparisonDotInner} />
                            </View>
                        );
                    })}
                </LinearGradient>
            </View>
            <View style={[styles.comparisonLabels, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={styles.comparisonMin}>{minPrice} {t('common.qar')}</Text>
                <Text style={styles.comparisonMax}>{maxPrice} {t('common.qar')}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    comparisonContainer: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    comparisonTitle: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm },
    comparisonBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
    comparisonGradient: { flex: 1, position: 'relative' },
    comparisonDot: {
        position: 'absolute',
        top: -4,
        width: 16,
        height: 16,
        marginLeft: -8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    comparisonDotInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#1a1a2e',
    },
    comparisonLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    comparisonMin: { fontSize: FontSizes.sm, color: '#22C55E', fontWeight: '600' },
    comparisonMax: { fontSize: FontSizes.sm, color: '#EF4444', fontWeight: '600' },
});

export default BidComparisonBar;
