/**
 * Order Controller - Refactored to use Service Layer
 * Delegates to OrderLifecycleService, OrderQueryService, and ReviewService
 */

import { Response } from 'express';
import pool from '../config/db';
import { getDeliveryFeeForLocation } from './delivery.controller';
import { AuthRequest } from '../middleware/auth.middleware';
import { createOrderFromBid, undoOrder } from '../services/order.service';
import {
    getHttpStatusForError,
    isOrderError,
    OrderLifecycleService,
    OrderQueryService,
    ReviewService,
    type ReviewData
} from '../services/order';
import { getErrorMessage } from '../types';
import { catchAsync } from '../utils/catchAsync';
import logger from '../utils/logger';

const orderLifecycleService = new OrderLifecycleService(pool);
const orderQueryService = new OrderQueryService(pool);
const reviewService = new ReviewService(pool);

const GARAGE_ALLOWED_STATUSES = ['preparing', 'ready_for_pickup'] as const;

interface BidParams {
    bid_id: string;
}

interface OrderParams {
    order_id: string;
}

interface GarageParams {
    garage_id: string;
}

interface AcceptBidBody {
    payment_method?: string;
    delivery_notes?: string;
}

interface UndoOrderBody {
    reason?: string;
}

interface UpdateOrderStatusBody {
    order_status?: string;
    notes?: string;
}

interface SubmitReviewBody {
    overall_rating?: number | string;
    part_quality_rating?: number | string;
    communication_rating?: number | string;
    delivery_rating?: number | string;
    review_text?: string;
}

interface RequestLocationRow {
    delivery_lat: string | number | null;
    delivery_lng: string | number | null;
    delivery_address_text: string | null;
}

interface OrderCountRow {
    total: string;
}

type JsonRecord = Record<string, unknown>;

const getUserContext = (req: AuthRequest): { userId: string; userType: string } | null => {
    if (!req.user?.userId || !req.user.userType) {
        return null;
    }
    return { userId: req.user.userId, userType: req.user.userType };
};

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const toRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const logOrderError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

const sendOrderError = (res: Response, error: unknown, fallbackMessage: string): Response => {
    if (isOrderError(error)) {
        return res.status(getHttpStatusForError(error)).json({ error: getErrorMessage(error) });
    }
    return res.status(500).json({ error: fallbackMessage });
};

// ============================================
// ORDER CREATION (uses existing order.service.ts)
// ============================================

/**
 * Accept a bid and create order
 * Uses existing createOrderFromBid service
 */
export const acceptBid = catchAsync(async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const { bid_id: bidId } = req.params as unknown as BidParams;
    const body = req.body as unknown as AcceptBidBody;
    const paymentMethod = toQueryString(body.payment_method);
    const deliveryNotes = toQueryString(body.delivery_notes);

    // Get delivery fee (requires request location)
    const requestResult = await pool.query<RequestLocationRow>(
        'SELECT delivery_lat, delivery_lng, delivery_address_text FROM part_requests WHERE request_id = (SELECT request_id FROM bids WHERE bid_id = $1)',
        [bidId]
    );

    const request = requestResult.rows[0];

    // Calculate delivery fee (Zone-based: Garage → Customer only, not driver position)
    let deliveryFee = 10.00; // Zone 1 base fee
    let deliveryZoneId: number | null = null;
    let deliveryAddress = '';

    if (request) {
        deliveryAddress = request.delivery_address_text ?? '';
        const deliveryLat = toOptionalNumber(request.delivery_lat);
        const deliveryLng = toOptionalNumber(request.delivery_lng);
        if (deliveryLat !== undefined && deliveryLng !== undefined) {
            const zoneInfo = await getDeliveryFeeForLocation(
                deliveryLat,
                deliveryLng
            );
            deliveryFee = zoneInfo.fee;
            deliveryZoneId = zoneInfo.zone_id;
        }
    }

    const createResult = await createOrderFromBid({
        bidId,
        customerId: user.userId,
        paymentMethod: paymentMethod ?? 'card',
        deliveryNotes,
        deliveryFee,
        deliveryZoneId,
        deliveryAddress
    });
    const order = toRecord(createResult.order);
    if (!order) {
        return res.status(500).json({ error: 'Failed to create order' });
    }
    const orderId = toQueryString(order.order_id);
    const orderNumber = toQueryString(order.order_number);
    const undoDeadline = toQueryString(order.undo_deadline);
    if (!orderId || !orderNumber) {
        return res.status(500).json({ error: 'Invalid order response from service' });
    }

    // VVIP G-01: Include undo_deadline in response for client countdown
    res.json({
        message: 'Order created successfully',
        order_id: orderId,
        order_number: orderNumber,
        total_amount: createResult.totalAmount,
        undo_deadline: undoDeadline
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
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const { order_id: orderId } = req.params as unknown as OrderParams;
    const body = req.body as unknown as UndoOrderBody;
    const reason = toQueryString(body.reason);

    if (user.userType !== 'customer' && user.userType !== 'garage') {
        return res.status(403).json({ error: 'Only customers and garages can undo orders' });
    }

    const result = await undoOrder(orderId, user.userId, user.userType, reason);

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
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;
        const body = req.body as unknown as UpdateOrderStatusBody;
        const orderStatus = toQueryString(body.order_status);
        const notes = toQueryString(body.notes);

        // Validate garage-allowed statuses
        if (!orderStatus || !GARAGE_ALLOWED_STATUSES.includes(orderStatus as (typeof GARAGE_ALLOWED_STATUSES)[number])) {
            return res.status(400).json({
                error: 'Garages can only set status to "preparing" or "ready_for_pickup"',
                hint: 'Collection and delivery are handled by Operations team'
            });
        }

        const result = await orderLifecycleService.updateOrderStatus(
            orderId,
            user.userId,
            orderStatus,
            notes
        );

        res.json({
            message: 'Status updated successfully',
            old_status: result.old_status,
            new_status: result.new_status
        });
    } catch (error) {
        logOrderError('updateOrderStatus error', error);
        return sendOrderError(res, error, 'Failed to update order status');
    }
};

/**
 * Confirm delivery (Customer)
 * Marks order complete, creates payout, releases driver
 */
export const confirmDelivery = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;

        await orderLifecycleService.confirmDelivery(orderId, user.userId);

        res.json({
            message: 'Delivery confirmed. Thank you!',
            prompt_review: true
        });
    } catch (error) {
        logOrderError('confirmDelivery error', error);
        return sendOrderError(res, error, 'Failed to confirm delivery');
    }
};

// ============================================
// ORDER QUERIES (uses OrderQueryService)
// ============================================

/**
 * Get customer's or garage's orders with pagination
 */
export const getMyOrders = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await orderQueryService.getMyOrders(user.userId, user.userType, {
            status: toQueryString(req.query.status),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        });

        res.json(result);
    } catch (error) {
        logOrderError('getMyOrders error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

/**
 * Get full order details with history and review
 */
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;

        const result = await orderQueryService.getOrderDetails(orderId, user.userId);
        res.json(result);
    } catch (error) {
        logOrderError('getOrderDetails error', error);
        return sendOrderError(res, error, 'Failed to fetch order details');
    }
};

// ============================================
// REVIEWS (uses ReviewService)
// ============================================

/**
 * Submit review (Customer)
 */
export const submitReview = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;
        const body = req.body as unknown as SubmitReviewBody;
        const overallRating = toOptionalNumber(body.overall_rating);
        const partQualityRating = toOptionalNumber(body.part_quality_rating);
        const communicationRating = toOptionalNumber(body.communication_rating);
        const deliveryRating = toOptionalNumber(body.delivery_rating);
        const reviewText = toQueryString(body.review_text);

        if (overallRating === undefined) {
            return res.status(400).json({ error: 'overall_rating is required' });
        }

        const reviewData: ReviewData = {
            overall_rating: overallRating,
            part_quality_rating: partQualityRating,
            communication_rating: communicationRating,
            delivery_rating: deliveryRating,
            review_text: reviewText
        };

        await reviewService.submitReview(orderId, user.userId, reviewData);

        res.json({ message: 'Thank you for your review!' });
    } catch (error) {
        logOrderError('submitReview error', error);
        return sendOrderError(res, error, 'Failed to submit review');
    }
};

/**
 * Get garage reviews (public)
 */
export const getGarageReviews = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id: garageId } = req.params as unknown as GarageParams;
        const result = await reviewService.getGarageReviews(garageId);
        res.json(result);
    } catch (error) {
        logOrderError('getGarageReviews error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

// ============================================
// ORDER COUNT (for P2 confetti trigger)
// ============================================

/**
 * Get total order count for customer
 */
export const getOrderCount = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await pool.query<OrderCountRow>(
            'SELECT COUNT(*) as total FROM orders WHERE customer_id = $1',
            [user.userId]
        );
        const total = Number.parseInt(result.rows[0]?.total ?? '0', 10);
        res.json({ total: Number.isFinite(total) ? total : 0 });
    } catch (error) {
        logOrderError('getOrderCount error', error);
        res.status(500).json({ error: 'Failed to get order count' });
    }
};
