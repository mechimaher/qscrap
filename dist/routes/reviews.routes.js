"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const reviews_controller_1 = require("../controllers/reviews.controller");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC: Get garage reviews (for customers viewing bids)
// ============================================
router.get('/garage/:garage_id', reviews_controller_1.getGarageReviews);
// ============================================
// GARAGE: Get my reviews
// ============================================
router.get('/my', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('garage'), reviews_controller_1.getMyReviews);
// ============================================
// OPERATIONS: Review Moderation
// ============================================
router.get('/pending', auth_middleware_1.authenticate, authorize_middleware_1.authorizeOperations, reviews_controller_1.getPendingReviews);
router.get('/all', auth_middleware_1.authenticate, authorize_middleware_1.authorizeOperations, reviews_controller_1.getAllReviews);
router.post('/:review_id/moderate', auth_middleware_1.authenticate, authorize_middleware_1.authorizeOperations, reviews_controller_1.moderateReview);
exports.default = router;
