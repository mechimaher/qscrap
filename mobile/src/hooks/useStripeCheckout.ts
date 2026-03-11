import { useState, useCallback, useRef, useEffect } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

interface StripeCheckoutParams {
    clientSecret: string | null;
    cardComplete: boolean;
    orderId: string | null;
    navigation: any;
    t: (key: string) => string;
    toast: any;
}

export function useStripeCheckout({
    clientSecret,
    cardComplete,
    orderId,
    navigation,
    t,
    toast,
}: StripeCheckoutParams) {
    const { confirmPayment } = useStripe();
    const [isLoading, setIsLoading] = useState(false);
    
    // 30-Second Undo Window
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdown, setCountdown] = useState(30);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const cancelCheckout = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsCountingDown(false);
        setCountdown(30);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, []);

    const executePayment = async () => {
        if (!clientSecret || !cardComplete) {
            toast.error(t('common.error'), t('payment.enterCardDetails'));
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
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

            const status = paymentIntent?.status?.toLowerCase();

            if (status === 'succeeded') {
                try {
                    await api.confirmDeliveryFeePayment(paymentIntent.id);
                } catch (confirmError: any) {
                    // Continue anyway - Stripe webhook will handle it as fallback
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                toast.show({
                    type: 'success',
                    title: t('payment.paymentSuccessTitle'),
                    message: t('payment.paymentSuccessMsg'),
                });

                const navigateToOrder = () => {
                    if (orderId) {
                        navigation.reset({
                            index: 1,
                            routes: [
                                { name: 'Main' },
                                { name: 'Tracking', params: { orderId, orderNumber: '' } },
                            ],
                        });
                    } else {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Main', params: { screen: 'Orders' } }],
                        });
                    }
                };

                setTimeout(navigateToOrder, 500);

            } else {
                warn('[Payment] Unexpected status:', paymentIntent?.status);
                toast.show({
                    type: 'info',
                    title: t('payment.paymentProcessing'),
                    message: t('payment.paymentProcessingMsg') + (paymentIntent?.status ? ` (${paymentIntent.status})` : ''),
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
            setIsCountingDown(false);
        }
    };

    const handlePayment = useCallback(() => {
        if (!clientSecret || !cardComplete) {
            toast.error(t('common.error'), t('payment.enterCardDetails'));
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsCountingDown(true);
        setCountdown(30);

        if (timerRef.current) clearInterval(timerRef.current);
        
        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    executePayment();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clientSecret, cardComplete, t, toast]);

    const handleFreeOrder = useCallback(async (calculateDiscount: any) => {
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
                message: t('payment.freeOrderMsg'),
            });

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
    }, [orderId, navigation, toast, t]);

    return {
        isLoading,
        setIsLoading,
        handlePayment,
        handleFreeOrder,
        isCountingDown,
        countdown,
        cancelCheckout,
        executePayment, // Expose to bypass countdown if user taps "Pay Now"
    };
}
