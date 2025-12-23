import { Router } from 'express';
import { submitBid, getMyBids, rejectBid, updateBid } from '../controllers/bid.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/file.middleware';
import { validate, createBidSchema } from '../middleware/validation.middleware';

const router = Router();

// Submit bid (Garage only) - Allow up to 10 images with validation
router.post('/', authenticate, requireRole('garage'), upload.array('images', 10), submitBid);

// Get my bids (Garage only)
router.get('/my', authenticate, requireRole('garage'), getMyBids);

// Update bid (Garage only) - modify pending bid
router.put('/:bid_id', authenticate, requireRole('garage'), updateBid);

// Reject bid (Customer only)
router.post('/:bid_id/reject', authenticate, requireRole('customer'), rejectBid);

export default router;
