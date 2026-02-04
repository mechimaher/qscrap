import { Router } from 'express';
import { submitBid, getMyBids, getBidById, rejectBid, updateBid, getFairPriceEstimate } from '../controllers/bid.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload, optimizeFiles } from '../middleware/file.middleware';
import { validateParams, bidIdParamSchema } from '../middleware/validation.middleware';
import { bidWriteLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// ============================================
// Bid Routes - Simplified (Flag & Supersede Decommissioned)
// ============================================

// Get Fair Price Estimate (Public/Auth) - Must be before /:bid_id to avoid conflicts
router.get('/estimate', authenticate, getFairPriceEstimate);

// Submit bid (Garage only) - Allow up to 10 images (rate limited)
// Note: Body validation handled by BidService (multipart form)
router.post('/', authenticate, requireRole('garage'), bidWriteLimiter, upload.array('images', 10), optimizeFiles, submitBid);

// Get my bids (Garage only)
router.get('/my', authenticate, requireRole('garage'), getMyBids);

// Get single bid (Garage only) - With validation
router.get('/:bid_id', authenticate, requireRole('garage'), validateParams(bidIdParamSchema), getBidById);

// Update bid (Garage only) - modify pending bid
router.put('/:bid_id', authenticate, requireRole('garage'), validateParams(bidIdParamSchema), updateBid);

// Reject bid (Customer only)
router.post('/:bid_id/reject', authenticate, requireRole('customer'), validateParams(bidIdParamSchema), rejectBid);

export default router;
