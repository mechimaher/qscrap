"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public: Get available plans
router.get('/plans', subscription_controller_1.getSubscriptionPlans);
// Garage: Get my subscription
router.get('/my', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), subscription_controller_1.getMySubscription);
// Garage: Subscribe to a plan
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), subscription_controller_1.subscribeToPlan);
// Garage: Change plan (upgrade/downgrade)
router.put('/change-plan', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), subscription_controller_1.changePlan);
// Garage: Cancel subscription
router.delete('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), subscription_controller_1.cancelSubscription);
// Garage: Get payment history
router.get('/payments', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), subscription_controller_1.getPaymentHistory);
exports.default = router;
