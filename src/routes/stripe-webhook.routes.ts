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
            console.error('[Stripe Webhook] Stripe not configured');
            return res.status(500).json({ error: 'Stripe not configured' });
        }

        if (!webhookSecret) {
            console.error('[Stripe Webhook] No webhook secret configured');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        try {
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;

                case 'payment_intent.payment_failed':
                    await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
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
                    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
            }

            res.json({ received: true });
        } catch (error: any) {
            console.error('[Stripe Webhook] Handler error:', error);
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

    console.log(`[Stripe Webhook] Payment succeeded: ${intent.id}`);

    try {
        // Find the payment intent record
        const intentResult = await pool.query(
            `SELECT pi.intent_id, pi.order_id, pi.status, o.order_status
             FROM payment_intents pi
             JOIN orders o ON o.order_id = pi.order_id
             WHERE pi.provider_intent_id = $1`,
            [intent.id]
        );

        if (intentResult.rows.length === 0) {
            console.log(`[Stripe Webhook] No matching intent found for ${intent.id}`);
            return;
        }

        const record = intentResult.rows[0];

        // Check if already confirmed (idempotent)
        if (record.status === 'succeeded' && record.order_status === 'confirmed') {
            console.log(`[Stripe Webhook] Order ${record.order_id} already confirmed (idempotent)`);
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

        console.log(`[Stripe Webhook] Order ${record.order_id} confirmed via webhook`);

        // Notify garage of confirmed order (async - don't await to prevent webhook timeout)
        notifyGarageAsync(record.order_id).catch(err =>
            console.error('[Stripe Webhook] Failed to notify garage:', err)
        );

    } catch (error) {
        console.error('[Stripe Webhook] handlePaymentSucceeded error:', error);
        throw error;
    }
}

/**
 * Handle failed payment - log for monitoring
 */
async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const pool = getWritePool();

    console.log(`[Stripe Webhook] Payment failed: ${intent.id}`, {
        error: intent.last_payment_error?.message
    });

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
    } catch (error) {
        console.error('[Stripe Webhook] handlePaymentFailed error:', error);
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

        if (orderResult.rows.length === 0) return;

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

    } catch (error) {
        console.error('[Stripe Webhook] Garage notification error:', error);
    }
}

/**
 * FIX PG-02: Handle refund status updates from Stripe
 * Syncs Stripe refund status with internal database
 */
async function handleRefundUpdate(stripeRefund: Stripe.Refund): Promise<void> {
    const pool = getWritePool();
    const { id: stripeRefundId, status, metadata, failure_reason } = stripeRefund;

    console.log(`[Stripe Webhook] Processing refund ${stripeRefundId}, status: ${status}`);

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
            console.log(`[Stripe Webhook] Updated refund ${refund.refund_id} to ${internalStatus}`);

            // If completed, update order payment_status
            if (internalStatus === 'completed') {
                await pool.query(
                    `UPDATE orders SET payment_status = 'refunded', updated_at = NOW() 
                     WHERE order_id = $1 AND payment_status != 'refunded'`,
                    [refund.order_id]
                );
                console.log(`[Stripe Webhook] Marked order ${refund.order_id} as refunded`);
            }
        } else {
            console.warn(`[Stripe Webhook] No matching refund found for Stripe refund ${stripeRefundId}`);
        }
    } catch (error) {
        console.error('[Stripe Webhook] handleRefundUpdate error:', error);
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
        console.warn('[Stripe Webhook] charge.refunded event without payment_intent');
        return;
    }

    console.log(`[Stripe Webhook] Charge refunded for payment intent: ${paymentIntentId}`);

    try {
        // Find order by payment intent
        const orderResult = await pool.query(
            `SELECT o.order_id FROM orders o
             JOIN payment_intents pi ON o.order_id = pi.order_id
             WHERE pi.provider_intent_id = $1`,
            [paymentIntentId]
        );

        if (orderResult.rows.length === 0) {
            console.warn(`[Stripe Webhook] No order found for payment intent ${paymentIntentId}`);
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
            console.log(`[Stripe Webhook] Marked refund ${refundResult.rows[0].refund_id} as completed via charge.refunded`);

            // Update order payment status
            await pool.query(
                `UPDATE orders SET payment_status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
                [orderId]
            );
        }
    } catch (error) {
        console.error('[Stripe Webhook] handleChargeRefunded error:', error);
        throw error;
    }
}

export default router;
