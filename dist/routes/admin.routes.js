"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
// Phase 5: Reports Module
const admin_reports_controller_1 = require("../controllers/admin-reports.controller");
const router = (0, express_1.Router)();
// ============================================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ============================================================================
const requireAdmin = (req, res, next) => {
    if (req.user?.userType !== 'admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required'
        });
    }
    next();
};
router.use(auth_middleware_1.authenticate);
router.use(requireAdmin);
// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', admin_controller_1.getAdminDashboardStats);
// ============================================================================
// GARAGE APPROVAL WORKFLOW
// ============================================================================
router.get('/garages/pending', admin_controller_1.getPendingGarages);
router.get('/garages', admin_controller_1.getAllGaragesAdmin);
router.post('/garages/:garage_id/approve', admin_controller_1.approveGarage);
router.post('/garages/:garage_id/reject', admin_controller_1.rejectGarage);
router.post('/garages/:garage_id/demo', admin_controller_1.grantDemoAccess);
router.post('/garages/:garage_id/revoke', admin_controller_1.revokeGarageAccess);
// ============================================================================
// PHASE 3: SUBSCRIPTION CONTROL
// ============================================================================
router.get('/plans', admin_controller_1.getSubscriptionPlans);
router.post('/garages/:garage_id/plan', admin_controller_1.assignPlanToGarage);
router.post('/garages/:garage_id/plan/revoke', admin_controller_1.revokeSubscription);
router.post('/garages/:garage_id/plan/extend', admin_controller_1.extendSubscription);
router.post('/garages/:garage_id/commission', admin_controller_1.overrideCommission);
// Garage Specialization
router.put('/garages/:garage_id/specialization', admin_controller_1.updateGarageSpecializationAdmin);
// ============================================================================
// PHASE 4: USER MANAGEMENT
// ============================================================================
router.get('/users', admin_controller_1.getAllUsers);
router.post('/users/create', admin_controller_1.adminCreateUser);
router.get('/users/:user_id', admin_controller_1.getAdminUserDetails);
router.put('/users/:user_id', admin_controller_1.updateUserAdmin);
router.post('/users/:user_id/suspend', admin_controller_1.adminSuspendUser);
router.post('/users/:user_id/activate', admin_controller_1.adminActivateUser);
router.post('/users/:user_id/reset-password', admin_controller_1.adminResetPassword);
// ============================================================================
// AUDIT LOG
// ============================================================================
router.get('/audit', admin_controller_1.getAuditLog);
// ============================================================================
// PHASE 5: REPORTS MODULE
// ============================================================================
router.get('/reports', admin_reports_controller_1.getAvailableReports);
router.get('/reports/demo-garages', admin_reports_controller_1.getDemoGaragesReport);
router.get('/reports/expired-demos', admin_reports_controller_1.getExpiredDemosReport);
router.get('/reports/demo-conversions', admin_reports_controller_1.getDemoConversionsReport);
router.get('/reports/subscription-renewals', admin_reports_controller_1.getSubscriptionRenewalsReport);
router.get('/reports/commission-revenue', admin_reports_controller_1.getCommissionRevenueReport);
router.get('/reports/all-garages', admin_reports_controller_1.getAllGaragesReport);
router.get('/reports/registrations', admin_reports_controller_1.getRegistrationsReport);
exports.default = router;
