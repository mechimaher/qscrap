import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    createCampaign,
    getMyCampaigns,
    getCampaignPerformance,
    updateCampaignStatus,
    getAdPricing,
    reviewCampaign,
    getAdStats
} from '../controllers/ad.controller';

const router = Router();

// Public pricing endpoint
router.get('/pricing', authenticate, getAdPricing);

// Garage endpoints
router.post('/campaigns', authenticate, requireRole('garage'), createCampaign);
router.get('/campaigns', authenticate, requireRole('garage'), getMyCampaigns);
router.get('/campaigns/:id/performance', authenticate, requireRole('garage'), getCampaignPerformance);
router.put('/campaigns/:id/status', authenticate, requireRole('garage'), updateCampaignStatus);

// Admin endpoints
router.post('/admin/review', authenticate, requireRole('admin', 'operations'), reviewCampaign);
router.get('/admin/stats', authenticate, requireRole('admin', 'operations'), getAdStats);

export default router;
