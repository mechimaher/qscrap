/**
 * Finance Controller - Refactored to use Service Layer
 * All business logic delegated to PayoutService, RefundService, and RevenueService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import {
    PayoutService,
    RefundService,
    RevenueService,
    isFinanceError,
    getHttpStatusForError
} from '../services/finance';

// Initialize services
const payoutService = new PayoutService(pool);
const refundService = new RefundService(pool);
const revenueService = new RevenueService(pool);

// ============================================
// PAYOUT SUMMARY & LIST
// ============================================

export const getPayoutSummary = async (req: AuthRequest, res: Response) => {
    try {
        const summary = await payoutService.getPayoutSummary(
            req.user!.userId,
            req.user!.userType
        );
        res.json(summary);
    } catch (err) {
        console.error('getPayoutSummary Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payout summary' });
    }
};

export const getPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const { status, garage_id, page, limit } = req.query;

        const result = await payoutService.getPayouts({
            status: status as any,
            garage_id: garage_id as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            userId: req.user!.userId,
            userType: req.user!.userType as any
        });

        res.json(result);
    } catch (err) {
        console.error('getPayouts Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
};

export const getPayoutStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const statusDetail = await payoutService.getPayoutStatus(payout_id);
        res.json(statusDetail);
    } catch (err) {
        console.error('getPayoutStatus Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payout status' });
    }
};

export const getPaymentStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await payoutService.getPaymentStats();
        res.json(stats);
    } catch (err) {
        console.error('getPaymentStats Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payment stats' });
    }
};

export const getPayoutConfig = async (_req: AuthRequest, res: Response) => {
    res.json({
        auto_confirm_days: 7,
        min_payout_amount: 50,
        payout_methods: ['bank_transfer', 'cash', 'cheque'],
        currencies: ['QAR']
    });
};

// ============================================
// 2-WAY CONFIRMATION WORKFLOW
// ============================================

export const sendPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const result = await payoutService.sendPayment(payout_id, req.body);
        res.json(result);
    } catch (err) {
        console.error('sendPayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to send payment' });
    }
};

export const confirmPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const garageId = req.user!.userId;

        const result = await payoutService.confirmPayment(payout_id, garageId, req.body);
        res.json(result);
    } catch (err) {
        console.error('confirmPayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
};

export const disputePayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const garageId = req.user!.userId;

        const result = await payoutService.disputePayment(payout_id, garageId, req.body);
        res.json(result);
    } catch (err) {
        console.error('disputePayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to dispute payment' });
    }
};

export const resolvePaymentDispute = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const result = await payoutService.resolveDispute(payout_id, req.body);
        res.json(result);
    } catch (err) {
        console.error('resolvePaymentDispute Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to resolve dispute' });
    }
};

export const getAwaitingConfirmation = async (req: AuthRequest, res: Response) => {
    try {
        const garageId = req.user!.userId;
        const payouts = await payoutService.getAwaitingConfirmation(garageId);
        res.json({ awaiting_confirmation: payouts });
    } catch (err) {
        console.error('getAwaitingConfirmation Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch awaiting confirmation' });
    }
};

export const confirmAllPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const garageId = req.user!.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required for bulk confirmation' });
        }

        const result = await payoutService.confirmAllPayouts(garageId, password);
        res.json(result);
    } catch (err) {
        console.error('confirmAllPayouts Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to confirm payouts' });
    }
};

// ============================================
// ADMIN PAYOUT OPERATIONS
// ============================================

export const processPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        await payoutService.processPayout(payout_id);
        res.json({ message: 'Payout processed successfully' });
    } catch (err) {
        console.error('processPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to process payout' });
    }
};

export const holdPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Hold reason required' });
        }

        await payoutService.holdPayout(payout_id, reason);
        res.json({ message: 'Payout held successfully' });
    } catch (err) {
        console.error('holdPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to hold payout' });
    }
};

export const releasePayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        await payoutService.releasePayout(payout_id);
        res.json({ message: 'Payout released successfully' });
    } catch (err) {
        console.error('releasePayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to release payout' });
    }
};

export const forceProcessPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Reason required for force processing' });
        }

        const result = await payoutService.forceProcessPayout(payout_id, reason);
        res.json(result);
    } catch (err) {
        console.error('forceProcessPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to force process payout' });
    }
};

// ============================================
// REFUND OPERATIONS
// ============================================

export const createRefund = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const { refund_amount, refund_reason } = req.body;

        if (!refund_amount || !refund_reason) {
            return res.status(400).json({ error: 'Refund amount and reason required' });
        }

        const result = await refundService.createRefund({
            order_id,
            refund_amount: parseFloat(refund_amount),
            refund_reason,
            initiated_by: req.user!.userId
        });

        res.json(result);
    } catch (err) {
        console.error('createRefund Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to create refund' });
    }
};

export const getRefunds = async (req: AuthRequest, res: Response) => {
    try {
        const { status, page, limit } = req.query;

        const result = await refundService.getRefunds({
            status: status as string,
            limit: limit ? parseInt(limit as string) : undefined,
            offset: page ? (parseInt(page as string) - 1) * (parseInt(limit as string) || 50) : undefined
        });

        res.json(result);
    } catch (err) {
        console.error('getRefunds Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch refunds' });
    }
};

// ============================================
// REVENUE & TRANSACTIONS
// ============================================

export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const { period = '30d', garage_id } = req.query;

        const report = await revenueService.getRevenueReport(
            period as any,
            garage_id ? { garage_id: garage_id as string } : undefined
        );

        res.json(report);
    } catch (err) {
        console.error('getRevenueReport Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch revenue report' });
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const { status, from_date, to_date, page, limit } = req.query;

        const transactions = await revenueService.getTransactions({
            user_id: req.user!.userId,
            user_type: req.user!.userType as any,
            status: status ? (status as string).split(',') : undefined,
            from_date: from_date ? new Date(from_date as string) : undefined,
            to_date: to_date ? new Date(to_date as string) : undefined,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });

        res.json({ transactions });
    } catch (err) {
        console.error('getTransactions Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

export const getTransactionDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const detail = await revenueService.getTransactionDetail(order_id);
        res.json(detail);
    } catch (err) {
        console.error('getTransactionDetails Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
};

// ============================================
// CRON JOB - Auto-confirm payouts
// ============================================

export const autoConfirmPayouts = async () => {
    try {
        const result = await PayoutService.autoConfirmPayouts(pool);
        console.log(`[CRON] Auto-confirmed ${result.confirmed} payouts, ${result.failed} failed`);
        return result;
    } catch (err) {
        console.error('[CRON] autoConfirmPayouts error:', err);
        return { confirmed: 0, failed: 1 };
    }
};
