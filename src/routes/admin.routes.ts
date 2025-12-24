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
    getAuditLog,
    // Phase 3: Subscription Control
    getSubscriptionPlans,
    assignPlanToGarage,
    revokeSubscription,
    extendSubscription,
    overrideCommission,
    // Phase 4: User Management
    getAllUsers,
    getAdminUserDetails,
    updateUserAdmin,
    adminSuspendUser,
    adminActivateUser,
    adminResetPassword,
    adminCreateUser
} from '../controllers/admin.controller';

// Phase 5: Reports Module
import {
    getAvailableReports,
    getDemoGaragesReport,
    getExpiredDemosReport,
    getDemoConversionsReport,
    getSubscriptionRenewalsReport,
    getCommissionRevenueReport,
    getAllGaragesReport,
    getRegistrationsReport
} from '../controllers/admin-reports.controller';

const router = Router();

// ============================================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ============================================================================

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.userType !== 'admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required'
        });
    }
    next();
};

router.use(authenticate);
router.use(requireAdmin);

// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', getAdminDashboardStats);

// ============================================================================
// GARAGE APPROVAL WORKFLOW
// ============================================================================
router.get('/garages/pending', getPendingGarages);
router.get('/garages', getAllGaragesAdmin);
router.post('/garages/:garage_id/approve', approveGarage);
router.post('/garages/:garage_id/reject', rejectGarage);
router.post('/garages/:garage_id/demo', grantDemoAccess);
router.post('/garages/:garage_id/revoke', revokeGarageAccess);

// ============================================================================
// PHASE 3: SUBSCRIPTION CONTROL
// ============================================================================
router.get('/plans', getSubscriptionPlans);
router.post('/garages/:garage_id/plan', assignPlanToGarage);
router.post('/garages/:garage_id/plan/revoke', revokeSubscription);
router.post('/garages/:garage_id/plan/extend', extendSubscription);
router.post('/garages/:garage_id/commission', overrideCommission);

// ============================================================================
// PHASE 4: USER MANAGEMENT
// ============================================================================
router.get('/users', getAllUsers);
router.post('/users/create', adminCreateUser);
router.get('/users/:user_id', getAdminUserDetails);
router.put('/users/:user_id', updateUserAdmin);
router.post('/users/:user_id/suspend', adminSuspendUser);
router.post('/users/:user_id/activate', adminActivateUser);
router.post('/users/:user_id/reset-password', adminResetPassword);

// ============================================================================
// AUDIT LOG
// ============================================================================
router.get('/audit', getAuditLog);

// ============================================================================
// PHASE 5: REPORTS MODULE
// ============================================================================
router.get('/reports', getAvailableReports);
router.get('/reports/demo-garages', getDemoGaragesReport);
router.get('/reports/expired-demos', getExpiredDemosReport);
router.get('/reports/demo-conversions', getDemoConversionsReport);
router.get('/reports/subscription-renewals', getSubscriptionRenewalsReport);
router.get('/reports/commission-revenue', getCommissionRevenueReport);
router.get('/reports/all-garages', getAllGaragesReport);
router.get('/reports/registrations', getRegistrationsReport);

export default router;

