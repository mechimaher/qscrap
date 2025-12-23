import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Response, NextFunction } from 'express';
import {
    getPendingGarages,
    getAllGaragesAdmin,
    approveGarage,
    rejectGarage,
    grantDemoAccess,
    revokeGarageAccess,
    getAdminDashboardStats,
    getAuditLog
} from '../controllers/admin.controller';

const router = Router();

// ============================================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Require admin role for all admin routes
 */
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.userType !== 'admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required'
        });
    }
    next();
};

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// ============================================================================
// DASHBOARD
// ============================================================================

// GET /api/admin/dashboard - Get admin dashboard stats
router.get('/dashboard', getAdminDashboardStats);

// ============================================================================
// GARAGE APPROVAL WORKFLOW
// ============================================================================

// GET /api/admin/garages/pending - Get pending approval queue
router.get('/garages/pending', getPendingGarages);

// GET /api/admin/garages - Get all garages with filters
router.get('/garages', getAllGaragesAdmin);

// POST /api/admin/garages/:garage_id/approve - Approve a garage
router.post('/garages/:garage_id/approve', approveGarage);

// POST /api/admin/garages/:garage_id/reject - Reject a garage
router.post('/garages/:garage_id/reject', rejectGarage);

// POST /api/admin/garages/:garage_id/demo - Grant demo access
router.post('/garages/:garage_id/demo', grantDemoAccess);

// POST /api/admin/garages/:garage_id/revoke - Revoke access
router.post('/garages/:garage_id/revoke', revokeGarageAccess);

// ============================================================================
// AUDIT LOG
// ============================================================================

// GET /api/admin/audit - Get admin audit log
router.get('/audit', getAuditLog);

export default router;
