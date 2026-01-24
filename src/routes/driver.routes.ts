import { Router, RequestHandler } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { driverLocationLimiter } from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validation.middleware';
import {
    updateLocationSchema,
    updateStatusSchema,
    uploadProofSchema,
    toggleAvailabilitySchema
} from '../schemas/driver.schema';
import {
    uploadDeliveryProof,
    getMyStats,
    getEarningsTrend,
    getPayoutHistory,
    updateProfile,
    toggleAvailability,
    getMyProfile,
    getMyAssignments,
    getAssignmentDetails,
    acceptAssignment,
    rejectAssignment,
    updateAssignmentStatus,
    updateMyLocation,
    getWallet,
    getWalletHistory
} from '../controllers/driver.controller';

const router = Router();

// All routes require driver authentication
router.use(authenticate as RequestHandler);
router.use(requireRole('driver') as RequestHandler);

// ============================================================================
// DRIVER PROFILE & STATS
// ============================================================================

// Get driver's own profile
router.get('/me', getMyProfile as unknown as RequestHandler);

// Get driver's statistics
router.get('/stats', getMyStats as unknown as RequestHandler);

// Get earnings trend (last 7 days)
router.get('/stats/trend', getEarningsTrend as unknown as RequestHandler);

// Get payout history
router.get('/payouts', getPayoutHistory as unknown as RequestHandler);

// Get Wallet Balance
router.get('/wallet', getWallet as unknown as RequestHandler);

// Get Wallet History
router.get('/wallet/history', getWalletHistory as unknown as RequestHandler);

// Update profile (including bank details)
router.patch('/profile', updateProfile as unknown as RequestHandler);

// Toggle availability (available/offline)
router.post('/availability', validate(toggleAvailabilitySchema), toggleAvailability as unknown as RequestHandler);

// ============================================================================
// ASSIGNMENTS
// ============================================================================

// Get driver's assignments (active by default)
router.get('/assignments', getMyAssignments as unknown as RequestHandler);

// Accept pending assignment (P0 Critical - Jan 2026)
router.post('/assignments/:assignment_id/accept', acceptAssignment as unknown as RequestHandler);

// Reject pending assignment (P0 Critical - Jan 2026)
router.post('/assignments/:assignment_id/reject', rejectAssignment as unknown as RequestHandler);

// Get specific assignment details
router.get('/assignments/:assignment_id', getAssignmentDetails as unknown as RequestHandler);

// Update assignment status (picked_up, in_transit, delivered, failed)
router.patch('/assignments/:assignment_id/status', validate(updateStatusSchema), updateAssignmentStatus as unknown as RequestHandler);

// Upload proof of delivery
router.post('/assignments/:assignment_id/proof', validate(uploadProofSchema), uploadDeliveryProof as unknown as RequestHandler);

// ============================================================================
// LOCATION TRACKING (Rate Limited)
// ============================================================================

// Update driver's current location - RATE LIMITED: 1 per 5 seconds
router.post('/location', driverLocationLimiter, validate(updateLocationSchema), updateMyLocation as unknown as RequestHandler);

export default router;
