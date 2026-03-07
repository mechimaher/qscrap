import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { log, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

interface PaymentIntentParams {
    orderId: string | null;
    paymentType: 'delivery_only' | 'full';
    applyDiscount: boolean;
    payNowAmount: number;
    discountOnTotal: number;
    discountOnPart: number;
    deliveryFee: number;
    t: (key: string) => string;
    toast: any;
}

export function usePaymentIntent({
    orderId,
    paymentType,
    applyDiscount,
    payNowAmount,
    discountOnTotal,
    discountOnPart,
    deliveryFee,
    t,
    toast,
}: PaymentIntentParams) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(deliveryFee);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);

    const requestVersion = useRef(0);

    useEffect(() => {
        if (!orderId) return;

        setDiscountAmount(paymentType === 'full' ? discountOnTotal : discountOnPart);

        requestVersion.current += 1;
        const thisVersion = requestVersion.current;

        setClientSecret('');
        setIsCreatingOrder(true);

        const timer = setTimeout(async () => {
            if (thisVersion !== requestVersion.current) return;

            try {
                if (payNowAmount <= 0) {
                    setClientSecret('FREE_ORDER');
                    setPaymentAmount(0);
                    setIsCreatingOrder(false);
                    return;
                }

                let paymentResult;
                if (paymentType === 'full') {
                    paymentResult = await api.createFullPaymentIntent(orderId, discountOnTotal);
                    setPaymentAmount(paymentResult.breakdown?.total || payNowAmount);
                } else {
                    paymentResult = await api.createDeliveryFeeIntent(orderId, discountOnPart);
                    setPaymentAmount(deliveryFee);
                }

                if (thisVersion !== requestVersion.current) return;

                if (paymentResult.intent?.clientSecret) {
                    setClientSecret(paymentResult.intent.clientSecret);
                } else {
                    const result = paymentResult as any;
                    const errorMsg = result.error?.message || result.message || t('payment.failed');
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
    }, [orderId, paymentType, applyDiscount, payNowAmount, discountOnTotal, discountOnPart, deliveryFee, t, toast]);

    return {
        clientSecret,
        setClientSecret,
        paymentAmount,
        setPaymentAmount,
        isCreatingOrder,
        setIsCreatingOrder,
        discountAmount,
        setDiscountAmount,
    };
}
