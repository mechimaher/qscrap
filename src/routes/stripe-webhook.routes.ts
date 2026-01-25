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

export default router;
