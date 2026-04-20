"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
// Customer: Accept a bid and create order
router.post('/accept-bid/:bid_id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.bidIdParamSchema), order_controller_1.acceptBid);
// Both: Get my orders (filtered by user type)
router.get('/my', auth_middleware_1.authenticate, order_controller_1.getMyOrders);
// Both: Get order details
router.get('/:order_id', auth_middleware_1.authenticate, (0, validation_middleware_1.validateParams)(validation_middleware_1.orderIdParamSchema), order_controller_1.getOrderDetails);
// Garage: Update order status (with validation)
router.patch('/:order_id/status', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), (0, validation_middleware_1.validateParams)(validation_middleware_1.orderIdParamSchema), (0, validation_middleware_1.validate)(validation_middleware_1.updateOrderStatusSchema), order_controller_1.updateOrderStatus);
// Customer: Confirm delivery receipt
router.post('/:order_id/confirm-delivery', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.orderIdParamSchema), order_controller_1.confirmDelivery);
// Customer: Submit review for completed order
router.post('/:order_id/review', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.orderIdParamSchema), order_controller_1.submitReview);
// Public: Get garage reviews
router.get('/reviews/garage/:garage_id', order_controller_1.getGarageReviews);
exports.default = router;
