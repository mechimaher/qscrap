"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const negotiation_controller_1 = require("../controllers/negotiation.controller");
const router = express_1.default.Router();
// All negotiation routes require authentication
router.use(auth_middleware_1.authenticate);
// ============================================
// CUSTOMER ROUTES
// ============================================
// Customer creates a counter-offer on a garage's bid
router.post('/bids/:bid_id/counter-offer', (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.bidIdParamSchema), negotiation_controller_1.createCounterOffer);
// Customer responds to garage's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/customer-respond', (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.counterOfferIdParamSchema), negotiation_controller_1.customerRespondToCounter);
// Customer accepts garage's last counter-offer (even after negotiation rounds ended)
router.post('/bids/:bid_id/accept-last-offer', (0, auth_middleware_1.requireRole)('customer'), (0, validation_middleware_1.validateParams)(validation_middleware_1.bidIdParamSchema), negotiation_controller_1.acceptLastGarageOffer);
// ============================================
// GARAGE ROUTES
// ============================================
// Garage responds to customer's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/garage-respond', (0, auth_middleware_1.requireRole)('garage'), (0, validation_middleware_1.validateParams)(validation_middleware_1.counterOfferIdParamSchema), negotiation_controller_1.respondToCounterOffer);
// Get pending counter-offers for garage (offers awaiting response)
router.get('/pending-offers', (0, auth_middleware_1.requireRole)('garage'), negotiation_controller_1.getPendingCounterOffers);
// ============================================
// SHARED ROUTES (Both customer and garage can view)
// ============================================
// Get negotiation history for a bid (ownership verified in controller)
router.get('/bids/:bid_id/negotiations', (0, validation_middleware_1.validateParams)(validation_middleware_1.bidIdParamSchema), negotiation_controller_1.getNegotiationHistory);
exports.default = router;
