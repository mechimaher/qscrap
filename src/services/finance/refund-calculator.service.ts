import { CANCELLATION_FEES, FEE_POLICY, STATUS_TO_STAGE, CancellationStage } from '../cancellation/cancellation.constants';

export interface RefundCalculation {
    originalAmount: number;
    deliveryFee: number;
    stage: number;
    stageName: string;
    feePercentage: number;
    platformFee: number;
    deliveryFeeRetained: number;
    refundableAmount: number;
    breakdown: {
        partPrice: number;
        platformFeeAmount: number;
        deliveryFeeRetained: number;
        totalDeductions: number;
    };
    reason?: string;
    isDefectiveItem?: boolean;
    isFirstCancellationFree?: boolean;
}

export interface RefundCalculationInput {
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    deliveryFee: number;
    customerCancellationCount?: number;
    deliveredAt?: Date | null;
    isDefectiveItem?: boolean;
    isWrongItem?: boolean;
}

/**
 * Determine the refund stage based on order status
 */
export function determineRefundStage(orderStatus: string, deliveredAt?: Date | null): number {
    const stageKey = (STATUS_TO_STAGE as Record<string, CancellationStage>)[orderStatus] || 'AFTER_DELIVERY';

    // Map stage strings back to numeric stages for display/logic compatibility
    const stageMap: Record<CancellationStage, number> = {
        'BEFORE_PAYMENT': 1,
        'AFTER_PAYMENT': 4,
        'DURING_PREPARATION': 5,
        'IN_DELIVERY': 6,
        'AFTER_DELIVERY': 7
    };

    return stageMap[stageKey] || 7;
}

/**
 * Get stage name for display
 */
export function getStageName(stage: number): string {
    const stageNames: Record<number, string> = {
        1: 'Pre-Payment',
        4: 'Payment Complete',
        5: 'Preparation',
        6: 'In Delivery',
        7: 'After Delivery (Return Window)',
    };
    return stageNames[stage] || 'Unknown Stage';
}

/**
 * Calculate refundable amount based on BRAIN v3.1 policy
 * 
 * @param input - Order details for calculation
 * @returns Detailed refund calculation
 */
export function calculateRefundableAmount(input: RefundCalculationInput): RefundCalculation {
    const {
        orderStatus,
        totalAmount,
        deliveryFee,
        customerCancellationCount = 0,
        deliveredAt,
        isDefectiveItem = false,
        isWrongItem = false
    } = input;

    const stage = determineRefundStage(orderStatus, deliveredAt);
    const stageName = getStageName(stage);
    const partPrice = totalAmount - deliveryFee;

    // Defective or wrong items = 100% refund (Garage covers all costs per BRAIN v3.1)
    if (isDefectiveItem || isWrongItem) {
        return {
            originalAmount: totalAmount,
            deliveryFee,
            stage,
            stageName: 'Defective/Wrong Part',
            feePercentage: 0,
            platformFee: 0,
            deliveryFeeRetained: 0,
            refundableAmount: totalAmount, // Full refund
            breakdown: {
                partPrice,
                platformFeeAmount: 0,
                deliveryFeeRetained: 0,
                totalDeductions: 0,
            },
            reason: isDefectiveItem ? 'Defective Part' : 'Wrong Part Delivered',
            isDefectiveItem: true,
        };
    }

    // Stage-based fee calculation from constants (BRAIN v3.1)
    let feeRate = 0;
    let deliveryFeeRetained = 0;

    const stageKey = (STATUS_TO_STAGE as Record<string, CancellationStage>)[orderStatus] || 'AFTER_DELIVERY';
    feeRate = CANCELLATION_FEES[stageKey] || 0.20;

    if (stageKey === 'IN_DELIVERY' || stageKey === 'AFTER_DELIVERY') {
        deliveryFeeRetained = deliveryFee;
    }

    // [BRAIN v3.1] Policy: First Cancellation Free
    let isFirstFree = false;
    if (FEE_POLICY.FIRST_CANCELLATION_FREE && customerCancellationCount === 0 && feeRate > 0) {
        isFirstFree = true;
        feeRate = 0;
    }

    // Calculate platform fee on PART PRICE only
    let platformFeeAmount = Math.round((partPrice * feeRate) * 100) / 100;

    // [BRAIN v3.1] Policy: Max Fee Cap (100 QAR)
    if (platformFeeAmount > FEE_POLICY.MAX_FEE_QAR) {
        platformFeeAmount = FEE_POLICY.MAX_FEE_QAR;
    }

    const totalDeductions = platformFeeAmount + deliveryFeeRetained;
    const refundableAmount = Math.max(0, totalAmount - totalDeductions);

    return {
        originalAmount: totalAmount,
        deliveryFee,
        stage,
        stageName,
        feePercentage: Math.round(feeRate * 100),
        platformFee: platformFeeAmount,
        deliveryFeeRetained,
        refundableAmount: Math.round(refundableAmount * 100) / 100,
        breakdown: {
            partPrice,
            platformFeeAmount,
            deliveryFeeRetained,
            totalDeductions,
        },
        isDefectiveItem: false,
        isFirstCancellationFree: isFirstFree
    };
}

/**
 * Validate if refund is allowed based on warranty period (7 days)
 */
export function isWithinWarrantyPeriod(deliveredAt: Date | null): boolean {
    if (!deliveredAt) { return false; }

    const WARRANTY_DAYS = 7;
    const warrantyEnd = new Date(deliveredAt);
    warrantyEnd.setDate(warrantyEnd.getDate() + WARRANTY_DAYS);

    return new Date() <= warrantyEnd;
}

/**
 * Calculate remaining warranty days
 */
export function getWarrantyDaysRemaining(deliveredAt: Date | null): number {
    if (!deliveredAt) { return 0; }

    const WARRANTY_DAYS = 7;
    const now = new Date();
    const deliveryDate = new Date(deliveredAt);
    const daysSinceDelivery = Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, WARRANTY_DAYS - daysSinceDelivery);
}

/**
 * Get refund reason options based on stage (structured dropdown)
 */
export function getRefundReasonOptions(stage: number, isPostDelivery: boolean): string[] {
    if (isPostDelivery || stage >= 7) {
        return [
            'Defective Part',
            'Wrong Part Delivered',
            'Part Does Not Match Description',
            'Part Does Not Fit Vehicle',
            'Quality Not As Expected',
            'Changed Mind - No Longer Needed',
            'Found Better Alternative',
            'Other'
        ];
    }

    return [
        'Customer Changed Mind',
        'Found Better Price',
        'No Longer Needed',
        'Incorrect Order',
        'Duplicate Order',
        'Other'
    ];
}
