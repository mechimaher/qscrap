import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { PlatformPay, useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
import { KEYS } from '../config/keys';

interface StripeCheckoutParams {
    clientSecret: string | null;
    cardComplete: boolean;
    orderId: string | null;
    payNowAmount: number;
    garageName: string;
    partDescription: string;
    navigation: any;
    t: (key: string) => string;
    toast: any;
}

export function useStripeCheckout({
    clientSecret,
    cardComplete,
    orderId,
    payNowAmount,
    garageName,
    partDescription,
    navigation,
    t,
    toast
}: StripeCheckoutParams) {
    const { confirmPayment, confirmPlatformPayPayment, isPlatformPaySupported } = useStripe();
    const [isLoading, setIsLoading] = useState(false);
    const [platformPayReady, setPlatformPayReady] = useState(false);
    const [platformPayLabel, setPlatformPayLabel] = useState<'apple' | 'google' | null>(null);

    useEffect(() => {
        let isMounted = true;
        const checkPlatformPay = async () => {
            try {
                if (Platform.OS === 'ios') {
                    if (!KEYS.APPLE_MERCHANT_ID) {
                        setPlatformPayReady(false);
                        return;
                    }
                    const supported = await isPlatformPaySupported();
                    if (isMounted) {
                        setPlatformPayReady(!!supported);
                        setPlatformPayLabel('apple');
                    }
                } else {
                    const supported = await isPlatformPaySupported({ googlePay: { testEnv: __DEV__ } });
                    if (isMounted) {
                        setPlatformPayReady(!!supported);
                        setPlatformPayLabel('google');
                    }
                }
            } catch (error) {
                warn('Platform pay support check failed', error);
                if (isMounted) setPlatformPayReady(false);
            }
        };
        checkPlatformPay();
        return () => {
            isMounted = false;
        };
    }, [isPlatformPaySupported]);

    const navigateToOrder = useCallback(() => {
        if (orderId) {
            navigation.reset({
                index: 1,
                routes: [{ name: 'Main' }, { name: 'Tracking', params: { orderId, orderNumber: '' } }]
            });
        } else {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main', params: { screen: 'Orders' } }]
            });
        }
    }, [navigation, orderId]);

    const handlePaymentSuccess = useCallback(
        async (paymentIntentId?: string) => {
            try {
                if (paymentIntentId) {
                    await api.confirmDeliveryFeePayment(paymentIntentId);
                }
            } catch (confirmError: any) {
                // Continue anyway - Stripe webhook will handle as fallback
                warn('Post-payment confirm failed', confirmError);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.show({
                type: 'success',
                title: t('payment.paymentSuccessTitle'),
                message: t('payment.paymentSuccessMsg')
            });
            setTimeout(navigateToOrder, 500);
        },
        [navigateToOrder, t, toast]
    );

    const handlePayment = useCallback(async () => {
        if (!clientSecret || !cardComplete) {
            toast.error(t('common.error'), t('payment.enterCardDetails'));
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const { error, paymentIntent } = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card'
            });

            if (error) {
                logError('Payment error:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                toast.error(t('common.error'), error.message || t('payment.failed'));
                setIsLoading(false);
                return;
            }

            const status = paymentIntent?.status?.toLowerCase();

            if (status === 'succeeded') {
                await handlePaymentSuccess(paymentIntent.id);
            } else {
                warn('[Payment] Unexpected status:', paymentIntent?.status);
                toast.show({
                    type: 'info',
                    title: t('payment.paymentProcessing'),
                    message:
                        t('payment.paymentProcessingMsg') + (paymentIntent?.status ? ` (${paymentIntent.status})` : '')
                });
                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main' }]
                    });
                }, 1000);
            }
        } catch (error: any) {
            handleApiError(error, toast);
        } finally {
            setIsLoading(false);
        }
    }, [clientSecret, cardComplete, toast, t, confirmPayment, handlePaymentSuccess]);

    const handlePlatformPay = useCallback(async () => {
        if (!clientSecret) {
            toast.error(t('common.error'), t('payment.intentFailed'));
            return;
        }
        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const { error, paymentIntent } = await confirmPlatformPayPayment(clientSecret, {
                applePay: {
                    merchantCountryCode: 'QA',
                    currencyCode: 'QAR',
                    cartItems: [
                        {
                            label: garageName || 'QScrap',
                            amount: payNowAmount.toFixed(2),
                            paymentType: PlatformPay.PaymentType.Immediate
                        },
                        {
                            label: partDescription || t('common.part'),
                            amount: '0.00',
                            paymentType: PlatformPay.PaymentType.Immediate
                        }
                    ]
                },
                googlePay: {
                    testEnv: __DEV__,
                    merchantCountryCode: 'QA',
                    currencyCode: 'QAR',
                    merchantName: KEYS.GOOGLE_PAY_MERCHANT_NAME || 'QScrap'
                }
            });

            if (error) {
                logError('Platform Pay error:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                toast.error(t('common.error'), error.message || t('payment.failed'));
                setIsLoading(false);
                return;
            }

            const status = paymentIntent?.status?.toLowerCase();
            if (status === 'succeeded' && paymentIntent?.id) {
                await handlePaymentSuccess(paymentIntent.id);
            } else {
                warn('[Payment] Platform Pay unexpected status:', paymentIntent?.status);
                toast.show({
                    type: 'info',
                    title: t('payment.paymentProcessing'),
                    message:
                        t('payment.paymentProcessingMsg') + (paymentIntent?.status ? ` (${paymentIntent.status})` : '')
                });
                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main' }]
                    });
                }, 1000);
            }
        } catch (error: any) {
            handleApiError(error, toast);
        } finally {
            setIsLoading(false);
        }
    }, [
        clientSecret,
        confirmPlatformPayPayment,
        garageName,
        payNowAmount,
        partDescription,
        t,
        toast,
        handlePaymentSuccess,
        navigation
    ]);

    const handleFreeOrder = useCallback(
        async (calculateDiscount: any) => {
            if (!orderId) {
                toast.error(t('common.error'), t('payment.orderNotFound'));
                return;
            }

            setIsLoading(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            try {
                const { discountOnTotal } = calculateDiscount;
                await api.confirmFreeOrder(orderId, discountOnTotal);

                toast.show({
                    type: 'success',
                    title: t('payment.freeOrderTitle'),
                    message: t('payment.freeOrderMsg')
                });

                setTimeout(() => {
                    navigation.reset({
                        index: 1,
                        routes: [{ name: 'Main' }, { name: 'Tracking', params: { orderId, orderNumber: '' } }]
                    });
                }, 1000);
            } catch (error: any) {
                handleApiError(error, toast);
            } finally {
                setIsLoading(false);
            }
        },
        [orderId, navigation, toast, t]
    );

    return {
        isLoading,
        setIsLoading,
        handlePayment,
        handlePlatformPay,
        handleFreeOrder,
        platformPayReady,
        platformPayLabel
    };
}
