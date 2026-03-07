import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { log } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

interface PaymentInitializationParams {
    existingOrderId: string | undefined;
    bidId: string;
    paymentType: 'delivery_only' | 'full';
    applyDiscount: boolean;
    loyaltyData: any;
    totalAmount: number;
    partPrice: number;
    deliveryFee: number;
    setClientSecret: (secret: string | null) => void;
    setPaymentAmount: (amount: number) => void;
    setDiscountAmount: (amount: number) => void;
    t: (key: string) => string;
    toast: any;
    navigation: any;
}

export function usePaymentInitialization({
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
}: PaymentInitializationParams) {
    const [orderId, setOrderId] = useState<string | null>(existingOrderId || null);
    const [intentError, setIntentError] = useState<string | null>(null);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const isInitializing = useRef(false);

    const initializePayment = useCallback(async () => {
        if (isInitializing.current) {
            return;
        }

        isInitializing.current = true;
        setIsCreatingOrder(true);
        let orderIdToUse = existingOrderId;
        try {
            if (!orderIdToUse) {
                const orderResult = await api.acceptBid(bidId, 'card');
                if (!orderResult.order_id) {
                    throw new Error(t('payment.failed'));
                }
                orderIdToUse = orderResult.order_id;
                setOrderId(orderIdToUse || null);
            } else {
                setOrderId(orderIdToUse || null);
            }

            let currentDiscount = 0;
            if (applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0) {
                currentDiscount = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
            }

            if (!orderIdToUse) {
                throw new Error('Order ID is required');
            }

            let paymentResult;
            if (paymentType === 'full') {
                paymentResult = await api.createFullPaymentIntent(orderIdToUse, currentDiscount);
                setPaymentAmount(paymentResult.breakdown?.total || totalAmount);
                setDiscountAmount(currentDiscount);
            } else {
                const partDiscount = applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0
                    ? Math.round(partPrice * (loyaltyData.discountPercentage / 100))
                    : 0;
                paymentResult = await api.createDeliveryFeeIntent(orderIdToUse, partDiscount);
                setPaymentAmount(deliveryFee);
            }

            if (!paymentResult.intent?.clientSecret) {
                const result = paymentResult as any;
                const errorMsg = typeof result.error === 'string'
                    ? result.error
                    : (result.error?.message || result.message || t('payment.failed'));
                throw new Error(errorMsg);
            }

            setClientSecret(paymentResult.intent.clientSecret);
            setIntentError(null);
        } catch (error: any) {
            const errorMsg = error?.message || t('payment.failed');
            setIntentError(errorMsg);
            if (!orderIdToUse && !existingOrderId) {
                handleApiError(error, toast, { useAlert: true, onDismiss: () => navigation.goBack() });
            } else {
                toast.error(t('common.error'), errorMsg);
            }
        } finally {
            setIsCreatingOrder(false);
            isInitializing.current = false;
        }
    }, [existingOrderId, bidId, paymentType, applyDiscount, loyaltyData, totalAmount, partPrice, deliveryFee, setClientSecret, setPaymentAmount, setDiscountAmount, t, toast, navigation]);

    const retryPaymentIntent = useCallback(async () => {
        if (!orderId) {
            setIntentError(null);
            initializePayment();
            return;
        }

        setIsCreatingOrder(true);
        setIntentError(null);

        try {

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
                const partDiscount = applyDiscount && loyaltyData && loyaltyData.discountPercentage > 0
                    ? Math.round(partPrice * (loyaltyData.discountPercentage / 100))
                    : 0;
                paymentResult = await api.createDeliveryFeeIntent(orderId, partDiscount);
                setPaymentAmount(deliveryFee);
            }

            if (!paymentResult.intent?.clientSecret) {
                const result = paymentResult as any;
                const errorMsg = typeof result.error === 'string'
                    ? result.error
                    : (result.error?.message || result.message || t('payment.failed'));
                throw new Error(errorMsg);
            }

            setClientSecret(paymentResult.intent.clientSecret);
            log('[Payment] Retry successful, got clientSecret');
        } catch (error: any) {
            const errorMsg = error?.message || t('payment.failed');
            setIntentError(errorMsg);
            toast.error(t('common.error'), errorMsg);
        } finally {
            setIsCreatingOrder(false);
        }
    }, [orderId, paymentType, applyDiscount, loyaltyData, totalAmount, partPrice, deliveryFee, setClientSecret, setPaymentAmount, setDiscountAmount, t, toast, initializePayment]);

    return {
        orderId,
        intentError,
        isCreatingOrder,
        initializePayment,
        retryPaymentIntent,
    };
}
