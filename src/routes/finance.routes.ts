import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getPayoutSummary,
    getPayouts,
    processPayout,
    holdPayout,
    getTransactionDetails,
    createRefund,
    getRevenueReport,
    getTransactions,
    forceProcessPayout,
    releasePayout,
    getPayoutStatus,
    getPayoutConfig,
    // New 2-way confirmation workflow
    sendPayment,
    confirmPayment,
    disputePayment,
    getAwaitingConfirmation,
    resolvePaymentDispute,
    getPaymentStats,
    confirmAllPayouts
} from '../controllers/finance.controller';

const router = Router();

// All finance routes require authentication
router.use(authenticate);

// Dashboard summary (Accessible by Admin, Operations, Garage)
router.get('/stats', getPayoutSummary);

// Revenue report (Accessible by Admin, Operations, Garage)
router.get('/revenue', getRevenueReport);

// Payment Statistics (Operations)
router.get('/payment-stats', authorizeOperations, getPaymentStats);

// Payout Configuration (Operations Only)
router.get('/payouts/config', authorizeOperations, getPayoutConfig);

// Payouts (Read access for Garage, Full access for Ops)
router.get('/payouts', getPayouts);
router.get('/payouts/summary', getPayoutSummary);
router.get('/payouts/:payout_id/status', getPayoutStatus);

// ==========================================
// 2-WAY CONFIRMATION WORKFLOW
// ==========================================

// Operations: Send payment to garage
router.post('/payouts/:payout_id/send', authorizeOperations, sendPayment);

// Operations: Resolve disputed payment
router.post('/payouts/:payout_id/resolve-dispute', authorizeOperations, resolvePaymentDispute);

// Garage: Get payouts awaiting confirmation
router.get('/payouts/awaiting-confirmation', requireRole('garage'), getAwaitingConfirmation);

// Garage: Confirm payment receipt
router.post('/payouts/:payout_id/confirm', requireRole('garage'), confirmPayment);

// Garage: Bulk confirm all payouts (requires password)
router.post('/payouts/confirm-all', requireRole('garage'), confirmAllPayouts);

// Garage: Dispute/report issue with payment
router.post('/payouts/:payout_id/dispute', requireRole('garage'), disputePayment);

// ==========================================
// LEGACY PAYOUT ACTIONS (Operations Only)
// ==========================================
router.post('/payouts/:payout_id/process', authorizeOperations, processPayout);
router.post('/payouts/:payout_id/force-process', authorizeOperations, forceProcessPayout);
router.post('/payouts/:payout_id/hold', authorizeOperations, holdPayout);
router.post('/payouts/:payout_id/release', authorizeOperations, releasePayout);

// Transactions (Accessible by Admin, Operations, Garage)
router.get('/transactions', getTransactions);
router.get('/transaction/:order_id', getTransactionDetails);
router.post('/refund/:order_id', authorizeOperations, createRefund);

export default router;
