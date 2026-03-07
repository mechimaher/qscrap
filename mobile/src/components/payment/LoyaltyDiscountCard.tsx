import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import { rtlFlexDirection } from '../../utils/rtl';

interface LoyaltyDiscountCardProps {
    loyaltyData: { tier: string; discountPercentage: number } | null;
    freeOrder: boolean;
    applyDiscount: boolean;
    setApplyDiscount: (apply: boolean) => void;
    paymentType: 'delivery_only' | 'full';
    calculateDiscount: { discountOnPart: number; discountOnTotal: number };
    partPrice: number;
    codAmount: number;
    totalAmount: number;
    payNowAmount: number;
    discountAmount: number;
    isRTL: boolean;
    t: (key: string) => string;
}

export const LoyaltyDiscountCard: React.FC<LoyaltyDiscountCardProps> = ({
    loyaltyData,
    freeOrder,
    applyDiscount,
    setApplyDiscount,
    paymentType,
    calculateDiscount,
    partPrice,
    codAmount,
    totalAmount,
    payNowAmount,
    discountAmount,
    isRTL,
    t,
}) => {
    if (!loyaltyData || loyaltyData.discountPercentage <= 0) {
        return null;
    }

    return (
        <View style={[
            styles.vvipLoyaltyCard,
            freeOrder && { borderColor: '#22C55E', borderWidth: 2 }
        ]}>
            <View style={[styles.vvipLoyaltyRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.vvipLoyaltyLeft}>
                    <Ionicons name={loyaltyData.tier === 'platinum' ? 'diamond' : loyaltyData.tier === 'gold' ? 'trophy' : 'medal'} size={28} color={loyaltyData.tier === 'platinum' ? '#E5E7EB' : loyaltyData.tier === 'gold' ? '#FFD700' : '#C0C0C0'} />
                    <View>
                        <Text style={styles.vvipLoyaltyTier}>
                            {loyaltyData.tier.toUpperCase()} • {loyaltyData.discountPercentage}% {t('payment.off')}
                        </Text>
                        <Text style={styles.vvipLoyaltySavings}>
                            {applyDiscount ? t('payment.save', { amount: paymentType === 'full' ? calculateDiscount.discountOnTotal : calculateDiscount.discountOnPart }) : t('payment.tapToApply')}
                        </Text>
                    </View>
                </View>
                <Switch
                    testID="loyalty-switch"
                    value={applyDiscount}
                    onValueChange={(value) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setApplyDiscount(value);
                    }}
                    trackColor={{ false: '#374151', true: '#22C55E' }}
                    thumbColor={applyDiscount ? '#fff' : '#9CA3AF'}
                />
            </View>

            {freeOrder && (
                <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    style={styles.vvipFreeOrderBanner}
                >
                    <Text style={styles.vvipFreeOrderText}>{t('payment.freeOrderBanner')}</Text>
                </LinearGradient>
            )}

            {applyDiscount && (paymentType === 'full' ? calculateDiscount.discountOnTotal : calculateDiscount.discountOnPart) > 0 && !freeOrder && (
                <View style={styles.vvipDiscountSummary}>
                    <Text style={styles.vvipDiscountLabel}>
                        {paymentType === 'full' ? t('payment.youPay') : t('payment.codAmount')}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.vvipDiscountOld}>
                            {(paymentType === 'full' ? totalAmount : partPrice).toFixed(0)} {t('common.currency')}
                        </Text>
                        <Text style={styles.vvipDiscountNew}>
                            {(paymentType === 'full' ? payNowAmount : codAmount).toFixed(0)} {t('common.currency')}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    vvipLoyaltyCard: {
        backgroundColor: '#1F2937',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    vvipLoyaltyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    vvipLoyaltyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    vvipLoyaltyTier: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
    },
    vvipLoyaltySavings: {
        fontSize: FontSizes.sm,
        color: '#22C55E',
        marginTop: 2,
    },
    vvipFreeOrderBanner: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    vvipFreeOrderText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: FontSizes.md,
    },
    vvipDiscountSummary: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#374151',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    vvipDiscountLabel: {
        fontSize: FontSizes.md,
        color: '#9CA3AF',
    },
    vvipDiscountOld: {
        fontSize: FontSizes.sm,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    vvipDiscountNew: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#22C55E',
    },
});
