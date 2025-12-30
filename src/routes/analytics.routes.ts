import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    getGarageAnalytics,
    exportAnalytics,
    getCustomerInsights,
    getPlanFeatures,
    getMarketInsights
} from '../controllers/analytics.controller';

const router = Router();

// All routes require garage authentication
router.use(authenticate, requireRole('garage'));

// Plan features check (for frontend UI gating)
router.get('/plan-features', getPlanFeatures);

// Analytics dashboard (requires Professional or Enterprise)
router.get('/', getGarageAnalytics);

// Export analytics (requires Enterprise)
router.get('/export', exportAnalytics);

// Customer insights (requires Enterprise)
router.get('/customers', getCustomerInsights);

// Market insights (requires Enterprise)
router.get('/market', getMarketInsights);

export default router;
