import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getGarageReviews,
    getMyReviews,
    getPendingReviews,
    getAllReviews,
    moderateReview
} from '../controllers/reviews.controller';

const router = Router();

// ============================================
// PUBLIC: Get garage reviews (for customers viewing bids)
// ============================================
router.get('/garage/:garage_id', getGarageReviews);

// ============================================
// GARAGE: Get my reviews
// ============================================
router.get('/my', authenticate, requireRole('garage'), getMyReviews);

// ============================================
// OPERATIONS: Review Moderation
// ============================================
router.get('/pending', authenticate, authorizeOperations, getPendingReviews);
router.get('/all', authenticate, authorizeOperations, getAllReviews);
router.post('/:review_id/moderate', authenticate, authorizeOperations, moderateReview);

export default router;
