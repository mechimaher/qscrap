/**
 * Stripe Webhook Handler
 * Enterprise-grade webhook processing with signature verification and idempotency
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../../config/db';
import { SubscriptionService } from '../subscription/subscription.service';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

const subscriptionService = new SubscriptionService(pool);

/**
 * Stripe Webhook Endpoint
 * POST /webhooks/stripe
 */
router.post('/stripe', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        // Verify webhook signature (critical for security)
        event = stripe.webhooks.constructEvent(
            req.body, // Raw body required
            sig,
            webhookSecret
        );
    } catch (err: any) {
        console.error('[Webhook] Signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency check - prevent duplicate processing
    const existingEvent = await pool.query(
        'SELECT event_id FROM stripe_webhook_events WHERE event_id = $1',
        [event.id]
    );

    if (existingEvent.rows.length > 0) {
        console.log(`[Webhook] Event ${event.id} already processed, skipping`);
        return res.json({ received: true, status: 'already_processed' });
    }

    console.log(`[Webhook] Processing ${event.type}: ${event.id}`);

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                break;

            case 'setup_intent.succeeded':
                await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object as Stripe.Invoice);
                break;

            case 'customer.subscription.updated':
                // Handle Stripe subscription changes if using Stripe Billing
                console.log('[Webhook] Subscription updated:', event.data.object);
                break;

            default:
                console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }

        // Log successful processing
        await pool.query(
            `INSERT INTO stripe_webhook_events (event_id, event_type, payload, status) 
             VALUES ($1, $2, $3, 'processed')`,
            [event.id, event.type, JSON.stringify(event.data.object)]
        );

        res.json({ received: true, status: 'processed' });
    } catch (err: any) {
        console.error(`[Webhook] Error processing ${event.type}:`, err);

        // Log failed processing
        await pool.query(
            `INSERT INTO stripe_webhook_events (event_id, event_type, payload, status) 
             VALUES ($1, $2, $3, 'failed')`,
            [event.id, event.type, JSON.stringify({ error: err.message })]
        );

        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Handle successful payment intent (subscription upgrade)
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const metadata = paymentIntent.metadata;

    if (metadata.type === 'subscription_upgrade') {
        console.log(`[Webhook] Subscription upgrade payment succeeded: ${paymentIntent.id}`);

        // Confirm the upgrade payment
        const result = await subscriptionService.confirmUpgradePayment(paymentIntent.id);

        if (result.success) {
            console.log(`[Webhook] ✅ Upgrade payment auto-confirmed for request ${result.requestId}`);

            // Generate invoice
            await generateInvoice({
                garage_id: metadata.garage_id,
                request_id: result.requestId,
                amount: paymentIntent.amount / 100, // Convert from cents
                payment_intent_id: paymentIntent.id,
                plan_name: metadata.plan_name,
                payment_method: 'card'
            });
        }
    }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const metadata = paymentIntent.metadata;

    if (metadata.type === 'subscription_upgrade') {
        console.log(`[Webhook] ❌ Subscription upgrade payment failed: ${paymentIntent.id}`);

        // Update request with failed status
        await pool.query(`
            UPDATE subscription_change_requests
            SET payment_status = 'failed',
                admin_notes = COALESCE(admin_notes, '') || ' Payment failed: ' || $2,
                updated_at = NOW()
            WHERE payment_intent_id = $1
        `, [paymentIntent.id, paymentIntent.last_payment_error?.message || 'Unknown error']);
    }
}

/**
 * Handle successful setup intent (saved card)
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
    const metadata = setupIntent.metadata;
    const paymentMethodId = setupIntent.payment_method as string;

    if (metadata.garage_id) {
        console.log(`[Webhook] Setup intent succeeded, saving payment method for garage ${metadata.garage_id}`);

        // Get payment method details
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        if (paymentMethod.card) {
            // Check if this is the first payment method (make it default)
            const existingMethods = await pool.query(
                'SELECT COUNT(*) FROM garage_payment_methods WHERE garage_id = $1',
                [metadata.garage_id]
            );
            const isDefault = existingMethods.rows[0].count === '0';

            await pool.query(`
                INSERT INTO garage_payment_methods 
                (garage_id, stripe_payment_method_id, stripe_customer_id, card_last4, card_brand, card_exp_month, card_exp_year, is_default)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (stripe_payment_method_id) DO UPDATE SET updated_at = NOW()
            `, [
                metadata.garage_id,
                paymentMethodId,
                metadata.customer_id,
                paymentMethod.card.last4,
                paymentMethod.card.brand,
                paymentMethod.card.exp_month,
                paymentMethod.card.exp_year,
                isDefault
            ]);

            console.log(`[Webhook] ✅ Saved payment method ${paymentMethod.card.brand} ****${paymentMethod.card.last4}`);
        }
    }
}

/**
 * Handle paid invoice (recurring billing)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
    console.log(`[Webhook] Invoice paid: ${invoice.id}`);

    // Update subscription billing info if this is a recurring charge
    if (invoice.subscription) {
        const customerId = invoice.customer as string;

        await pool.query(`
            UPDATE garage_subscriptions gs
            SET last_billing_attempt = NOW(),
                billing_retry_count = 0,
                updated_at = NOW()
            FROM garages g
            WHERE gs.garage_id = g.garage_id 
            AND g.stripe_customer_id = $1
            AND gs.status IN ('active', 'trial')
        `, [customerId]);
    }
}

/**
 * Generate invoice record
 */
async function generateInvoice(params: {
    garage_id: string;
    request_id?: string;
    amount: number;
    payment_intent_id?: string;
    bank_reference?: string;
    plan_name: string;
    payment_method: 'card' | 'bank_transfer';
}) {
    // Generate invoice number: QS-INV-YYYYMM-XXXX
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

    console.log(`[Invoice] Generated ${invoiceNumber} for ${params.amount} QAR`);

    return invoiceNumber;
}

export default router;
export { generateInvoice };
