import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { rtlFlexDirection } from '../../utils/rtl';

interface PaymentTypeSelectorProps {
    paymentType: 'delivery_only' | 'full';
    setPaymentType: (type: 'delivery_only' | 'full') => void;
    deliveryFee: number;
    totalAmount: number;
    isRTL: boolean;
    t: (key: string) => string;
    setClientSecret: (secret: string | null) => void;
}

export const PaymentTypeSelector: React.FC<PaymentTypeSelectorProps> = ({
    paymentType,
    setPaymentType,
    deliveryFee,
    totalAmount,
    isRTL,
    t,
    setClientSecret
}) => {
    return (
        <View style={styles.paymentOptionsSection}>
            <TouchableOpacity
                style={[
                    styles.vvipPaymentOption,
                    paymentType === 'delivery_only' && styles.vvipPaymentSelected
                ]}
                onPress={() => {
                    if (paymentType !== 'delivery_only') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPaymentType('delivery_only');
                        setClientSecret(null);
                    }
                }}
                activeOpacity={0.85}
            >
                <View style={[styles.vvipPaymentLeft, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <View style={[styles.vvipPaymentIcon, { backgroundColor: '#3B82F6' }]}>
                        <Ionicons name="car-sport" size={20} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.vvipPaymentTitle}>{t('payment.payDeliveryOnly')}</Text>
                        <Text style={styles.vvipPaymentSubtitle}>{t('payment.cashOnDeliveryForPart')}</Text>
                    </View>
                </View>
                <View style={styles.vvipPaymentRight}>
                    <Text style={styles.vvipPaymentAmount}>{deliveryFee.toFixed(0)}</Text>
                    <Text style={styles.vvipPaymentCurrency}>{t('common.currency')}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.vvipPaymentOption,
                    paymentType === 'full' && styles.vvipPaymentSelected
                ]}
                onPress={() => {
                    if (paymentType !== 'full') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPaymentType('full');
                        setClientSecret(null);
                    }
                }}
                activeOpacity={0.85}
            >
                <View style={[styles.vvipPaymentLeft, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <View style={[styles.vvipPaymentIcon, { backgroundColor: '#22C55E' }]}>
                        <Ionicons name="card" size={20} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.vvipPaymentTitle}>{t('payment.payFullOption')}</Text>
                        <Text style={styles.vvipPaymentSubtitle}>{t('payment.noCashAtDelivery')}</Text>
                    </View>
                </View>
                <View style={styles.vvipPaymentRight}>
                    <Text style={[styles.vvipPaymentAmount, { color: '#22C55E' }]}>{totalAmount.toFixed(0)}</Text>
                    <Text style={styles.vvipPaymentCurrency}>{t('common.currency')}</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    paymentOptionsSection: {
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    vvipPaymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        ...Shadows.sm,
    },
    vvipPaymentSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#F0F9FF',
    },
    vvipPaymentLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    vvipPaymentIcon: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    vvipPaymentTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1F2937',
    },
    vvipPaymentSubtitle: {
        fontSize: FontSizes.sm,
        color: '#6B7280',
        marginTop: 2,
    },
    vvipPaymentRight: {
        alignItems: 'flex-end',
    },
    vvipPaymentAmount: {
        fontSize: 22,
        fontWeight: '800',
        color: '#3B82F6',
    },
    vvipPaymentCurrency: {
        fontSize: FontSizes.xs,
        color: '#9CA3AF',
        fontWeight: '600',
    },
});
