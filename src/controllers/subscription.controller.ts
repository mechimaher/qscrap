import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { SubscriptionService } from '../services/subscription';
import logger from '../utils/logger';

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
        logger.error('getMySubscription Error', { error: (err as Error).message });
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
        res.json({
            message: result.payment_required
                ? `Upgrade to ${result.plan_name} requires payment of ${result.payment_amount} QAR. Use /subscription/pay to complete.`
                : `Request to switch to ${result.plan_name} submitted successfully.`,
            request_id: result.request_id,
            plan_name: result.plan_name,
            payment_required: result.payment_required,
            payment_amount: result.payment_amount,
            status: result.status
        });
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

/**
 * Cancel pending plan change request
 * Garage can cancel if they change their mind before admin approval
 */
export const cancelPendingRequest = async (req: AuthRequest, res: Response) => {
    try {
        const result = await subscriptionService.cancelPendingRequest(req.user!.userId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

/**
 * Create Stripe PaymentIntent for subscription upgrade
 * Garage calls this to get clientSecret for card payment
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
    try {
        const { request_id } = req.body;
        if (!request_id) {
            return res.status(400).json({ error: 'request_id is required' });
        }

        const result = await subscriptionService.createUpgradePaymentIntent(request_id, req.user!.userId);
        res.json({
            client_secret: result.clientSecret,
            amount: result.amount,
            currency: 'QAR',
            plan_name: result.planName,
            message: `Pay ${result.amount} QAR to upgrade to ${result.planName}`
        });
    } catch (err) {
        logger.error('createPaymentIntent Error', { error: (err as Error).message });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

/**
 * Confirm Stripe payment succeeded (webhook alternative)
 * After Stripe.js confirms payment, garage calls this to verify and complete
 */
export const confirmPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payment_intent_id } = req.body;
        if (!payment_intent_id) {
            return res.status(400).json({ error: 'payment_intent_id is required' });
        }

        const result = await subscriptionService.confirmUpgradePayment(payment_intent_id);
        if (result.success) {
            res.json({
                success: true,
                message: 'Payment verified! Your subscription upgrade is now pending admin approval.',
                request_id: result.requestId
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Payment not yet completed. Please try again.'
            });
        }
    } catch (err) {
        logger.error('confirmPayment Error', { error: (err as Error).message });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// PAYMENT METHODS (Saved Cards)
// ============================================

import { PaymentMethodsService } from '../services/subscription/payment-methods.service';
import { InvoiceService } from '../services/subscription/invoice.service';

const paymentMethodsService = new PaymentMethodsService(pool);
const invoiceService = new InvoiceService(pool);

/**
 * Create SetupIntent for adding a new payment method
 */
export const createSetupIntent = async (req: AuthRequest, res: Response) => {
    try {
        const result = await paymentMethodsService.createSetupIntent(req.user!.userId);
        res.json({
            client_secret: result.clientSecret,
            customer_id: result.customerId,
            message: 'Use this client_secret with Stripe.js to save a card'
        });
    } catch (err) {
        logger.error('createSetupIntent Error', { error: (err as Error).message });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get saved payment methods
 */
export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
    try {
        const methods = await paymentMethodsService.getPaymentMethods(req.user!.userId);
        res.json({ payment_methods: methods });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = async (req: AuthRequest, res: Response) => {
    try {
        const { method_id } = req.params;
        await paymentMethodsService.setDefaultPaymentMethod(req.user!.userId, method_id);
        res.json({ message: 'Default payment method updated' });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

/**
 * Delete a payment method
 */
export const deletePaymentMethod = async (req: AuthRequest, res: Response) => {
    try {
        const { method_id } = req.params;
        await paymentMethodsService.deletePaymentMethod(req.user!.userId, method_id);
        res.json({ message: 'Payment method deleted' });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// INVOICES
// ============================================

/**
 * Get garage invoices
 */
export const getInvoices = async (req: AuthRequest, res: Response) => {
    try {
        const invoices = await invoiceService.getGarageInvoices(req.user!.userId);
        res.json({ invoices });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Download invoice PDF
 */
export const downloadInvoice = async (req: AuthRequest, res: Response) => {
    try {
        const { invoice_id } = req.params;
        const pdfPath = await invoiceService.getInvoicePdf(invoice_id, req.user!.userId);

        if (!pdfPath) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.download(pdfPath);
    } catch (err) {
        logger.error('downloadInvoice Error', { error: (err as Error).message });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};
