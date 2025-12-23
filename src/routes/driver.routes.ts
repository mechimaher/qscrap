import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { driverLocationLimiter } from '../middleware/rateLimiter.middleware';
import {
    getMyProfile,
    getMyAssignments,
    getAssignmentDetails,
    updateMyLocation,
    updateAssignmentStatus,
    uploadDeliveryProof,
    getMyStats,
    toggleAvailability
} from '../controllers/driver.controller';

const router = Router();

// All routes require driver authentication
router.use(authenticate);
router.use(requireRole('driver'));

// ============================================================================
// DRIVER PROFILE & STATS
// ============================================================================

// Get driver's own profile
router.get('/me', getMyProfile);

// Get driver's statistics
router.get('/stats', getMyStats);

// Toggle availability (available/offline)
router.post('/availability', toggleAvailability);

// ============================================================================
// ASSIGNMENTS
// ============================================================================

// Get driver's assignments (active by default)
router.get('/assignments', getMyAssignments);

// Get specific assignment details
router.get('/assignments/:assignment_id', getAssignmentDetails);

// Update assignment status (picked_up, in_transit, delivered, failed)
router.patch('/assignments/:assignment_id/status', updateAssignmentStatus);

// Upload proof of delivery
router.post('/assignments/:assignment_id/proof', uploadDeliveryProof);

// ============================================================================
// LOCATION TRACKING (Rate Limited)
// ============================================================================

// Update driver's current location - RATE LIMITED: 1 per 5 seconds
router.post('/location', driverLocationLimiter, updateMyLocation);

export default router;
