import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validateParams, bidIdParamSchema, counterOfferIdParamSchema } from '../middleware/validation.middleware';
import {
    createCounterOffer,
    respondToCounterOffer,
    customerRespondToCounter,
    getNegotiationHistory,
    getPendingCounterOffers,
    acceptLastGarageOffer
} from '../controllers/negotiation.controller';

const router = express.Router();

// All negotiation routes require authentication
router.use(authenticate);

// ============================================
// CUSTOMER ROUTES
// ============================================

// Customer creates a counter-offer on a garage's bid
router.post('/bids/:bid_id/counter-offer', requireRole('customer'), validateParams(bidIdParamSchema), createCounterOffer);

// Customer responds to garage's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/customer-respond', requireRole('customer'), validateParams(counterOfferIdParamSchema), customerRespondToCounter);

// Customer accepts garage's last counter-offer (even after negotiation rounds ended)
router.post('/bids/:bid_id/accept-last-offer', requireRole('customer'), validateParams(bidIdParamSchema), acceptLastGarageOffer);

// ============================================
// GARAGE ROUTES
// ============================================

// Garage responds to customer's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/garage-respond', requireRole('garage'), validateParams(counterOfferIdParamSchema), respondToCounterOffer);

// Get pending counter-offers for garage (offers awaiting response)
router.get('/pending-offers', requireRole('garage'), getPendingCounterOffers);

// ============================================
// SHARED ROUTES (Both customer and garage can view)
// ============================================

// Get negotiation history for a bid (ownership verified in controller)
router.get('/bids/:bid_id/negotiations', validateParams(bidIdParamSchema), getNegotiationHistory);

export default router;
