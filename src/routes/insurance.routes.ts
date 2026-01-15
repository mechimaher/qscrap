import { Router } from 'express';
import {
    createClaim,
    getMyClaims,
    searchParts,
    priceCompare,
    trackClaim,
    getClaimPhotos,
    getHistoryReport
} from '../controllers/insurance.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ==========================================
// EXISTING CLAIM MANAGEMENT
// ==========================================

// Agents: Create Claim
router.post('/claims', authenticate, requireRole('insurance_agent'), createClaim);

// Agents: View Claims
router.get('/claims', authenticate, requireRole('insurance_agent'), getMyClaims);

// ==========================================
// GAP-FILLING API FOR INSURANCE COMPANIES
// These endpoints solve problems insurance portals can't
// ==========================================

// Parts Search - Access to 50+ scrapyard inventory
router.post('/parts-search', authenticate, requireRole('insurance_agent'), searchParts);

// Price Comparison - Agency vs. Scrapyard pricing
router.post('/price-compare', authenticate, requireRole('insurance_agent'), priceCompare);

// Claim Tracking - Real-time order/parts tracking
router.get('/track/:claim_id', authenticate, requireRole('insurance_agent'), trackClaim);

// Photo Verification - Fraud prevention with photo proof
router.get('/photos/:claim_id', authenticate, requireRole('insurance_agent'), getClaimPhotos);

// History Report - Certified repair history (monetization)
router.get('/history/:vin_number', authenticate, requireRole('insurance_agent'), getHistoryReport);

export default router;
