"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cancellation_controller_1 = require("../controllers/cancellation.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Customer: Cancel a request (before bid accepted)
router.post('/requests/:request_id/cancel', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), cancellation_controller_1.cancelRequest);
// Garage: Withdraw a bid
router.post('/bids/:bid_id/withdraw', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), cancellation_controller_1.withdrawBid);
// Both: Get cancellation preview for an order
router.get('/orders/:order_id/cancel-preview', auth_middleware_1.authenticate, cancellation_controller_1.getCancellationPreview);
// Customer: Cancel an order
router.post('/orders/:order_id/cancel/customer', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), cancellation_controller_1.cancelOrderByCustomer);
// Garage: Cancel an order (cannot fulfill)
router.post('/orders/:order_id/cancel/garage', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), cancellation_controller_1.cancelOrderByGarage);
// Both: Get cancellation history
router.get('/history', auth_middleware_1.authenticate, cancellation_controller_1.getCancellationHistory);
exports.default = router;
