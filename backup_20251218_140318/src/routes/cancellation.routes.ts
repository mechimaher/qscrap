import { Router } from 'express';
import {
    cancelRequest,
    withdrawBid,
    getCancellationPreview,
    cancelOrderByCustomer,
    cancelOrderByGarage,
    getCancellationHistory
} from '../controllers/cancellation.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Customer: Cancel a request (before bid accepted)
router.post('/requests/:request_id/cancel', authenticate, requireRole('customer'), cancelRequest);

// Garage: Withdraw a bid
router.post('/bids/:bid_id/withdraw', authenticate, requireRole('garage'), withdrawBid);

// Both: Get cancellation preview for an order
router.get('/orders/:order_id/cancel-preview', authenticate, getCancellationPreview);

// Customer: Cancel an order
router.post('/orders/:order_id/cancel/customer', authenticate, requireRole('customer'), cancelOrderByCustomer);

// Garage: Cancel an order (cannot fulfill)
router.post('/orders/:order_id/cancel/garage', authenticate, requireRole('garage'), cancelOrderByGarage);

// Both: Get cancellation history
router.get('/history', authenticate, getCancellationHistory);

export default router;
