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
import logger from '../../utils/logger';
import { EscrowService } from '../escrow.service';

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
    private escrowService: EscrowService;

    constructor(pool: Pool, providerType?: 'stripe' | 'mock') {
        this.pool = pool;
        this.escrowService = new EscrowService(pool);

        // Select provider based on config or environment
        const type = providerType || process.env.PAYMENT_PROVIDER || 'mock';

        if (type === 'stripe') {
            const secretKey = process.env.STRIPE_SECRET_KEY!;
            if (!secretKey) {
                logger.warn('No Stripe key, falling back to Mock');
                this.provider = new MockPaymentProvider();
            } else {
                this.provider = new StripePaymentProvider(secretKey);
            }
        } else {
            this.provider = new MockPaymentProvider();
        }

        logger.info('Payment provider initialized', { provider: this.provider.providerName });
    }

    /**
     * Create deposit intent for delivery fee
     * Called when customer confirms order
     */
    async createDeliveryFeeDeposit(
        orderId: string,
        customerId: string,
        deliveryFee: number,
        currency: string = 'QAR',
        loyaltyDiscount: number = 0
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

            // Update order with deposit info and loyalty discount in ONE ATOMIC MOVE
            if (loyaltyDiscount > 0) {
                // Get current part price to calculate new total
                const orderData = await client.query('SELECT part_price FROM orders WHERE order_id = $1', [orderId]);
                const partPrice = parseFloat(orderData.rows[0]?.part_price || 0);
                const newTotal = deliveryFee + Math.max(0, partPrice - loyaltyDiscount);

                await client.query(`
                    UPDATE orders 
                    SET deposit_amount = $2, 
                        deposit_status = 'pending',
                        payment_method = 'card',
                        loyalty_discount = $3,
                        total_amount = $4,
                        updated_at = NOW()
                    WHERE order_id = $1
                `, [orderId, deliveryFee, loyaltyDiscount, newTotal]);
            } else {
                await client.query(`
                    UPDATE orders 
                    SET deposit_amount = $2, 
                        deposit_status = 'pending',
                        payment_method = 'card',
                        updated_at = NOW()
                    WHERE order_id = $1
                `, [orderId, deliveryFee]);
            }

            await client.query('COMMIT');

            logger.info('Created deposit intent', { intentId: intent.id, orderId, amount: deliveryFee, currency });

            return {
                intentId: String(intent.id),
                clientSecret: String(intent.clientSecret || ''),
                amount: Number(deliveryFee),
                currency: String(currency),
                status: String(intent.status || 'pending')
            };
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            logger.error('Deposit service error', { error: (error as Error).message, orderId });
            throw error;
        } finally {
            client.release();
        }
    }

    async cancelPaymentIntent(providerIntentId: string): Promise<void> {
        try {
            await this.provider.cancelPaymentIntent(providerIntentId);
            logger.info('Cancelled payment intent', { providerIntentId });
        } catch (err) {
            logger.warn('Cancel payment intent failed', { providerIntentId, error: (err as Error).message });
            throw err;
        }
    }

    /**
     * Create full payment intent (Part Price + Delivery Fee)
     * Scenario B: Customer pays everything upfront, no COD
     */
    async createFullPaymentIntent(
        orderId: string,
        customerId: string,
        totalAmount: number,
        partPrice: number,
        deliveryFee: number,
        currency: string = 'QAR',
        loyaltyDiscount: number = 0
    ): Promise<DepositResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Create payment intent for full amount
            const intent = await this.provider.createPaymentIntent({
                amount: totalAmount,
                currency,
                customerId,
                orderId,
                description: `QScrap Full Payment - Order ${orderId}`,
                metadata: {
                    type: 'full_payment',
                    orderId,
                    customerId,
                    partPrice: partPrice.toString(),
                    deliveryFee: deliveryFee.toString(),
                    loyaltyDiscount: loyaltyDiscount.toString()
                }
            });

            // Store in database with intent_type = 'full'
            await client.query(`
                INSERT INTO payment_intents 
                (intent_id, order_id, customer_id, amount, currency, intent_type, provider, provider_intent_id, provider_client_secret, status)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, 'full', $5, $6, $7, $8)
            `, [orderId, customerId, totalAmount, currency, this.provider.providerName, intent.id, intent.clientSecret, intent.status]);

            // Update order with full payment info and loyalty discount in ONE ATOMIC MOVE
            await client.query(`
                UPDATE orders 
                SET deposit_amount = $2, 
                    deposit_status = 'pending',
                    payment_method = 'card_full',
                    loyalty_discount = $3,
                    total_amount = $4,
                    updated_at = NOW()
                WHERE order_id = $1
            `, [orderId, deliveryFee, loyaltyDiscount, totalAmount]);

            await client.query('COMMIT');

            logger.info('Created full payment intent', { intentId: intent.id, orderId, amount: totalAmount, currency });

            return {
                intentId: String(intent.id),
                clientSecret: String(intent.clientSecret || ''),
                amount: Number(totalAmount),
                currency: String(currency),
                status: String(intent.status || 'pending')
            };
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            logger.error('Full payment service error', { error: (error as Error).message, orderId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Confirm deposit payment succeeded
     * Called via webhook or after client-side confirmation
     * KEY: This also confirms the order (pending_payment → confirmed)
     * For full payments (intent_type='full'), also sets payment_status='paid'
     */
    async confirmDepositPayment(providerIntentId: string): Promise<boolean> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Get payment status from provider
            const status = await this.provider.getPaymentStatus(providerIntentId);

            if (status !== 'succeeded') {
                logger.info('Intent not succeeded', { providerIntentId, status });
                return false;
            }

            // Update payment intent
            await client.query(`
                UPDATE payment_intents 
                SET status = 'succeeded', updated_at = NOW()
                WHERE provider_intent_id = $1
            `, [providerIntentId]);

            // Get order details AND intent type for correct status updates
            const orderResult = await client.query(`
                SELECT o.order_id, o.order_number, o.customer_id, o.garage_id, 
                       o.total_amount, o.delivery_fee, o.commission_rate, o.platform_fee, o.garage_payout_amount,
                       pr.part_description,
                       pi.intent_type, pi.amount as payment_amount
                FROM orders o
                JOIN payment_intents pi ON pi.order_id = o.order_id
                LEFT JOIN part_requests pr ON o.request_id = pr.request_id
                WHERE pi.provider_intent_id = $1
            `, [providerIntentId]);

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found for payment intent');
            }

            const order = orderResult.rows[0];
            const isFullPayment = order.intent_type === 'full';

            // Update order: deposit status = paid, order status = confirmed
            // For FULL payments, also set payment_status = 'paid'
            if (isFullPayment) {
                await client.query(`
                    UPDATE orders 
                    SET deposit_status = 'paid',
                        payment_status = 'paid',
                        order_status = 'confirmed',
                        updated_at = NOW()
                    WHERE order_id = $1
                `, [order.order_id]);
                logger.info('Full payment confirmed', { orderNumber: order.order_number, paymentStatus: 'paid' });
            } else {
                await client.query(`
                    UPDATE orders 
                    SET deposit_status = 'paid',
                        order_status = 'confirmed',
                        updated_at = NOW()
                    WHERE order_id = $1
                `, [order.order_id]);
                logger.info('Deposit confirmed', { orderNumber: order.order_number, status: 'confirmed' });
            }

            // Add to order status history
            const reason = isFullPayment
                ? 'Full payment confirmed (part + delivery)'
                : 'Delivery fee payment confirmed';
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, 'pending_payment', 'confirmed', $2, 'system', $3)
            `, [order.order_id, order.customer_id, reason]);

            await client.query('COMMIT');

            // Send notifications to garage (async, don't block)
            this.notifyGarageOfConfirmedOrder(order).catch(err =>
                logger.error('Notification error', { error: (err as Error).message })
            );

            // Create escrow record (async, best-effort to avoid blocking payment)
            this.ensureEscrowForOrder(order).catch(err =>
                logger.error('Escrow creation failed', { error: (err as Error).message, orderId: order.order_id })
            );

            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Notify garage that order is confirmed after payment
     */
    private async notifyGarageOfConfirmedOrder(order: any): Promise<void> {
        try {
            const { createNotification } = await import('../notification.service');
            const { emitToGarage } = await import('../../utils/socketIO');
            const { pushService } = await import('../push.service');

            // Push notification
            await pushService.sendToUser(
                order.garage_id,
                '🎉 Order Confirmed!',
                `Order #${order.order_number} is confirmed. Customer paid delivery fee. Start preparing!`,
                {
                    type: 'order_confirmed',
                    orderId: order.order_id,
                    orderNumber: order.order_number,
                },
                { channelId: 'orders', sound: true }
            );

            // In-app notification
            await createNotification({
                userId: order.garage_id,
                type: 'order_confirmed',
                title: 'Order Confirmed! 🎉',
                message: `Order #${order.order_number} is confirmed and paid. Please start preparing the part.`,
                data: {
                    order_id: order.order_id,
                    order_number: order.order_number,
                },
                target_role: 'garage'
            });

            // Socket emit
            emitToGarage(order.garage_id, 'order_confirmed', {
                order_id: order.order_id,
                order_number: order.order_number,
                status: 'confirmed'
            });

        } catch (err) {
            logger.error('Garage notification failed', { error: (err as Error).message });
        }
    }

    /**
    * Ensure an escrow transaction exists for the order.
    * Best-effort: logs errors but does not block payment confirmation.
    */
    private async ensureEscrowForOrder(order: any): Promise<void> {
        try {
            const existing = await this.escrowService.getEscrowByOrder(order.order_id);
            if (existing) return;

            const deliveryFee = parseFloat(order.delivery_fee || 0);
            const totalAmount = parseFloat(order.total_amount || order.payment_amount || 0);
            const partPrice = order.part_price !== undefined && order.part_price !== null
                ? parseFloat(order.part_price)
                : (Number.isFinite(totalAmount) ? totalAmount - deliveryFee : 0);
            const amount = Number.isFinite(partPrice) ? Math.max(0, partPrice) : 0;
            const platformFeePercent = order.commission_rate
                ? parseFloat(order.commission_rate) * 100
                : 0;

            if (Number.isNaN(amount) || amount <= 0) {
                logger.warn('Escrow skipped due to invalid amount', { orderId: order.order_id, amount });
                return;
            }

            await this.escrowService.createEscrow({
                orderId: order.order_id,
                customerId: order.customer_id,
                sellerId: order.garage_id,
                amount,
                platformFeePercent,
                deliveryFee,
                inspectionWindowHours: 48,
            });
            logger.info('Escrow created for order', { orderId: order.order_id, amount });
        } catch (err) {
            logger.error('ensureEscrowForOrder failed', { error: (err as Error).message, orderId: order.order_id });
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

                logger.info('No refund - full fee retained', { orderId, depositAmount });

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

            logger.info('Refund processed', { orderId, refundAmount, feeRetained: feeToRetain });

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
