// QScrap Payment System - Provider Interface
// Abstraction layer for easy payment provider swapping (Mock → QPAY → Stripe, etc.)

export type PaymentMethod = 'mock_card' | 'cash' | 'qpay';
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'cancelled';
export type TransactionAction = 'initiated' | 'validated' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

// ============================================================================
// PAYMENT REQUEST/RESPONSE TYPES
// ============================================================================

export interface PaymentRequest {
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethodDetails;
    idempotencyKey: string;
    metadata?: Record<string, any>;
}

export interface PaymentMethodDetails {
    type: PaymentMethod;
    // Card details (only for mock_card type)
    cardNumber?: string;
    cardExpiry?: string; // Format: MM/YY
    cardCVV?: string;
    cardholderName?: string;
}

export interface PaymentResponse {
    success: boolean;
    transactionId: string;
    status: PaymentStatus;
    message?: string;
    errorCode?: string;
    providerTransactionId?: string;
    metadata?: Record<string, any>;
}

export interface RefundRequest {
    transactionId: string;
    amount?: number; // Partial refund if specified
    reason: string;
}

export interface RefundResponse {
    success: boolean;
    refundId: string;
    amount: number;
    message?: string;
}

export interface TransactionStatus {
    transactionId: string;
    status: PaymentStatus;
    amount: number;
    refundedAmount: number;
    createdAt: Date;
    completedAt?: Date;
}

// ============================================================================
// PAYMENT PROVIDER INTERFACE
// ============================================================================
// Any payment provider (Mock, QPAY, Stripe, etc.) must implement this interface

export interface PaymentProvider {
    /**
     * Process a payment transaction
     * @param data Payment request details
     * @returns Payment result
     */
    processPayment(data: PaymentRequest): Promise<PaymentResponse>;

    /**
     * Refund a transaction (full or partial)
     * @param request Refund details
     * @returns Refund result
     */
    refundPayment(request: RefundRequest): Promise<RefundResponse>;

    /**
     * Verify transaction status with provider
     * @param transactionId Internal transaction ID
     * @returns Current status
     */
    verifyTransaction(transactionId: string): Promise<TransactionStatus>;

    /**
     * Get provider name for logging
     */
    getProviderName(): string;
}

// ============================================================================
// CARD VALIDATION TYPES
// ============================================================================

export interface CardValidationResult {
    isValid: boolean;
    errors: string[];
    brand?: CardBrand;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface PaymentTransaction {
    transaction_id: string;
    order_id: string;
    user_id: string;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    status: PaymentStatus;
    card_last4?: string;
    card_brand?: string;
    card_expiry_month?: number;
    card_expiry_year?: number;
    provider_response?: any;
    provider_transaction_id?: string;
    idempotency_key?: string;
    refund_amount: number;
    refund_reason?: string;
    refunded_at?: Date;
    created_at: Date;
    updated_at: Date;
    completed_at?: Date;
    failed_at?: Date;
    failure_reason?: string;
    error_code?: string;
    metadata?: any;
}

export interface PaymentAuditLog {
    log_id: string;
    transaction_id: string;
    action: TransactionAction;
    ip_address?: string;
    user_agent?: string;
    request_method?: string;
    request_path?: string;
    request_data?: any;
    response_data?: any;
    processing_time_ms?: number;
    created_at: Date;
}

export interface IdempotencyKey {
    key: string;
    transaction_id: string;
    response: any;
    created_at: Date;
    expires_at: Date;
    request_hash?: string;
    user_id?: string;
}
