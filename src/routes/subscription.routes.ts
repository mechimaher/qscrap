import { Router } from 'express';
import {
    getSubscriptionPlans,
    getMySubscription,
    subscribeToPlan,
    changePlan,
    cancelSubscription,
    cancelPendingRequest,
    getPaymentHistory,
    createPaymentIntent,
    confirmPayment,
    // Payment Methods
    createSetupIntent,
    getPaymentMethods,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    // Invoices
    getInvoices,
    downloadInvoice
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

// Garage: Cancel pending plan change request
router.delete('/pending-request', authenticate, requireRole('garage'), cancelPendingRequest);

// ============================================
// SAVED PAYMENT METHODS
// ============================================
router.post('/payment-methods/setup', authenticate, requireRole('garage'), createSetupIntent);
router.get('/payment-methods', authenticate, requireRole('garage'), getPaymentMethods);
router.put('/payment-methods/:method_id/default', authenticate, requireRole('garage'), setDefaultPaymentMethod);
router.delete('/payment-methods/:method_id', authenticate, requireRole('garage'), deletePaymentMethod);

// ============================================
// INVOICES
// ============================================
router.get('/invoices', authenticate, requireRole('garage'), getInvoices);
router.get('/invoices/:invoice_id/download', authenticate, requireRole('garage'), downloadInvoice);

export default router;
