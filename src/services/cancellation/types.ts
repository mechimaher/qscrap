/**
 * Cancellation Service Types
 */

export interface CancellationFeeResult {
    feeRate: number;
    fee: number;
    canCancel: boolean;
    reason?: string;
}

export interface CancellationPreview {
    order_id: string;
    order_status: string;
    total_amount: number;
    can_cancel: boolean;
    cancellation_fee_rate: number;
    cancellation_fee: number;
    refund_amount: number;
    reason?: string;
}

export interface CancelRequestResult {
    message: string;
    bids_affected: number;
}

export interface WithdrawBidResult {
    message: string;
}

export interface CancelOrderResult {
    message: string;
    cancellation_fee?: number;
    delivery_fee_retained?: number;
    refund_amount?: number;
    refund_status?: string;
    impact?: string;
    fault_party?: 'customer' | 'garage' | 'driver' | 'platform';
}

// ===========================================
// NEW TYPES - Cancellation-Refund-BRAIN.md v3.0
// ===========================================

/**
 * Return Request (7-Day Window)
 */
export interface ReturnRequest {
    return_id: string;
    order_id: string;
    customer_id: string;
    reason: 'unused' | 'defective' | 'wrong_part';
    photo_urls: string[];
    condition_description: string;
    return_fee: number;
    refund_amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'pickup_scheduled' | 'completed';
    pickup_driver_id?: string;
    created_at: Date;
    processed_at?: Date;
}

export interface ReturnPreview {
    order_id: string;
    order_number: string;
    can_return: boolean;
    days_since_delivery: number;
    hours_remaining: number;
    part_price: number;
    delivery_fee: number;
    return_fee: number;        // 20% of part price
    delivery_fee_retained: number;  // 100% of delivery
    refund_amount: number;
    reason?: string;           // If can_return is false
}

export interface ReturnResult {
    success: boolean;
    return_id?: string;
    refund_amount?: number;
    message: string;
}

/**
 * Garage Penalty System
 */
export interface GaragePenalty {
    penalty_id: string;
    garage_id: string;
    order_id?: string;
    penalty_type: 'cancellation' | 'repeat_cancellation' | 'wrong_part' | 'damaged_part';
    amount: number;
    reason: string;
    status: 'pending' | 'deducted' | 'waived';
    deducted_from_payout_id?: string;
    created_at: Date;
}

export interface GarageAccountability {
    garage_id: string;
    cancellations_this_month: number;
    pending_penalties: number;
    total_penalties_amount: number;
    status: 'good_standing' | 'warning' | 'review' | 'suspended';
}

/**
 * Customer Abuse Tracking
 */
export interface CustomerAbuseStatus {
    customer_id: string;
    month_year: string;
    returns_count: number;
    defective_claims_count: number;
    cancellations_count: number;
    flag_level: 'none' | 'yellow' | 'orange' | 'red' | 'black';
    can_return: boolean;
    can_claim_defective: boolean;
    remaining_returns: number;
    remaining_claims: number;
}

/**
 * Delivery Voucher (Garage Cancellation Compensation)
 */
export interface DeliveryVoucher {
    voucher_id: string;
    customer_id: string;
    order_id?: string;
    amount: number;
    reason: string;
    expires_at: Date;
    used_at?: Date;
    used_on_order_id?: string;
    created_at: Date;
}

/**
 * Enhanced Cancellation Preview with BRAIN-compliant breakdown
 */
export interface EnhancedCancellationPreview extends CancellationPreview {
    order_number: string;
    part_description?: string;
    part_price: number;
    delivery_fee: number;
    delivery_fee_retained: number;
    cancellation_stage: string;
    fee_breakdown: {
        platform_fee: number;
        garage_compensation: number;
        delivery_fee: number;
    };
}
