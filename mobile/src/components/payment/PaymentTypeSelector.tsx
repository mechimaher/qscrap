import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, FontSizes, BorderRadius, Shadows, Colors } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

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
    const { colors } = useTheme();

    const options = [
        {
            type: 'delivery_only' as const,
            icon: 'car-sport' as const,
            iconBg: '#3B82F6',
            selectedBorder: '#3B82F6',
            selectedBg: '#3B82F6' + '12',
            title: t('payment.payDeliveryOnly'),
            subtitle: t('payment.cashOnDeliveryForPart'),
            amount: deliveryFee,
            amountColor: '#3B82F6',
            testIdOption: 'delivery-option',
            testIdAmount: 'delivery-amount',
        },
        {
            type: 'full' as const,
            icon: 'card' as const,
            iconBg: '#22C55E',
            selectedBorder: '#22C55E',
            selectedBg: '#22C55E' + '12',
            title: t('payment.payFullOption'),
            subtitle: t('payment.noCashAtDelivery'),
            amount: totalAmount,
            amountColor: '#22C55E',
            testIdOption: 'full-option',
            testIdAmount: 'full-amount',
        },
    ];

    return (
        <View style={styles.paymentOptionsSection}>
            {options.map((option) => {
                const isSelected = paymentType === option.type;
                return (
                    <TouchableOpacity
                        key={option.type}
                        testID={option.testIdOption}
                        style={[
                            styles.vvipPaymentOption,
                            {
                                backgroundColor: colors.surface,
                                borderColor: isSelected ? option.selectedBorder : colors.border,
                            },
                            isSelected && { backgroundColor: option.selectedBg },
                            { flexDirection: isRTL ? 'row-reverse' : 'row' },
                        ]}
                        onPress={() => {
                            if (!isSelected) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPaymentType(option.type);
                                setClientSecret(null);
                            }
                        }}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.vvipPaymentLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <View style={[styles.vvipPaymentIcon, { backgroundColor: option.iconBg }]}>
                                <Ionicons testID={option.icon} name={option.icon} size={20} color="#fff" />
                            </View>
                            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                                <Text style={[styles.vvipPaymentTitle, { color: colors.text }]}>{option.title}</Text>
                                <Text style={[styles.vvipPaymentSubtitle, { color: colors.textSecondary }]}>{option.subtitle}</Text>
                            </View>
                        </View>
                        <View style={[styles.vvipPaymentRight, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
                            <Text testID={option.testIdAmount} style={[styles.vvipPaymentAmount, { color: isSelected ? option.amountColor : colors.text }]}>
                                {option.amount.toFixed(0)}
                            </Text>
                            <Text style={[styles.vvipPaymentCurrency, { color: colors.textSecondary }]}>{t('common.currency')}</Text>
                        </View>

                        {/* Selected indicator */}
                        {isSelected && (
                            <View style={[styles.selectedBadge, { backgroundColor: option.selectedBorder }]}>
                                <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
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
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 2,
        position: 'relative',
        ...Shadows.sm,
    },
    vvipPaymentLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
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
    },
    vvipPaymentSubtitle: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    vvipPaymentRight: {
        alignItems: 'flex-end',
    },
    vvipPaymentAmount: {
        fontSize: 22,
        fontWeight: '800',
    },
    vvipPaymentCurrency: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    selectedBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
});
