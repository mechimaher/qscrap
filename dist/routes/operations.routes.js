"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const operations_controller_1 = require("../controllers/operations.controller");
const router = (0, express_1.Router)();
// All operations routes require authentication AND operations authorization
router.use(auth_middleware_1.authenticate);
router.use(authorize_middleware_1.authorizeOperations);
// Dashboard & Analytics
router.get('/dashboard/stats', operations_controller_1.getDashboardStats);
router.get('/analytics', operations_controller_1.getAnalytics);
// Quality Control
router.get('/quality/stats', operations_controller_1.getQualityStats);
// Orders
router.get('/orders', operations_controller_1.getOrders);
router.get('/orders/:order_id', operations_controller_1.getOrderDetails);
router.patch('/orders/:order_id/status', operations_controller_1.updateOrderStatus);
router.post('/orders/:order_id/collect', operations_controller_1.collectOrder);
// Disputes
router.get('/disputes', operations_controller_1.getDisputes);
router.get('/disputes/:dispute_id', operations_controller_1.getDisputeDetails);
router.post('/disputes/:dispute_id/resolve', operations_controller_1.resolveDispute);
// Return Assignments
router.get('/returns', operations_controller_1.getPendingReturns);
router.get('/returns/stats', operations_controller_1.getReturnStats);
router.post('/returns/:assignment_id/assign-driver', operations_controller_1.assignDriverToReturn);
// Users
router.get('/users', operations_controller_1.getUsers);
router.get('/users/stats', operations_controller_1.getUserStats);
router.get('/users/:user_id', operations_controller_1.getUserDetails);
router.post('/users/:user_id/suspend', operations_controller_1.suspendUser);
router.post('/users/:user_id/activate', operations_controller_1.activateUser);
// Garages
router.get('/garages', operations_controller_1.getGarages);
exports.default = router;
