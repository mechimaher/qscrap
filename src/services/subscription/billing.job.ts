/**
 * Subscription Billing Job
 * Enterprise-grade recurring billing with retry logic and notifications
 */

import { Pool } from 'pg';
import Stripe from 'stripe';
import { InvoiceService } from './invoice.service';
import logger from '../../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

export class SubscriptionBillingJob {
    private invoiceService: InvoiceService;

    constructor(private pool: Pool) {
        this.invoiceService = new InvoiceService(pool);
    }

    /**
     * Process all subscriptions due for renewal
     * Run daily via cron: 0 6 * * * (6 AM Qatar time)
     */
    async processRenewals() {
        logger.info('Starting subscription renewal processing');

        // Get subscriptions due for renewal within next 24 hours
        const dueSubscriptions = await this.pool.query(`
            SELECT 
                gs.subscription_id, gs.garage_id, gs.billing_cycle_end, gs.auto_renew,
                g.garage_name, g.stripe_customer_id,
                sp.plan_id, sp.plan_name, sp.monthly_fee,
                u.email, u.phone_number,
                gpm.stripe_payment_method_id, gpm.card_last4
            FROM garage_subscriptions gs
            JOIN garages g ON gs.garage_id = g.garage_id
            JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_payment_methods gpm ON g.garage_id = gpm.garage_id AND gpm.is_default = true
            WHERE gs.status = 'active'
            AND gs.auto_renew = true
            AND gs.billing_cycle_end <= NOW() + INTERVAL '1 day'
            AND (gs.last_billing_attempt IS NULL OR gs.last_billing_attempt < NOW() - INTERVAL '1 day')
            AND gs.billing_retry_count < 3
            ORDER BY gs.billing_cycle_end ASC
        `);

        logger.info('Found subscriptions due for renewal', { count: dueSubscriptions.rows.length });

        for (const sub of dueSubscriptions.rows) {
            try {
                await this.processSubscriptionRenewal(sub);
            } catch (err) {
                logger.error('Error processing subscription', { garage: sub.garage_name, error: (err as Error).message });
            }
        }

        logger.info('Renewal processing complete');
    }

    /**
     * Process a single subscription renewal
     */
    private async processSubscriptionRenewal(sub: any) {
        const amount = parseFloat(sub.monthly_fee);

        // Skip free plans
        if (amount <= 0) {
            await this.extendSubscription(sub.subscription_id, sub.garage_name);
            return;
        }

        // Check if has saved payment method
        if (!sub.stripe_payment_method_id || !sub.stripe_customer_id) {
            logger.info('No saved payment method, sending reminder', { garage: sub.garage_name });
            await this.sendPaymentReminder(sub, 'no_payment_method');
            return;
        }

        logger.info('Charging subscription', { garage: sub.garage_name, amount });

        try {
            // Create and confirm payment intent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency: 'qar',
                customer: sub.stripe_customer_id,
                payment_method: sub.stripe_payment_method_id,
                confirm: true,
                off_session: true,
                metadata: {
                    type: 'subscription_renewal',
                    subscription_id: sub.subscription_id,
                    garage_id: sub.garage_id,
                    plan_name: sub.plan_name
                },
                description: `QScrap ${sub.plan_name} - Monthly Renewal`
            });

            if (paymentIntent.status === 'succeeded') {
                logger.info('Payment succeeded', { garage: sub.garage_name });

                // Extend subscription
                await this.extendSubscription(sub.subscription_id, sub.garage_name);

                // Generate invoice
                await this.invoiceService.createInvoice({
                    garage_id: sub.garage_id,
                    subscription_id: sub.subscription_id,
                    amount,
                    plan_name: sub.plan_name,
                    payment_method: 'card',
                    payment_intent_id: paymentIntent.id,
                    status: 'paid'
                });

                // Reset retry count
                await this.pool.query(`
                    UPDATE garage_subscriptions 
                    SET last_billing_attempt = NOW(), billing_retry_count = 0 
                    WHERE subscription_id = $1
                `, [sub.subscription_id]);
            } else {
                throw new Error(`Payment status: ${paymentIntent.status}`);
            }
        } catch (err: any) {
            logger.error('Payment failed', { garage: sub.garage_name, error: err.message });

            // Increment retry count
            await this.pool.query(`
                UPDATE garage_subscriptions 
                SET last_billing_attempt = NOW(), 
                    billing_retry_count = billing_retry_count + 1 
                WHERE subscription_id = $1
            `, [sub.subscription_id]);

            // Send payment failed notification
            await this.sendPaymentReminder(sub, 'payment_failed');
        }
    }

    /**
     * Extend subscription by 1 month
     */
    private async extendSubscription(subscriptionId: string, garageName: string) {
        await this.pool.query(`
            UPDATE garage_subscriptions 
            SET billing_cycle_start = billing_cycle_end,
                billing_cycle_end = billing_cycle_end + INTERVAL '1 month',
                next_billing_date = billing_cycle_end + INTERVAL '1 month',
                renewal_reminder_sent = false,
                bids_used_this_cycle = 0,
                updated_at = NOW()
            WHERE subscription_id = $1
        `, [subscriptionId]);

        logger.info('Extended subscription', { garage: garageName });
    }

    /**
     * Send renewal/payment reminders
     * Run daily: 0 9 * * * (9 AM Qatar time)
     */
    async sendRenewalReminders() {
        logger.info('Sending renewal reminders');

        // 7 days before expiry
        await this.sendRemindersForDays(7);

        // 3 days before expiry
        await this.sendRemindersForDays(3);

        // 1 day before expiry
        await this.sendRemindersForDays(1);
    }

    private async sendRemindersForDays(days: number) {
        const subscriptions = await this.pool.query(`
            SELECT 
                gs.subscription_id, gs.billing_cycle_end, gs.auto_renew,
                g.garage_name, g.stripe_customer_id,
                sp.plan_name, sp.monthly_fee,
                u.email, u.phone_number,
                gpm.card_last4
            FROM garage_subscriptions gs
            JOIN garages g ON gs.garage_id = g.garage_id
            JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_payment_methods gpm ON g.garage_id = gpm.garage_id AND gpm.is_default = true
            WHERE gs.status = 'active'
            AND gs.billing_cycle_end::date = (CURRENT_DATE + INTERVAL '${days} days')::date
            AND (gs.renewal_reminder_sent = false OR gs.renewal_reminder_sent IS NULL)
        `);

        for (const sub of subscriptions.rows) {
            const hasPaymentMethod = !!sub.stripe_customer_id && !!sub.card_last4;

            logger.info('Sending reminder', { days, garage: sub.garage_name });

            await this.sendPaymentReminder(sub, hasPaymentMethod ? 'renewal_upcoming' : 'add_payment_method');

            // Mark reminder sent (only for 1-day reminder to allow multiple reminders)
            if (days === 1) {
                await this.pool.query(`
                    UPDATE garage_subscriptions SET renewal_reminder_sent = true WHERE subscription_id = $1
                `, [sub.subscription_id]);
            }
        }
    }

    /**
     * Send payment reminder notification
     */
    private async sendPaymentReminder(sub: any, type: string) {
        // TODO: Integrate with email.service.ts and SMS service
        logger.info('Would send reminder', { type, email: sub.email });

        // Log the reminder attempt
        await this.pool.query(`
            INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, action_data)
            VALUES ('00000000-0000-0000-0000-000000000000', 'billing_reminder', $1, 'subscription', $2)
        `, [sub.subscription_id, JSON.stringify({ type, email: sub.email, plan: sub.plan_name })]);
    }

    /**
     * Handle expired subscriptions
     * Run daily: 0 2 * * * (2 AM Qatar time)
     */
    async processExpiredSubscriptions() {
        logger.info('Processing expired subscriptions');

        // Suspend subscriptions that are 3+ days past due with failed payments
        const expired = await this.pool.query(`
            UPDATE garage_subscriptions 
            SET status = 'suspended',
                updated_at = NOW()
            WHERE status = 'active'
            AND billing_cycle_end < NOW() - INTERVAL '3 days'
            AND billing_retry_count >= 3
            RETURNING subscription_id, garage_id
        `);

        logger.info('Suspended expired subscriptions', { count: expired.rows.length });

        for (const sub of expired.rows) {
            logger.info('Suspended subscription', { subscriptionId: sub.subscription_id });
        }
    }
}
