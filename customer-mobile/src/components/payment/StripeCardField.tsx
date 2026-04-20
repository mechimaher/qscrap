import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardField } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { rtlFlexDirection } from '../../utils/rtl';

interface StripeCardFieldProps {
    colors: any;
    t: (key: string) => string;
    setCardComplete: (complete: boolean) => void;
    isRTL: boolean;
}

export const StripeCardField: React.FC<StripeCardFieldProps> = ({
    colors,
    t,
    setCardComplete,
    isRTL,
}) => {
    return (
        <View style={[styles.cardSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('payment.cardDetails')}
            </Text>

            <Text style={[styles.cardInputLabel, { color: colors.textSecondary }]}>
                {t('payment.enterCardInfo')}
            </Text>

            <View style={styles.cardFieldWrapper}>
                <CardField
                    postalCodeEnabled={false}
                    placeholders={{
                        number: '1234 1234 1234 1234',
                        expiration: 'MM/YY',
                        cvc: 'CVC',
                    }}
                    cardStyle={{
                        backgroundColor: '#FFFFFF',
                        textColor: '#1F2937',
                        placeholderColor: '#9CA3AF',
                        borderColor: '#E5E7EB',
                        borderWidth: 1,
                        borderRadius: 12,
                        fontSize: 16,
                        fontFamily: 'System',
                    }}
                    style={styles.cardField}
                    onCardChange={(cardDetails) => {
                        setCardComplete(cardDetails.complete);
                    }}
                />
            </View>

            <View style={[styles.cardSecurityRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Ionicons name="lock-closed" size={16} color="#22c55e" />
                <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                    {t('payment.cardSecure')}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    cardSection: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    cardInputLabel: {
        fontSize: FontSizes.sm,
        marginBottom: Spacing.sm,
    },
    cardFieldWrapper: {
        backgroundColor: '#F9FAFB',
        borderRadius: BorderRadius.lg,
        padding: Spacing.sm,
        marginBottom: Spacing.md,
    },
    cardField: {
        width: '100%',
        height: 56,
    },
    cardSecurityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    securityText: {
        fontSize: FontSizes.xs,
        marginLeft: Spacing.xs,
        marginRight: Spacing.xs,
    },
});
