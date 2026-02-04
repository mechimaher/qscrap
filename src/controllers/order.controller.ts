/**
 * Order Controller - Refactored to use Service Layer
 * Delegates to OrderLifecycleService, OrderQueryService, and ReviewService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { getDeliveryFeeForLocation } from './delivery.controller';
import { catchAsync } from '../utils/catchAsync';
import { createOrderFromBid, undoOrder } from '../services/order.service';
import {
    OrderLifecycleService,
    OrderQueryService,
    ReviewService,
    isOrderError,
    getHttpStatusForError
} from '../services/order';
import logger from '../utils/logger';

// Initialize services
const orderLifecycleService = new OrderLifecycleService(pool);
const orderQueryService = new OrderQueryService(pool);
const reviewService = new ReviewService(pool);

// ============================================
// ORDER CREATION (uses existing order.service.ts)
// ============================================

/**
 * Accept a bid and create order
 * Uses existing createOrderFromBid service
 */
export const acceptBid = catchAsync(async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const customerId = req.user!.userId;
    const { payment_method, delivery_notes } = req.body;

    // Get delivery fee (requires request location)
    const requestResult = await pool.query(
        'SELECT delivery_lat, delivery_lng, delivery_address_text FROM part_requests WHERE request_id = (SELECT request_id FROM bids WHERE bid_id = $1)',
        [bid_id]
    );

    const request = requestResult.rows[0];

    // Calculate delivery fee (Zone-based: Garage → Customer only, not driver position)
    let delivery_fee = 10.00; // Zone 1 base fee
    let delivery_zone_id: number | null = null;
    let deliveryAddress = '';

    if (request) {
        deliveryAddress = request.delivery_address_text;
        if (request.delivery_lat && request.delivery_lng) {
            const zoneInfo = await getDeliveryFeeForLocation(
                parseFloat(request.delivery_lat),
                parseFloat(request.delivery_lng)
            );
            delivery_fee = zoneInfo.fee;
            delivery_zone_id = zoneInfo.zone_id;
        }
    }

    const { order, totalAmount } = await createOrderFromBid({
        bidId: bid_id,
        customerId,
        paymentMethod: payment_method,
        deliveryNotes: delivery_notes,
        deliveryFee: delivery_fee,
        deliveryZoneId: delivery_zone_id,
        deliveryAddress: deliveryAddress
    });

    // VVIP G-01: Include undo_deadline in response for client countdown
    res.json({
        message: 'Order created successfully',
        order_id: order.order_id,
        order_number: order.order_number,
        total_amount: totalAmount,
        undo_deadline: order.undo_deadline
    });
});

// ============================================
// UNDO ORDER (VVIP G-01: 30-Second Grace Window)
// ============================================

/**
 * Undo an order within 30-second grace window
 * POST /api/orders/:order_id/undo
 */
export const undoOrderHandler = catchAsync(async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType as 'customer' | 'garage';
    const { reason } = req.body;

    const result = await undoOrder(order_id, userId, userType, reason);

    if (!result.success) {
        // Use 409 Conflict for expired undo
        const status = result.expired ? 409 : 400;
        return res.status(status).json({
            error: result.message,
            code: result.error,
            expired: result.expired
        });
    }

    res.json({
        success: true,
        message: result.message,
        order_status: result.order_status
    });
});

// ============================================
// ORDER LIFECYCLE (uses OrderLifecycleService)
// ============================================

/**
 * Update order status (Garage only)
 * Garages can transition: confirmed → preparing → ready_for_pickup
 */
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const { order_status, notes } = req.body;
        const garageId = req.user!.userId;

        // Validate garage-allowed statuses
        const garageAllowedStatuses = ['preparing', 'ready_for_pickup'];
        if (!garageAllowedStatuses.includes(order_status)) {
            return res.status(400).json({
                error: 'Garages can only set status to "preparing" or "ready_for_pickup"',
                hint: 'Collection and delivery are handled by Operations team'
            });
        }

        const result = await orderLifecycleService.updateOrderStatus(
            order_id,
            garageId,
            order_status,
            notes
        );

        res.json({
            message: 'Status updated successfully',
            old_status: result.old_status,
            new_status: result.new_status
        });
    } catch (err) {
        logger.error('updateOrderStatus error', { error: (err as Error).message });
        if (isOrderError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Confirm delivery (Customer)
 * Marks order complete, creates payout, releases driver
 */
export const confirmDelivery = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const customerId = req.user!.userId;

        await orderLifecycleService.confirmDelivery(order_id, customerId);

        res.json({
            message: 'Delivery confirmed. Thank you!',
            prompt_review: true
        });
    } catch (err) {
        logger.error('confirmDelivery error', { error: (err as Error).message });
        if (isOrderError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ORDER QUERIES (uses OrderQueryService)
// ============================================

/**
 * Get customer's or garage's orders with pagination
 */
export const getMyOrders = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const userType = req.user!.userType;
        const { status, page, limit } = req.query;

        const result = await orderQueryService.getMyOrders(userId, userType, {
            status: status as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });

        res.json(result);
    } catch (err) {
        logger.error('getMyOrders error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get full order details with history and review
 */
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const userId = req.user!.userId;

        const result = await orderQueryService.getOrderDetails(order_id, userId);
        res.json(result);
    } catch (err) {
        logger.error('getOrderDetails error', { error: (err as Error).message });
        if (isOrderError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// REVIEWS (uses ReviewService)
// ============================================

/**
 * Submit review (Customer)
 */
export const submitReview = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const customerId = req.user!.userId;
        const { overall_rating, part_quality_rating, communication_rating, delivery_rating, review_text } = req.body;

        await reviewService.submitReview(order_id, customerId, {
            overall_rating,
            part_quality_rating,
            communication_rating,
            delivery_rating,
            review_text
        });

        res.json({ message: 'Thank you for your review!' });
    } catch (err) {
        logger.error('submitReview error', { error: (err as Error).message });
        if (isOrderError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get garage reviews (public)
 */
export const getGarageReviews = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const result = await reviewService.getGarageReviews(garage_id);
        res.json(result);
    } catch (err) {
        logger.error('getGarageReviews error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ORDER COUNT (for P2 confetti trigger)
// ============================================

/**
 * Get total order count for customer
 */
export const getOrderCount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await pool.query(
            'SELECT COUNT(*) as total FROM orders WHERE customer_id = $1',
            [userId]
        );
        res.json({ total: parseInt(result.rows[0].total, 10) });
    } catch (err) {
        logger.error('getOrderCount error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to get order count' });
    }
};
