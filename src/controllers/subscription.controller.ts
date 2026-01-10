import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';

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
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get garage's current subscription
export const getMySubscription = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        // Get current month's bid count (always compute dynamically for accuracy)
        const bidCountResult = await pool.query(
            `SELECT COUNT(*) as bids_this_month 
             FROM bids 
             WHERE garage_id = $1 
             AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
            [garageId]
        );
        const bidsThisMonth = parseInt(bidCountResult.rows[0].bids_this_month) || 0;

        // First check for active subscription in garage_subscriptions table
        const result = await pool.query(
            `SELECT gs.*, 
                    sp.plan_code, sp.plan_name, sp.monthly_fee, 
                    sp.commission_rate, sp.max_bids_per_month, sp.features,
                    np.plan_name as next_plan_name
             FROM garage_subscriptions gs
             JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             LEFT JOIN subscription_plans np ON gs.next_plan_id = np.plan_id
             WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial', 'past_due')
             ORDER BY gs.created_at DESC
             LIMIT 1`,
            [garageId]
        );

        // Check for pending requests
        const pendingRequest = await pool.query(
            `SELECT scr.*, sp.plan_name as target_plan_name 
             FROM subscription_change_requests scr
             JOIN subscription_plans sp ON scr.to_plan_id = sp.plan_id
             WHERE scr.garage_id = $1 AND scr.status = 'pending'`,
            [garageId]
        );

        if (result.rows.length > 0) {
            const sub = result.rows[0];
            const bidsRemaining = sub.max_bids_per_month
                ? sub.max_bids_per_month - bidsThisMonth
                : null;

            return res.json({
                subscription: {
                    ...sub,
                    bids_used_this_cycle: bidsThisMonth, // Use dynamic count
                    bids_remaining: bidsRemaining
                },
                pending_request: pendingRequest.rows[0] || null
            });
        }

        // No subscription found - check garage approval status
        const garageResult = await pool.query(
            `SELECT approval_status, demo_expires_at 
             FROM garages 
             WHERE garage_id = $1`,
            [garageId]
        );

        if (garageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Garage not found' });
        }

        const garage = garageResult.rows[0];

        // Demo garage - return demo plan
        if (garage.approval_status === 'demo') {
            return res.json({
                subscription: {
                    plan_name: 'Demo Trial',
                    plan_code: 'demo',
                    status: 'demo',
                    monthly_fee: 0,
                    commission_rate: 0, // 0% during demo - garage keeps 100%
                    max_bids_per_month: null, // unlimited during demo
                    bids_used_this_cycle: bidsThisMonth,
                    bids_remaining: null,
                    billing_cycle_end: garage.demo_expires_at,
                    features: ['Full platform access', 'Unlimited bids', '0% platform commission', 'Demo period'],
                    is_demo: true
                }
            });
        }

        // Approved garage without subscription - Commission-based model
        if (garage.approval_status === 'approved') {
            return res.json({
                subscription: {
                    plan_name: 'Commission Plan',
                    plan_code: 'commission',
                    status: 'active',
                    monthly_fee: 0, // No monthly subscription fee
                    commission_rate: 0.15, // 15% platform commission on each sale
                    max_bids_per_month: null, // Unlimited bids
                    bids_used_this_cycle: bidsThisMonth,
                    bids_remaining: null,
                    billing_cycle_end: null, // No billing cycle - commission per order
                    features: [
                        'No monthly fees',
                        'Unlimited bids',
                        '15% commission per order',
                        'Pay only when you sell'
                    ],
                    is_commission_based: true
                }
            });
        }

        // Expired demo
        if (garage.approval_status === 'expired') {
            return res.json({
                subscription: null,
                status: 'expired',
                message: 'Your demo trial has expired. Please subscribe to continue using the platform.',
                can_bid: false
            });
        }

        // Pending approval or other status
        return res.json({
            subscription: null,
            message: 'No active subscription',
            approval_status: garage.approval_status
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
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
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Upgrade/Downgrade subscription (Request based)
export const changePlan = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { plan_id, reason } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check for existing pending request
        const pendingCheck = await client.query(
            `SELECT request_id FROM subscription_change_requests 
             WHERE garage_id = $1 AND status = 'pending'`,
            [garageId]
        );

        if (pendingCheck.rows.length > 0) {
            throw new Error('You already have a pending plan change request.');
        }

        // Get current subscription
        const currentSub = await client.query(
            `SELECT plan_id, monthly_fee FROM garage_subscriptions 
             JOIN subscription_plans USING (plan_id)
             WHERE garage_id = $1 AND status IN ('active', 'trial')`,
            [garageId]
        );

        if (currentSub.rows.length === 0) {
            throw new Error('No active subscription found.');
        }

        const currentPlanId = currentSub.rows[0].plan_id;
        const currentFee = parseFloat(currentSub.rows[0].monthly_fee);

        // Get new plan info
        const newPlan = await client.query(
            `SELECT monthly_fee, plan_name FROM subscription_plans WHERE plan_id = $1`,
            [plan_id]
        );

        if (newPlan.rows.length === 0) throw new Error('Invalid plan.');
        const newFee = parseFloat(newPlan.rows[0].monthly_fee);

        // Determine request type
        let type = 'upgrade';
        if (newFee < currentFee) type = 'downgrade';
        if (newFee === currentFee) type = 'upgrade'; // Side-grade treated as upgrade workflow for now

        // Create Request
        await client.query(
            `INSERT INTO subscription_change_requests 
             (garage_id, from_plan_id, to_plan_id, request_type, request_reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [garageId, currentPlanId, plan_id, type, reason || `User requested ${type}`]
        );

        await client.query('COMMIT');

        res.json({
            message: `Request to switch to ${newPlan.rows[0].plan_name} submitted successfully. Waiting for admin approval.`,
            status: 'pending'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
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
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
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
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
