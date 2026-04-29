// QScrap - Delivery Fee Payment Screen
// Collects upfront delivery fee via Stripe before order confirmation

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    Switch,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StripeProvider } from '@stripe/stripe-react-native';

import { Colors, FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage as useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { API_BASE_URL } from '../config/api';
import { KEYS } from '../config/keys';
import { PaymentSummary } from '../components/payment/PaymentSummary';
import { PaymentTypeSelector } from '../components/payment/PaymentTypeSelector';
import { LoyaltyDiscountCard } from '../components/payment/LoyaltyDiscountCard';
import { StripeCardField } from '../components/payment/StripeCardField';
import { PaymentButton } from '../components/payment/PaymentButton';


import { useLoyaltyCalculation } from '../hooks/useLoyaltyCalculation';
import { usePaymentInitialization } from '../hooks/usePaymentInitialization';
import { useStripeCheckout } from '../hooks/useStripeCheckout';


// Version for cache-busting diagnostics
const SCREEN_VERSION = 'v2.1.0-2026-04-24';

interface RouteParams {
    bidId: string;
    garageName: string;
    partPrice: number;
    deliveryFee: number;
    partDescription: string;
    orderId?: string; // Optional: For resuming payment on existing order
    _cacheKey?: string; // Cache-busting key for navigation
}

/**
 * PaymentScreen — Outer wrapper that provides StripeProvider context.
 * 
 * CRITICAL: useStripe() MUST be called inside <StripeProvider>.
 * This wrapper ensures the Stripe SDK is initialized before any
 * child component calls useStripe().
 */
export default function PaymentScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const stripeKey = KEYS.STRIPE_PUBLISHABLE_KEY;

    // Guard: If Stripe key is missing, show error instead of crashing
    if (!stripeKey) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Ionicons name="card-outline" size={56} color={Colors.error || '#e74c3c'} />
                    <Text style={[styles.loadingText, { color: colors.text, marginTop: 16, fontSize: 18, fontWeight: '600' }]}>
                        {t('payment.configError') || 'Payment Configuration Error'}
                    </Text>
                    <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: 14, marginTop: 8, paddingHorizontal: 32, textAlign: 'center' }]}>
                        {t('payment.stripeNotConfigured') || 'Stripe payment is not configured. Please contact support.'}
                    </Text>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.retryCancel}
                    >
                        <Text style={[styles.retryCancelText, { color: colors.textSecondary }]}>
                            {t('common.goBack') || 'Go Back'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <StripeProvider publishableKey={stripeKey}>
            <PaymentScreenContent />
        </StripeProvider>
    );
}

/**
 * PaymentScreenContent — Inner component that safely uses useStripe() 
 * because it renders inside <StripeProvider>.
 */
function PaymentScreenContent() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const params = route.params as RouteParams;
    const { bidId, garageName, partDescription, orderId: existingOrderId } = params;

    const partPrice = parseFloat(String(params.partPrice)) || 0;
    const deliveryFee = parseFloat(String(params.deliveryFee)) || 0;
    const totalAmount = partPrice + deliveryFee;

    const [cardComplete, setCardComplete] = useState(false);
    const [paymentType, setPaymentType] = useState<'delivery_only' | 'full'>('delivery_only');
    const [applyDiscount, setApplyDiscount] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(deliveryFee);
    const [discountAmount, setDiscountAmount] = useState(0);
    const hasInitialized = useRef(false);
    const lastPaymentIntentKey = useRef<string | null>(null);

    // 1. Calculate Loyalty constraints
    const {
        loyaltyData,
        calculateDiscount,
        payNowAmount,
        codAmount,
        freeOrder,
    } = useLoyaltyCalculation({ partPrice, deliveryFee, paymentType, applyDiscount });

    const {
        orderId,
        intentError,
        isCreatingOrder: isInitLoading,
        initializePayment,
        retryPaymentIntent,
    } = usePaymentInitialization({
        existingOrderId,
        bidId,
        paymentType,
        applyDiscount,
        loyaltyData,
        totalAmount,
        partPrice,
        deliveryFee,
        setClientSecret,
        setPaymentAmount,
        setDiscountAmount,
        t,
        toast,
        navigation
    });

    // 3. Initialize Payment Intent exactly once
    useEffect(() => {
        hasInitialized.current = true;
        initializePayment();
    }, []);

    // Refresh the visible intent when the customer changes payment mode or loyalty use.
    useEffect(() => {
        if (!hasInitialized.current || !orderId) {
            return;
        }

        const nextKey = `${orderId}:${paymentType}:${applyDiscount}`;
        if (lastPaymentIntentKey.current === null) {
            lastPaymentIntentKey.current = nextKey;
            return;
        }
        if (lastPaymentIntentKey.current === nextKey) {
            return;
        }

        lastPaymentIntentKey.current = nextKey;
        setClientSecret(null);
        retryPaymentIntent();
    }, [orderId, paymentType, applyDiscount, retryPaymentIntent]);

    // 4. Handle Stripe Checkouts — NOW SAFE because we are inside <StripeProvider>
    const { isLoading, handlePayment, handleFreeOrder } = useStripeCheckout({
        clientSecret,
        cardComplete,
        orderId,
        navigation,
        t,
        toast,
    });

    // Aggregate loading state
    const isComponentLoading = isInitLoading || isLoading;


    const handleCancel = useCallback(() => {
        Alert.alert(
            t('cancel.title'),
            t('payment.cancelConfirm'),
            [
                { text: t('cancel.keepOrder'), style: 'cancel' },
                {
                    text: t('cancel.yesCancel'),
                    style: 'destructive',
                    onPress: () => navigation.goBack(),
                },
            ]
        );
    }, [navigation, t]);

    if (isComponentLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        {t('payment.preparing')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (intentError && !clientSecret) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Ionicons name="cloud-offline-outline" size={56} color={Colors.error || '#e74c3c'} />
                    <Text style={[styles.loadingText, { color: colors.text, marginTop: 16, fontSize: 18, fontWeight: '600' }]}>
                        {t('payment.intentFailed')}
                    </Text>
                    <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: 14, marginTop: 8, paddingHorizontal: 32, textAlign: 'center' }]}>
                        {intentError}
                    </Text>
                    <TouchableOpacity
                        onPress={retryPaymentIntent}
                        style={[styles.retryButton, { backgroundColor: Colors.primary }]}
                    >
                        <Ionicons name="refresh-outline" size={20} color="#fff" />
                        <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.retryCancel}
                    >
                        <Text style={[styles.retryCancelText, { color: colors.textSecondary }]}>
                            {t('common.cancel')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {paymentType === 'full' ? t('payment.payFullAmount') : t('payment.payDeliveryFee')}
                </Text>
                <View style={{ width: 60 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    <PaymentSummary
                        garageName={garageName}
                        partDescription={partDescription}
                        partPrice={partPrice}
                        deliveryFee={deliveryFee}
                        totalAmount={totalAmount}
                        isRTL={isRTL}
                        t={t}
                    />

                    <PaymentTypeSelector
                        paymentType={paymentType}
                        setPaymentType={setPaymentType}
                        deliveryFee={deliveryFee}
                        totalAmount={totalAmount}
                        isRTL={isRTL}
                        t={t}
                        setClientSecret={setClientSecret}
                    />

                    <LoyaltyDiscountCard
                        loyaltyData={loyaltyData}
                        freeOrder={freeOrder}
                        applyDiscount={applyDiscount}
                        setApplyDiscount={setApplyDiscount}
                        paymentType={paymentType}
                        calculateDiscount={calculateDiscount}
                        partPrice={partPrice}
                        codAmount={codAmount}
                        totalAmount={totalAmount}
                        payNowAmount={payNowAmount}
                        discountAmount={discountAmount}
                        isRTL={isRTL}
                        t={t}
                    />

                    <StripeCardField
                        colors={colors}
                        t={t}
                        setCardComplete={setCardComplete}
                        isRTL={isRTL}
                    />

                    <View style={{ height: 180 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <PaymentButton
                freeOrder={freeOrder}
                handleFreeOrder={handleFreeOrder}
                isLoading={isLoading}
                cardComplete={cardComplete}
                handlePayment={handlePayment}
                payNowAmount={payNowAmount}
                t={t}
                colors={colors}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.lg,
        fontSize: FontSizes.lg,
        fontWeight: '600',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    retryCancel: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    retryCancelText: {
        fontSize: FontSizes.md,
        fontWeight: '500',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    backButton: {
        padding: Spacing.sm,
    },
    backText: {
        color: Colors.primary,
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
});
