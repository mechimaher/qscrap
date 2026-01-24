/**
 * Payment Gateway Interface
 * Provider-agnostic payment abstraction for Stripe/QPAY/Mock
 */

export interface PaymentIntent {
    id: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    metadata?: Record<string, any>;
}

export type PaymentStatus =
    | 'pending'
    | 'requires_action'
    | 'requires_payment_method'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'refunded';

export interface PaymentMethod {
    id: string;
    providerId: string;
    last4: string;
    brand: string;
    expMonth: number;
    expYear: number;
    cardholderName?: string;
}

export interface RefundResult {
    id: string;
    amount: number;
    status: 'pending' | 'succeeded' | 'failed';
}

export interface CreatePaymentOptions {
    amount: number;
    currency?: string;
    customerId?: string;
    orderId?: string;
    description?: string;
    metadata?: Record<string, any>;
    paymentMethodId?: string;
    captureMethod?: 'automatic' | 'manual';
}

export interface PaymentGateway {
    /**
     * Provider name for identification
     */
    readonly providerName: string;

    /**
     * Create a payment intent
     */
    createPaymentIntent(options: CreatePaymentOptions): Promise<PaymentIntent>;

    /**
     * Confirm a payment intent (for manual confirmation)
     */
    confirmPaymentIntent(intentId: string, paymentMethodId?: string): Promise<PaymentIntent>;

    /**
     * Capture a payment (for manual capture mode)
     */
    capturePayment(intentId: string, amount?: number): Promise<PaymentIntent>;

    /**
     * Cancel a payment intent
     */
    cancelPaymentIntent(intentId: string): Promise<boolean>;

    /**
     * Refund a payment (full or partial)
     */
    refundPayment(intentId: string, amount?: number, reason?: string): Promise<RefundResult>;

    /**
     * Get payment status
     */
    getPaymentStatus(intentId: string): Promise<PaymentStatus>;

    /**
     * Create or get Stripe customer for saved cards
     */
    createCustomer(userId: string, email?: string, name?: string): Promise<string>;

    /**
     * Attach payment method to customer
     */
    attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod>;

    /**
     * Detach payment method from customer
     */
    detachPaymentMethod(paymentMethodId: string): Promise<boolean>;

    /**
     * List customer's payment methods
     */
    listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
}

/**
 * Payment configuration
 */
export interface PaymentConfig {
    provider: 'stripe' | 'qpay' | 'mock';
    stripeSecretKey?: string;
    stripePublishableKey?: string;
    qpayApiKey?: string;
    qpayMerchantId?: string;
    testMode: boolean;
    defaultCurrency: string;
    // Delivery fee upfront model (not percentage)
    upfrontType: 'delivery_fee' | 'percentage';
    depositPercentage?: number; // Only if upfrontType = 'percentage'
}

export const DEFAULT_PAYMENT_CONFIG: Partial<PaymentConfig> = {
    provider: 'stripe',
    testMode: true,
    defaultCurrency: 'QAR',
    upfrontType: 'delivery_fee', // Customer only pays delivery fee upfront
};
