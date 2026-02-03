/**
 * Return Service
 * Handles 7-day return window processing per Qatar Law No. 8/2008 Article 26
 * 
 * Source: Cancellation-Refund-BRAIN.md v3.0 (Section: Return Policy)
 */

import { Pool, PoolClient } from 'pg';
import { ReturnRequest, ReturnPreview, ReturnResult } from './types';
import { RETURN_POLICY, CANCELLATION_FEES } from './cancellation.constants';
import { getFraudDetectionService } from './fraud-detection.service';
import { createNotification } from '../notification.service';
import { emitToOperations } from '../../utils/socketIO';
import logger from '../../utils/logger';

export class ReturnService {
    constructor(private pool: Pool) { }

    /**
     * Get return preview - calculate fees and check eligibility
     */
    async getReturnPreview(orderId: string, customerId: string): Promise<ReturnPreview> {
        // Get order details
        const orderResult = await this.pool.query(
            `SELECT o.*, 
                    EXTRACT(EPOCH FROM (NOW() - o.actual_delivery_at)) / 3600 as hours_since_delivery,
                    pr.part_description
             FROM orders o
             LEFT JOIN bids b ON o.bid_id = b.bid_id
             LEFT JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE o.order_id = $1 AND o.customer_id = $2`,
            [orderId, customerId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found or access denied');
        }

        const order = orderResult.rows[0];

        // Check if already returned
        const existingReturn = await this.pool.query(
            `SELECT return_id FROM return_requests WHERE order_id = $1`,
            [orderId]
        );

        if (existingReturn.rows.length > 0) {
            return {
                order_id: orderId,
                order_number: order.order_number,
                can_return: false,
                days_since_delivery: 0,
                hours_remaining: 0,
                part_price: 0,
                delivery_fee: 0,
                return_fee: 0,
                delivery_fee_retained: 0,
                refund_amount: 0,
                reason: 'Return request already exists for this order'
            };
        }

        // Check if order is in returnable status
        if (!['delivered', 'completed'].includes(order.order_status)) {
            return {
                order_id: orderId,
                order_number: order.order_number,
                can_return: false,
                days_since_delivery: 0,
                hours_remaining: 0,
                part_price: 0,
                delivery_fee: 0,
                return_fee: 0,
                delivery_fee_retained: 0,
                refund_amount: 0,
                reason: `Cannot return order with status: ${order.order_status}`
            };
        }

        // Check delivery date
        if (!order.actual_delivery_at) {
            return {
                order_id: orderId,
                order_number: order.order_number,
                can_return: false,
                days_since_delivery: 0,
                hours_remaining: 0,
                part_price: 0,
                delivery_fee: 0,
                return_fee: 0,
                delivery_fee_retained: 0,
                refund_amount: 0,
                reason: 'Delivery not yet confirmed'
            };
        }

        const hoursSinceDelivery = parseFloat(order.hours_since_delivery || 0);
        const daysSinceDelivery = Math.floor(hoursSinceDelivery / 24);
        const hoursRemaining = Math.max(0, RETURN_POLICY.WINDOW_HOURS - hoursSinceDelivery);

        // Check 7-day window
        if (hoursSinceDelivery > RETURN_POLICY.WINDOW_HOURS) {
            return {
                order_id: orderId,
                order_number: order.order_number,
                can_return: false,
                days_since_delivery: daysSinceDelivery,
                hours_remaining: 0,
                part_price: parseFloat(order.part_price),
                delivery_fee: parseFloat(order.delivery_fee || 0),
                return_fee: 0,
                delivery_fee_retained: 0,
                refund_amount: 0,
                reason: `Return window expired (${RETURN_POLICY.WINDOW_DAYS} days from delivery)`
            };
        }

        // Check customer abuse limits
        const fraudService = getFraudDetectionService(this.pool);
        const canReturn = await fraudService.canCustomerReturn(customerId);

        if (!canReturn.allowed) {
            return {
                order_id: orderId,
                order_number: order.order_number,
                can_return: false,
                days_since_delivery: daysSinceDelivery,
                hours_remaining: hoursRemaining,
                part_price: parseFloat(order.part_price),
                delivery_fee: parseFloat(order.delivery_fee || 0),
                return_fee: 0,
                delivery_fee_retained: 0,
                refund_amount: 0,
                reason: canReturn.reason
            };
        }

        // Calculate fees per BRAIN spec
        const partPrice = parseFloat(order.part_price);
        const deliveryFee = parseFloat(order.delivery_fee || 0);
        const returnFee = partPrice * RETURN_POLICY.FEE_PERCENTAGE; // 20% of part price
        const deliveryFeeRetained = deliveryFee; // 100% of delivery fee
        const refundAmount = partPrice - returnFee; // Customer gets 80% of part price back

        return {
            order_id: orderId,
            order_number: order.order_number,
            can_return: true,
            days_since_delivery: daysSinceDelivery,
            hours_remaining: Math.round(hoursRemaining),
            part_price: partPrice,
            delivery_fee: deliveryFee,
            return_fee: Math.round(returnFee * 100) / 100,
            delivery_fee_retained: deliveryFeeRetained,
            refund_amount: Math.round(refundAmount * 100) / 100,
        };
    }

    /**
     * Create return request
     * Requires 3 photos as per BRAIN spec
     */
    async createReturnRequest(
        orderId: string,
        customerId: string,
        reason: 'unused' | 'defective' | 'wrong_part',
        photoUrls: string[],
        conditionDescription?: string
    ): Promise<ReturnResult> {
        // Validate photos
        if (photoUrls.length < RETURN_POLICY.REQUIRED_PHOTOS) {
            return {
                success: false,
                message: `Minimum ${RETURN_POLICY.REQUIRED_PHOTOS} photos required for return request`
            };
        }

        // Get preview to validate and get amounts
        const preview = await this.getReturnPreview(orderId, customerId);

        if (!preview.can_return) {
            return {
                success: false,
                message: preview.reason || 'Cannot process return for this order'
            };
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Create return request
            const returnResult = await client.query(
                `INSERT INTO return_requests 
                 (order_id, customer_id, reason, photo_urls, condition_description, 
                  return_fee, delivery_fee_retained, refund_amount, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
                 RETURNING return_id`,
                [
                    orderId, customerId, reason, photoUrls,
                    conditionDescription || '',
                    preview.return_fee,
                    preview.delivery_fee_retained,
                    preview.refund_amount
                ]
            );

            const returnId = returnResult.rows[0].return_id;

            // Increment customer return count
            const fraudService = getFraudDetectionService(this.pool);
            await fraudService.incrementReturnCount(customerId);

            // Get order details for notifications
            const orderResult = await client.query(
                `SELECT o.order_number, o.garage_id, g.garage_name
                 FROM orders o
                 JOIN garages g ON o.garage_id = g.garage_id
                 WHERE o.order_id = $1`,
                [orderId]
            );
            const order = orderResult.rows[0];

            await client.query('COMMIT');

            // Notify Operations (for pickup scheduling)
            emitToOperations('new_return_request', {
                return_id: returnId,
                order_id: orderId,
                order_number: order.order_number,
                customer_id: customerId,
                garage_id: order.garage_id,
                reason,
                refund_amount: preview.refund_amount,
                photos_count: photoUrls.length,
                requires_action: true
            });

            // Notify garage
            await createNotification({
                userId: order.garage_id,
                type: 'return_requested',
                title: '📦 Return Requested',
                message: `Customer requested return for Order #${order.order_number}. Reason: ${reason}`,
                data: { order_id: orderId, return_id: returnId },
                target_role: 'garage'
            });

            // Notify customer
            await createNotification({
                userId: customerId,
                type: 'return_submitted',
                title: '📦 Return Request Submitted',
                message: `Your return request for Order #${order.order_number} has been submitted. We'll schedule a pickup soon.`,
                data: { order_id: orderId, return_id: returnId },
                target_role: 'customer'
            });

            logger.info('Return request created', { returnId, orderId, refundAmount: preview.refund_amount });

            return {
                success: true,
                return_id: returnId,
                refund_amount: preview.refund_amount,
                message: `Return request submitted. You will receive ${preview.refund_amount} QAR after pickup and inspection.`
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Approve return and process refund
     * Called by Operations after pickup and inspection
     */
    async approveReturn(
        returnId: string,
        operatorId: string,
        notes?: string
    ): Promise<{ success: boolean; refund_amount: number; message: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get return request
            const returnResult = await client.query(
                `SELECT rr.*, o.order_number, o.customer_id, o.garage_id, o.total_amount
                 FROM return_requests rr
                 JOIN orders o ON rr.order_id = o.order_id
                 WHERE rr.return_id = $1
                 FOR UPDATE`,
                [returnId]
            );

            if (returnResult.rows.length === 0) {
                throw new Error('Return request not found');
            }

            const returnReq = returnResult.rows[0];

            if (returnReq.status !== 'pending' && returnReq.status !== 'picked_up' && returnReq.status !== 'inspected') {
                throw new Error(`Cannot approve return with status: ${returnReq.status}`);
            }

            // Update return status
            await client.query(
                `UPDATE return_requests 
                 SET status = 'completed', 
                     admin_notes = $2,
                     processed_at = NOW()
                 WHERE return_id = $1`,
                [returnId, notes]
            );

            // Create refund record
            await client.query(
                `INSERT INTO refunds 
                 (order_id, original_amount, refund_amount, fee_retained, 
                  delivery_fee_retained, refund_type, refund_status, refund_reason, processed_by)
                 VALUES ($1, $2, $3, $4, $5, 'return', 'pending', 'Return approved', $6)`,
                [
                    returnReq.order_id,
                    returnReq.total_amount,
                    returnReq.refund_amount,
                    returnReq.return_fee,
                    returnReq.delivery_fee_retained,
                    operatorId
                ]
            );

            // Update order status
            await client.query(
                `UPDATE orders SET order_status = 'refunded' WHERE order_id = $1`,
                [returnReq.order_id]
            );

            await client.query('COMMIT');

            // Notify customer
            await createNotification({
                userId: returnReq.customer_id,
                type: 'return_approved',
                title: '✅ Return Approved',
                message: `Your return for Order #${returnReq.order_number} has been approved. Refund of ${returnReq.refund_amount} QAR will be processed.`,
                data: { order_id: returnReq.order_id, refund_amount: returnReq.refund_amount },
                target_role: 'customer'
            });

            logger.info('Return approved', { returnId, refundAmount: returnReq.refund_amount });

            return {
                success: true,
                refund_amount: parseFloat(returnReq.refund_amount),
                message: 'Return approved and refund queued for processing'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject return request
     */
    async rejectReturn(
        returnId: string,
        operatorId: string,
        reason: string
    ): Promise<{ success: boolean; message: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get return request
            const returnResult = await client.query(
                `SELECT rr.*, o.order_number, o.customer_id
                 FROM return_requests rr
                 JOIN orders o ON rr.order_id = o.order_id
                 WHERE rr.return_id = $1
                 FOR UPDATE`,
                [returnId]
            );

            if (returnResult.rows.length === 0) {
                throw new Error('Return request not found');
            }

            const returnReq = returnResult.rows[0];

            // Update return status
            await client.query(
                `UPDATE return_requests 
                 SET status = 'rejected', 
                     admin_notes = $2,
                     processed_at = NOW()
                 WHERE return_id = $1`,
                [returnId, reason]
            );

            await client.query('COMMIT');

            // Notify customer
            await createNotification({
                userId: returnReq.customer_id,
                type: 'return_rejected',
                title: '❌ Return Request Rejected',
                message: `Your return for Order #${returnReq.order_number} was rejected: ${reason}`,
                data: { order_id: returnReq.order_id, reason },
                target_role: 'customer'
            });

            logger.info('Return rejected', { returnId, reason });

            return {
                success: true,
                message: 'Return request rejected'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get pending returns for Operations dashboard
     */
    async getPendingReturns(): Promise<ReturnRequest[]> {
        const result = await this.pool.query(
            `SELECT rr.*, o.order_number, 
                    u.full_name as customer_name, u.phone_number as customer_phone,
                    g.garage_name
             FROM return_requests rr
             JOIN orders o ON rr.order_id = o.order_id
             JOIN users u ON rr.customer_id = u.user_id
             JOIN garages g ON o.garage_id = g.garage_id
             WHERE rr.status IN ('pending', 'pickup_scheduled', 'picked_up', 'inspected')
             ORDER BY rr.created_at ASC`
        );

        return result.rows;
    }
}

// Export singleton
let returnServiceInstance: ReturnService | null = null;

export const getReturnService = (pool: Pool): ReturnService => {
    if (!returnServiceInstance) {
        returnServiceInstance = new ReturnService(pool);
    }
    return returnServiceInstance;
};
