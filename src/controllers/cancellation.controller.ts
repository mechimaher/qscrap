import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';

// ============================================
// REQUEST CANCELLATION (by Customer)
// ============================================

export const cancelRequest = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const { reason } = req.body;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership and status
        const reqResult = await client.query(
            `SELECT * FROM part_requests 
             WHERE request_id = $1 AND customer_id = $2
             FOR UPDATE`,
            [request_id, customerId]
        );

        if (reqResult.rows.length === 0) {
            throw new Error('Request not found or access denied');
        }

        const request = reqResult.rows[0];

        if (request.status !== 'active') {
            throw new Error(`Cannot cancel request with status: ${request.status}`);
        }

        // Update request status
        await client.query(
            `UPDATE part_requests 
             SET status = 'cancelled_by_customer', 
                 cancellation_reason = $2,
                 cancelled_at = NOW()
             WHERE request_id = $1`,
            [request_id, reason || 'Customer cancelled']
        );

        // Expire all pending bids
        const bidsResult = await client.query(
            `UPDATE bids 
             SET status = 'expired', updated_at = NOW()
             WHERE request_id = $1 AND status = 'pending'
             RETURNING garage_id`,
            [request_id]
        );

        await client.query('COMMIT');

        // Notify all bidding garages (Persistent + Socket)
        const garageIds = bidsResult.rows.map(r => r.garage_id);
        for (const garageId of garageIds) {
            await createNotification({
                userId: garageId,
                type: 'request_cancelled',
                title: 'Request Cancelled',
                message: 'The customer has cancelled this request',
                data: { request_id },
                target_role: 'garage'
            });
            (global as any).io.to(`garage_${garageId}`).emit('request_cancelled', {
                request_id,
                message: 'The customer has cancelled this request'
            });
        }

        // Also broadcast to all garage room so everyone sees the request removed
        (global as any).io.emit('request_cancelled', {
            request_id,
            message: 'Request has been cancelled'
        });

        res.json({
            message: 'Request cancelled successfully',
            bids_affected: bidsResult.rowCount
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// ============================================
// BID WITHDRAWAL (by Garage)
// ============================================

export const withdrawBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const { reason } = req.body;
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership and status
        const bidResult = await client.query(
            `SELECT b.*, pr.customer_id 
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2
             FOR UPDATE OF b`,
            [bid_id, garageId]
        );

        if (bidResult.rows.length === 0) {
            throw new Error('Bid not found or access denied');
        }

        const bid = bidResult.rows[0];

        if (bid.status !== 'pending') {
            throw new Error(`Cannot withdraw bid with status: ${bid.status}`);
        }

        // Update bid status
        await client.query(
            `UPDATE bids 
             SET status = 'withdrawn', 
                 withdrawal_reason = $2,
                 withdrawn_at = NOW()
             WHERE bid_id = $1`,
            [bid_id, reason || 'Garage withdrew bid']
        );

        // Decrement request bid count
        await client.query(
            `UPDATE part_requests 
             SET bid_count = GREATEST(0, bid_count - 1)
             WHERE request_id = $1`,
            [bid.request_id]
        );

        await client.query('COMMIT');

        // Notify customer (Persistent + Socket)
        await createNotification({
            userId: bid.customer_id,
            type: 'bid_withdrawn',
            title: 'Bid Withdrawn',
            message: 'A garage has withdrawn their bid',
            data: { request_id: bid.request_id },
            target_role: 'customer'
        });

        (global as any).io.to(`user_${bid.customer_id}`).emit('bid_withdrawn', {
            request_id: bid.request_id,
            message: 'A garage has withdrawn their bid'
        });

        res.json({ message: 'Bid withdrawn successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// ============================================
// ORDER CANCELLATION
// ============================================

// Calculate cancellation fee based on order status and time
const calculateCancellationFee = (order: { created_at: Date; total_amount: number; order_status: string }): { feeRate: number; fee: number; canCancel: boolean; reason?: string } => {
    const orderCreatedAt = new Date(order.created_at);
    const now = new Date();
    const minutesSinceOrder = Math.floor((now.getTime() - orderCreatedAt.getTime()) / 60000);

    const status = order.order_status;

    // Cannot cancel these statuses
    if (['ready_for_pickup', 'in_transit', 'delivered', 'completed', 'refunded'].includes(status)) {
        return { feeRate: 0, fee: 0, canCancel: false, reason: `Cannot cancel order with status: ${status}` };
    }

    // Already cancelled
    if (status.startsWith('cancelled')) {
        return { feeRate: 0, fee: 0, canCancel: false, reason: 'Order already cancelled' };
    }

    let feeRate = 0;

    if (status === 'confirmed') {
        // Within 1 hour: free cancellation
        if (minutesSinceOrder <= 60) {
            feeRate = 0;
        } else {
            // After 1 hour: 10% fee
            feeRate = 0.10;
        }
    } else if (status === 'preparing') {
        // 25% fee during preparation
        feeRate = 0.25;
    }

    const fee = parseFloat(String(order.total_amount)) * feeRate;

    return {
        feeRate,
        fee: Math.round(fee * 100) / 100,
        canCancel: true
    };
};

// Get cancellation preview (for UI)
export const getCancellationPreview = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;

    try {
        const orderResult = await pool.query(
            `SELECT * FROM orders WHERE order_id = $1 AND (customer_id = $2 OR garage_id = $2)`,
            [order_id, userId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];
        const feeInfo = calculateCancellationFee(order);

        res.json({
            order_id,
            order_status: order.order_status,
            total_amount: order.total_amount,
            can_cancel: feeInfo.canCancel,
            cancellation_fee_rate: feeInfo.feeRate,
            cancellation_fee: feeInfo.fee,
            refund_amount: feeInfo.canCancel ? parseFloat(String(order.total_amount)) - feeInfo.fee : 0,
            reason: feeInfo.reason
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Cancel order (by Customer)
export const cancelOrderByCustomer = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason_code, reason_text } = req.body;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        // Lock and get order
        const orderResult = await client.query(
            `SELECT * FROM orders WHERE order_id = $1 AND customer_id = $2 FOR UPDATE`,
            [order_id, customerId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found or access denied');
        }

        const order = orderResult.rows[0];
        const feeInfo = calculateCancellationFee(order);

        if (!feeInfo.canCancel) {
            throw new Error(feeInfo.reason);
        }

        const orderCreatedAt = new Date(order.created_at);
        const minutesSinceOrder = Math.floor((Date.now() - orderCreatedAt.getTime()) / 60000);
        const refundAmount = parseFloat(String(order.total_amount)) - feeInfo.fee;

        // Create cancellation request
        const cancelResult = await client.query(
            `INSERT INTO cancellation_requests 
             (order_id, requested_by, requested_by_type, reason_code, reason_text, 
              order_status_at_cancel, time_since_order_minutes, cancellation_fee_rate, 
              cancellation_fee, refund_amount, status)
             VALUES ($1, $2, 'customer', $3, $4, $5, $6, $7, $8, $9, 'processed')
             RETURNING cancellation_id`,
            [order_id, customerId, reason_code || 'changed_mind', reason_text,
                order.order_status, minutesSinceOrder, feeInfo.feeRate, feeInfo.fee, refundAmount]
        );

        // Update order status
        await client.query(
            `UPDATE orders 
             SET order_status = 'cancelled_by_customer', 
                 updated_at = NOW()
             WHERE order_id = $1`,
            [order_id]
        );

        // Log status change
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, $2, 'cancelled_by_customer', $3, 'customer', $4)`,
            [order_id, order.order_status, customerId, reason_text]
        );

        // Create refund record if applicable
        if (refundAmount > 0 && order.payment_status === 'paid') {
            await client.query(
                `INSERT INTO refunds 
                 (order_id, cancellation_id, original_amount, refund_amount, fee_retained, refund_status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [order_id, cancelResult.rows[0].cancellation_id, order.total_amount, refundAmount, feeInfo.fee]
            );
        }

        await client.query('COMMIT');

        // Notify garage (Persistent + Socket)
        await createNotification({
            userId: order.garage_id,
            type: 'order_cancelled',
            title: 'Order Cancelled 🚫',
            message: `Customer has cancelled Order #${order.order_number}`,
            data: { order_id, order_number: order.order_number, cancelled_by: 'customer' },
            target_role: 'garage'
        });

        (global as any).io.to(`garage_${order.garage_id}`).emit('order_cancelled', {
            order_id,
            order_number: order.order_number,
            cancelled_by: 'customer',
            message: 'Customer has cancelled this order'
        });

        res.json({
            message: 'Order cancelled successfully',
            cancellation_fee: feeInfo.fee,
            refund_amount: refundAmount,
            refund_status: order.payment_status === 'paid' ? 'pending' : 'not_applicable'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Cancel order (by Garage)
export const cancelOrderByGarage = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason_code, reason_text } = req.body;
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        // Lock and get order
        const orderResult = await client.query(
            `SELECT * FROM orders WHERE order_id = $1 AND garage_id = $2 FOR UPDATE`,
            [order_id, garageId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found or access denied');
        }

        const order = orderResult.rows[0];

        // Garage can only cancel if not yet picked up
        const cancelableStatuses = ['confirmed', 'preparing'];
        if (!cancelableStatuses.includes(order.order_status)) {
            throw new Error(`Cannot cancel order with status: ${order.order_status}`);
        }

        const orderCreatedAt = new Date(order.created_at);
        const minutesSinceOrder = Math.floor((Date.now() - orderCreatedAt.getTime()) / 60000);

        // Create cancellation request - garage cancellation = full refund
        const cancelResult = await client.query(
            `INSERT INTO cancellation_requests 
             (order_id, requested_by, requested_by_type, reason_code, reason_text, 
              order_status_at_cancel, time_since_order_minutes, cancellation_fee, 
              refund_amount, status)
             VALUES ($1, $2, 'garage', $3, $4, $5, $6, 0, $7, 'processed')
             RETURNING cancellation_id`,
            [order_id, garageId, reason_code || 'stock_out', reason_text,
                order.order_status, minutesSinceOrder, order.total_amount]
        );

        // Update order status
        await client.query(
            `UPDATE orders 
             SET order_status = 'cancelled_by_garage', 
                 updated_at = NOW()
             WHERE order_id = $1`,
            [order_id]
        );

        // Log status change
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, $2, 'cancelled_by_garage', $3, 'garage', $4)`,
            [order_id, order.order_status, garageId, reason_text]
        );

        // Update garage fulfillment rate
        await client.query(
            `UPDATE garages 
             SET fulfillment_rate = (
                 SELECT ROUND(
                     COUNT(*) FILTER (WHERE order_status = 'completed') * 100.0 / 
                     NULLIF(COUNT(*), 0), 2
                 )
                 FROM orders 
                 WHERE garage_id = $1
             )
             WHERE garage_id = $1`,
            [garageId]
        );

        // Full refund for customer
        if (order.payment_status === 'paid') {
            await client.query(
                `INSERT INTO refunds 
                 (order_id, cancellation_id, original_amount, refund_amount, fee_retained, refund_status)
                 VALUES ($1, $2, $3, $3, 0, 'pending')`,
                [order_id, cancelResult.rows[0].cancellation_id, order.total_amount]
            );
        }

        await client.query('COMMIT');

        // Notify customer (Persistent + Socket)
        await createNotification({
            userId: order.customer_id,
            type: 'order_cancelled',
            title: 'Order Cancelled 🚫',
            message: `Garage cannot fulfill Order #${order.order_number}. Full refund will be processed.`,
            data: { order_id, order_number: order.order_number, cancelled_by: 'garage', refund_amount: order.total_amount },
            target_role: 'customer'
        });

        (global as any).io.to(`user_${order.customer_id}`).emit('order_cancelled', {
            order_id,
            order_number: order.order_number,
            cancelled_by: 'garage',
            message: 'Unfortunately, the garage cannot fulfill this order. Full refund will be processed.',
            refund_amount: order.total_amount
        });

        res.json({
            message: 'Order cancelled. Customer will receive full refund.',
            impact: 'This cancellation affects your fulfillment rate.'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get cancellation history
export const getCancellationHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const field = userType === 'customer' ? 'customer_id' : 'garage_id';

        const result = await pool.query(
            `SELECT cr.*, o.order_number, o.total_amount as order_total
             FROM cancellation_requests cr
             JOIN orders o ON cr.order_id = o.order_id
             WHERE o.${field} = $1
             ORDER BY cr.created_at DESC
             LIMIT 20`,
            [userId]
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
