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

export class StripePaymentProvider implements PaymentGateway {
    readonly providerName = 'stripe';
    private stripe: Stripe;

    constructor(secretKey: string) {
        this.stripe = new Stripe(secretKey, {
            apiVersion: '2025-12-15.clover',
            typescript: true,
        });

        const isTestMode = secretKey.startsWith('sk_test_');
        console.log(`[Stripe] Initialized in ${isTestMode ? 'TEST' : 'LIVE'} mode`);
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

            console.log(`[Stripe] Created intent: ${intent.id} for ${options.amount} ${options.currency}`);

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            console.error('[Stripe] Create intent error:', error.message);
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

            console.log(`[Stripe] Confirmed intent: ${intent.id} -> ${intent.status}`);

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            console.error('[Stripe] Confirm error:', error.message);
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

            console.log(`[Stripe] Captured: ${intent.id}`);

            return {
                id: intent.id,
                clientSecret: intent.client_secret || '',
                amount: intent.amount / 100,
                currency: intent.currency.toUpperCase(),
                status: this.mapStripeStatus(intent.status),
                metadata: intent.metadata as Record<string, any>
            };
        } catch (error: any) {
            console.error('[Stripe] Capture error:', error.message);
            throw new Error(`Payment capture failed: ${error.message}`);
        }
    }

    async cancelPaymentIntent(intentId: string): Promise<boolean> {
        try {
            await this.stripe.paymentIntents.cancel(intentId);
            console.log(`[Stripe] Cancelled: ${intentId}`);
            return true;
        } catch (error: any) {
            console.error('[Stripe] Cancel error:', error.message);
            return false;
        }
    }

    async refundPayment(intentId: string, amount?: number, reason?: string): Promise<RefundResult> {
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

            const refund = await this.stripe.refunds.create(params);

            console.log(`[Stripe] Refund created: ${refund.id} for ${refund.amount / 100}`);

            return {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status === 'succeeded' ? 'succeeded' : 'pending'
            };
        } catch (error: any) {
            console.error('[Stripe] Refund error:', error.message);
            throw new Error(`Refund failed: ${error.message}`);
        }
    }

    async getPaymentStatus(intentId: string): Promise<PaymentStatus> {
        try {
            const intent = await this.stripe.paymentIntents.retrieve(intentId);
            return this.mapStripeStatus(intent.status);
        } catch (error: any) {
            console.error('[Stripe] Get status error:', error.message);
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

            console.log(`[Stripe] Created customer: ${customer.id} for user ${userId}`);
            return customer.id;
        } catch (error: any) {
            console.error('[Stripe] Create customer error:', error.message);
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

            console.log(`[Stripe] Attached method ${pm.id} to customer ${customerId}`);

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
            console.error('[Stripe] Attach method error:', error.message);
            throw new Error(`Failed to save card: ${error.message}`);
        }
    }

    async detachPaymentMethod(paymentMethodId: string): Promise<boolean> {
        try {
            await this.stripe.paymentMethods.detach(paymentMethodId);
            console.log(`[Stripe] Detached method ${paymentMethodId}`);
            return true;
        } catch (error: any) {
            console.error('[Stripe] Detach method error:', error.message);
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
            console.error('[Stripe] List methods error:', error.message);
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
