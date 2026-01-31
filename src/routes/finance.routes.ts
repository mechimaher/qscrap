import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import { passwordRateLimiter } from '../middleware/rateLimiter';
import {
    getPayoutSummary,
    getPayouts,
    getInWarrantyPayouts,
    processPayout,
    holdPayout,
    getTransactionDetails,
    createRefund,
    getRefunds,
    getPendingRefunds,
    processStripeRefund,
    rejectRefund,
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
    sendPaymentReminder,
    getPaymentStats,
    confirmAllPayouts,
    // Batch payment operations
    getGaragesWithPendingPayouts,
    getBatchPayoutPreview,
    sendBatchPayments,
    // Payout statements / Tax invoices
    getPayoutStatement,
    // Compensation review (Support/Finance manual decision)
    getPendingCompensationReviews,
    approveCompensation,
    denyCompensation
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
router.get('/payouts/in-warranty', getInWarrantyPayouts);
router.get('/payouts/:payout_id/status', getPayoutStatus);

// ==========================================
// 2-WAY CONFIRMATION WORKFLOW
// ==========================================

// Operations: Send payment to garage
router.post('/payouts/:payout_id/send', authorizeOperations, sendPayment);

// Operations: Resolve disputed payment
router.post('/payouts/:payout_id/resolve-dispute', authorizeOperations, resolvePaymentDispute);

// Operations: Send reminder to garage for confirming payment
router.post('/payouts/:payout_id/remind', authorizeOperations, sendPaymentReminder);

// Garage: Get payouts awaiting confirmation
router.get('/payouts/awaiting-confirmation', requireRole('garage'), getAwaitingConfirmation);

// Garage: Confirm payment receipt
router.post('/payouts/:payout_id/confirm', requireRole('garage'), confirmPayment);

// Garage: Bulk confirm all payouts (requires password) - RATE LIMITED
router.post('/payouts/confirm-all', requireRole('garage'), passwordRateLimiter, confirmAllPayouts);

// Garage: Dispute/report issue with payment
router.post('/payouts/:payout_id/dispute', requireRole('garage'), disputePayment);

// ==========================================
// LEGACY PAYOUT ACTIONS (Operations Only)
// ==========================================
router.post('/payouts/:payout_id/process', authorizeOperations, processPayout);
router.post('/payouts/:payout_id/force-process', authorizeOperations, forceProcessPayout);
router.post('/payouts/:payout_id/hold', authorizeOperations, holdPayout);
router.post('/payouts/:payout_id/release', authorizeOperations, releasePayout);

// ==========================================
// BATCH PAYMENT OPERATIONS (Operations Only)
// ==========================================

// Get list of garages with pending payouts (for filter dropdown)
router.get('/payouts/garages-pending', authorizeOperations, getGaragesWithPendingPayouts);

// Get preview of batch payouts before processing
router.post('/payouts/batch-preview', authorizeOperations, getBatchPayoutPreview);

// Send batch payments (efficient single-API-call processing)
router.post('/payouts/batch-send', authorizeOperations, sendBatchPayments);

// ==========================================
// PAYOUT STATEMENTS / TAX INVOICES
// ==========================================

// Generate consolidated payout statement (Tax Invoice) for a garage
// Query: ?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&format=pdf|html
router.get('/payouts/statement/:garageId', authorizeOperations, getPayoutStatement);

// Transactions (Accessible by Admin, Operations, Garage)
router.get('/transactions', getTransactions);
router.get('/transaction/:order_id', getTransactionDetails);

// Refunds (Operations Only)
router.get('/refunds', authorizeOperations, getRefunds);
router.get('/refunds/pending', authorizeOperations, getPendingRefunds);
router.post('/refunds/:refund_id/process', authorizeOperations, processStripeRefund);
router.post('/refunds/:refund_id/approve', authorizeOperations, processStripeRefund); // Alias for approve
router.post('/refunds/:refund_id/reject', authorizeOperations, rejectRefund);
router.post('/refund/:order_id', authorizeOperations, createRefund);

// ==========================================
// COMPENSATION REVIEW (Support/Finance Manual Decision)
// ==========================================

// Get all pending compensation reviews
router.get('/compensation-reviews/pending', authorizeOperations, getPendingCompensationReviews);

// Approve garage compensation
router.post('/compensation-reviews/:payout_id/approve', authorizeOperations, approveCompensation);

// Deny garage compensation (with optional penalty)
router.post('/compensation-reviews/:payout_id/deny', authorizeOperations, denyCompensation);

export default router;
