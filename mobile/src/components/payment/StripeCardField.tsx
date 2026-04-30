import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardField } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, Shadows, Colors } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

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
    // Determine if dark mode based on the theme background
    const isDark = colors.background === '#0A0A0A' || colors.background === '#000' || colors.background === '#121212'
        || (colors.background && colors.background.startsWith('#') && parseInt(colors.background.slice(1, 3), 16) < 50);

    return (
        <View style={[styles.cardSection, { backgroundColor: colors.surface }]}>
            {/* Section Header with Icon */}
            <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: Colors.primary + '15' }]}>
                    <Ionicons name="card-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('payment.cardDetails')}
                    </Text>
                    <Text style={[styles.cardInputLabel, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('payment.enterCardInfo')}
                    </Text>
                </View>
            </View>

            {/* Card Input Field */}
            <View style={[styles.cardFieldWrapper, {
                backgroundColor: isDark ? '#1A1A2E' : '#F8FAFC',
                borderColor: isDark ? '#2D2D44' : '#E2E8F0',
            }]}>
                <CardField
                    testID="card-field"
                    postalCodeEnabled={false}
                    placeholders={{
                        number: '4242  4242  4242  4242',
                        expiration: 'MM/YY',
                        cvc: 'CVC',
                    }}
                    cardStyle={{
                        backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
                        textColor: isDark ? '#F1F5F9' : '#0F172A',
                        placeholderColor: isDark ? '#475569' : '#94A3B8',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
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

            {/* Card Brands Accepted */}
            <View style={[styles.cardBrandsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {['Visa', 'Mastercard', 'Amex'].map((brand) => (
                    <View key={brand} style={[styles.brandBadge, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                        <Text style={[styles.brandText, { color: isDark ? '#94A3B8' : '#64748B' }]}>{brand}</Text>
                    </View>
                ))}
            </View>

            {/* Security Badge */}
            <LinearGradient
                colors={isDark ? ['rgba(34,197,94,0.12)', 'rgba(34,197,94,0.05)'] : ['rgba(34,197,94,0.08)', 'rgba(34,197,94,0.03)']}
                style={styles.securityBadge}
            >
                <View style={[styles.cardSecurityRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons testID="lock-closed" name="shield-checkmark" size={16} color="#22C55E" style={isRTL ? { marginLeft: Spacing.xs } : { marginRight: Spacing.xs }} />
                    <Text style={[styles.securityText, { color: isDark ? '#86EFAC' : '#15803D' }]}>
                        {t('payment.cardSecure')}
                    </Text>
                    <Ionicons name="lock-closed" size={12} color={isDark ? '#86EFAC' : '#15803D'} style={isRTL ? { marginRight: Spacing.xs } : { marginLeft: Spacing.xs }} />
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    cardSection: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    cardInputLabel: {
        fontSize: FontSizes.xs,
        marginTop: 2,
    },
    cardFieldWrapper: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.sm,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
    cardField: {
        width: '100%',
        height: 56,
    },
    cardBrandsRow: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    brandBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    brandText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    securityBadge: {
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
    },
    cardSecurityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
});
