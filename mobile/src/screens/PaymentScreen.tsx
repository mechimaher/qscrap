import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
// QScrap - Delivery Fee Payment Screen
// Collects upfront delivery fee via Stripe before order confirmation

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { KEYS } from '../config/keys';
import { useLoyalty } from '../hooks/useLoyalty';

// Version for cache-busting diagnostics
const SCREEN_VERSION = 'v2.0.0-2026-01-27';

interface RouteParams {
    bidId: string;
    garageName: string;
    partPrice: number;
    deliveryFee: number;
    partDescription: string;
    orderId?: string; // Optional: For resuming payment on existing order
    _cacheKey?: string; // Cache-busting key for navigation
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

    // 🔍 CRITICAL DEBUG: Log screen mount to diagnose cache issues
    useEffect(() => {
        log('========================================');
        log(`🏦 PAYMENT SCREEN MOUNTED - ${SCREEN_VERSION}`);
        log(`📦 Params: bidId=${bidId}, garageName=${garageName}`);
        log(`💰 partPrice=${params.partPrice}, deliveryFee=${params.deliveryFee}`);
        log('========================================');
        return () => {
            log(`🏦 PAYMENT SCREEN UNMOUNTED - ${SCREEN_VERSION}`);
        };
    }, []);

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

    // Loyalty - centralized hook (shared cache, no duplicate API calls)
    const { loyalty: loyaltyRaw } = useLoyalty();
    const loyaltyData = loyaltyRaw ? {
        points: loyaltyRaw.points,
        tier: loyaltyRaw.tier,
        discountPercentage: loyaltyRaw.discountPercentage,
    } : null;
    const [applyDiscount, setApplyDiscount] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Track if initialization is in progress to prevent race conditions
    const isInitializing = useRef(false);

    const totalAmount = partPrice + deliveryFee;

    // Step 1: Create order first (pending_payment status) OR resume existing order
    useEffect(() => {
        initializePayment();
    }, []);

    // Single consolidated useEffect for payment type and discount changes
    // Uses a version counter to cancel outdated requests
    const requestVersion = useRef(0);

    // CRITICAL FIX: Calculate CORRECT discount based on payment type
    // - Full Payment: discount applies to TOTAL (part + delivery)
    // - Delivery Only: discount applies to PART PRICE only (COD amount)
    const calculateDiscount = useMemo(() => {
        if (!applyDiscount || !loyaltyData || loyaltyData.discountPercentage <= 0) {
            return { discountOnPart: 0, discountOnTotal: 0 };
        }
        const discountOnTotal = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
        const discountOnPart = Math.round(partPrice * (loyaltyData.discountPercentage / 100));
        return { discountOnPart, discountOnTotal };
    }, [applyDiscount, loyaltyData, totalAmount, partPrice]);

    // Get the amount customer will pay NOW (via card)
    const payNowAmount = useMemo(() => {
        const { discountOnTotal } = calculateDiscount;
        if (paymentType === 'full') {
            // Full payment: discount applies to total, minimum 0 (FREE)
            return Math.max(0, totalAmount - discountOnTotal);
        } else {
            // Delivery only: ALWAYS pay full delivery fee, never discounted
            return deliveryFee;
        }
    }, [calculateDiscount, paymentType, totalAmount, deliveryFee]);

    // Get the COD amount (if delivery-only)
    const codAmount = useMemo(() => {
        const { discountOnPart } = calculateDiscount;
        if (paymentType === 'delivery_only') {
            // COD = part price minus discount on part (minimum 0)
            return Math.max(0, partPrice - discountOnPart);
        }
        return 0;
    }, [calculateDiscount, paymentType, partPrice]);

    // Check if order is FREE (discount >= total amount for full payment)
    const freeOrder = useMemo(() => {
        const { discountOnTotal } = calculateDiscount;
        return paymentType === 'full' && discountOnTotal >= totalAmount;
    }, [calculateDiscount, paymentType, totalAmount]);

    useEffect(() => {
        // Skip if no order yet (initial order creation happens separately)
        if (!orderId) return;

        // Calculate and set discount for display
        const { discountOnPart, discountOnTotal } = calculateDiscount;
        setDiscountAmount(paymentType === 'full' ? discountOnTotal : discountOnPart);

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
                log('[Payment] Request cancelled - newer request pending');
                return;
            }

            try {
                const finalAmount = payNowAmount;

                // If FREE order, no need for payment intent
                if (finalAmount <= 0) {
                    log('[Payment] 🎉 FREE ORDER - No payment needed!');
                    setClientSecret('FREE_ORDER');
                    setPaymentAmount(0);
                    setIsCreatingOrder(false);
                    return;
                }

                let paymentResult;
                if (paymentType === 'full') {
                    paymentResult = await api.createFullPaymentIntent(orderId, discountOnTotal);
                    setPaymentAmount(paymentResult.breakdown?.total || finalAmount);
                } else {
                    // Pass discount for COD calculation (discount applies to part price)
                    paymentResult = await api.createDeliveryFeeIntent(orderId, discountOnPart);
                    setPaymentAmount(deliveryFee);
                }

                // Check again if this is still the latest request
                if (thisVersion !== requestVersion.current) {
                    log('[Payment] Intent received but request is stale, ignoring');
                    return;
                }

                if (paymentResult.intent?.clientSecret) {
                    setClientSecret(paymentResult.intent.clientSecret);
                } else {
                    const result = paymentResult as any;
                    const errorMsg = result.error?.message || result.message || 'Failed to create payment intent';
                    logError('[Payment] Intent creation failed:', errorMsg);
                    toast.error(t('common.error'), errorMsg);
                }
            } catch (error: any) {
                if (thisVersion !== requestVersion.current) return;
                handleApiError(error, toast);
            } finally {
                if (thisVersion === requestVersion.current) {
                    setIsCreatingOrder(false);
                }
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [orderId, paymentType, applyDiscount]);

    const initializePayment = async () => {
        // Prevent concurrent initialization calls
        if (isInitializing.current) {
            log('[Payment] ⚠️ Initialization already in progress, skipping...');
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
                // For delivery-only, discount applies to part price (COD amount)
                const partDiscount = applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0
                    ? Math.round(partPrice * (loyaltyData.discountPercentage / 100))
                    : 0;
                paymentResult = await api.createDeliveryFeeIntent(orderIdToUse, partDiscount);
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
            handleApiError(error, toast, { useAlert: true, onDismiss: () => navigation.goBack() });
        } finally {
            setIsCreatingOrder(false);
            isInitializing.current = false;
        }
    };

    const handlePayment = useCallback(async () => {
        if (!clientSecret || !cardComplete) {
            toast.error(t('common.error'), t('payment.enterCardDetails'));
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            log('[Payment] Starting confirmPayment with clientSecret:', clientSecret?.substring(0, 20) + '...');
            const { error, paymentIntent } = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
            });

            if (error) {
                logError('Payment error:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                toast.error(t('common.error'), error.message || t('payment.failed'));
                setIsLoading(false);
                return;
            }

            // Check for success status (case-insensitive)
            const status = paymentIntent?.status?.toLowerCase();
            log('[Payment] Stripe status:', status, 'orderId:', orderId, 'paymentIntent:', JSON.stringify(paymentIntent));

            if (status === 'succeeded') {
                // Confirm payment on backend to update order status
                log('[Payment] ✅ Stripe payment succeeded, confirming with backend...');
                log('[Payment] Payment Intent ID:', paymentIntent.id);
                try {
                    const confirmResult = await api.confirmDeliveryFeePayment(paymentIntent.id);
                    log('[Payment] ✅ Backend confirmed successfully:', confirmResult);
                } catch (confirmError: any) {
                    logError('[Payment] ⚠️ Backend confirm FAILED (webhook will retry):', confirmError);
                    logError('[Payment] Backend error type:', typeof confirmError);
                    logError('[Payment] Backend error message:', confirmError?.message);
                    logError('[Payment] Backend error details:', JSON.stringify(confirmError));
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
                log('[Payment] SUCCESS - Navigating now. orderId:', orderId);

                // Use shorter delay and ensure navigation happens
                const navigateToOrder = () => {
                    log('[Payment] Executing navigation reset...');
                    if (orderId) {
                        navigation.reset({
                            index: 1,
                            routes: [
                                { name: 'Main' },
                                { name: 'Tracking', params: { orderId, orderNumber: '' } },
                            ],
                        });
                    } else {
                        warn('[Payment] No orderId, navigating to Orders tab');
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
                warn('[Payment] Unexpected status:', paymentIntent?.status);
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
            handleApiError(error, toast);
        } finally {
            setIsLoading(false);
        }
    }, [clientSecret, cardComplete, orderId, toast, t, navigation, confirmPayment]);

    // Handle FREE order (when loyalty discount covers entire amount)
    const handleFreeOrder = useCallback(async () => {
        if (!orderId) {
            toast.error(t('common.error'), t('payment.orderNotFound'));
            return;
        }

        setIsLoading(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            log('[Payment] 🎉 Processing FREE order via loyalty discount');

            // Confirm order with zero payment (loyalty covers it)
            const { discountOnTotal } = calculateDiscount;
            await api.confirmFreeOrder(orderId, discountOnTotal);

            // CELEBRATION!
            toast.show({
                type: 'success',
                title: '🎊 FREE Order Confirmed!',
                message: 'Your loyalty rewards covered this order!',
            });

            // Navigate to tracking
            setTimeout(() => {
                navigation.reset({
                    index: 1,
                    routes: [
                        { name: 'Main' },
                        { name: 'Tracking', params: { orderId, orderNumber: '' } },
                    ],
                });
            }, 1000);
        } catch (error: any) {
            handleApiError(error, toast);
        } finally {
            setIsLoading(false);
        }
    }, [orderId, calculateDiscount, toast, t, navigation]);

    const handleCancel = useCallback(() => {
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
    }, [navigation]);

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
        <StripeProvider publishableKey={KEYS.STRIPE_PUBLISHABLE_KEY}>
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
                    {/* ═══════════════════════════════════════════════════════════
                        VVIP PREMIUM ORDER CARD - Glassmorphism Style
                    ═══════════════════════════════════════════════════════════ */}
                    <LinearGradient
                        colors={['#1a1a2e', '#2d2d44']}
                        style={styles.vvipOrderCard}
                    >
                        {/* Garage Name - Hero */}
                        <Text style={styles.vvipGarageName}>{garageName}</Text>

                        {/* Part Info - Clean & Minimal */}
                        <View style={styles.vvipPartRow}>
                            <Text style={styles.vvipPartLabel}>🔧 Part</Text>
                            <Text style={styles.vvipPartValue} numberOfLines={1}>
                                {partDescription}
                            </Text>
                        </View>

                        {/* Price Breakdown - Elegant */}
                        <View style={styles.vvipDivider} />

                        <View style={styles.vvipPriceRow}>
                            <Text style={styles.vvipPriceLabel}>Part Price</Text>
                            <Text style={styles.vvipPriceValue}>{partPrice.toFixed(0)} QAR</Text>
                        </View>
                        <View style={styles.vvipPriceRow}>
                            <Text style={styles.vvipPriceLabel}>Delivery</Text>
                            <Text style={styles.vvipPriceValue}>{deliveryFee.toFixed(0)} QAR</Text>
                        </View>
                        <View style={[styles.vvipPriceRow, { marginTop: Spacing.sm }]}>
                            <Text style={styles.vvipTotalLabel}>Total</Text>
                            <Text style={styles.vvipTotalValue}>{totalAmount.toFixed(0)} QAR</Text>
                        </View>
                    </LinearGradient>

                    {/* ═══════════════════════════════════════════════════════════
                        PAYMENT OPTIONS - Premium Cards
                    ═══════════════════════════════════════════════════════════ */}
                    <View style={styles.paymentOptionsSection}>
                        {/* Pay Delivery Only Option */}
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
                            <View style={styles.vvipPaymentLeft}>
                                <View style={[styles.vvipPaymentIcon, { backgroundColor: '#3B82F6' }]}>
                                    <Text style={styles.vvipPaymentEmoji}>🚚</Text>
                                </View>
                                <View>
                                    <Text style={styles.vvipPaymentTitle}>Pay Delivery Only</Text>
                                    <Text style={styles.vvipPaymentSubtitle}>Cash on delivery for part</Text>
                                </View>
                            </View>
                            <View style={styles.vvipPaymentRight}>
                                <Text style={styles.vvipPaymentAmount}>{deliveryFee.toFixed(0)}</Text>
                                <Text style={styles.vvipPaymentCurrency}>QAR</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Pay Full Amount Option */}
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
                            <View style={styles.vvipPaymentLeft}>
                                <View style={[styles.vvipPaymentIcon, { backgroundColor: '#22C55E' }]}>
                                    <Text style={styles.vvipPaymentEmoji}>💳</Text>
                                </View>
                                <View>
                                    <Text style={styles.vvipPaymentTitle}>Pay Full Amount</Text>
                                    <Text style={styles.vvipPaymentSubtitle}>No cash at delivery</Text>
                                </View>
                            </View>
                            <View style={styles.vvipPaymentRight}>
                                <Text style={[styles.vvipPaymentAmount, { color: '#22C55E' }]}>{totalAmount.toFixed(0)}</Text>
                                <Text style={styles.vvipPaymentCurrency}>QAR</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* ═══════════════════════════════════════════════════════════
                        LOYALTY DISCOUNT - Premium Banner (if available)
                    ═══════════════════════════════════════════════════════════ */}
                    {loyaltyData && loyaltyData.discountPercentage > 0 && (
                        <View style={[
                            styles.vvipLoyaltyCard,
                            freeOrder && { borderColor: '#22C55E', borderWidth: 2 }
                        ]}>
                            <View style={styles.vvipLoyaltyRow}>
                                <View style={styles.vvipLoyaltyLeft}>
                                    <Text style={styles.vvipLoyaltyBadge}>
                                        {loyaltyData.tier === 'platinum' ? '💎' : loyaltyData.tier === 'gold' ? '🥇' : '🥈'}
                                    </Text>
                                    <View>
                                        <Text style={styles.vvipLoyaltyTier}>
                                            {loyaltyData.tier.toUpperCase()} • {loyaltyData.discountPercentage}% OFF
                                        </Text>
                                        <Text style={styles.vvipLoyaltySavings}>
                                            {applyDiscount ? `Save ${paymentType === 'full' ? calculateDiscount.discountOnTotal : calculateDiscount.discountOnPart} QAR` : 'Tap to apply'}
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={applyDiscount}
                                    onValueChange={(value) => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setApplyDiscount(value);
                                    }}
                                    trackColor={{ false: '#374151', true: '#22C55E' }}
                                    thumbColor={applyDiscount ? '#fff' : '#9CA3AF'}
                                />
                            </View>

                            {/* FREE ORDER Celebration */}
                            {freeOrder && (
                                <LinearGradient
                                    colors={['#22C55E', '#16A34A']}
                                    style={styles.vvipFreeOrderBanner}
                                >
                                    <Text style={styles.vvipFreeOrderText}>🎊 FREE ORDER! 🎊</Text>
                                </LinearGradient>
                            )}

                            {/* Discount Summary */}
                            {applyDiscount && (paymentType === 'full' ? calculateDiscount.discountOnTotal : calculateDiscount.discountOnPart) > 0 && !freeOrder && (
                                <View style={styles.vvipDiscountSummary}>
                                    <Text style={styles.vvipDiscountLabel}>
                                        {paymentType === 'full' ? 'You Pay' : 'COD Amount'}
                                    </Text>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.vvipDiscountOld}>
                                            {(paymentType === 'full' ? totalAmount : partPrice).toFixed(0)} QAR
                                        </Text>
                                        <Text style={styles.vvipDiscountNew}>
                                            {(paymentType === 'full' ? payNowAmount : codAmount).toFixed(0)} QAR
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Quick Info Banner */}
                    {!freeOrder && (
                        <View style={styles.vvipInfoBanner}>
                            <Text style={styles.vvipInfoText}>
                                {paymentType === 'full'
                                    ? '✓ No cash needed at delivery'
                                    : `💵 ${applyDiscount && discountAmount > 0 ? codAmount.toFixed(0) : partPrice.toFixed(0)} QAR cash at delivery`
                                }
                            </Text>
                        </View>
                    )}

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

                {/* Pay Button - Enterprise Logic */}
                <View style={[styles.footer, { backgroundColor: colors.surface }]}>
                    {freeOrder ? (
                        /* FREE ORDER - Special Celebration Button */
                        <TouchableOpacity
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
                                        🎊 Claim FREE Order! 🎊
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        /* Normal Payment Button */
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
                                        🔒 Pay {payNowAmount.toFixed(2)} QAR
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.secureText}>
                        {freeOrder ? '✨ Your loyalty rewards at work!' : '🔐 Secured by Stripe'}
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

    // ═══════════════════════════════════════════════════════════
    // VVIP PREMIUM STYLES
    // ═══════════════════════════════════════════════════════════
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

    // Payment Options
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
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    vvipPaymentEmoji: {
        fontSize: 20,
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

    // Loyalty Card
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
    vvipLoyaltyBadge: {
        fontSize: 28,
    },
    vvipLoyaltyTier: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFD700',
    },
    vvipLoyaltySavings: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    vvipFreeOrderBanner: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    vvipFreeOrderText: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: '#fff',
    },
    vvipDiscountSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    vvipDiscountLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
    },
    vvipDiscountOld: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.5)',
        textDecorationLine: 'line-through',
    },
    vvipDiscountNew: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: '#22C55E',
    },

    // Info Banner
    vvipInfoBanner: {
        backgroundColor: '#F3F4F6',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        alignItems: 'center',
    },
    vvipInfoText: {
        fontSize: FontSizes.sm,
        color: '#4B5563',
        fontWeight: '600',
    },
});
