import { useMemo } from 'react';
import { useLoyalty } from './useLoyalty';

interface LoyaltyCalculationParams {
    partPrice: number;
    deliveryFee: number;
    paymentType: 'delivery_only' | 'full';
    applyDiscount: boolean;
}

export function useLoyaltyCalculation({
    partPrice,
    deliveryFee,
    paymentType,
    applyDiscount,
}: LoyaltyCalculationParams) {
    const { loyalty: loyaltyRaw } = useLoyalty();

    const loyaltyData = loyaltyRaw ? {
        points: loyaltyRaw.points,
        tier: loyaltyRaw.tier,
        discountPercentage: loyaltyRaw.discountPercentage,
    } : null;

    const totalAmount = partPrice + deliveryFee;

    const calculateDiscount = useMemo(() => {
        if (!applyDiscount || !loyaltyData || loyaltyData.discountPercentage <= 0) {
            return { discountOnPart: 0, discountOnTotal: 0 };
        }
        const discountOnTotal = Math.round(totalAmount * (loyaltyData.discountPercentage / 100));
        const discountOnPart = Math.round(partPrice * (loyaltyData.discountPercentage / 100));
        return { discountOnPart, discountOnTotal };
    }, [applyDiscount, loyaltyData, totalAmount, partPrice]);

    const payNowAmount = useMemo(() => {
        const { discountOnTotal } = calculateDiscount;
        if (paymentType === 'full') {
            return Math.max(0, totalAmount - discountOnTotal);
        } else {
            return deliveryFee;
        }
    }, [calculateDiscount, paymentType, totalAmount, deliveryFee]);

    const codAmount = useMemo(() => {
        const { discountOnPart } = calculateDiscount;
        if (paymentType === 'delivery_only') {
            return Math.max(0, partPrice - discountOnPart);
        }
        return 0;
    }, [calculateDiscount, paymentType, partPrice]);

    const freeOrder = useMemo(() => {
        const { discountOnTotal } = calculateDiscount;
        return paymentType === 'full' && discountOnTotal >= totalAmount;
    }, [calculateDiscount, paymentType, totalAmount]);

    return {
        loyaltyData,
        calculateDiscount,
        payNowAmount,
        codAmount,
        freeOrder,
        totalAmount,
    };
}
