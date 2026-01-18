import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    getRewardsSummary,
    getTransactionHistory,
    redeemPoints,
    getTierBenefits,
    calculateRewards,
    awardBonusPoints,
    getLoyaltyStats
} from '../controllers/loyalty.controller';

const router = Router();

// Customer endpoints (require customer authentication)
router.get('/summary', authenticate, requireRole('customer'), getRewardsSummary);
router.get('/transactions', authenticate, requireRole('customer'), getTransactionHistory);
router.post('/redeem', authenticate, requireRole('customer'), redeemPoints);
router.get('/tiers', authenticate, getTierBenefits); // Available to all authenticated users
router.get('/calculate', authenticate, calculateRewards);

// Admin endpoints (require admin/operations authentication)
router.post('/admin/bonus', authenticate, requireRole('admin'), awardBonusPoints);
router.get('/admin/stats', authenticate, requireRole('admin'), getLoyaltyStats);

export default router;
