import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createCounterOffer,
    respondToCounterOffer,
    customerRespondToCounter,
    getNegotiationHistory,
    getPendingCounterOffers
} from '../controllers/negotiation.controller';

const router = express.Router();

// Customer creates a counter-offer on a garage's bid
router.post('/bids/:bid_id/counter-offer', authenticate, createCounterOffer);

// Garage responds to customer's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/garage-respond', authenticate, respondToCounterOffer);

// Customer responds to garage's counter-offer (accept/reject/counter)
router.post('/counter-offers/:counter_offer_id/customer-respond', authenticate, customerRespondToCounter);

// Get negotiation history for a bid
router.get('/bids/:bid_id/negotiations', authenticate, getNegotiationHistory);

// Get pending counter-offers for garage (offers awaiting response)
router.get('/pending-offers', authenticate, getPendingCounterOffers);

export default router;
