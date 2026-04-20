"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Garage: Get dashboard stats
router.get('/garage/stats', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), dashboard_controller_1.getGarageStats);
// Garage: Get profile with subscription
router.get('/garage/profile', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), dashboard_controller_1.getGarageProfile);
// Garage: Update business details (CR number, bank info) - Qatar Legal Compliance
router.put('/garage/business-details', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), dashboard_controller_1.updateGarageBusinessDetails);
// Garage: Update specialization (supplier type, brands)
router.put('/garage/specialization', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), dashboard_controller_1.updateGarageSpecialization);
// Customer: Get dashboard stats
router.get('/customer/stats', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), dashboard_controller_1.getCustomerStats);
// Customer: Profile (for the profile section)
router.get('/profile', auth_middleware_1.authenticate, dashboard_controller_1.getCustomerProfile);
router.put('/profile', auth_middleware_1.authenticate, dashboard_controller_1.updateCustomerProfile);
// Customer: Addresses - DEPRECATED: Use /api/addresses instead
// Routes kept for backwards compatibility but should migrate to dedicated address routes
// Notifications (for any user type)
router.get('/notifications', auth_middleware_1.authenticate, dashboard_controller_1.getNotifications);
router.post('/notifications/:notificationId/read', auth_middleware_1.authenticate, dashboard_controller_1.markNotificationRead);
router.post('/notifications/read-all', auth_middleware_1.authenticate, dashboard_controller_1.markAllNotificationsRead);
// Shorthand routes (IMPORTANT: These match what frontend dashboards expect)
router.get('/garage', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), dashboard_controller_1.getGarageStats);
router.get('/customer', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), dashboard_controller_1.getCustomerStats);
exports.default = router;
