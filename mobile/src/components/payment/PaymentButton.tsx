import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius } from '../../constants/theme';

interface PaymentButtonProps {
    freeOrder: boolean;
    handleFreeOrder: () => void;
    isLoading: boolean;
    cardComplete: boolean;
    handlePayment: () => void;
    payNowAmount: number;
    t: (key: string) => string;
    colors: any;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
    freeOrder,
    handleFreeOrder,
    isLoading,
    cardComplete,
    handlePayment,
    payNowAmount,
    t,
    colors,
}) => {
    return (
        <View style={[styles.footer, { backgroundColor: colors.surface }]}>
            {freeOrder ? (
                /* FREE ORDER - Special Celebration Button */
                <TouchableOpacity
                    testID="free-order-button"
                    style={styles.payButton}
                    onPress={handleFreeOrder}
                    disabled={isLoading}
                >
                    <LinearGradient
                        colors={['#FFD700', '#FFA500']}
                        style={styles.payGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={[styles.payButtonText, { color: '#1a1a2e' }]}>
                                {t('payment.freeOrderClaim')}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            ) : (
                /* Normal Payment Button */
                <TouchableOpacity
                    testID="payment-button"
                    style={[styles.payButton, (!cardComplete || isLoading) && styles.payButtonDisabled]}
                    onPress={handlePayment}
                    disabled={!cardComplete || isLoading}
                >
                    <LinearGradient
                        colors={cardComplete ? ['#22c55e', '#16a34a'] : ['#9ca3af', '#6b7280']}
                        style={styles.payGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payButtonText}>
                                {t('payment.pay').replace('{{amount}}', payNowAmount.toFixed(2))}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            )}

            <Text style={styles.secureText}>
                {freeOrder ? t('payment.loyaltyAtWork') : t('payment.securedByStripe')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
    },
    payButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    payButtonDisabled: {
        opacity: 0.7,
    },
    payGradient: {
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '800',
    },
    secureText: {
        textAlign: 'center',
        marginTop: Spacing.sm,
        fontSize: FontSizes.sm,
        color: '#6B7280',
    },
});
