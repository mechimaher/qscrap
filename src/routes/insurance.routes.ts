import { Router } from 'express';
import {
    createClaim,
    getMyClaims,
    searchParts,
    priceCompare,
    trackClaim,
    getClaimPhotos,
    getHistoryReport,
    // Qatar Workflow: Approval Endpoints
    getPendingApprovals,
    approveClaim,
    rejectClaim,
    getApprovedOrders,
    submitToInsurance,
    getInsuranceCompanies
} from '../controllers/insurance.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ==========================================
// QATAR WORKFLOW: APPROVAL-BASED SYSTEM
// ==========================================

// Get pending claims awaiting approval
router.get('/pending', authenticate, requireRole('insurance_agent'), getPendingApprovals);

// Approve a claim
router.post('/approve/:claim_id', authenticate, requireRole('insurance_agent'), approveClaim);

// Reject a claim
router.post('/reject/:claim_id', authenticate, requireRole('insurance_agent'), rejectClaim);

// Get approved orders for tracking
router.get('/approved', authenticate, requireRole('insurance_agent'), getApprovedOrders);

// Get list of insurance companies (public for garage dropdown)
router.get('/companies', authenticate, getInsuranceCompanies);

// Garage submits claim to insurance
router.post('/submit', authenticate, requireRole('garage'), submitToInsurance);

// ==========================================
// LEGACY/EXISTING ENDPOINTS (kept for compatibility)
// ==========================================

// Agents: Create Claim (legacy - garages should use /submit instead)
router.post('/claims', authenticate, requireRole('insurance_agent'), createClaim);

// Agents: View Claims
router.get('/claims', authenticate, requireRole('insurance_agent'), getMyClaims);

// ==========================================
// GAP-FILLING API FOR INSURANCE COMPANIES
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
