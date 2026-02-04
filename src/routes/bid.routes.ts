import { Router } from 'express';
import { submitBid, getMyBids, getBidById, rejectBid, updateBid, getFairPriceEstimate } from '../controllers/bid.controller';
import { flagBid, supersedeBid, getBidFlags, acknowledgeFlag, dismissFlag } from '../controllers/bidFlag.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload, optimizeFiles } from '../middleware/file.middleware';
import { validateParams, validate, bidIdParamSchema } from '../middleware/validation.middleware';
import { bidWriteLimiter } from '../middleware/rateLimiter.middleware';
import { z } from 'zod';

const router = Router();

// ============================================
// Validation Schemas for Flag Workflow
// ============================================

const flagBidSchema = z.object({
    reason: z.enum(['wrong_part', 'wrong_picture', 'incorrect_price', 'missing_info', 'other']),
    details: z.string().max(500).optional(),
    urgent: z.boolean().optional()
});

const flagIdParamSchema = z.object({
    bid_id: z.string().uuid(),
    flag_id: z.string().uuid()
});

const acknowledgeSchema = z.object({
    message: z.string().max(200).optional()
});

const dismissSchema = z.object({
    reason: z.string().max(200).optional()
});

// ============================================
// Original Bid Routes
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

// ============================================
// Flag Workflow Routes (NEW)
// ============================================

// Flag a bid (Customer only) - report incorrect part/image
router.post(
    '/:bid_id/flag',
    authenticate,
    requireRole('customer'),
    validateParams(bidIdParamSchema),
    validate(flagBidSchema),
    flagBid
);

// Get all flags for a bid (Customer or Garage)
router.get(
    '/:bid_id/flags',
    authenticate,
    validateParams(bidIdParamSchema),
    getBidFlags
);

// Supersede bid with corrected version (Garage only)
router.post(
    '/:bid_id/supersede',
    authenticate,
    requireRole('garage'),
    bidWriteLimiter,
    validateParams(bidIdParamSchema),
    upload.array('images', 10),
    optimizeFiles,
    supersedeBid
);

// Acknowledge a flag (Garage only) - before correction
router.post(
    '/:bid_id/flags/:flag_id/acknowledge',
    authenticate,
    requireRole('garage'),
    validateParams(flagIdParamSchema),
    validate(acknowledgeSchema),
    acknowledgeFlag
);

// Dismiss a flag (Customer who flagged or Garage owner)
router.post(
    '/:bid_id/flags/:flag_id/dismiss',
    authenticate,
    validateParams(flagIdParamSchema),
    validate(dismissSchema),
    dismissFlag
);

export default router;
