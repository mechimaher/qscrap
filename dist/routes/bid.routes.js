"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bid_controller_1 = require("../controllers/bid.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const file_middleware_1 = require("../middleware/file.middleware");
const router = (0, express_1.Router)();
// Submit bid (Garage only) - Allow up to 10 images with validation
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), file_middleware_1.upload.array('images', 10), bid_controller_1.submitBid);
// Get my bids (Garage only)
router.get('/my', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), bid_controller_1.getMyBids);
// Update bid (Garage only) - modify pending bid
router.put('/:bid_id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), bid_controller_1.updateBid);
// Reject bid (Customer only)
router.post('/:bid_id/reject', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('customer'), bid_controller_1.rejectBid);
exports.default = router;
