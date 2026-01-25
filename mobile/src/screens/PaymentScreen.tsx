// QScrap - Delivery Fee Payment Screen
// Collects upfront delivery fee via Stripe before order confirmation

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';

import { Colors, FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage as useTranslation } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { API_BASE_URL } from '../config/api';

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51St6AI39lYR0XT69rqWSeL7KgzTodXnECkPed1CAsZ7KsqhJOB4W3VD6QvhWyUhrVsTfADxh33p6DIJOTH30q4dK00dnPzwcBt';

interface RouteParams {
    bidId: string;
    garageName: string;
    partPrice: number;
    deliveryFee: number;
    partDescription: string;
    orderId?: string; // Optional: For resuming payment on existing order
}

export default function PaymentScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();
    const { confirmPayment } = useStripe();

    const params = route.params as RouteParams;
    const { bidId, garageName, partDescription, orderId: existingOrderId } = params;

    // CRITICAL: Parse prices as numbers to prevent string concatenation
    const partPrice = parseFloat(String(params.partPrice)) || 0;
    const deliveryFee = parseFloat(String(params.deliveryFee)) || 0;

    const [isLoading, setIsLoading] = useState(false);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [orderId, setOrderId] = useState<string | null>(existingOrderId || null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [cardComplete, setCardComplete] = useState(false);
    const [paymentType, setPaymentType] = useState<'delivery_only' | 'full'>('delivery_only');
    const [paymentAmount, setPaymentAmount] = useState(deliveryFee);

    // Loyalty state
    const [loyaltyData, setLoyaltyData] = useState<{
        points: number;
        tier: string;
        discountPercentage: number;
    } | null>(null);
    const [applyDiscount, setApplyDiscount] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Track if initialization is in progress to prevent race conditions
    const isInitializing = useRef(false);

    const totalAmount = partPrice + deliveryFee;

    // Step 1: Create order first (pending_payment status) OR resume existing order
    useEffect(() => {
        initializePayment();
        fetchLoyaltyData();
    }, []);

    // Fetch loyalty balance
    const fetchLoyaltyData = async () => {
        try {
            const data = await api.getLoyaltyBalance();
            const tierDiscounts: Record<string, number> = {
                bronze: 0,
                silver: 5,
                gold: 10,
                platinum: 15
            };
            setLoyaltyData({
                points: data.points,
                tier: data.tier,
                discountPercentage: tierDiscounts[data.tier.toLowerCase()] || 0
            });
        } catch (err) {
            console.log('[Payment] Failed to fetch loyalty:', err);
        }
    };

    // Single consolidated useEffect for payment type and discount changes
    // Uses a version counter to cancel outdated requests
    const requestVersion = useRef(0);

    useEffect(() => {
        // Skip if no order yet (initial order creation happens separately)
        if (!orderId) return;

        // Calculate discount for display immediately
        if (applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0) {
            // CRITICAL: Discount ALWAYS calculated on total order (part + delivery)
            const discount = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
            setDiscountAmount(discount);
        } else {
            setDiscountAmount(0);
        }

        // Increment version to cancel any in-flight requests
        requestVersion.current += 1;
        const thisVersion = requestVersion.current;

        // Clear existing intent
        setClientSecret('');
        setIsCreatingOrder(true);

        // Create new payment intent with debounce
        const timer = setTimeout(async () => {
            // Check if this request is still the latest
            if (thisVersion !== requestVersion.current) {
                console.log('[Payment] Request cancelled - newer request pending');
                return;
            }

            try {
                // Calculate discount inline
                let currentDiscount = 0;
                if (applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0) {
                    currentDiscount = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
                }

                let paymentResult;
                if (paymentType === 'full') {
                    paymentResult = await api.createFullPaymentIntent(orderId, currentDiscount);
                    setPaymentAmount(paymentResult.breakdown?.total || totalAmount);
                    setDiscountAmount(currentDiscount);
                } else {
                    paymentResult = await api.createDeliveryFeeIntent(orderId);
                    setPaymentAmount(deliveryFee);
                    // For delivery-only, discount is shown but not sent to backend yet
                    // It will apply to the COD portion at delivery
                }

                // Check again if this is still the latest request
                if (thisVersion !== requestVersion.current) {
                    console.log('[Payment] Intent received but request is stale, ignoring');
                    return;
                }

                if (paymentResult.intent?.clientSecret) {
                    setClientSecret(paymentResult.intent.clientSecret);
                } else {
                    const result = paymentResult as any;
                    const errorMsg = result.error?.message || result.message || 'Failed to create payment intent';
                    console.error('[Payment] Intent creation failed:', errorMsg);
                    toast.error(t('common.error'), errorMsg);
                }
            } catch (error: any) {
                if (thisVersion !== requestVersion.current) return;
                console.error('[Payment] Error creating intent:', error);
                toast.error(t('common.error'), error?.message || 'Payment setup failed');
            } finally {
                if (thisVersion === requestVersion.current) {
                    setIsCreatingOrder(false);
                }
            }
        }, 400); // Slightly longer debounce for stability

        return () => clearTimeout(timer);
    }, [orderId, paymentType, applyDiscount]);

    const initializePayment = async () => {
        // Prevent concurrent initialization calls
        if (isInitializing.current) {
            console.log('[Payment] ⚠️ Initialization already in progress, skipping...');
            return;
        }

        isInitializing.current = true;
        setIsCreatingOrder(true);
        try {
            let orderIdToUse = existingOrderId;

            // If no existing order, create new one via acceptBid
            if (!orderIdToUse) {
                const orderResult = await api.acceptBid(bidId, 'card');
                if (!orderResult.order_id) {
                    throw new Error('Failed to create order');
                }
                orderIdToUse = orderResult.order_id;
                setOrderId(orderIdToUse || null);
            } else {
                setOrderId(orderIdToUse || null);
            }

            // Calculate discount inline to avoid race condition with useEffect
            // This ensures we use the current applyDiscount and loyaltyData state
            let currentDiscount = 0;
            if (applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0) {
                // CRITICAL: Discount ALWAYS calculated on total order (part + delivery)
                currentDiscount = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
            }

            // Create payment intent based on payment type
            if (!orderIdToUse) {
                throw new Error('Order ID is required');
            }
            let paymentResult;
            if (paymentType === 'full') {
                // Pass loyalty discount to backend - platform absorbs the difference
                paymentResult = await api.createFullPaymentIntent(orderIdToUse, currentDiscount);
                setPaymentAmount(paymentResult.breakdown?.total || totalAmount);
                setDiscountAmount(currentDiscount);
            } else {
                paymentResult = await api.createDeliveryFeeIntent(orderIdToUse);
                setPaymentAmount(deliveryFee);
            }

            if (!paymentResult.intent?.clientSecret) {
                // Extract error message properly - result may have error property on failure
                const result = paymentResult as any;
                const errorMsg = typeof result.error === 'string'
                    ? result.error
                    : (result.error?.message || result.message || 'Failed to create payment intent');
                throw new Error(errorMsg);
            }

            setClientSecret(paymentResult.intent.clientSecret);
        } catch (error: any) {
            console.error('Error initializing payment:', error);
            const errorMessage = typeof error === 'string'
                ? error
                : (error?.message || 'Failed to initialize payment');
            Alert.alert(
                t('common.error'),
                errorMessage,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } finally {
            setIsCreatingOrder(false);
            isInitializing.current = false;
        }
    };

    const handlePayment = async () => {
        if (!clientSecret || !cardComplete) {
            toast.error(t('common.error'), 'Please enter valid card details');
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            console.log('[Payment] Starting confirmPayment with clientSecret:', clientSecret?.substring(0, 20) + '...');
            const { error, paymentIntent } = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
            });

            if (error) {
                console.error('Payment error:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                toast.error(t('common.error'), error.message || 'Payment failed');
                setIsLoading(false);
                return;
            }

            // Check for success status (case-insensitive)
            const status = paymentIntent?.status?.toLowerCase();
            console.log('[Payment] Stripe status:', status, 'orderId:', orderId, 'paymentIntent:', JSON.stringify(paymentIntent));

            if (status === 'succeeded') {
                // Confirm payment on backend to update order status
                console.log('[Payment] ✅ Stripe payment succeeded, confirming with backend...');
                console.log('[Payment] Payment Intent ID:', paymentIntent.id);
                try {
                    const confirmResult = await api.confirmDeliveryFeePayment(paymentIntent.id);
                    console.log('[Payment] ✅ Backend confirmed successfully:', confirmResult);
                } catch (confirmError: any) {
                    console.error('[Payment] ⚠️ Backend confirm FAILED (webhook will retry):', confirmError);
                    console.error('[Payment] Backend error type:', typeof confirmError);
                    console.error('[Payment] Backend error message:', confirmError?.message);
                    console.error('[Payment] Backend error details:', JSON.stringify(confirmError));
                    // Continue anyway - Stripe webhook will handle it as fallback
                }

                // Payment successful - order is now confirmed
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                toast.show({
                    type: 'success',
                    title: '✅ Payment Successful',
                    message: 'Your order has been confirmed!',
                });

                // Navigate immediately - don't wait for setIsLoading
                console.log('[Payment] SUCCESS - Navigating now. orderId:', orderId);

                // Use shorter delay and ensure navigation happens
                const navigateToOrder = () => {
                    console.log('[Payment] Executing navigation reset...');
                    if (orderId) {
                        navigation.reset({
                            index: 1,
                            routes: [
                                { name: 'Main' },
                                { name: 'DeliveryTracking', params: { orderId } },
                            ],
                        });
                    } else {
                        console.warn('[Payment] No orderId, navigating to Orders tab');
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Main', params: { screen: 'Orders' } }],
                        });
                    }
                };

                // Execute after a short delay
                setTimeout(navigateToOrder, 500);

            } else {
                // Unexpected status - show warning but try to proceed
                console.warn('[Payment] Unexpected status:', paymentIntent?.status);
                toast.show({
                    type: 'info',
                    title: 'Payment Processing',
                    message: `Status: ${paymentIntent?.status}. Please check your orders.`,
                });
                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main' }],
                    });
                }, 1000);
            }
        } catch (error: any) {
            console.error('[Payment] ❌ PAYMENT ERROR:', error);
            console.error('[Payment] Error type:', typeof error);
            console.error('[Payment] Error keys:', error ? Object.keys(error) : 'null');
            console.error('[Payment] Error message:', error?.message);
            console.error('[Payment] Error code:', error?.code);
            console.error('[Payment] Full error:', JSON.stringify(error, null, 2));

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Extract meaningful error message
            let errorMessage = 'Payment failed';
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (error?.error?.message) {
                errorMessage = error.error.message;
            } else if (error?.localizedDescription) {
                errorMessage = error.localizedDescription;
            }

            console.error('[Payment] Displaying error:', errorMessage);
            toast.error(t('common.error'), errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel? Your order will not be placed.',
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Cancel Order',
                    style: 'destructive',
                    onPress: () => navigation.goBack(),
                },
            ]
        );
    };

    if (isCreatingOrder) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Preparing your order...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                        <Text style={styles.backText}>← Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        💳 {paymentType === 'full' ? 'Pay Full Amount' : 'Pay Delivery Fee'}
                    </Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Order Summary Card */}
                    <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            📦 Order Summary
                        </Text>

                        <Text style={[styles.garageName, { color: Colors.primary }]}>
                            {garageName}
                        </Text>

                        <Text style={[styles.partDesc, { color: colors.textSecondary }]}>
                            {partDescription}
                        </Text>

                        <View style={styles.divider} />

                        {/* Payment Type Selector */}
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
                            Choose Payment Option
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.paymentTypeOption,
                                paymentType === 'delivery_only' && styles.paymentTypeSelected,
                                { borderColor: paymentType === 'delivery_only' ? Colors.primary : colors.border }
                            ]}
                            onPress={() => {
                                if (paymentType !== 'delivery_only') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setPaymentType('delivery_only');
                                    setClientSecret(null); // Reset to trigger new intent
                                }
                            }}
                        >
                            <View style={styles.paymentTypeContent}>
                                <Text style={[styles.paymentTypeTitle, { color: colors.text }]}>
                                    🚚 Pay Delivery Only
                                </Text>
                                <Text style={[styles.paymentTypeDesc, { color: colors.textSecondary }]}>
                                    Pay {deliveryFee.toFixed(2)} QAR now, pay {partPrice.toFixed(2)} QAR at delivery
                                </Text>
                            </View>
                            <Text style={[styles.paymentTypeAmount, { color: Colors.primary }]}>
                                {deliveryFee.toFixed(2)} QAR
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.paymentTypeOption,
                                paymentType === 'full' && styles.paymentTypeSelected,
                                { borderColor: paymentType === 'full' ? Colors.success : colors.border, marginTop: Spacing.sm }
                            ]}
                            onPress={() => {
                                if (paymentType !== 'full') {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setPaymentType('full');
                                    setClientSecret(null); // Reset to trigger new intent
                                }
                            }}
                        >
                            <View style={styles.paymentTypeContent}>
                                <Text style={[styles.paymentTypeTitle, { color: colors.text }]}>
                                    💳 Pay Full Amount
                                </Text>
                                <Text style={[styles.paymentTypeDesc, { color: colors.textSecondary }]}>
                                    No cash payment at delivery - faster checkout
                                </Text>
                            </View>
                            <Text style={[styles.paymentTypeAmount, { color: Colors.success }]}>
                                {totalAmount.toFixed(2)} QAR
                            </Text>
                        </TouchableOpacity>

                        <View style={[styles.divider, { marginVertical: Spacing.md }]} />

                        <View style={styles.priceRow}>
                            <Text style={[styles.totalLabel, { color: colors.text }]}>
                                Total
                            </Text>
                            <Text style={[styles.totalValue, { color: colors.text }]}>
                                {totalAmount.toFixed(2)} QAR
                            </Text>
                        </View>

                        {/* Loyalty Discount Section */}
                        {loyaltyData && loyaltyData.discountPercentage > 0 && (
                            <>
                                <View style={[styles.divider, { marginVertical: Spacing.md }]} />
                                <View style={[styles.loyaltyBanner, { backgroundColor: '#FEF3C7' }]}>
                                    <View style={styles.loyaltyHeader}>
                                        <Text style={styles.loyaltyEmoji}>
                                            {loyaltyData.tier === 'platinum' ? '💎' : loyaltyData.tier === 'gold' ? '🥇' : '🥈'}
                                        </Text>
                                        <View style={styles.loyaltyInfo}>
                                            <Text style={styles.loyaltyTier}>
                                                {loyaltyData.tier.charAt(0).toUpperCase() + loyaltyData.tier.slice(1)} Member
                                            </Text>
                                            <Text style={styles.loyaltyPoints}>
                                                {loyaltyData.points.toLocaleString()} pts • {loyaltyData.discountPercentage}% discount
                                            </Text>
                                        </View>
                                        <Switch
                                            value={applyDiscount}
                                            onValueChange={(value) => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setApplyDiscount(value);
                                            }}
                                            trackColor={{ false: '#D1D5DB', true: Colors.success }}
                                            thumbColor={applyDiscount ? '#fff' : '#f4f3f4'}
                                        />
                                    </View>
                                    {applyDiscount && discountAmount > 0 && (
                                        <View style={styles.discountApplied}>
                                            <Text style={styles.discountText}>
                                                🎉 -{discountAmount} QAR discount applied!
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </>
                        )}

                        {/* Show final amount if discount applied */}
                        {discountAmount > 0 && (
                            <View style={[styles.priceRow, { marginTop: Spacing.sm }]}>
                                <Text style={[styles.totalLabel, { color: Colors.success, fontWeight: '700' }]}>
                                    💰 You Pay
                                </Text>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: colors.textSecondary, textDecorationLine: 'line-through', fontSize: FontSizes.sm }}>
                                        {(paymentType === 'full' ? totalAmount : deliveryFee).toFixed(2)} QAR
                                    </Text>
                                    <Text style={[styles.totalValue, { color: Colors.success }]}>
                                        {((paymentType === 'full' ? totalAmount : deliveryFee) - discountAmount).toFixed(2)} QAR
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Payment Info */}
                    <View style={[styles.infoCard, { backgroundColor: paymentType === 'full' ? '#E6FFE6' : '#EBF5FF' }]}>
                        <Text style={styles.infoIcon}>{paymentType === 'full' ? '✅' : 'ℹ️'}</Text>
                        <Text style={[styles.infoText, paymentType === 'full' && { color: '#15803d' }]}>
                            {paymentType === 'full'
                                ? 'Full payment now. No cash at delivery.'
                                : `Pay ${partPrice.toFixed(2)} QAR cash at delivery.`
                            }
                        </Text>
                    </View>

                    {/* Card Input */}
                    <View style={[styles.cardSection, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            💳 Card Details
                        </Text>

                        <Text style={[styles.cardInputLabel, { color: colors.textSecondary }]}>
                            Enter your card information
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

                        <View style={styles.cardSecurityRow}>
                            <Text style={styles.securityIcon}>🔒</Text>
                            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                                Your card details are encrypted and secure
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 180 }} />
                </ScrollView>

                {/* Pay Button */}
                <View style={[styles.footer, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity
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
                                    🔒 Pay {((paymentType === 'full' ? totalAmount : deliveryFee) - discountAmount).toFixed(2)} QAR
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={styles.secureText}>
                        🔐 Secured by Stripe
                    </Text>
                </View>
            </SafeAreaView >
        </StripeProvider >
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
    summaryCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    garageName: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        marginBottom: Spacing.xs,
    },
    partDesc: {
        fontSize: FontSizes.md,
        marginBottom: Spacing.md,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginVertical: Spacing.sm,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    priceLabel: {
        fontSize: FontSizes.md,
        flex: 1,
    },
    priceValue: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    totalLabel: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
    },
    infoCard: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        alignItems: 'flex-start',
    },
    infoIcon: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    infoText: {
        flex: 1,
        fontSize: FontSizes.sm,
        color: '#1E40AF',
        lineHeight: 20,
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
    securityIcon: {
        fontSize: 14,
        marginRight: Spacing.xs,
    },
    securityText: {
        fontSize: FontSizes.xs,
    },
    testCardInfo: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
    },
    testCardTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: Spacing.xs,
    },
    testCardText: {
        fontSize: FontSizes.sm,
        color: '#92400E',
        lineHeight: 18,
    },
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
    // Payment Type Selector Styles
    sectionLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    paymentTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
    },
    paymentTypeSelected: {
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
    },
    paymentTypeContent: {
        flex: 1,
    },
    paymentTypeTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        marginBottom: 4,
    },
    paymentTypeDesc: {
        fontSize: FontSizes.sm,
    },
    paymentTypeAmount: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
    },
    // Loyalty Discount Styles
    loyaltyBanner: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    loyaltyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loyaltyEmoji: {
        fontSize: 28,
        marginRight: Spacing.sm,
    },
    loyaltyInfo: {
        flex: 1,
    },
    loyaltyTier: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#92400E',
    },
    loyaltyPoints: {
        fontSize: FontSizes.sm,
        color: '#B45309',
    },
    discountApplied: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#FCD34D',
    },
    discountText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#15803D',
        textAlign: 'center',
    },
});
