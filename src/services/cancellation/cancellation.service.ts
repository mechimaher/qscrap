/**
 * Cancellation Service
 * Handles all cancellation workflows: requests, bids, and orders
 */
import { Pool, PoolClient } from 'pg';
import { createNotification } from '../notification.service';
import { emitToOperations } from '../../utils/socketIO';
import { CancellationFeeResult, CancellationPreview, CancelRequestResult, WithdrawBidResult, CancelOrderResult } from './types';

export class CancellationService {
    constructor(private pool: Pool) { }

    /**
     * Cancel a request (by customer)
     * Expires all pending bids and notifies garages
     */
    async cancelRequest(requestId: string, customerId: string, reason?: string): Promise<CancelRequestResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ownership and status
            const reqResult = await client.query(
                `SELECT * FROM part_requests 
                 WHERE request_id = $1 AND customer_id = $2
                 FOR UPDATE`,
                [requestId, customerId]
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
                [requestId, reason || 'Customer cancelled']
            );

            // Expire all pending bids
            const bidsResult = await client.query(
                `UPDATE bids 
                 SET status = 'expired', updated_at = NOW()
                 WHERE request_id = $1 AND status = 'pending'
                 RETURNING garage_id`,
                [requestId]
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
                    data: { request_id: requestId },
                    target_role: 'garage'
                });

                (global as any).io?.to(`garage_${garageId}`).emit('request_cancelled', {
                    request_id: requestId,
                    message: 'The customer has cancelled this request'
                });
            }

            // Broadcast to all garages
            (global as any).io?.emit('request_cancelled', {
                request_id: requestId,
                message: 'Request has been cancelled'
            });

            return {
                message: 'Request cancelled successfully',
                bids_affected: bidsResult.rowCount || 0
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Withdraw a bid (by garage)
     * Updates bid status and notifies customer
     */
    async withdrawBid(bidId: string, garageId: string, reason?: string): Promise<WithdrawBidResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ownership and status
            const bidResult = await client.query(
                `SELECT b.*, pr.customer_id 
                 FROM bids b
                 JOIN part_requests pr ON b.request_id = pr.request_id
                 WHERE b.bid_id = $1 AND b.garage_id = $2
                 FOR UPDATE OF b`,
                [bidId, garageId]
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
                [bidId, reason || 'Garage withdrew bid']
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

            (global as any).io?.to(`user_${bid.customer_id}`).emit('bid_withdrawn', {
                request_id: bid.request_id,
                message: 'A garage has withdrawn their bid'
            });

            return { message: 'Bid withdrawn successfully' };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Calculate cancellation fee based on order status and time
     */
    private calculateCancellationFee(order: {
        created_at: Date;
        total_amount: number;
        order_status: string
    }): CancellationFeeResult {
        const orderCreatedAt = new Date(order.created_at);
        const now = new Date();
        const minutesSinceOrder = Math.floor((now.getTime() - orderCreatedAt.getTime()) / 60000);

        const status = order.order_status;

        // Cannot cancel these statuses
        if (['ready_for_pickup', 'in_transit', 'delivered', 'completed', 'refunded'].includes(status)) {
            return {
                feeRate: 0,
                fee: 0,
                canCancel: false,
                reason: `Cannot cancel order with status: ${status}`
            };
        }

        // Already cancelled
        if (status.startsWith('cancelled')) {
            return {
                feeRate: 0,
                fee: 0,
                canCancel: false,
                reason: 'Order already cancelled'
            };
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
    }

    /**
     * Get cancellation preview (for UI)
     */
    async getCancellationPreview(orderId: string, userId: string): Promise<CancellationPreview> {
        const orderResult = await this.pool.query(
            `SELECT * FROM orders WHERE order_id = $1 AND (customer_id = $2 OR garage_id = $2)`,
            [orderId, userId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];
        const feeInfo = this.calculateCancellationFee(order);

        return {
            order_id: orderId,
            order_status: order.order_status,
            total_amount: order.total_amount,
            can_cancel: feeInfo.canCancel,
            cancellation_fee_rate: feeInfo.feeRate,
            cancellation_fee: feeInfo.fee,
            refund_amount: feeInfo.canCancel ? parseFloat(String(order.total_amount)) - feeInfo.fee : 0,
            reason: feeInfo.reason
        };
    }

    /**
     * Cancel order (by customer)
     * Applies cancellation fee based on order status and timing
     */
    async cancelOrderByCustomer(
        orderId: string,
        customerId: string,
        reasonCode?: string,
        reasonText?: string
    ): Promise<CancelOrderResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            // Lock and get order
            const orderResult = await client.query(
                `SELECT * FROM orders WHERE order_id = $1 AND customer_id = $2 FOR UPDATE`,
                [orderId, customerId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found or access denied');
            }

            const order = orderResult.rows[0];
            const feeInfo = this.calculateCancellationFee(order);

            if (!feeInfo.canCancel) {
                throw new Error(feeInfo.reason || 'Cannot cancel this order');
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
                [orderId, customerId, reasonCode || 'changed_mind', reasonText,
                    order.order_status, minutesSinceOrder, feeInfo.feeRate, feeInfo.fee, refundAmount]
            );

            // Update order status
            await client.query(
                `UPDATE orders 
                 SET order_status = 'cancelled_by_customer', 
                     updated_at = NOW()
                 WHERE order_id = $1`,
                [orderId]
            );

            // Log status change
            await client.query(
                `INSERT INTO order_status_history 
                 (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, $2, 'cancelled_by_customer', $3, 'customer', $4)`,
                [orderId, order.order_status, customerId, reasonText]
            );

            // Calculate refund: KEEP delivery fee (not refunded per business rule)
            const deliveryFee = parseFloat(order.delivery_fee || 0);
            const partPrice = parseFloat(order.total_amount) - deliveryFee;
            const refundableAmount = Math.max(0, partPrice - feeInfo.fee); // Part price minus cancellation fee

            let stripeRefundResult = null;

            // Auto-execute Stripe refund if applicable
            if (refundableAmount > 0 && order.payment_status === 'paid') {
                // Get Stripe payment intent
                const piResult = await client.query(
                    `SELECT provider_intent_id FROM payment_intents 
                     WHERE order_id = $1 AND status = 'succeeded' LIMIT 1`,
                    [orderId]
                );

                // Create refund record
                const refundInsert = await client.query(
                    `INSERT INTO refunds 
                     (order_id, cancellation_id, original_amount, refund_amount, fee_retained, 
                      delivery_fee_retained, refund_status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'processing')
                     RETURNING refund_id`,
                    [orderId, cancelResult.rows[0].cancellation_id, order.total_amount,
                        refundableAmount, feeInfo.fee, deliveryFee]
                );

                if (piResult.rows.length > 0 && piResult.rows[0].provider_intent_id) {
                    try {
                        // Execute Stripe refund immediately
                        const Stripe = require('stripe');
                        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                            apiVersion: '2025-12-15.acacia'
                        });

                        const stripeRefund = await stripe.refunds.create({
                            payment_intent: piResult.rows[0].provider_intent_id,
                            amount: Math.round(refundableAmount * 100), // cents
                            metadata: {
                                order_id: orderId,
                                order_number: order.order_number,
                                reason: 'customer_cancellation',
                                delivery_fee_retained: deliveryFee.toString()
                            }
                        });

                        // Update refund as completed
                        await client.query(
                            `UPDATE refunds SET 
                                refund_status = 'completed',
                                stripe_refund_id = $2,
                                processed_at = NOW()
                             WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeRefund.id]
                        );

                        // Update order payment status
                        await client.query(
                            `UPDATE orders SET payment_status = 'refunded' WHERE order_id = $1`,
                            [orderId]
                        );

                        stripeRefundResult = {
                            refund_id: stripeRefund.id,
                            amount: refundableAmount,
                            status: 'completed'
                        };

                        console.log(`[Cancellation] Auto-refund ${stripeRefund.id}: ${refundableAmount} QAR (delivery fee ${deliveryFee} retained)`);
                    } catch (stripeErr: any) {
                        console.error('[Cancellation] Stripe refund failed:', stripeErr.message);
                        // Mark refund as failed, Operations can retry
                        await client.query(
                            `UPDATE refunds SET refund_status = 'failed', 
                             refund_reason = $2 WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeErr.message]
                        );
                    }
                }
            }

            await client.query('COMMIT');

            // Notify garage (Persistent + Socket)
            await createNotification({
                userId: order.garage_id,
                type: 'order_cancelled',
                title: 'Order Cancelled 🚫',
                message: `Customer has cancelled Order #${order.order_number}`,
                data: { order_id: orderId, order_number: order.order_number, cancelled_by: 'customer' },
                target_role: 'garage'
            });

            (global as any).io?.to(`garage_${order.garage_id}`).emit('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'customer',
                message: 'Customer has cancelled this order'
            });

            // Notify customer about refund (in-app + email)
            if (stripeRefundResult) {
                await createNotification({
                    userId: customerId,
                    type: 'refund_completed',
                    title: '💰 Refund Processed',
                    message: `Your refund of ${refundableAmount.toFixed(2)} QAR for Order #${order.order_number} has been processed. Delivery fee of ${deliveryFee.toFixed(2)} QAR was retained. It may take 5-10 business days to appear.`,
                    data: {
                        order_id: orderId,
                        refund_amount: refundableAmount,
                        delivery_fee_retained: deliveryFee
                    },
                    target_role: 'customer',
                    send_email: true // Send email notification
                });
            }

            // Notify Operations (for audit trail)
            emitToOperations('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'customer',
                customer_id: customerId,
                garage_id: order.garage_id,
                cancellation_fee: feeInfo.fee,
                delivery_fee_retained: deliveryFee,
                refund_amount: refundableAmount,
                refund_status: stripeRefundResult ? 'completed' : 'not_applicable',
                auto_processed: true
            });

            return {
                message: 'Order cancelled successfully',
                cancellation_fee: feeInfo.fee,
                delivery_fee_retained: deliveryFee,
                refund_amount: refundableAmount,
                refund_status: stripeRefundResult ? 'completed' : 'not_applicable'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Cancel order (by garage)
     * Full refund to customer, impacts garage fulfillment rate
     */
    async cancelOrderByGarage(
        orderId: string,
        garageId: string,
        reasonCode?: string,
        reasonText?: string
    ): Promise<CancelOrderResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            // Lock and get order
            const orderResult = await client.query(
                `SELECT * FROM orders WHERE order_id = $1 AND garage_id = $2 FOR UPDATE`,
                [orderId, garageId]
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
                [orderId, garageId, reasonCode || 'stock_out', reasonText,
                    order.order_status, minutesSinceOrder, order.total_amount]
            );

            // Update order status
            await client.query(
                `UPDATE orders 
                 SET order_status = 'cancelled_by_garage', 
                     updated_at = NOW()
                 WHERE order_id = $1`,
                [orderId]
            );

            // Log status change
            await client.query(
                `INSERT INTO order_status_history 
                 (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, $2, 'cancelled_by_garage', $3, 'garage', $4)`,
                [orderId, order.order_status, garageId, reasonText]
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
                    [orderId, cancelResult.rows[0].cancellation_id, order.total_amount]
                );
            }

            await client.query('COMMIT');

            // Notify customer (Persistent + Socket)
            await createNotification({
                userId: order.customer_id,
                type: 'order_cancelled',
                title: 'Order Cancelled 🚫',
                message: `Garage cannot fulfill Order #${order.order_number}. Full refund will be processed.`,
                data: {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'garage',
                    refund_amount: order.total_amount
                },
                target_role: 'customer'
            });

            (global as any).io?.to(`user_${order.customer_id}`).emit('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'garage',
                message: 'Unfortunately, the garage cannot fulfill this order. Full refund will be processed.',
                refund_amount: order.total_amount
            });

            // Notify Operations for urgent refund processing (Garage cancellation = full refund)
            emitToOperations('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'garage',
                customer_id: order.customer_id,
                garage_id: garageId,
                cancellation_fee: 0,
                refund_amount: order.total_amount,
                requires_refund: order.payment_status === 'paid',
                urgent: true // Garage-initiated = urgent
            });

            return {
                message: 'Order cancelled. Customer will receive full refund.',
                impact: 'This cancellation affects your fulfillment rate.'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get cancellation history
     */
    async getCancellationHistory(userId: string, userType: string) {
        const field = userType === 'customer' ? 'customer_id' : 'garage_id';

        const result = await this.pool.query(
            `SELECT cr.*, o.order_number, o.total_amount as order_total
             FROM cancellation_requests cr
             JOIN orders o ON cr.order_id = o.order_id
             WHERE o.${field} = $1
             ORDER BY cr.created_at DESC
             LIMIT 20`,
            [userId]
        );

        return result.rows;
    }
}
