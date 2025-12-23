import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Get all available subscription plans
export const getSubscriptionPlans = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, 
                    commission_rate, max_bids_per_month, features, is_featured
             FROM subscription_plans 
             WHERE is_active = true 
             ORDER BY display_order ASC`
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Get garage's current subscription
export const getMySubscription = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT gs.*, sp.plan_code, sp.plan_name, sp.monthly_fee, 
                    sp.commission_rate, sp.max_bids_per_month, sp.features
             FROM garage_subscriptions gs
             JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial', 'past_due')
             ORDER BY gs.created_at DESC
             LIMIT 1`,
            [garageId]
        );

        if (result.rows.length === 0) {
            return res.json({ subscription: null, message: 'No active subscription' });
        }

        const sub = result.rows[0];
        const bidsRemaining = sub.max_bids_per_month
            ? sub.max_bids_per_month - sub.bids_used_this_cycle
            : null;

        res.json({
            subscription: {
                ...sub,
                bids_remaining: bidsRemaining
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Subscribe to a plan
export const subscribeToPlan = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { plan_code, payment_method } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if already subscribed
        const existingSub = await client.query(
            `SELECT subscription_id FROM garage_subscriptions 
             WHERE garage_id = $1 AND status IN ('active', 'trial')`,
            [garageId]
        );

        if (existingSub.rows.length > 0) {
            throw new Error('Already have an active subscription. Please cancel or upgrade instead.');
        }

        // Get plan details
        const planResult = await client.query(
            `SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true`,
            [plan_code]
        );

        if (planResult.rows.length === 0) {
            throw new Error('Invalid subscription plan');
        }

        const plan = planResult.rows[0];
        const today = new Date();
        const cycleEnd = new Date(today);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        // Create subscription
        const subResult = await client.query(
            `INSERT INTO garage_subscriptions 
             (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, next_billing_date)
             VALUES ($1, $2, 'active', $3, $4, $4)
             RETURNING subscription_id`,
            [garageId, plan.plan_id, today.toISOString().split('T')[0], cycleEnd.toISOString().split('T')[0]]
        );

        const subscriptionId = subResult.rows[0].subscription_id;

        // Create payment record
        await client.query(
            `INSERT INTO subscription_payments 
             (subscription_id, amount, payment_method, payment_status, processed_at)
             VALUES ($1, $2, $3, 'completed', NOW())`,
            [subscriptionId, plan.monthly_fee, payment_method || 'card']
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Subscription activated successfully',
            subscription_id: subscriptionId,
            plan_name: plan.plan_name,
            expires_at: cycleEnd.toISOString()
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Upgrade/Downgrade subscription
export const changePlan = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { new_plan_code } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current subscription
        const currentSub = await client.query(
            `SELECT gs.*, sp.monthly_fee as current_fee, sp.plan_name as current_plan
             FROM garage_subscriptions gs
             JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
             FOR UPDATE`,
            [garageId]
        );

        if (currentSub.rows.length === 0) {
            throw new Error('No active subscription to change');
        }

        // Get new plan
        const newPlan = await client.query(
            `SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true`,
            [new_plan_code]
        );

        if (newPlan.rows.length === 0) {
            throw new Error('Invalid plan code');
        }

        const current = currentSub.rows[0];
        const newP = newPlan.rows[0];

        // Update subscription with new plan
        await client.query(
            `UPDATE garage_subscriptions 
             SET plan_id = $1, updated_at = NOW()
             WHERE subscription_id = $2`,
            [newP.plan_id, current.subscription_id]
        );

        await client.query('COMMIT');

        res.json({
            message: `Plan changed from ${current.current_plan} to ${newP.plan_name}`,
            new_commission_rate: newP.commission_rate,
            effective_immediately: true
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Cancel subscription
export const cancelSubscription = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { reason } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE garage_subscriptions 
             SET status = 'cancelled', 
                 cancelled_at = NOW(), 
                 cancellation_reason = $2,
                 auto_renew = false,
                 updated_at = NOW()
             WHERE garage_id = $1 AND status IN ('active', 'trial')
             RETURNING subscription_id, billing_cycle_end`,
            [garageId, reason]
        );

        if (result.rows.length === 0) {
            throw new Error('No active subscription to cancel');
        }

        await client.query('COMMIT');

        res.json({
            message: 'Subscription cancelled',
            active_until: result.rows[0].billing_cycle_end,
            note: 'You can continue to use the service until the end of your billing cycle'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get subscription payment history
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT sp.*, gs.billing_cycle_start, gs.billing_cycle_end
             FROM subscription_payments sp
             JOIN garage_subscriptions gs ON sp.subscription_id = gs.subscription_id
             WHERE gs.garage_id = $1
             ORDER BY sp.created_at DESC
             LIMIT 12`,
            [garageId]
        );

        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
