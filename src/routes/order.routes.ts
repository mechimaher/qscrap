import { Router } from 'express';
import {
    acceptBid,
    undoOrderHandler,
    updateOrderStatus,
    getMyOrders,
    getOrderCount,
    getOrderDetails,
    confirmDelivery,
    submitReview,
    getGarageReviews
} from '../controllers/order.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    validate,
    validateParams,
    updateOrderStatusSchema,
    orderIdParamSchema,
    bidIdParamSchema
} from '../middleware/validation.middleware';
import { orderWriteLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Customer: Accept a bid and create order (rate limited)
router.post('/accept-bid/:bid_id', authenticate, requireRole('customer'), orderWriteLimiter, validateParams(bidIdParamSchema), acceptBid);

// ============================================
// UNDO ORDER (VVIP G-01: 30-Second Grace Window)
// ============================================
router.post('/:order_id/undo', authenticate, validateParams(orderIdParamSchema), undoOrderHandler);

// Both: Get my orders (filtered by user type)
router.get('/my', authenticate, getMyOrders);

// ============================================
// CUSTOMER: GET ORDERS (for customer-specific view)
// ============================================
router.get('/orders', authenticate, getMyOrders);

// ============================================
// CUSTOMER: GET ORDER COUNT (for confetti trigger)
// ============================================
router.get('/orders/count', authenticate, getOrderCount);

// Both: Get order details
router.get('/:order_id', authenticate, validateParams(orderIdParamSchema), getOrderDetails);

// Garage: Update order status (with validation)
router.patch('/:order_id/status', authenticate, requireRole('garage'), validateParams(orderIdParamSchema), validate(updateOrderStatusSchema), updateOrderStatus);

// Customer: Confirm delivery receipt
router.post('/:order_id/confirm-delivery', authenticate, requireRole('customer'), validateParams(orderIdParamSchema), confirmDelivery);

// Customer: Submit review for completed order
router.post('/:order_id/review', authenticate, requireRole('customer'), validateParams(orderIdParamSchema), submitReview);

// Public: Get garage reviews
router.get('/reviews/garage/:garage_id', getGarageReviews);

export default router;

