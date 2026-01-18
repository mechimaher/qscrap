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
    refund_amount?: number;
    refund_status?: string;
    impact?: string;
}
