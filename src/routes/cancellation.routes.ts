import { Router } from 'express';
import {
    cancelRequest,
    withdrawBid,
    getCancellationPreview,
    cancelOrderByCustomer,
    cancelOrderByGarage,
    getCancellationHistory,
    getReturnPreview,
    createReturnRequest,
    getCustomerAbuseStatus
} from '../controllers/cancellation.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ============================================
// REQUEST & BID CANCELLATION
// ============================================

// Customer: Cancel a request (before bid accepted)
router.post('/requests/:request_id/cancel', authenticate, requireRole('customer'), cancelRequest);

// Garage: Withdraw a bid
router.post('/bids/:bid_id/withdraw', authenticate, requireRole('garage'), withdrawBid);

// ============================================
// ORDER CANCELLATION
// ============================================

// Both: Get cancellation preview for an order
router.get('/orders/:order_id/cancel-preview', authenticate, getCancellationPreview);

// Customer: Cancel an order
router.post('/orders/:order_id/cancel/customer', authenticate, requireRole('customer'), cancelOrderByCustomer);

// Garage: Cancel an order (cannot fulfill)
router.post('/orders/:order_id/cancel/garage', authenticate, requireRole('garage'), cancelOrderByGarage);

// ============================================
// 7-DAY RETURN WINDOW (BRAIN v3.0)
// ============================================

// Customer: Get return preview (fees, eligibility)
router.get('/orders/:order_id/return-preview', authenticate, requireRole('customer'), getReturnPreview);

// Customer: Submit return request
router.post('/orders/:order_id/return', authenticate, requireRole('customer'), createReturnRequest);

// ============================================
// CUSTOMER ABUSE STATUS (BRAIN v3.0)
// ============================================

// Customer: Get abuse status (remaining returns/claims)
router.get('/abuse-status', authenticate, requireRole('customer'), getCustomerAbuseStatus);

// ============================================
// HISTORY
// ============================================

// Both: Get cancellation history
router.get('/history', authenticate, getCancellationHistory);

export default router;

