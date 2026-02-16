/**
 * Stripe Webhook Routes
 * Handles Stripe webhook events for self-healing payment confirmation
 * 
 * CRITICAL: This route MUST be mounted BEFORE express.json() middleware
 * because Stripe signature verification requires the raw body.
 */

import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { getWritePool } from '../config/db';
import logger from '../utils/logger';

const router = express.Router();

// Initialize Stripe only if key is configured
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, {
    apiVersion: '2025-12-15.clover',
}) : null;

/**
 * POST /api/stripe/webhook
 * Receives webhook events from Stripe
 * 
 * Key Events:
 * - payment_intent.succeeded: Auto-confirm orders
 * - payment_intent.payment_failed: Log failures
 */
router.post('/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
        const sig = req.headers['stripe-signature'] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!stripe) {
            logger.error('Stripe not configured');
            return res.status(500).json({ error: 'Stripe not configured' });
        }

        if (!webhookSecret) {
            logger.error('Stripe webhook secret not configured');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
            logger.error('Stripe signature verification failed', { error: err.message });
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        logger.info('Stripe webhook received', { eventType: event.type, eventId: event.id });

        try {
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;

                case 'payment_intent.payment_failed':
                    await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
                    break;

                // NEW: Handle SetupIntent for saved payment methods
                case 'setup_intent.succeeded':
                    await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
                    break;

                // FIX PG-02: Handle refund events for status synchronization
                case 'refund.created':
                case 'refund.updated':
                    await handleRefundUpdate(event.data.object as Stripe.Refund);
                    break;

                case 'charge.refunded':
                    await handleChargeRefunded(event.data.object as Stripe.Charge);
                    break;

                default:
                    logger.info('Stripe webhook unhandled event type', { eventType: event.type });
            }

            res.json({ received: true });
        } catch (error: any) {
            logger.error('Stripe webhook handler error', { eventType: event.type, error: error.message });
            res.status(500).json({ error: 'Webhook handler failed' });
        }

    }
);

/**
 * Handle successful payment - confirm order
 * This is the self-healing mechanism for when mobile app fails to call confirm endpoint
 */
async function handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const pool = getWritePool();

    logger.info('Payment succeeded', { intentId: intent.id });

    // NEW: Handle subscription upgrade payments
    if (intent.metadata?.type === 'subscription_upgrade') {
        await handleSubscriptionUpgradePayment(intent);
        return;
    }

    // NEW: Handle subscription renewal payments
    if (intent.metadata?.type === 'subscription_renewal') {
        await handleSubscriptionRenewalPayment(intent);
        return;
    }

    try {
        // Existing order payment logic
        const intentResult = await pool.query(
            `SELECT pi.intent_id, pi.order_id, pi.status, o.order_status
             FROM payment_intents pi
             JOIN orders o ON o.order_id = pi.order_id
             WHERE pi.provider_intent_id = $1`,
            [intent.id]
        );

        if (intentResult.rows.length === 0) {
            logger.info('No matching payment intent found', { intentId: intent.id });
            return;
        }

        const record = intentResult.rows[0];

        // Check if already confirmed (idempotent)
        if (record.status === 'succeeded' && record.order_status === 'confirmed') {
            logger.info('Order already confirmed (idempotent)', { orderId: record.order_id });
            return;
        }

        // Update payment intent status
        await pool.query(
            `UPDATE payment_intents SET status = 'succeeded', updated_at = NOW() 
             WHERE provider_intent_id = $1`,
            [intent.id]
        );

        // Update order status from pending_payment to confirmed
        await pool.query(
            `UPDATE orders 
             SET order_status = 'confirmed', 
                 deposit_status = 'paid',
                 updated_at = NOW()
             WHERE order_id = $1 AND order_status = 'pending_payment'`,
            [record.order_id]
        );

        logger.info('Order confirmed via webhook', { orderId: record.order_id });

        // Notify garage of confirmed order (async - don't await to prevent webhook timeout)
        notifyGarageAsync(record.order_id).catch(err =>
            logger.error('Failed to notify garage', { orderId: record.order_id, error: err.message })
        );

    } catch (error: any) {
        logger.error('handlePaymentSucceeded error', { intentId: intent.id, error: error.message });
        throw error;
    }
}

/**
 * NEW: Handle subscription upgrade payment success
 */
async function handleSubscriptionUpgradePayment(intent: Stripe.PaymentIntent): Promise<void> {
    const pool = getWritePool();
    const { request_id, garage_id, plan_name } = intent.metadata;

    logger.info('Subscription upgrade payment', { intentId: intent.id, requestId: request_id, garageId: garage_id });

    try {
        // Update subscription_change_request payment status
        const result = await pool.query(`
            UPDATE subscription_change_requests
            SET payment_status = 'paid',
                payment_intent_id = $1,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE request_id = $2 AND payment_status != 'paid'
            RETURNING request_id, garage_id, to_plan_id
        `, [intent.id, request_id]);

        if (result.rows.length === 0) {
            logger.info('Subscription request already marked paid (idempotent)', { requestId: request_id });
            return;
        }

        // Generate invoice
        await generateSubscriptionInvoice(pool, {
            garage_id: garage_id || result.rows[0].garage_id,
            request_id,
            amount: intent.amount / 100,
            payment_intent_id: intent.id,
            plan_name,
            payment_method: 'card'
        });

        // ==========================================
        // NEW: Auto-Execute Subscription Upgrade
        // ==========================================

        const effectiveGarageId = garage_id || result.rows[0].garage_id;

        // 1. Deactivate current active subscription
        await pool.query(`
            UPDATE garage_subscriptions
            SET status = 'upgraded',
                updated_at = NOW()
            WHERE garage_id = $1 AND status = 'active'
        `, [effectiveGarageId]);

        // 2. Create new active subscription
        const today = new Date();
        const cycleEnd = new Date(today);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);
        const planId = result.rows[0].to_plan_id; // retrieved from RETURNING clause

        await pool.query(`
            INSERT INTO garage_subscriptions 
            (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, next_billing_date) 
            VALUES ($1, $2, 'active', $3, $4, $4)
        `, [effectiveGarageId, planId, today, cycleEnd]);

        // 3. Mark request as completed
        await pool.query(`
            UPDATE subscription_change_requests
            SET status = 'completed',
                updated_at = NOW(),
                admin_notes = 'Auto-upgraded via Stripe Webhook'
            WHERE request_id = $1
        `, [request_id]);

        // ==========================================

        logger.info('Subscription upgrade payment confirmed & executed', { garageId: effectiveGarageId, planName: plan_name });
    } catch (error: any) {
        logger.error('handleSubscriptionUpgradePayment error', { intentId: intent.id, error: error.message });
        throw error;
    }
}

/**
 * NEW: Handle recurring subscription renewal payment
 */
async function handleSubscriptionRenewalPayment(intent: Stripe.PaymentIntent): Promise<void> {
    const pool = getWritePool();
    const { subscription_id, garage_id, plan_name } = intent.metadata;

    logger.info('Subscription renewal payment', { intentId: intent.id, subscriptionId: subscription_id });

    try {
        // Extend subscription by 1 month
        await pool.query(`
            UPDATE garage_subscriptions 
            SET billing_cycle_start = billing_cycle_end,
                billing_cycle_end = billing_cycle_end + INTERVAL '1 month',
                next_billing_date = billing_cycle_end + INTERVAL '1 month',
                renewal_reminder_sent = false,
                billing_retry_count = 0,
                last_billing_attempt = NOW(),
                updated_at = NOW()
            WHERE subscription_id = $1
        `, [subscription_id]);

        // Generate invoice
        await generateSubscriptionInvoice(pool, {
            garage_id,
            amount: intent.amount / 100,
            payment_intent_id: intent.id,
            plan_name,
            payment_method: 'card'
        });

        logger.info('Subscription renewal confirmed, extended 1 month', { subscriptionId: subscription_id });
    } catch (error: any) {
        logger.error('handleSubscriptionRenewalPayment error', { intentId: intent.id, error: error.message });
        throw error;
    }
}

/**
 * NEW: Handle SetupIntent succeeded - save payment method
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
    const pool = getWritePool();
    const metadata = setupIntent.metadata || {};
    const garage_id = metadata.garage_id;
    const customer_id = metadata.customer_id;
    const paymentMethodId = setupIntent.payment_method as string;

    if (!garage_id || !paymentMethodId) {
        logger.warn('SetupIntent missing garage_id or payment_method', { setupIntentId: setupIntent.id });
        return;
    }

    logger.info('SetupIntent succeeded', { garageId: garage_id, paymentMethodId });

    try {
        // Get payment method details from Stripe
        const paymentMethod = await stripe?.paymentMethods.retrieve(paymentMethodId);

        if (!paymentMethod?.card) {
            logger.warn('SetupIntent has no card details', { paymentMethodId });
            return;
        }

        // Check if first payment method
        const existing = await pool.query(
            'SELECT COUNT(*) FROM garage_payment_methods WHERE garage_id = $1',
            [garage_id]
        );
        const isDefault = existing.rows[0].count === '0';

        // Save payment method
        await pool.query(`
            INSERT INTO garage_payment_methods 
            (garage_id, stripe_payment_method_id, stripe_customer_id, card_last4, card_brand, card_exp_month, card_exp_year, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (stripe_payment_method_id) DO UPDATE SET updated_at = NOW()
        `, [
            garage_id,
            paymentMethodId,
            customer_id,
            paymentMethod.card.last4,
            paymentMethod.card.brand,
            paymentMethod.card.exp_month,
            paymentMethod.card.exp_year,
            isDefault
        ]);

        logger.info('Payment method saved', { brand: paymentMethod.card.brand, last4: paymentMethod.card.last4 });
    } catch (error: any) {
        logger.error('handleSetupIntentSucceeded error', { setupIntentId: setupIntent.id, error: error.message });
        throw error;
    }
}

/**
 * Generate invoice for subscription payment
 */
async function generateSubscriptionInvoice(pool: any, params: {
    garage_id: string;
    request_id?: string;
    amount: number;
    payment_intent_id?: string;
    bank_reference?: string;
    plan_name: string;
    payment_method: 'card' | 'bank_transfer';
}) {
    try {
        const date = new Date();
        const prefix = `QS-INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
        const seqResult = await pool.query("SELECT nextval('invoice_number_seq')");
        const invoiceNumber = `${prefix}-${String(seqResult.rows[0].nextval).padStart(4, '0')}`;

        await pool.query(`
            INSERT INTO subscription_invoices 
            (invoice_number, garage_id, request_id, amount, plan_name, payment_method, payment_intent_id, bank_reference, status, paid_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid', NOW())
        `, [
            invoiceNumber,
            params.garage_id,
            params.request_id,
            params.amount,
            params.plan_name,
            params.payment_method,
            params.payment_intent_id,
            params.bank_reference
        ]);

        logger.info('Invoice generated', { invoiceNumber, amount: params.amount });
        return invoiceNumber;
    } catch (error: any) {
        logger.error('Invoice generation failed', { garageId: params.garage_id, error: error.message });
        // Don't throw - invoice failure shouldn't block payment confirmation
    }
}

/**
 * Handle failed payment - log for monitoring
 */
async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const pool = getWritePool();

    logger.warn('Payment failed', { intentId: intent.id, error: intent.last_payment_error?.message });

    try {
        // Update payment intent status
        await pool.query(
            `UPDATE payment_intents 
             SET status = 'failed', 
                 failure_reason = $2,
                 updated_at = NOW() 
             WHERE provider_intent_id = $1`,
            [intent.id, intent.last_payment_error?.message || 'Payment declined']
        );
    } catch (error: any) {
        logger.error('handlePaymentFailed error', { intentId: intent.id, error: error.message });
        throw error;
    }
}

/**
 * Notify garage of confirmed order (async helper)
 */
async function notifyGarageAsync(orderId: string): Promise<void> {
    try {
        const pool = getWritePool();

        // Get order details for notification
        const orderResult = await pool.query(
            `SELECT o.*, g.user_id as garage_user_id 
             FROM orders o
             JOIN garages g ON g.garage_id = o.garage_id
             WHERE o.order_id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {return;}

        const order = orderResult.rows[0];

        // Create in-app notification for garage
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, data, created_at)
             VALUES ($1, 'new_order', 'New Paid Order!', $2, $3, NOW())`,
            [
                order.garage_user_id,
                `Order #${order.order_number} has been confirmed and paid. Please prepare the part for collection.`,
                JSON.stringify({ order_id: orderId, order_number: order.order_number })
            ]
        );

        // Socket notification handled separately via notification service
        // The in-app notification created above will be pushed via polling

    } catch (error: any) {
        logger.error('Garage notification error', { orderId, error: error.message });
    }
}

/**
 * FIX PG-02: Handle refund status updates from Stripe
 * Syncs Stripe refund status with internal database
 */
async function handleRefundUpdate(stripeRefund: Stripe.Refund): Promise<void> {
    const pool = getWritePool();
    const { id: stripeRefundId, status, metadata, failure_reason } = stripeRefund;

    logger.info('Processing refund', { stripeRefundId, status });

    // Map Stripe status to internal status
    let internalStatus: string;
    switch (status) {
        case 'succeeded':
            internalStatus = 'completed';
            break;
        case 'pending':
            internalStatus = 'processing';
            break;
        case 'failed':
        case 'canceled':
            internalStatus = 'failed';
            break;
        default:
            internalStatus = 'processing';
    }

    const orderId = metadata?.order_id;

    try {
        // Update refund record by stripe_refund_id or pending refund for order
        const updateResult = await pool.query(
            `UPDATE refunds SET 
                refund_status = $1,
                stripe_refund_status = $2,
                stripe_refund_id = COALESCE(stripe_refund_id, $3),
                last_synced_at = NOW(),
                processed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE processed_at END,
                refund_reason = CASE WHEN $4 IS NOT NULL 
                    THEN COALESCE(refund_reason, '') || ' [Stripe: ' || $4 || ']' 
                    ELSE refund_reason END
             WHERE stripe_refund_id = $3 
                OR (order_id = $5 AND stripe_refund_id IS NULL AND refund_status IN ('pending', 'processing'))
             RETURNING refund_id, order_id`,
            [internalStatus, status, stripeRefundId, failure_reason, orderId]
        );

        if (updateResult.rows.length > 0) {
            const refund = updateResult.rows[0];
            logger.info('Refund updated', { refundId: refund.refund_id, status: internalStatus });

            // If completed, update order payment_status
            if (internalStatus === 'completed') {
                await pool.query(
                    `UPDATE orders SET payment_status = 'refunded', updated_at = NOW() 
                     WHERE order_id = $1 AND payment_status != 'refunded'`,
                    [refund.order_id]
                );
                logger.info('Order marked as refunded', { orderId: refund.order_id });
            }
        } else {
            logger.warn('No matching refund found', { stripeRefundId });
        }
    } catch (error: any) {
        logger.error('handleRefundUpdate error', { stripeRefundId, error: error.message });
        throw error;
    }
}

/**
 * Handle charge.refunded event
 * Updates refund when charge is refunded (alternative to refund.updated)
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const pool = getWritePool();

    const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
        logger.warn('charge.refunded event without payment_intent', { chargeId: charge.id });
        return;
    }

    logger.info('Charge refunded', { paymentIntentId });

    try {
        // Find order by payment intent
        const orderResult = await pool.query(
            `SELECT o.order_id FROM orders o
             JOIN payment_intents pi ON o.order_id = pi.order_id
             WHERE pi.provider_intent_id = $1`,
            [paymentIntentId]
        );

        if (orderResult.rows.length === 0) {
            logger.warn('No order found for payment intent', { paymentIntentId });
            return;
        }

        const orderId = orderResult.rows[0].order_id;

        // Mark pending/processing refund as completed
        const refundResult = await pool.query(
            `UPDATE refunds SET 
                refund_status = 'completed',
                last_synced_at = NOW(),
                processed_at = NOW()
             WHERE order_id = $1 
               AND refund_status IN ('pending', 'processing')
             RETURNING refund_id`,
            [orderId]
        );

        if (refundResult.rows.length > 0) {
            logger.info('Refund marked completed via charge.refunded', { refundId: refundResult.rows[0].refund_id });

            // Update order payment status
            await pool.query(
                `UPDATE orders SET payment_status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
                [orderId]
            );
        }
    } catch (error: any) {
        logger.error('handleChargeRefunded error', { paymentIntentId, error: error.message });
        throw error;
    }
}

export default router;
