/**
 * Finance Services - Type Definitions
 * DTOs and interfaces for payout, refund, and revenue services
 */

// ============================================
// PAYOUT TYPES
// ============================================

export interface Payout {
    payout_id: string;
    garage_id: string;
    order_id: string | null;
    net_amount: number;
    platform_fee_amount: number;
    payout_status: PayoutStatus;
    payout_method?: string;
    payout_reference?: string;
    sent_at?: Date;
    confirmed_at?: Date;
    created_at: Date;
    updated_at: Date;
    notes?: string;
}

export type PayoutStatus =
    | 'pending'
    | 'processing'
    | 'awaiting_confirmation'
    | 'confirmed'
    | 'completed'
    | 'held'
    | 'disputed'
    | 'cancelled';

export interface SendPaymentDto {
    payout_method: string;
    payout_reference?: string;
    sent_at?: Date;
    notes?: string;
}

export interface ConfirmPaymentDto {
    received_at?: Date;
    received_amount?: number;
    confirmation_notes?: string;
}

export interface DisputeDto {
    issue_type: 'amount_mismatch' | 'not_received' | 'wrong_account' | 'other';
    issue_description: string;
}

export interface ResolveDisputeDto {
    resolution: 'corrected' | 'resent' | 'cancelled';
    new_payout_method?: string;
    new_payout_reference?: string;
    new_amount?: number;
    resolution_notes: string;
}

export interface PayoutFilters {
    status?: PayoutStatus;
    garage_id?: string;
    page?: number;
    limit?: number;
    userId: string;
    userType: 'admin' | 'operations' | 'garage';
}

export interface PayoutSummary {
    stats: {
        completed_payouts: number;
        confirmed_payouts: number;
        total_paid: number;
        pending_payouts: number;
        processing_payouts: number;
        pending_count: number;
        this_month_completed: number;
        total_revenue: number;
    };
    pending_payouts: Array<Payout & { garage_name: string; order_number?: string }>;
}

export interface PaginatedPayouts {
    payouts: Payout[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface PayoutResult {
    payout: Payout;
    message?: string;
}

export interface BulkConfirmResult {
    confirmed_count: number;
    total_amount: number;
    failed_count: number;
    errors?: string[];
}

export interface PayoutStatusDetail extends Payout {
    garage_name: string;
    order_number?: string;
    timeline: Array<{
        status: string;
        timestamp: Date;
        notes?: string;
    }>;
}

export interface PaymentStats {
    total_payouts: number;
    total_amount: number;
    by_status: Record<PayoutStatus, { count: number; amount: number }>;
    awaiting_confirmation: {
        count: number;
        total_amount: number;
        overdue_count: number;
    };
    auto_confirm_eligible: number;
}

// ============================================
// REFUND TYPES
// ============================================

export interface Refund {
    refund_id: string;
    order_id: string;
    refund_amount: number;
    refund_reason: string;
    refund_status: 'pending' | 'processing' | 'completed' | 'failed';
    initiated_by: string;
    processed_at?: Date;
    created_at: Date;
}

export interface CreateRefundDto {
    order_id: string;
    refund_amount: number;
    refund_reason: string;
    refund_method?: string;
    initiated_by: string;
    /** Type of refund - affects whether delivery fee is retained */
    refund_type?: 'cancelled_before_dispatch' | 'customer_refusal' | 'wrong_part' | 'driver_failure';
}

export interface RefundResult {
    refund_id: string;
    refund_amount: number;
    delivery_fee_retained: number;
    payout_adjustment?: {
        payout_id: string;
        original_amount: number;
        adjusted_amount: number;
        reversal_created: boolean;
    };
    message: string;
}

export interface RefundDetail extends Refund {
    order_number: string;
    customer_name: string;
    garage_name: string;
}

// ============================================
// REVENUE TYPES
// ============================================

export type RevenuePeriod = '7d' | '30d' | '90d';

export interface RevenueFilters {
    garage_id?: string;
    from_date?: Date;
    to_date?: Date;
}

export interface RevenueReport {
    period: RevenuePeriod;
    date_range: {
        from: Date;
        to: Date;
    };
    metrics: {
        total_revenue: number;
        platform_fees: number;
        delivery_fees: number;
        orders_completed: number;
        average_order_value: number;
    };
    breakdown: {
        by_day: Array<{ date: string; revenue: number; orders: number }>;
        by_garage?: Array<{ garage_id: string; garage_name: string; revenue: number; orders: number }>;
    };
}

export interface TransactionFilters {
    user_id?: string;
    user_type?: 'admin' | 'operations' | 'garage';
    status?: string[];
    from_date?: Date;
    to_date?: Date;
    page?: number;
    limit?: number;
}

export interface Transaction {
    transaction_id: string;
    type: 'payout' | 'refund';
    amount: number;
    status: string;
    created_at: Date;
    garage_id?: string;
    garage_name?: string;
    order_number?: string;
}

export interface TransactionDetail {
    order_id: string;
    order_number: string;
    customer_name: string;
    garage_name: string;
    part_price: number;
    platform_fee: number;
    delivery_fee: number;
    total_amount: number;
    garage_payout_amount: number;
    payment_status: string;
    order_status: string;
    payout?: Partial<Payout>;
    refund?: Partial<Refund>;
    created_at: Date;
}
