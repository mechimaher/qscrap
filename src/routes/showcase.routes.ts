/**
 * Showcase Routes - Enterprise Parts Marketplace
 */
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/file.middleware';
import * as showcaseController from '../controllers/showcase.controller';

const router = Router();

// ============================================
// PUBLIC ENDPOINTS
// ============================================
router.get('/parts', showcaseController.getShowcaseParts);
router.get('/parts/featured', showcaseController.getFeaturedParts);
router.get('/parts/:id', showcaseController.getPartDetail);

// ============================================
// CUSTOMER ENDPOINTS (Authenticated)
// ============================================
router.post('/quick-order', authenticate, showcaseController.quickOrderFromShowcase);
router.post('/request-quote', authenticate, showcaseController.requestQuoteFromShowcase);

// ============================================
// GARAGE ENDPOINTS (Enterprise Only)
// ============================================
router.get('/garage', authenticate, requireRole('garage'), showcaseController.getMyShowcaseParts);
router.post('/garage', authenticate, requireRole('garage'), upload.array('images', 5), showcaseController.addGaragePart);
router.put('/garage/:id', authenticate, requireRole('garage'), upload.array('images', 5), showcaseController.updateGaragePart);
router.delete('/garage/:id', authenticate, requireRole('garage'), showcaseController.deleteGaragePart);
router.post('/garage/:id/toggle', authenticate, requireRole('garage'), showcaseController.togglePartStatus);

export default router;
