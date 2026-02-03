/**
 * Stripe Payment Provider
 * Implements PaymentGateway interface for Stripe payments
 * Supports both Test Mode and Live Mode
 */

import Stripe from 'stripe';
import {
    PaymentGateway,
    PaymentIntent,
    PaymentMethod,
    PaymentStatus,
    RefundResult,
    CreatePaymentOptions
} from './payment-gateway.interface';
import logger from '../../utils/logger';

export class StripePaymentProvider implements PaymentGateway {
    readonly providerName = 'stripe';
    private stripe: Stripe;

    constructor(secretKey: string) {
        this.stripe = new Stripe(secretKey, {
            apiVersion: '2025-12-15.clover',
            typescript: true,
        });

        const isTestMode = secretKey.startsWith('sk_test_');
        logger.info('Stripe initialized', { mode: isTestMode ? 'TEST' : 'LIVE' });
    }

    private mapStripeStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
        const statusMap: Record<string, PaymentStatus> = {
            'requires_payment_method': 'requires_payment_method',
            'requires_confirmation': 'pending',
            'requires_action': 'requires_action',
            'processing': 'processing',
            'requires_capture': 'pending',
            'canceled': 'cancelled',
            'succeeded': 'succeeded',
        };
        return statusMap[status] || 'pending';
    }

    async createPaymentIntent(options: CreatePaymentOptions): Promise<PaymentIntent> {
        try {
            const params: Stripe.PaymentIntentCreateParams = {
                amount: Math.round(options.amount * 100), // Stripe uses cents
                currency: (options.currency || 'QAR').toLowerCase(),
                metadata: {
                    orderId: options.orderId || '',
                    customerId: options.customerId || '',
                    ...options.metadata
                },
                capture_method: options.captureMethod || 'automatic',
                automatic_payment_methods: {
                    enabled: true,
                },
            };

            // Attach to customer for saved cards
            if (options.customerId) {
                const stripeCustomerId = await this.getOrCreateStripeCustomer(options.customerId);
                params.customer = stripeCustomerId;
            }

            // Use saved payment method
            if (options.paymentMethodId) {
                params.payment_method = options.paymentMethodId;
                params.confirm = true;
                params.return_url = 'qscrap://payment-complete'; // Deep link for 3DS
            }

            if (options.description) {
                params.description = options.description;
            }

            const intent = await this.stripe.paymentIntents.create(params);

            logger.info('Created payment intent', { intentId: intent.id, amount: options.amount, currency: options.currency });

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            logger.error('Create intent error', { error: error.message });
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    async confirmPaymentIntent(intentId: string, paymentMethodId?: string): Promise<PaymentIntent> {
        try {
            const params: Stripe.PaymentIntentConfirmParams = {};

            if (paymentMethodId) {
                params.payment_method = paymentMethodId;
            }
            params.return_url = 'qscrap://payment-complete';

            const intent = await this.stripe.paymentIntents.confirm(intentId, params);

            logger.info('Confirmed intent', { intentId: intent.id, status: intent.status });

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            logger.error('Confirm error', { error: error.message });
            throw new Error(`Payment confirmation failed: ${error.message}`);
        }
    }

    async capturePayment(intentId: string, amount?: number): Promise<PaymentIntent> {
        try {
            const params: Stripe.PaymentIntentCaptureParams = {};
            if (amount) {
                params.amount_to_capture = Math.round(amount * 100);
            }

            const intent = await this.stripe.paymentIntents.capture(intentId, params);

            logger.info('Captured payment', { intentId: intent.id });

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            logger.error('Capture error', { error: error.message });
            throw new Error(`Payment capture failed: ${error.message}`);
        }
    }

    async cancelPaymentIntent(intentId: string): Promise<boolean> {
        try {
            await this.stripe.paymentIntents.cancel(intentId);
            logger.info('Cancelled intent', { intentId });
            return true;
        } catch (error: any) {
            logger.error('Cancel error', { error: error.message });
            return false;
        }
    }

    async refundPayment(intentId: string, amount?: number, reason?: string, idempotencyKey?: string): Promise<RefundResult> {
        try {
            const params: Stripe.RefundCreateParams = {
                payment_intent: intentId,
            };

            if (amount) {
                params.amount = Math.round(amount * 100);
            }

            if (reason) {
                params.metadata = { reason };
            }

            // G-04 FIX: Support idempotency key for Stripe-level duplicate protection
            const options: Stripe.RequestOptions = {};
            if (idempotencyKey) {
                options.idempotencyKey = idempotencyKey;
            }

            const refund = await this.stripe.refunds.create(params, options);

            logger.info('Refund created', { refundId: refund.id, amount: refund.amount / 100 });

            return {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status === 'succeeded' ? 'succeeded' : 'pending'
            };
        } catch (error: any) {
            logger.error('Refund error', { error: error.message });
            throw new Error(`Refund failed: ${error.message}`);
        }
    }

    async getPaymentStatus(intentId: string): Promise<PaymentStatus> {
        try {
            const intent = await this.stripe.paymentIntents.retrieve(intentId);
            return this.mapStripeStatus(intent.status);
        } catch (error: any) {
            logger.error('Get status error', { error: error.message });
            return 'failed';
        }
    }

    async createCustomer(userId: string, email?: string, name?: string): Promise<string> {
        try {
            // Check if customer already exists (would need DB lookup in real implementation)
            const customer = await this.stripe.customers.create({
                email: email || `user_${userId}@qscrap.qa`,
                name: name,
                metadata: { userId }
            });

            logger.info('Created customer', { customerId: customer.id, userId });
            return customer.id;
        } catch (error: any) {
            logger.error('Create customer error', { error: error.message });
            throw new Error(`Failed to create customer: ${error.message}`);
        }
    }

    async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod> {
        try {
            const pm = await this.stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId
            });

            // Set as default payment method
            await this.stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId
                }
            });

            logger.info('Attached payment method', { methodId: pm.id, customerId });

            return {
                id: pm.id,
                providerId: pm.id,
                last4: pm.card?.last4 || '****',
                brand: pm.card?.brand || 'unknown',
                expMonth: pm.card?.exp_month || 0,
                expYear: pm.card?.exp_year || 0,
                cardholderName: pm.billing_details?.name || undefined
            };
        } catch (error: any) {
            logger.error('Attach method error', { error: error.message });
            throw new Error(`Failed to save card: ${error.message}`);
        }
    }

    async detachPaymentMethod(paymentMethodId: string): Promise<boolean> {
        try {
            await this.stripe.paymentMethods.detach(paymentMethodId);
            logger.info('Detached payment method', { paymentMethodId });
            return true;
        } catch (error: any) {
            logger.error('Detach method error', { error: error.message });
            return false;
        }
    }

    async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
        try {
            const methods = await this.stripe.paymentMethods.list({
                customer: customerId,
                type: 'card'
            });

            return methods.data.map(pm => ({
                id: pm.id,
                providerId: pm.id,
                last4: pm.card?.last4 || '****',
                brand: pm.card?.brand || 'unknown',
                expMonth: pm.card?.exp_month || 0,
                expYear: pm.card?.exp_year || 0,
                cardholderName: pm.billing_details?.name || undefined
            }));
        } catch (error: any) {
            logger.error('List methods error', { error: error.message });
            return [];
        }
    }

    /**
     * Get or create Stripe customer ID for a user
     * In production, this should look up from database first
     */
    private async getOrCreateStripeCustomer(userId: string): Promise<string> {
        // This would normally check the stripe_customers table first
        // For now, create a new customer (deduplication handled by DB constraint)
        return this.createCustomer(userId);
    }
}
