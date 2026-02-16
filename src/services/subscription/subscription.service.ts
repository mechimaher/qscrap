/**
 * Subscription Service
 * Handles garage subscriptions, plans, upgrades, cancellations, and payment history
 */
import { Pool } from 'pg';
import logger from '../../utils/logger';

export class SubscriptionService {
    constructor(private pool: Pool) { }

    async getSubscriptionPlans() {
        // Exclude 'demo' plan - it's admin-assigned only, not for self-service upgrade
        const result = await this.pool.query(`SELECT plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured FROM subscription_plans WHERE is_active = true AND plan_code != 'demo' ORDER BY monthly_fee ASC, display_order ASC`);
        return result.rows;
    }

    async getMySubscription(garageId: string) {
        const bidCountResult = await this.pool.query(`SELECT COUNT(*) as bids_this_month FROM bids WHERE garage_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`, [garageId]);
        const bidsThisMonth = parseInt(bidCountResult.rows[0].bids_this_month) || 0;

        const result = await this.pool.query(`SELECT gs.*, sp.plan_code, sp.plan_name, sp.monthly_fee, sp.commission_rate, sp.max_bids_per_month, sp.features, np.plan_name as next_plan_name FROM garage_subscriptions gs JOIN subscription_plans sp ON gs.plan_id = sp.plan_id LEFT JOIN subscription_plans np ON gs.next_plan_id = np.plan_id WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial', 'past_due') ORDER BY gs.created_at DESC LIMIT 1`, [garageId]);
        const pendingRequest = await this.pool.query(`SELECT scr.*, sp.plan_name as target_plan_name FROM subscription_change_requests scr JOIN subscription_plans sp ON scr.to_plan_id = sp.plan_id WHERE scr.garage_id = $1 AND scr.status = 'pending'`, [garageId]);

        if (result.rows.length > 0) {
            const sub = result.rows[0];
            const bidsRemaining = sub.max_bids_per_month ? sub.max_bids_per_month - bidsThisMonth : null;
            return { subscription: { ...sub, bids_used_this_cycle: bidsThisMonth, bids_remaining: bidsRemaining }, pending_request: pendingRequest.rows[0] || null };
        }

        const garageResult = await this.pool.query(`SELECT approval_status, demo_expires_at FROM garages WHERE garage_id = $1`, [garageId]);
        if (garageResult.rows.length === 0) {return null;}
        const garage = garageResult.rows[0];

        if (garage.approval_status === 'demo') {
            return { subscription: { plan_name: 'Demo Trial', plan_code: 'demo', status: 'demo', monthly_fee: 0, commission_rate: 0, max_bids_per_month: null, bids_used_this_cycle: bidsThisMonth, bids_remaining: null, billing_cycle_end: garage.demo_expires_at, features: ['Full platform access', 'Unlimited bids', '0% platform commission', 'Demo period'], is_demo: true } };
        }
        if (garage.approval_status === 'approved') {
            return { subscription: { plan_name: 'Commission Plan', plan_code: 'commission', status: 'active', monthly_fee: 0, commission_rate: 0.15, max_bids_per_month: null, bids_used_this_cycle: bidsThisMonth, bids_remaining: null, billing_cycle_end: null, features: ['No monthly fees', 'Unlimited bids', '15% commission per order', 'Pay only when you sell'], is_commission_based: true } };
        }
        if (garage.approval_status === 'expired') {
            return { subscription: null, status: 'expired', message: 'Your demo trial has expired. Please subscribe to continue using the platform.', can_bid: false };
        }
        return { subscription: null, message: 'No active subscription', approval_status: garage.approval_status };
    }

    async subscribeToPlan(garageId: string, planCode: string, paymentMethod?: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const existingSub = await client.query(`SELECT subscription_id FROM garage_subscriptions WHERE garage_id = $1 AND status IN ('active', 'trial')`, [garageId]);
            if (existingSub.rows.length > 0) {throw new Error('Already have an active subscription. Please cancel or upgrade instead.');}

            const planResult = await client.query(`SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true`, [planCode]);
            if (planResult.rows.length === 0) {throw new Error('Invalid subscription plan');}
            const plan = planResult.rows[0];

            const today = new Date();
            const cycleEnd = new Date(today);
            cycleEnd.setMonth(cycleEnd.getMonth() + 1);

            const subResult = await client.query(`INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, next_billing_date) VALUES ($1, $2, 'active', $3, $4, $4) RETURNING subscription_id`, [garageId, plan.plan_id, today.toISOString().split('T')[0], cycleEnd.toISOString().split('T')[0]]);
            await client.query(`INSERT INTO subscription_payments (subscription_id, amount, payment_method, payment_status, processed_at) VALUES ($1, $2, $3, 'completed', NOW())`, [subResult.rows[0].subscription_id, plan.monthly_fee, paymentMethod || 'card']);
            await client.query('COMMIT');

            return { subscription_id: subResult.rows[0].subscription_id, plan_name: plan.plan_name, expires_at: cycleEnd.toISOString() };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async changePlan(garageId: string, planId: string, reason?: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const currentSub = await client.query(`SELECT plan_id, monthly_fee FROM garage_subscriptions JOIN subscription_plans USING (plan_id) WHERE garage_id = $1 AND status IN ('active', 'trial')`, [garageId]);
            if (currentSub.rows.length === 0) {throw new Error('No active subscription found.');}
            const currentPlanId = currentSub.rows[0].plan_id;
            const currentFee = parseFloat(currentSub.rows[0].monthly_fee);

            const pendingCheck = await client.query(`SELECT request_id, to_plan_id FROM subscription_change_requests WHERE garage_id = $1 AND status = 'pending'`, [garageId]);
            if (pendingCheck.rows.length > 0) {
                if (pendingCheck.rows[0].to_plan_id === currentPlanId) {
                    await client.query(`UPDATE subscription_change_requests SET status = 'approved', updated_at = NOW(), admin_notes = 'Auto-resolved' WHERE request_id = $1`, [pendingCheck.rows[0].request_id]);
                } else {
                    throw new Error('You already have a pending plan change request.');
                }
            }

            const newPlan = await client.query(`SELECT plan_id, monthly_fee, plan_name FROM subscription_plans WHERE plan_id = $1`, [planId]);
            if (newPlan.rows.length === 0) {throw new Error('Invalid plan.');}
            const newFee = parseFloat(newPlan.rows[0].monthly_fee);
            const type = newFee < currentFee ? 'downgrade' : 'upgrade';

            // Calculate payment amount (for upgrades, pay the new plan fee)
            const paymentAmount = type === 'upgrade' ? newFee : 0;
            const paymentStatus = paymentAmount > 0 ? 'unpaid' : 'paid';  // Free downgrades auto-paid

            const result = await client.query(
                `INSERT INTO subscription_change_requests 
                 (garage_id, from_plan_id, to_plan_id, request_type, request_reason, payment_amount, payment_status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING request_id`,
                [garageId, currentPlanId, planId, type, reason || `User requested ${type}`, paymentAmount, paymentStatus]
            );
            await client.query('COMMIT');

            return {
                request_id: result.rows[0].request_id,
                plan_name: newPlan.rows[0].plan_name,
                plan_id: newPlan.rows[0].plan_id,
                payment_amount: paymentAmount,
                payment_required: paymentAmount > 0,
                status: 'pending'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async cancelSubscription(garageId: string, reason?: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(`UPDATE garage_subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2, auto_renew = false, updated_at = NOW() WHERE garage_id = $1 AND status IN ('active', 'trial') RETURNING subscription_id, billing_cycle_end`, [garageId, reason]);
            if (result.rows.length === 0) {throw new Error('No active subscription to cancel');}
            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getPaymentHistory(garageId: string) {
        const result = await this.pool.query(`SELECT sp.*, gs.billing_cycle_start, gs.billing_cycle_end FROM subscription_payments sp JOIN garage_subscriptions gs ON sp.subscription_id = gs.subscription_id WHERE gs.garage_id = $1 ORDER BY sp.created_at DESC LIMIT 12`, [garageId]);
        return result.rows;
    }

    /**
     * Create Stripe PaymentIntent for subscription upgrade
     * Called when garage wants to pay by card for instant upgrade
     */
    async createUpgradePaymentIntent(requestId: string, garageId: string): Promise<{ clientSecret: string; amount: number; planName: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Fetch the pending request
            const reqQuery = await client.query(`
                SELECT scr.*, tp.monthly_fee, tp.plan_name
                FROM subscription_change_requests scr
                JOIN subscription_plans tp ON scr.to_plan_id = tp.plan_id
                WHERE scr.request_id = $1 AND scr.garage_id = $2 AND scr.status = 'pending'
                FOR UPDATE
            `, [requestId, garageId]);

            if (reqQuery.rows.length === 0) {
                throw new Error('Pending upgrade request not found');
            }

            const request = reqQuery.rows[0];
            const amount = parseFloat(request.monthly_fee);

            if (amount <= 0) {
                throw new Error('This plan does not require payment');
            }

            // Import Stripe (using existing test credentials)
            const Stripe = require('stripe');
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

            // Create PaymentIntent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe uses cents
                currency: 'qar',
                metadata: {
                    type: 'subscription_upgrade',
                    request_id: requestId,
                    garage_id: garageId,
                    plan_name: request.plan_name
                },
                description: `QScrap Subscription Upgrade - ${request.plan_name}`
            });

            // Update request with payment intent
            await client.query(`
                UPDATE subscription_change_requests
                SET payment_status = 'pending',
                    payment_intent_id = $1,
                    updated_at = NOW()
                WHERE request_id = $2
            `, [paymentIntent.id, requestId]);

            await client.query('COMMIT');

            logger.info('Created upgrade PaymentIntent', { paymentIntentId: paymentIntent.id, amount });

            return {
                clientSecret: paymentIntent.client_secret,
                amount,
                planName: request.plan_name
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Confirm Stripe payment succeeded for subscription upgrade
     * Called via webhook or after client confirmation
     */
    async confirmUpgradePayment(paymentIntentId: string): Promise<{ success: boolean; requestId?: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Find the request by payment intent
            const reqQuery = await client.query(`
                SELECT scr.*, tp.plan_name, g.garage_name
                FROM subscription_change_requests scr
                JOIN subscription_plans tp ON scr.to_plan_id = tp.plan_id
                JOIN garages g ON scr.garage_id = g.garage_id
                WHERE scr.payment_intent_id = $1 AND scr.status = 'pending'
                FOR UPDATE
            `, [paymentIntentId]);

            if (reqQuery.rows.length === 0) {
                logger.info('No pending request for PaymentIntent', { paymentIntentId });
                return { success: false };
            }

            const request = reqQuery.rows[0];

            // Verify payment with Stripe
            const Stripe = require('stripe');
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                logger.info('PaymentIntent not succeeded', { paymentIntentId, status: paymentIntent.status });
                return { success: false };
            }

            // Mark payment as verified
            await client.query(`
                UPDATE subscription_change_requests
                SET payment_status = 'paid',
                    paid_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = $1
            `, [request.request_id]);

            // ==========================================
            // NEW: Auto-Execute Subscription Upgrade
            // ==========================================

            // 1. Deactivate current active subscription
            await client.query(`
                UPDATE garage_subscriptions
                SET status = 'upgraded',
                    updated_at = NOW()
                WHERE garage_id = $1 AND status = 'active'
            `, [request.garage_id]);

            // 2. Create new active subscription
            const today = new Date();
            const cycleEnd = new Date(today);
            cycleEnd.setMonth(cycleEnd.getMonth() + 1);

            await client.query(`
                INSERT INTO garage_subscriptions 
                (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, next_billing_date) 
                VALUES ($1, $2, 'active', $3, $4, $4)
            `, [request.garage_id, request.to_plan_id, today, cycleEnd]);

            // 3. Mark request as completed
            await client.query(`
                UPDATE subscription_change_requests
                SET status = 'completed',
                    updated_at = NOW(),
                    admin_notes = 'Auto-upgraded via Stripe Payment'
                WHERE request_id = $1
            `, [request.request_id]);

            // ==========================================

            await client.query('COMMIT');

            logger.info('Upgrade payment confirmed & executed', { garageName: request.garage_name, planName: request.plan_name });

            return {
                success: true,
                requestId: request.request_id
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Cancel a pending plan change request
     * Garage can cancel if they change their mind before admin approval
     */
    async cancelPendingRequest(garageId: string): Promise<{ success: boolean; message: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Find pending request
            const reqQuery = await client.query(`
                SELECT request_id, payment_status, payment_intent_id, payment_amount
                FROM subscription_change_requests
                WHERE garage_id = $1 AND status = 'pending'
                FOR UPDATE
            `, [garageId]);

            if (reqQuery.rows.length === 0) {
                throw new Error('No pending request found to cancel');
            }

            const request = reqQuery.rows[0];

            // If payment was made, we need to refund (or admin will handle)
            if (request.payment_status === 'paid' && request.payment_intent_id) {
                // Mark for refund - admin will process
                await client.query(`
                    UPDATE subscription_change_requests
                    SET status = 'cancelled',
                        admin_notes = 'Cancelled by garage - refund required',
                        updated_at = NOW()
                    WHERE request_id = $1
                `, [request.request_id]);

                await client.query('COMMIT');
                return {
                    success: true,
                    message: 'Request cancelled. Your payment refund will be processed within 3-5 business days.'
                };
            }

            // Cancel Stripe PaymentIntent if pending
            if (request.payment_intent_id && request.payment_status === 'pending') {
                try {
                    const Stripe = require('stripe');
                    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
                    await stripe.paymentIntents.cancel(request.payment_intent_id);
                } catch (stripeErr) {
                    logger.warn('Could not cancel PaymentIntent (may already be cancelled)', { error: stripeErr });
                }
            }

            // Cancel the request
            await client.query(`
                UPDATE subscription_change_requests
                SET status = 'cancelled',
                    admin_notes = 'Cancelled by garage',
                    updated_at = NOW()
                WHERE request_id = $1
            `, [request.request_id]);

            await client.query('COMMIT');

            logger.info('Garage cancelled pending upgrade request', { garageId });

            return {
                success: true,
                message: 'Your pending plan change request has been cancelled.'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
