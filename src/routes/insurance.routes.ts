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
    getInsuranceCompanies,
    // MOI Endpoints
    uploadMOIReport,
    getMOIReport,
    verifyMOIReport
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

// History Report - VIN lookup for vehicle claims/repair history
router.post('/history', authenticate, requireRole('insurance_agent'), getHistoryReport);

// ==========================================
// MOI ACCIDENT REPORTS
// ==========================================

// Upload MOI accident report for a claim
router.post('/claims/:claim_id/moi-report', authenticate, uploadMOIReport);

// Get MOI report for a claim
router.get('/claims/:claim_id/moi-report', authenticate, getMOIReport);

// Verify/reject MOI report (insurance adjuster)
router.patch('/moi-reports/:report_id/verify', authenticate, requireRole('insurance_agent'), verifyMOIReport);

// ==========================================
// ESCROW PAYMENTS (TODO: Implement)
// ==========================================

// Create escrow hold when approving claim
// router.post('/claims/:claim_id/escrow/hold', authenticate, requireRole('insurance_agent'), holdEscrow);

// Release escrow payment after work verification
// router.post('/claims/:claim_id/escrow/release', authenticate, requireRole('insurance_agent'), releaseEscrow);

// Get escrow status
// router.get('/escrow/status/:escrow_id', authenticate, getEscrowStatus);

// ==========================================
// PRICE BENCHMARKING & FRAUD DETECTION (TODO: Implement)
// ==========================================

// Check if quoted price is an outlier
// router.post('/price-check', authenticate, requireRole('insurance_agent'), checkPrice);

// Get benchmark statistics for a part
// router.get('/benchmarks/:part_name', authenticate, requireRole('insurance_agent'), getBenchmark);

// Record actual invoice price
// router.post('/record-price', authenticate, requireRole('insurance_agent'), recordInvoicePrice);

// Get price trend over time
// router.get('/price-trend/:part_name', authenticate, requireRole('insurance_agent'), getPriceTrend);

// Get top inflated parts (fraud detection)
// router.get('/inflated-parts', authenticate, requireRole('insurance_agent'), getInflatedParts);

export default router;
