/**
 * Payment Service
 * Orchestrates payment operations with provider-agnostic architecture
 * 
 * Business Model: Delivery Fee Upfront
 * - Customer pays delivery fee at checkout (via card)
 * - Part cost is Cash on Delivery
 * - Cancellation: delivery fee retained/refunded based on status
 */

import { Pool } from 'pg';
import { PaymentGateway, PaymentIntent, PaymentMethod, PaymentStatus, CreatePaymentOptions } from './payment-gateway.interface';
import { StripePaymentProvider } from './stripe.provider';
import { MockPaymentProvider } from './mock.provider';

export interface DepositResult {
    intentId: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
}

export interface CancellationRefundResult {
    refundId?: string;
    refundAmount: number;
    feeRetained: number;
    status: 'refunded' | 'partial_refund' | 'no_refund' | 'not_applicable';
}

export class PaymentService {
    private provider: PaymentGateway;
    private pool: Pool;

    constructor(pool: Pool, providerType?: 'stripe' | 'mock') {
        this.pool = pool;

        // Select provider based on config or environment
        const type = providerType || process.env.PAYMENT_PROVIDER || 'mock';

        if (type === 'stripe') {
            const secretKey = process.env.STRIPE_SECRET_KEY;
            if (!secretKey) {
                console.warn('[PaymentService] No Stripe key, falling back to Mock');
                this.provider = new MockPaymentProvider();
            } else {
                this.provider = new StripePaymentProvider(secretKey);
            }
        } else {
            this.provider = new MockPaymentProvider();
        }

        console.log(`[PaymentService] Using provider: ${this.provider.providerName}`);
    }

    /**
     * Create deposit intent for delivery fee
     * Called when customer confirms order
     */
    async createDeliveryFeeDeposit(
        orderId: string,
        customerId: string,
        deliveryFee: number,
        currency: string = 'QAR'
    ): Promise<DepositResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Create payment intent
            const intent = await this.provider.createPaymentIntent({
                amount: deliveryFee,
                currency,
                customerId,
                orderId,
                description: `QScrap Delivery Fee - Order ${orderId}`,
                metadata: {
                    type: 'delivery_fee_deposit',
                    orderId,
                    customerId
                }
            });

            // Store in database
            await client.query(`
                INSERT INTO payment_intents 
                (intent_id, order_id, customer_id, amount, currency, intent_type, provider, provider_intent_id, provider_client_secret, status)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, 'deposit', $5, $6, $7, $8)
            `, [orderId, customerId, deliveryFee, currency, this.provider.providerName, intent.id, intent.clientSecret, intent.status]);

            // Update order with deposit info
            await client.query(`
                UPDATE orders 
                SET deposit_amount = $2, 
                    deposit_status = 'pending',
                    payment_method = 'card'
                WHERE order_id = $1
            `, [orderId, deliveryFee]);

            await client.query('COMMIT');

            console.log(`[PaymentService] Created deposit intent ${intent.id} for order ${orderId}: ${deliveryFee} ${currency}`);

            return {
                intentId: intent.id,
                clientSecret: intent.clientSecret,
                amount: deliveryFee,
                currency,
                status: intent.status
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Confirm deposit payment succeeded
     * Called via webhook or after client-side confirmation
     */
    async confirmDepositPayment(providerIntentId: string): Promise<boolean> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Get payment status from provider
            const status = await this.provider.getPaymentStatus(providerIntentId);

            if (status !== 'succeeded') {
                console.log(`[PaymentService] Intent ${providerIntentId} not succeeded: ${status}`);
                return false;
            }

            // Update payment intent
            await client.query(`
                UPDATE payment_intents 
                SET status = 'succeeded', updated_at = NOW()
                WHERE provider_intent_id = $1
            `, [providerIntentId]);

            // Update order deposit status
            await client.query(`
                UPDATE orders o
                SET deposit_status = 'paid'
                FROM payment_intents pi
                WHERE pi.provider_intent_id = $1 
                AND pi.order_id = o.order_id
            `, [providerIntentId]);

            await client.query('COMMIT');

            console.log(`[PaymentService] Deposit confirmed for intent ${providerIntentId}`);
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Process refund for order cancellation
     * Refund amount based on cancellation timing
     */
    async processCancellationRefund(
        orderId: string,
        feeToRetain: number,
        reason: string = 'cancellation'
    ): Promise<CancellationRefundResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Get order deposit info
            const orderResult = await client.query(`
                SELECT o.deposit_amount, o.deposit_status, pi.provider_intent_id, pi.intent_id
                FROM orders o
                LEFT JOIN payment_intents pi ON pi.order_id = o.order_id AND pi.intent_type = 'deposit'
                WHERE o.order_id = $1
            `, [orderId]);

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = orderResult.rows[0];

            // No deposit was paid - nothing to refund
            if (order.deposit_status !== 'paid' || !order.provider_intent_id) {
                await client.query('COMMIT');
                return {
                    refundAmount: 0,
                    feeRetained: 0,
                    status: 'not_applicable'
                };
            }

            const depositAmount = parseFloat(order.deposit_amount);
            const refundAmount = Math.max(0, depositAmount - feeToRetain);

            // Full retention - no refund needed
            if (refundAmount <= 0) {
                await client.query(`
                    UPDATE orders SET deposit_status = 'retained' WHERE order_id = $1
                `, [orderId]);

                await client.query('COMMIT');

                console.log(`[PaymentService] No refund for order ${orderId}: full fee retained (${depositAmount})`);

                return {
                    refundAmount: 0,
                    feeRetained: depositAmount,
                    status: 'no_refund'
                };
            }

            // Process partial or full refund
            const refundResult = await this.provider.refundPayment(
                order.provider_intent_id,
                refundAmount,
                reason
            );

            // Store refund record
            await client.query(`
                INSERT INTO payment_refunds 
                (intent_id, order_id, amount, reason, provider_refund_id, status, processed_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [order.intent_id, orderId, refundAmount, reason, refundResult.id, refundResult.status]);

            // Update order status
            const newDepositStatus = refundAmount < depositAmount ? 'partially_refunded' : 'refunded';
            await client.query(`
                UPDATE orders SET deposit_status = $2 WHERE order_id = $1
            `, [orderId, newDepositStatus]);

            await client.query('COMMIT');

            console.log(`[PaymentService] Refunded ${refundAmount} for order ${orderId}, retained ${feeToRetain}`);

            return {
                refundId: refundResult.id,
                refundAmount,
                feeRetained: feeToRetain,
                status: refundAmount < depositAmount ? 'partial_refund' : 'refunded'
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get or create Stripe customer for user (for saved cards)
     */
    async getOrCreateStripeCustomer(userId: string, email?: string, name?: string): Promise<string> {
        // Check if exists
        const existing = await this.pool.query(
            'SELECT stripe_customer_id FROM stripe_customers WHERE customer_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return existing.rows[0].stripe_customer_id;
        }

        // Create new
        const stripeCustomerId = await this.provider.createCustomer(userId, email, name);

        await this.pool.query(
            'INSERT INTO stripe_customers (customer_id, stripe_customer_id) VALUES ($1, $2) ON CONFLICT (customer_id) DO NOTHING',
            [userId, stripeCustomerId]
        );

        return stripeCustomerId;
    }

    /**
     * Save a payment method for customer
     */
    async savePaymentMethod(
        userId: string,
        paymentMethodId: string
    ): Promise<PaymentMethod> {
        const stripeCustomerId = await this.getOrCreateStripeCustomer(userId);
        const method = await this.provider.attachPaymentMethod(stripeCustomerId, paymentMethodId);

        // Store in database
        await this.pool.query(`
            INSERT INTO payment_methods 
            (customer_id, provider, provider_method_id, card_last4, card_brand, card_exp_month, card_exp_year, cardholder_name, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            ON CONFLICT (customer_id, provider_method_id) DO UPDATE
            SET card_last4 = $4, card_brand = $5, card_exp_month = $6, card_exp_year = $7, updated_at = NOW()
        `, [userId, this.provider.providerName, method.providerId, method.last4, method.brand, method.expMonth, method.expYear, method.cardholderName]);

        // Set as default (unset others)
        await this.pool.query(`
            UPDATE payment_methods SET is_default = false 
            WHERE customer_id = $1 AND provider_method_id != $2
        `, [userId, method.providerId]);

        return method;
    }

    /**
     * Get customer's saved payment methods
     */
    async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
        const result = await this.pool.query(`
            SELECT provider_method_id as id, provider_method_id as "providerId", 
                   card_last4 as last4, card_brand as brand, 
                   card_exp_month as "expMonth", card_exp_year as "expYear",
                   cardholder_name as "cardholderName", is_default as "isDefault"
            FROM payment_methods 
            WHERE customer_id = $1 AND is_active = true
            ORDER BY is_default DESC, created_at DESC
        `, [userId]);

        return result.rows;
    }

    /**
     * Remove a saved payment method
     */
    async removePaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
        await this.provider.detachPaymentMethod(paymentMethodId);

        await this.pool.query(`
            UPDATE payment_methods SET is_active = false, updated_at = NOW()
            WHERE customer_id = $1 AND provider_method_id = $2
        `, [userId, paymentMethodId]);

        return true;
    }

    /**
     * Get payment status for an order
     */
    async getOrderPaymentStatus(orderId: string): Promise<{
        depositAmount: number;
        depositStatus: string;
        paymentMethod: string;
    }> {
        const result = await this.pool.query(`
            SELECT deposit_amount, deposit_status, payment_method
            FROM orders WHERE order_id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            throw new Error('Order not found');
        }

        return {
            depositAmount: parseFloat(result.rows[0].deposit_amount) || 0,
            depositStatus: result.rows[0].deposit_status || 'none',
            paymentMethod: result.rows[0].payment_method || 'cod'
        };
    }
}

// Singleton instance
let paymentServiceInstance: PaymentService | null = null;

export function getPaymentService(pool: Pool): PaymentService {
    if (!paymentServiceInstance) {
        paymentServiceInstance = new PaymentService(pool);
    }
    return paymentServiceInstance;
}
