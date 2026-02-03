/**
 * Mock Payment Provider
 * For local development and testing without Stripe
 */

import {
    PaymentGateway,
    PaymentIntent,
    PaymentMethod,
    PaymentStatus,
    RefundResult,
    CreatePaymentOptions
} from './payment-gateway.interface';
import logger from '../../utils/logger';

export class MockPaymentProvider implements PaymentGateway {
    readonly providerName = 'mock';

    private intents: Map<string, PaymentIntent> = new Map();
    private customers: Map<string, string> = new Map(); // userId -> mockCustomerId
    private paymentMethods: Map<string, PaymentMethod[]> = new Map(); // customerId -> methods

    /**
     * Test card numbers for simulating different scenarios
     */
    private readonly TEST_CARDS = {
        SUCCESS: '4242424242424242',
        DECLINE: '4000000000000002',
        INSUFFICIENT: '4000000000009995',
        REQUIRES_3DS: '4000002760003184',
    };

    async createPaymentIntent(options: CreatePaymentOptions): Promise<PaymentIntent> {
        const intentId = `mock_pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const intent: PaymentIntent = {
            id: intentId,
            clientSecret: `${intentId}_secret_${Math.random().toString(36).substr(2, 16)}`,
            amount: options.amount,
            currency: options.currency || 'QAR',
            status: 'pending',
            metadata: options.metadata || {}
        };

        this.intents.set(intentId, intent);
        logger.info('MockPayment created intent', { intentId, amount: options.amount, currency: options.currency });

        return intent;
    }

    async confirmPaymentIntent(intentId: string, paymentMethodId?: string): Promise<PaymentIntent> {
        const intent = this.intents.get(intentId);
        if (!intent) {
            throw new Error('Payment intent not found');
        }

        // Simulate card behavior based on method ID
        if (paymentMethodId?.includes('decline')) {
            intent.status = 'failed';
        } else if (paymentMethodId?.includes('3ds')) {
            intent.status = 'requires_action';
        } else {
            // Default: success
            intent.status = 'succeeded';
        }

        this.intents.set(intentId, intent);
        logger.info('MockPayment confirmed intent', { intentId, status: intent.status });

        return intent;
    }

    async capturePayment(intentId: string, amount?: number): Promise<PaymentIntent> {
        const intent = this.intents.get(intentId);
        if (!intent) {
            throw new Error('Payment intent not found');
        }

        intent.status = 'succeeded';
        if (amount) {
            intent.amount = amount;
        }

        this.intents.set(intentId, intent);
        logger.info('MockPayment captured', { intentId });

        return intent;
    }

    async cancelPaymentIntent(intentId: string): Promise<boolean> {
        const intent = this.intents.get(intentId);
        if (!intent) {
            return false;
        }

        intent.status = 'cancelled';
        this.intents.set(intentId, intent);
        logger.info('MockPayment cancelled', { intentId });

        return true;
    }

    async refundPayment(intentId: string, amount?: number, reason?: string): Promise<RefundResult> {
        const intent = this.intents.get(intentId);
        if (!intent) {
            throw new Error('Payment intent not found');
        }

        const refundAmount = amount || intent.amount;
        const refundId = `mock_re_${Date.now()}`;

        if (refundAmount === intent.amount) {
            intent.status = 'refunded';
        }
        this.intents.set(intentId, intent);

        logger.info('MockPayment refunded', { refundAmount, intentId, reason });

        return {
            id: refundId,
            amount: refundAmount,
            status: 'succeeded'
        };
    }

    async getPaymentStatus(intentId: string): Promise<PaymentStatus> {
        const intent = this.intents.get(intentId);
        return intent?.status || 'failed';
    }

    async createCustomer(userId: string, email?: string, name?: string): Promise<string> {
        const existing = this.customers.get(userId);
        if (existing) {
            return existing;
        }

        const customerId = `mock_cus_${Date.now()}`;
        this.customers.set(userId, customerId);
        this.paymentMethods.set(customerId, []);

        logger.info('MockPayment created customer', { customerId, userId });
        return customerId;
    }

    async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod> {
        const method: PaymentMethod = {
            id: `mock_pm_${Date.now()}`,
            providerId: paymentMethodId,
            last4: '4242',
            brand: 'visa',
            expMonth: 12,
            expYear: 2028,
            cardholderName: 'Test User'
        };

        const methods = this.paymentMethods.get(customerId) || [];
        methods.push(method);
        this.paymentMethods.set(customerId, methods);

        logger.info('MockPayment attached method', { methodId: method.id, customerId });
        return method;
    }

    async detachPaymentMethod(paymentMethodId: string): Promise<boolean> {
        // Find and remove from all customers
        for (const [customerId, methods] of this.paymentMethods) {
            const filtered = methods.filter(m => m.id !== paymentMethodId && m.providerId !== paymentMethodId);
            if (filtered.length !== methods.length) {
                this.paymentMethods.set(customerId, filtered);
                logger.info('MockPayment detached method', { paymentMethodId });
                return true;
            }
        }
        return false;
    }

    async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
        return this.paymentMethods.get(customerId) || [];
    }
}
