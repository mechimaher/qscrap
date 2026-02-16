/**
 * Refund Calculator Service (BRAIN v3.0 Compliant)
 * 
 * Calculates refundable amounts based on order stage per Qatar Law No. 8/2008
 * and BRAIN v3.0 policy document.
 * 
 * Stage Fees:
 * - Stage 1-3 (Pre-Payment): 0% fee
 * - Stage 4 (Payment Complete): 5% fee 
 * - Stage 5 (Preparation): 10% fee
 * - Stage 6 (In Delivery): 10% + 100% delivery fee
 * - Stage 7 (After Delivery/Return Window): 20% + 100% delivery fee
 */

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
}

export interface RefundCalculationInput {
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    deliveryFee: number;
    deliveredAt?: Date | null;
    isDefectiveItem?: boolean;
    isWrongItem?: boolean;
}

/**
 * Determine the refund stage based on order status
 */
export function determineRefundStage(orderStatus: string, deliveredAt?: Date | null): number {
    const statusToStage: Record<string, number> = {
        // Stage 1-3: Pre-Payment
        'pending_payment': 1,
        'confirmed': 2,

        // Stage 4: Payment Complete
        'preparing': 4,
        'ready_for_pickup': 4,
        'ready_for_collection': 4,

        // Stage 5: Preparation/Collection in progress
        'collected': 5,
        'qc_in_progress': 5,
        'qc_passed': 5,

        // Stage 6: In Delivery
        'in_transit': 6,

        // Stage 7: After Delivery (Return Window)
        'delivered': 7,
        'completed': 7,
    };

    return statusToStage[orderStatus] || 7; // Default to Stage 7 for unknown statuses
}

/**
 * Get stage name for display
 */
export function getStageName(stage: number): string {
    const stageNames: Record<number, string> = {
        1: 'Pre-Payment',
        2: 'Order Confirmed',
        3: 'Pre-Payment',
        4: 'Payment Complete',
        5: 'Preparation',
        6: 'In Delivery',
        7: 'After Delivery (Return Window)',
    };
    return stageNames[stage] || 'Unknown Stage';
}

/**
 * Calculate refundable amount based on BRAIN v3.0 policy
 * 
 * @param input - Order details for calculation
 * @returns Detailed refund calculation
 */
export function calculateRefundableAmount(input: RefundCalculationInput): RefundCalculation {
    const {
        orderStatus,
        totalAmount,
        deliveryFee,
        deliveredAt,
        isDefectiveItem = false,
        isWrongItem = false
    } = input;

    const stage = determineRefundStage(orderStatus, deliveredAt);
    const stageName = getStageName(stage);
    const partPrice = totalAmount - deliveryFee;

    // Defective or wrong items = 100% refund (Garage covers all costs)
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

    // Stage-based fee calculation
    let feePercentage: number;
    let deliveryFeeRetained: number;

    switch (stage) {
        case 1:
        case 2:
        case 3:
            // Stage 1-3: 0% fee (pre-payment)
            feePercentage = 0;
            deliveryFeeRetained = 0;
            break;

        case 4:
            // Stage 4: 5% fee (payment complete)
            feePercentage = 5;
            deliveryFeeRetained = 0;
            break;

        case 5:
            // Stage 5: 10% fee (preparation)
            feePercentage = 10;
            deliveryFeeRetained = 0;
            break;

        case 6:
            // Stage 6: 10% + 100% delivery fee
            feePercentage = 10;
            deliveryFeeRetained = deliveryFee;
            break;

        case 7:
        default:
            // Stage 7: 20% + 100% delivery fee (after delivery)
            feePercentage = 20;
            deliveryFeeRetained = deliveryFee;
            break;
    }

    // Calculate amounts
    const platformFeeAmount = Math.round((partPrice * feePercentage / 100) * 100) / 100;
    const totalDeductions = platformFeeAmount + deliveryFeeRetained;
    const refundableAmount = Math.max(0, totalAmount - totalDeductions);

    return {
        originalAmount: totalAmount,
        deliveryFee,
        stage,
        stageName,
        feePercentage,
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
    };
}

/**
 * Validate if refund is allowed based on warranty period (7 days)
 */
export function isWithinWarrantyPeriod(deliveredAt: Date | null): boolean {
    if (!deliveredAt) {return false;}

    const WARRANTY_DAYS = 7;
    const warrantyEnd = new Date(deliveredAt);
    warrantyEnd.setDate(warrantyEnd.getDate() + WARRANTY_DAYS);

    return new Date() <= warrantyEnd;
}

/**
 * Calculate remaining warranty days
 */
export function getWarrantyDaysRemaining(deliveredAt: Date | null): number {
    if (!deliveredAt) {return 0;}

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
