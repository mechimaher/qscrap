import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import { rtlFlexDirection } from '../../utils/rtl';

interface PaymentSummaryProps {
    garageName: string;
    partDescription: string;
    partPrice: number;
    deliveryFee: number;
    totalAmount: number;
    isRTL: boolean;
    t: (key: string) => string;
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
    garageName,
    partDescription,
    partPrice,
    deliveryFee,
    totalAmount,
    isRTL,
    t,
}) => {
    return (
        <LinearGradient
            colors={['#1a1a2e', '#2d2d44']}
            style={styles.vvipOrderCard}
        >
            <Text style={styles.vvipGarageName}>{garageName}</Text>
            <View style={styles.vvipPartRow}>
                <Text style={styles.vvipPartLabel}>{t('payment.part')}</Text>
                <Text style={styles.vvipPartValue} numberOfLines={1}>
                    {partDescription}
                </Text>
            </View>
            <View style={styles.vvipDivider} />
            <View style={[styles.vvipPriceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={styles.vvipPriceLabel}>{t('order.partPrice')}</Text>
                <Text style={styles.vvipPriceValue}>{partPrice.toFixed(0)} {t('common.currency')}</Text>
            </View>
            <View style={[styles.vvipPriceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={styles.vvipPriceLabel}>{t('order.deliveryFee')}</Text>
                <Text style={styles.vvipPriceValue}>{deliveryFee.toFixed(0)} {t('common.currency')}</Text>
            </View>
            <View style={[styles.vvipPriceRow, { marginTop: Spacing.sm, flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={styles.vvipTotalLabel}>{t('common.total')}</Text>
                <Text style={styles.vvipTotalValue}>{totalAmount.toFixed(0)} {t('common.currency')}</Text>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    vvipOrderCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        marginBottom: Spacing.md,
    },
    vvipGarageName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: Spacing.md,
    },
    vvipPartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    vvipPartLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.6)',
    },
    vvipPartValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    vvipDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginVertical: Spacing.md,
    },
    vvipPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    vvipPriceLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
    },
    vvipPriceValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#fff',
    },
    vvipTotalLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
    },
    vvipTotalValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFD700',
    },
});
