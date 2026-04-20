"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const analytics_controller_1 = require("../controllers/analytics.controller");
const router = (0, express_1.Router)();
// All routes require garage authentication
router.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'));
// Plan features check (for frontend UI gating)
router.get('/plan-features', analytics_controller_1.getPlanFeatures);
// Analytics dashboard (requires Professional or Enterprise)
router.get('/', analytics_controller_1.getGarageAnalytics);
// Export analytics (requires Enterprise)
router.get('/export', analytics_controller_1.exportAnalytics);
// Customer insights (requires Enterprise)
router.get('/customers', analytics_controller_1.getCustomerInsights);
// Market insights (requires Enterprise)
router.get('/market', analytics_controller_1.getMarketInsights);
exports.default = router;
