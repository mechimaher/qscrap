import { Router } from 'express';
import {
    getSubscriptionPlans,
    getMySubscription,
    subscribeToPlan,
    changePlan,
    cancelSubscription,
    getPaymentHistory,
    createPaymentIntent,
    confirmPayment
} from '../controllers/subscription.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Public: Get available plans
router.get('/plans', getSubscriptionPlans);

// Garage: Get my subscription
router.get('/my', authenticate, requireRole('garage'), getMySubscription);

// Garage: Subscribe to a plan
router.post('/', authenticate, requireRole('garage'), subscribeToPlan);

// Garage: Change plan (upgrade/downgrade)
router.put('/change-plan', authenticate, requireRole('garage'), changePlan);

// Garage: Cancel subscription
router.delete('/', authenticate, requireRole('garage'), cancelSubscription);

// Garage: Get payment history
router.get('/payments', authenticate, requireRole('garage'), getPaymentHistory);

// NEW: Garage subscription upgrade payment via Stripe
router.post('/pay', authenticate, requireRole('garage'), createPaymentIntent);
router.post('/confirm-payment', authenticate, requireRole('garage'), confirmPayment);

export default router;
