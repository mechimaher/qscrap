import { Router } from 'express';
import {
    acceptBid,
    updateOrderStatus,
    getMyOrders,
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

const router = Router();

// Customer: Accept a bid and create order
router.post('/accept-bid/:bid_id', authenticate, requireRole('customer'), validateParams(bidIdParamSchema), acceptBid);

// Both: Get my orders (filtered by user type)
router.get('/my', authenticate, getMyOrders);

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
