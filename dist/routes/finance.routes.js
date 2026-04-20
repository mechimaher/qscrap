"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const finance_controller_1 = require("../controllers/finance.controller");
const router = (0, express_1.Router)();
// All finance routes require authentication
router.use(auth_middleware_1.authenticate);
// Dashboard summary (Accessible by Admin, Operations, Garage)
router.get('/stats', finance_controller_1.getPayoutSummary);
// Revenue report (Accessible by Admin, Operations, Garage)
router.get('/revenue', finance_controller_1.getRevenueReport);
// Payment Statistics (Operations)
router.get('/payment-stats', authorize_middleware_1.authorizeOperations, finance_controller_1.getPaymentStats);
// Payout Configuration (Operations Only)
router.get('/payouts/config', authorize_middleware_1.authorizeOperations, finance_controller_1.getPayoutConfig);
// Payouts (Read access for Garage, Full access for Ops)
router.get('/payouts', finance_controller_1.getPayouts);
router.get('/payouts/summary', finance_controller_1.getPayoutSummary);
router.get('/payouts/:payout_id/status', finance_controller_1.getPayoutStatus);
// ==========================================
// 2-WAY CONFIRMATION WORKFLOW
// ==========================================
// Operations: Send payment to garage
router.post('/payouts/:payout_id/send', authorize_middleware_1.authorizeOperations, finance_controller_1.sendPayment);
// Operations: Resolve disputed payment
router.post('/payouts/:payout_id/resolve-dispute', authorize_middleware_1.authorizeOperations, finance_controller_1.resolvePaymentDispute);
// Garage: Get payouts awaiting confirmation
router.get('/payouts/awaiting-confirmation', (0, auth_middleware_1.requireRole)('garage'), finance_controller_1.getAwaitingConfirmation);
// Garage: Confirm payment receipt
router.post('/payouts/:payout_id/confirm', (0, auth_middleware_1.requireRole)('garage'), finance_controller_1.confirmPayment);
// Garage: Dispute/report issue with payment
router.post('/payouts/:payout_id/dispute', (0, auth_middleware_1.requireRole)('garage'), finance_controller_1.disputePayment);
// ==========================================
// LEGACY PAYOUT ACTIONS (Operations Only)
// ==========================================
router.post('/payouts/:payout_id/process', authorize_middleware_1.authorizeOperations, finance_controller_1.processPayout);
router.post('/payouts/:payout_id/force-process', authorize_middleware_1.authorizeOperations, finance_controller_1.forceProcessPayout);
router.post('/payouts/:payout_id/hold', authorize_middleware_1.authorizeOperations, finance_controller_1.holdPayout);
router.post('/payouts/:payout_id/release', authorize_middleware_1.authorizeOperations, finance_controller_1.releasePayout);
// Transactions (Accessible by Admin, Operations, Garage)
router.get('/transactions', finance_controller_1.getTransactions);
router.get('/transaction/:order_id', finance_controller_1.getTransactionDetails);
router.post('/refund/:order_id', authorize_middleware_1.authorizeOperations, finance_controller_1.createRefund);
exports.default = router;
