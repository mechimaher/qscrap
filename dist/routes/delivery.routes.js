"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const delivery_controller_1 = require("../controllers/delivery.controller");
const router = (0, express_1.Router)();
// Zone routes - Public (for customer fee preview) or authenticated
router.get('/zones', auth_middleware_1.authenticate, delivery_controller_1.getDeliveryZones);
router.post('/calculate-fee', auth_middleware_1.authenticate, delivery_controller_1.calculateDeliveryFee);
// Admin-only zone management
router.patch('/zones/:zone_id', auth_middleware_1.authenticate, authorize_middleware_1.authorizeAdmin, delivery_controller_1.updateZoneFee);
// All other delivery routes require authentication AND operations authorization
router.use(auth_middleware_1.authenticate);
router.use(authorize_middleware_1.authorizeOperations);
// Dashboard stats
router.get('/stats', delivery_controller_1.getDeliveryStats);
// Active deliveries with live positions
router.get('/active', delivery_controller_1.getActiveDeliveries);
// Drivers
router.get('/drivers', delivery_controller_1.getDrivers);
router.get('/drivers/:driver_id', delivery_controller_1.getDriverDetails);
router.post('/drivers', delivery_controller_1.createDriver);
router.patch('/drivers/:driver_id', delivery_controller_1.updateDriver);
// Orders - Collection from garages
router.get('/collection/pending', delivery_controller_1.getOrdersReadyForCollection);
router.post('/collect/:order_id', delivery_controller_1.collectOrder);
// Orders - Delivery to customers  
router.get('/delivery/pending', delivery_controller_1.getOrdersReadyForDelivery);
// Legacy combined orders endpoint
router.get('/orders', delivery_controller_1.getOrdersForDelivery);
// Assignments
router.post('/assign/:order_id', delivery_controller_1.assignDriver);
router.post('/reassign/:assignment_id', delivery_controller_1.reassignDriver); // Emergency driver reassignment
router.patch('/assignment/:assignment_id/status', delivery_controller_1.updateDeliveryStatus);
router.post('/assignment/:assignment_id/location', delivery_controller_1.updateDriverLocation);
exports.default = router;
