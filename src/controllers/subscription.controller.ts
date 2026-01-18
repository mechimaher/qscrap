import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { SubscriptionService } from '../services/subscription';

const subscriptionService = new SubscriptionService(pool);

export const getSubscriptionPlans = async (req: AuthRequest, res: Response) => {
    try {
        const plans = await subscriptionService.getSubscriptionPlans();
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getMySubscription = async (req: AuthRequest, res: Response) => {
    try {
        const result = await subscriptionService.getMySubscription(req.user!.userId);
        if (!result) return res.status(404).json({ error: 'Garage not found' });
        res.json(result);
    } catch (err) {
        console.error('getMySubscription Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const subscribeToPlan = async (req: AuthRequest, res: Response) => {
    try {
        const result = await subscriptionService.subscribeToPlan(req.user!.userId, req.body.plan_code, req.body.payment_method);
        res.status(201).json({ message: 'Subscription activated successfully', ...result });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const changePlan = async (req: AuthRequest, res: Response) => {
    try {
        const result = await subscriptionService.changePlan(req.user!.userId, req.body.plan_id, req.body.reason);
        res.json({ message: `Request to switch to ${result.plan_name} submitted successfully. Waiting for admin approval.`, status: result.status });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const result = await subscriptionService.cancelSubscription(req.user!.userId, req.body.reason);
        res.json({ message: 'Subscription cancelled', active_until: result.billing_cycle_end, note: 'You can continue to use the service until the end of your billing cycle' });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
    try {
        const history = await subscriptionService.getPaymentHistory(req.user!.userId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
