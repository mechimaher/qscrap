import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius, Colors } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

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
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vvipOrderCard}
        >
            {/* Premium Brand Accent */}
            <LinearGradient
                colors={[Colors.primary + '40', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardOverlay}
            />

            {/* Garage Header */}
            <View style={[styles.garageRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={styles.garageIcon}>
                    <Ionicons name="business" size={18} color={Colors.secondary} />
                </View>
                <Text style={[styles.vvipGarageName, { textAlign: rtlTextAlign(isRTL) }]} numberOfLines={1}>
                    {garageName}
                </Text>
            </View>

            {/* Part Description */}
            <View style={[styles.vvipPartRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.vvipPartLabel}>{t('payment.part')}</Text>
                <Text style={[styles.vvipPartValue, { textAlign: rtlTextAlign(isRTL) }]} numberOfLines={1}>
                    {partDescription}
                </Text>
            </View>

            {/* Gold Divider */}
            <LinearGradient
                colors={['transparent', Colors.secondary + '40', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.vvipDivider}
            />

            {/* Price Breakdown */}
            <View style={[styles.vvipPriceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.vvipPriceLabel}>{t('order.partPrice')}</Text>
                <Text style={styles.vvipPriceValue}>{partPrice.toFixed(0)} {t('common.currency')}</Text>
            </View>
            <View style={[styles.vvipPriceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.deliveryBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="car-sport" size={12} color="#60A5FA" style={isRTL ? { marginLeft: 4 } : { marginRight: 4 }} />
                    <Text style={styles.vvipPriceLabel}>{t('order.deliveryFee')}</Text>
                </View>
                <Text style={styles.vvipPriceValue}>{deliveryFee.toFixed(0)} {t('common.currency')}</Text>
            </View>

            {/* Total */}
            <View style={[styles.totalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.vvipTotalLabel}>{t('common.total')}</Text>
                <View style={[styles.totalBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={styles.vvipTotalValue}>{totalAmount.toFixed(0)}</Text>
                    <Text style={styles.vvipTotalCurrency}> {t('common.currency')}</Text>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    vvipOrderCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        marginBottom: Spacing.md,
        position: 'relative',
        overflow: 'hidden',
    },
    cardOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
    },
    garageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    garageIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(201, 162, 39, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    vvipGarageName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        flex: 1,
        letterSpacing: -0.3,
    },
    vvipPartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    vvipPartLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.5)',
    },
    vvipPartValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        flex: 1,
    },
    vvipDivider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    vvipPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vvipPriceLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.6)',
    },
    vvipPriceValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    vvipTotalLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
    },
    totalBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    vvipTotalValue: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFD700',
    },
    vvipTotalCurrency: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFD700',
        opacity: 0.8,
    },
});
