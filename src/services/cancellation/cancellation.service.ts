/**
 * Cancellation Service - BRAIN v3.0 Compliant
 * Handles all cancellation workflows: requests, bids, and orders
 * 
 * Fee Structure (Cancellation-Refund-BRAIN.md v3.0):
 * - Before payment: 0%
 * - After payment (confirmed): 5%
 * - During preparation: 10%
 * - In delivery: 10% + 100% delivery fee
 * - After delivery: Use return.service.ts (20% + 100% delivery)
 */
import { Pool, PoolClient } from 'pg';
import { createNotification } from '../notification.service';
import { getIO, emitToOperations } from '../../utils/socketIO';
import {
    CancellationFeeResult,
    CancellationPreview,
    CancelRequestResult,
    WithdrawBidResult,
    CancelOrderResult,
    EnhancedCancellationPreview
} from './types';
import {
    CANCELLATION_FEES,
    STATUS_TO_STAGE,
    GARAGE_PENALTIES,
    FEE_SPLIT,
    FEE_POLICY,
    CancellationStage
} from './cancellation.constants';
import logger from '../../utils/logger';
import { getFraudDetectionService } from './fraud-detection.service';
import { smsService } from '../sms.service';

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

                getIO()?.to(`garage_${garageId}`).emit('request_cancelled', {
                    request_id: requestId,
                    message: 'The customer has cancelled this request'
                });
            }

            // Broadcast to all garages
            getIO()?.emit('request_cancelled', {
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

            getIO()?.to(`user_${bid.customer_id}`).emit('bid_withdrawn', {
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
     * Calculate cancellation fee based on order status
     * BRAIN v3.0 Compliant - See Cancellation-Refund-BRAIN.md
     * 
     * Fee Structure:
     * - BEFORE_PAYMENT: 0%
     * - AFTER_PAYMENT (confirmed): 5% (covers 2% tx + 1% refund + 2% admin)
     * - DURING_PREPARATION: 10% (5% platform + 5% garage compensation)
     * - IN_DELIVERY: 10% + 100% delivery fee
     * - AFTER_DELIVERY: Not cancellable - use return flow
     */
    private calculateCancellationFee(order: {
        total_amount: number;
        part_price?: number;
        delivery_fee?: number;
        order_status: string;
    }): CancellationFeeResult & { deliveryFeeRetained: number; stage: string } {
        const status = order.order_status;
        const totalAmount = parseFloat(String(order.total_amount));
        const deliveryFee = parseFloat(String(order.delivery_fee || 0));
        const partPrice = order.part_price ? parseFloat(String(order.part_price)) : totalAmount - deliveryFee;

        // Already cancelled
        if (status.startsWith('cancelled')) {
            return {
                feeRate: 0,
                fee: 0,
                canCancel: false,
                deliveryFeeRetained: 0,
                stage: 'CANCELLED',
                reason: 'Order already cancelled'
            };
        }

        // After delivery - use return flow instead
        if (['delivered', 'completed'].includes(status)) {
            return {
                feeRate: 0,
                fee: 0,
                canCancel: false,
                deliveryFeeRetained: 0,
                stage: 'AFTER_DELIVERY',
                reason: 'Order delivered. Use return request within 7 days.'
            };
        }

        // Refunded already
        if (status === 'refunded') {
            return {
                feeRate: 0,
                fee: 0,
                canCancel: false,
                deliveryFeeRetained: 0,
                stage: 'REFUNDED',
                reason: 'Order already refunded'
            };
        }

        // Map status to cancellation stage
        const stage = (STATUS_TO_STAGE as Record<string, CancellationStage>)[status] || 'BEFORE_PAYMENT';

        let feeRate = 0;
        let deliveryFeeRetained = 0;

        switch (stage) {
            case 'BEFORE_PAYMENT':
                // Stage 1-3: Pre-payment - FREE cancellation
                feeRate = CANCELLATION_FEES.BEFORE_PAYMENT; // 0%
                break;

            case 'AFTER_PAYMENT':
                // Stage 4: After payment, before prep - 5% fee
                feeRate = CANCELLATION_FEES.AFTER_PAYMENT; // 5%
                break;

            case 'DURING_PREPARATION':
                // Stage 5: During preparation - 10% fee
                feeRate = CANCELLATION_FEES.DURING_PREPARATION; // 10%
                break;

            case 'IN_DELIVERY':
                // Stage 6: In delivery - 10% + 100% delivery fee
                feeRate = CANCELLATION_FEES.IN_DELIVERY; // 10%
                deliveryFeeRetained = deliveryFee; // 100% delivery fee retained
                break;

            default:
                feeRate = 0;
        }

        // Calculate fee on PART PRICE only (not delivery)
        const fee = partPrice * feeRate;

        return {
            feeRate,
            fee: Math.round(fee * 100) / 100,
            canCancel: true,
            deliveryFeeRetained: Math.round(deliveryFeeRetained * 100) / 100,
            stage
        };
    }

    /**
     * Get cancellation preview (for UI)
     * Returns enhanced preview with fee breakdown per BRAIN spec
     * BRAIN v3.1 - Includes first-free and max-cap policy
     */
    async getCancellationPreview(orderId: string, userId: string): Promise<EnhancedCancellationPreview> {
        const orderResult = await this.pool.query(
            `SELECT o.*, 
                    COALESCE(pr.part_description, 'Part') as part_description,
                    o.order_number
             FROM orders o
             LEFT JOIN bids b ON o.bid_id = b.bid_id
             LEFT JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE o.order_id = $1 AND (o.customer_id = $2 OR o.garage_id = $2)`,
            [orderId, userId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];
        const feeInfo = this.calculateCancellationFee(order);

        const totalAmount = parseFloat(String(order.total_amount));
        const deliveryFee = parseFloat(String(order.delivery_fee || 0));
        const partPrice = parseFloat(String(order.part_price || (totalAmount - deliveryFee)));

        // BRAIN v3.1: Apply customer-friendly fee policy
        let finalFee = feeInfo.fee;
        let feeMessage = '';

        if (feeInfo.canCancel && feeInfo.fee > 0) {
            // Check first cancellation free policy
            if (FEE_POLICY.FIRST_CANCELLATION_FREE) {
                const prevCancellations = await this.pool.query(
                    `SELECT COUNT(*) as count FROM cancellation_requests 
                     WHERE requested_by = $1 AND requested_by_type = 'customer'`,
                    [order.customer_id]
                );
                if (parseInt(prevCancellations.rows[0].count) === 0) {
                    finalFee = 0;
                    feeMessage = 'No cancellation fee for first order';
                }
            }

            // Apply max fee cap (only if not already free)
            if (finalFee > 0 && finalFee > FEE_POLICY.MAX_FEE_QAR) {
                finalFee = FEE_POLICY.MAX_FEE_QAR;
                feeMessage = `Fee capped at ${FEE_POLICY.MAX_FEE_QAR} QAR (max limit)`;
            }
        }

        // Calculate refund with adjusted fee
        const refundAmount = feeInfo.canCancel
            ? totalAmount - finalFee - feeInfo.deliveryFeeRetained
            : 0;

        return {
            order_id: orderId,
            order_number: order.order_number,
            order_status: order.order_status,
            total_amount: totalAmount,
            part_description: order.part_description,
            part_price: partPrice,
            delivery_fee: deliveryFee,
            delivery_fee_retained: feeInfo.deliveryFeeRetained,
            can_cancel: feeInfo.canCancel,
            cancellation_fee_rate: feeInfo.feeRate,
            cancellation_fee: finalFee,
            cancellation_stage: feeInfo.stage,
            refund_amount: Math.round(refundAmount * 100) / 100,
            reason: feeMessage || feeInfo.reason,
            fee_breakdown: {
                platform_fee: Math.round(finalFee * 0.5 * 100) / 100,
                garage_compensation: Math.round(finalFee * 0.5 * 100) / 100,
                delivery_fee: feeInfo.deliveryFeeRetained
            }
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

            // BRAIN v3.1: Apply customer-friendly fee policy
            let finalFee = feeInfo.fee;

            if (feeInfo.fee > 0) {
                // Check first cancellation free policy
                if (FEE_POLICY.FIRST_CANCELLATION_FREE) {
                    const prevCancellations = await client.query(
                        `SELECT COUNT(*) as count FROM cancellation_requests 
                         WHERE requested_by = $1 AND requested_by_type = 'customer'`,
                        [customerId]
                    );
                    if (parseInt(prevCancellations.rows[0].count) === 0) {
                        finalFee = 0; // First cancellation is FREE!
                    }
                }

                // Apply max fee cap
                if (finalFee > 0 && finalFee > FEE_POLICY.MAX_FEE_QAR) {
                    finalFee = FEE_POLICY.MAX_FEE_QAR;
                }
            }

            const orderCreatedAt = new Date(order.created_at);
            const minutesSinceOrder = Math.floor((Date.now() - orderCreatedAt.getTime()) / 60000);
            const totalAmount = parseFloat(String(order.total_amount));
            const refundAmount = totalAmount - finalFee - feeInfo.deliveryFeeRetained;

            // Create cancellation request
            const cancelResult = await client.query(
                `INSERT INTO cancellation_requests 
                 (order_id, requested_by, requested_by_type, reason_code, reason_text, 
                  order_status_at_cancel, time_since_order_minutes, cancellation_fee_rate, 
                  cancellation_fee, refund_amount, status)
                 VALUES ($1, $2, 'customer', $3, $4, $5, $6, $7, $8, $9, 'processed')
                 RETURNING cancellation_id`,
                [orderId, customerId, reasonCode || 'changed_mind', reasonText,
                    order.order_status, minutesSinceOrder, feeInfo.feeRate, finalFee, refundAmount]
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
                            apiVersion: '2025-12-15.clover'
                        });

                        // G-04 FIX: Add idempotency key for Stripe-level duplicate protection
                        const stripeRefund = await stripe.refunds.create({
                            payment_intent: piResult.rows[0].provider_intent_id,
                            amount: Math.round(refundableAmount * 100), // cents
                            metadata: {
                                order_id: orderId,
                                order_number: order.order_number,
                                reason: 'customer_cancellation',
                                delivery_fee_retained: deliveryFee.toString()
                            }
                        }, {
                            idempotencyKey: `customer_cancel_${orderId}_${refundInsert.rows[0].refund_id}`
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

                        logger.info('Auto-refund processed', { refundId: stripeRefund.id, amount: refundableAmount, deliveryFeeRetained: deliveryFee });
                    } catch (stripeErr: any) {
                        logger.error('Stripe refund failed', { error: stripeErr.message });
                        // Mark refund as failed, Operations can retry
                        await client.query(
                            `UPDATE refunds SET refund_status = 'failed', 
                             refund_reason = $2 WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeErr.message]
                        );
                    }
                }
            }

            // BRAIN v3.0: Garage compensation - MANUAL REVIEW WORKFLOW
            // Philosophy: "Customer is King" - Support/Finance team decides if garage deserves compensation
            // 
            // When customer cancels during/after preparation:
            // 1. Payout is marked as "pending_compensation_review" 
            // 2. Support/Finance team reviews the reason
            // 3. They approve (garage gets 5%) or deny (garage gets 0 + possible penalty)

            const stage = feeInfo.stage as keyof typeof FEE_SPLIT;
            const feeSplit = FEE_SPLIT[stage] || { platform: 0, garage: 0 };
            const potentialCompensation = partPrice * feeSplit.garage;

            if (potentialCompensation > 0) {
                // Stage 5-7: Needs manual review by Support/Finance
                // Store potential compensation amount for review
                await client.query(
                    `UPDATE garage_payouts 
                     SET payout_status = 'pending_compensation_review',
                         potential_compensation = $2,
                         review_reason = $3,
                         adjustment_reason = 'Customer cancellation - awaiting Support/Finance review',
                         payout_type = 'cancellation_compensation',
                         updated_at = NOW()
                     WHERE order_id = $1 AND payout_status IN ('pending', 'processing')`,
                    [orderId, potentialCompensation, reasonCode || 'changed_mind']
                );

                // Record in cancellation request for visibility
                await client.query(
                    `UPDATE cancellation_requests 
                     SET garage_compensation = 0,
                         pending_compensation = $2,
                         compensation_status = 'pending_review'
                     WHERE order_id = $1 AND cancellation_id = (
                         SELECT cancellation_id FROM cancellation_requests 
                         WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1
                     )`,
                    [orderId, potentialCompensation]
                );

                logger.info('Payout awaiting compensation review', { potentialCompensation });

                // Notify Support team
                await createNotification({
                    userId: 'support_team', // Special identifier for team notifications
                    type: 'compensation_review_needed',
                    title: '🔍 Compensation Review Required',
                    message: `Order #${order.order_number} cancelled. Review if garage deserves ${potentialCompensation.toFixed(0)} QAR compensation.`,
                    data: {
                        order_id: orderId,
                        order_number: order.order_number,
                        garage_name: order.garage_name,
                        reason_code: reasonCode,
                        reason_text: reasonText,
                        potential_compensation: potentialCompensation,
                        stage: stage
                    },
                    target_role: 'operations'
                });
            } else {
                // Before preparation: no compensation possible, cancel payout entirely
                await client.query(
                    `UPDATE garage_payouts SET payout_status = 'cancelled', 
                     cancellation_reason = 'Customer cancelled before preparation',
                     cancelled_at = NOW(),
                     updated_at = NOW() 
                     WHERE order_id = $1 AND payout_status IN ('pending', 'processing')`,
                    [orderId]
                );
            }

            // Set garageCompensation to 0 for now (pending review)
            const garageCompensation = 0;

            await client.query('COMMIT');

            // Notify garage (Persistent + Socket) - include compensation info
            const compensationNote = garageCompensation > 0
                ? ` You will receive ${garageCompensation.toFixed(2)} QAR compensation for your work.`
                : '';
            await createNotification({
                userId: order.garage_id,
                type: 'order_cancelled',
                title: 'Order Cancelled 🚫',
                message: `Customer has cancelled Order #${order.order_number}.${compensationNote}`,
                data: {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'customer',
                    garage_compensation: garageCompensation
                },
                target_role: 'garage'
            });

            // PUSH: Garage - order cancelled by customer
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    order.garage_id,
                    'Order Cancelled 🚫',
                    `Customer cancelled Order #${order.order_number}`,
                    { type: 'order_cancelled', order_id: orderId, order_number: order.order_number },
                    { channelId: 'orders', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to garage failed', { error: (pushErr as Error).message });
            }

            getIO()?.to(`garage_${order.garage_id}`).emit('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'customer',
                message: 'Customer has cancelled this order'
            });

            // CR-02: Notify driver if order was in transit - critical for mid-delivery cancellations
            if (order.driver_id && ['assigned', 'picked_up', 'in_transit'].includes(order.order_status)) {
                await createNotification({
                    userId: order.driver_id,
                    type: 'order_cancelled',
                    title: '🚫 Order Cancelled',
                    message: `Order #${order.order_number} cancelled. Please return part to garage.`,
                    data: { order_id: orderId, order_number: order.order_number, action: 'return_to_garage' },
                    target_role: 'driver'
                });

                // PUSH notification to driver
                try {
                    const { pushService } = await import('../push.service');
                    await pushService.sendToUser(
                        order.driver_id,
                        '🚫 Order Cancelled',
                        `Order #${order.order_number} cancelled. Return part to garage.`,
                        { type: 'order_cancelled', order_id: orderId, order_number: order.order_number },
                        { channelId: 'orders', sound: true }
                    );
                } catch (pushErr) {
                    logger.error('Push to driver failed', { error: (pushErr as Error).message });
                }

                // Socket to driver
                getIO()?.to(`driver_${order.driver_id}`).emit('order_cancelled', {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'customer',
                    message: 'Customer cancelled. Please return part to garage.',
                    action: 'return_to_garage'
                });

                logger.info('Driver notified of cancellation', { driverId: order.driver_id, orderNumber: order.order_number });
            }

            // Notify customer about refund (in-app)
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
                    target_role: 'customer'
                });

                // SMS notification for refund confirmation (critical financial action)
                try {
                    const customerResult = await this.pool.query(
                        'SELECT phone_number FROM customers WHERE customer_id = $1',
                        [customerId]
                    );
                    if (customerResult.rows[0]?.phone_number) {
                        await smsService.sendRefundConfirmation(
                            customerResult.rows[0].phone_number,
                            order.order_number,
                            refundableAmount
                        );
                    }
                } catch (smsErr) {
                    logger.error('SMS notification failed', { error: (smsErr as Error).message });
                }
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
     * Auto-executes Stripe refund immediately
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

            // Garage can cancel up to ready_for_pickup (before driver picks up)
            const cancelableStatuses = ['confirmed', 'preparing', 'ready_for_pickup'];
            if (!cancelableStatuses.includes(order.order_status)) {
                throw new Error(`Cannot cancel order with status: ${order.order_status}`);
            }

            const orderCreatedAt = new Date(order.created_at);
            const minutesSinceOrder = Math.floor((Date.now() - orderCreatedAt.getTime()) / 60000);
            const refundAmount = parseFloat(order.total_amount);

            // Create cancellation request - garage cancellation = full refund
            const cancelResult = await client.query(
                `INSERT INTO cancellation_requests 
                 (order_id, requested_by, requested_by_type, reason_code, reason_text, 
                  order_status_at_cancel, time_since_order_minutes, cancellation_fee, 
                  refund_amount, status)
                 VALUES ($1, $2, 'garage', $3, $4, $5, $6, 0, $7, 'processed')
                 RETURNING cancellation_id`,
                [orderId, garageId, reasonCode || 'stock_out', reasonText,
                    order.order_status, minutesSinceOrder, refundAmount]
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

            let stripeRefundResult = null;

            // AUTO-EXECUTE Stripe refund for garage cancellation
            if (order.payment_status === 'paid') {
                const piResult = await client.query(
                    `SELECT provider_intent_id FROM payment_intents 
                     WHERE order_id = $1 AND status = 'succeeded' LIMIT 1`,
                    [orderId]
                );

                const refundInsert = await client.query(
                    `INSERT INTO refunds 
                     (order_id, cancellation_id, original_amount, refund_amount, fee_retained, refund_status)
                     VALUES ($1, $2, $3, $3, 0, 'processing')
                     RETURNING refund_id`,
                    [orderId, cancelResult.rows[0].cancellation_id, refundAmount]
                );

                if (piResult.rows.length > 0 && piResult.rows[0].provider_intent_id) {
                    try {
                        const Stripe = require('stripe');
                        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                            apiVersion: '2025-12-15.clover'
                        });

                        // G-04 FIX: Add idempotency key for Stripe-level duplicate protection
                        const stripeRefund = await stripe.refunds.create({
                            payment_intent: piResult.rows[0].provider_intent_id,
                            amount: Math.round(refundAmount * 100),
                            metadata: {
                                order_id: orderId,
                                order_number: order.order_number,
                                reason: 'garage_cancellation',
                                cancelled_by: 'garage'
                            }
                        }, {
                            idempotencyKey: `garage_cancel_${orderId}_${refundInsert.rows[0].refund_id}`
                        });

                        await client.query(
                            `UPDATE refunds SET 
                                refund_status = 'completed',
                                stripe_refund_id = $2,
                                processed_at = NOW()
                             WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeRefund.id]
                        );

                        await client.query(
                            `UPDATE orders SET payment_status = 'refunded' WHERE order_id = $1`,
                            [orderId]
                        );

                        stripeRefundResult = { refund_id: stripeRefund.id, amount: refundAmount };
                        logger.info('Garage-Cancel auto-refund', { refundId: stripeRefund.id, amount: refundAmount });
                    } catch (stripeErr: any) {
                        logger.error('Garage-Cancel Stripe refund failed', { error: stripeErr.message });
                        await client.query(
                            `UPDATE refunds SET refund_status = 'failed', 
                             refund_reason = $2 WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeErr.message]
                        );
                    }
                }
            }

            // CR-03: Atomic payout cancellation
            await client.query(
                `UPDATE garage_payouts SET payout_status = 'cancelled', updated_at = NOW() 
                 WHERE order_id = $1 AND payout_status IN ('pending', 'processing')`,
                [orderId]
            );

            await client.query('COMMIT');

            // Notify customer
            await createNotification({
                userId: order.customer_id,
                type: 'order_cancelled',
                title: 'Order Cancelled 🚫',
                message: stripeRefundResult
                    ? `Garage cannot fulfill Order #${order.order_number}. Refund of ${refundAmount} QAR processed.`
                    : `Garage cannot fulfill Order #${order.order_number}. Full refund will be processed.`,
                data: {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'garage',
                    refund_amount: refundAmount,
                    refund_status: stripeRefundResult ? 'completed' : 'pending'
                },
                target_role: 'customer'
            });

            // SMS notification for refund (garage cancellation = full refund)
            if (stripeRefundResult) {
                try {
                    const customerResult = await this.pool.query(
                        'SELECT phone_number FROM customers WHERE customer_id = $1',
                        [order.customer_id]
                    );
                    if (customerResult.rows[0]?.phone_number) {
                        await smsService.sendRefundConfirmation(
                            customerResult.rows[0].phone_number,
                            order.order_number,
                            refundAmount
                        );
                    }
                } catch (smsErr) {
                    logger.error('Garage-Cancel SMS notification failed', { error: (smsErr as Error).message });
                }
            }

            // PUSH: Customer
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    order.customer_id,
                    'Order Cancelled 🚫',
                    `Garage cancelled Order #${order.order_number}. Full refund ${stripeRefundResult ? 'processed' : 'incoming'}.`,
                    { type: 'order_cancelled', order_id: orderId, order_number: order.order_number },
                    { channelId: 'orders', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to customer failed', { error: (pushErr as Error).message });
            }

            // Notify driver if order was assigned
            if (order.driver_id) {
                await createNotification({
                    userId: order.driver_id,
                    type: 'order_cancelled',
                    title: '🚫 Pickup Cancelled',
                    message: `Order #${order.order_number} cancelled by garage. No pickup needed.`,
                    data: { order_id: orderId, order_number: order.order_number, action: 'cancel_pickup' },
                    target_role: 'driver'
                });

                try {
                    const { pushService } = await import('../push.service');
                    await pushService.sendToUser(
                        order.driver_id,
                        '🚫 Pickup Cancelled',
                        `Order #${order.order_number} cancelled. No pickup needed.`,
                        { type: 'order_cancelled', order_id: orderId },
                        { channelId: 'orders', sound: true }
                    );
                } catch (pushErr) {
                    logger.error('Push to driver failed', { error: (pushErr as Error).message });
                }

                getIO()?.to(`driver_${order.driver_id}`).emit('order_cancelled', {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'garage',
                    message: 'Pickup cancelled by garage.',
                    action: 'cancel_pickup'
                });
            }

            getIO()?.to(`user_${order.customer_id}`).emit('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'garage',
                message: 'Unfortunately, the garage cannot fulfill this order. Full refund will be processed.',
                refund_amount: refundAmount
            });

            // Notify Operations
            emitToOperations('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'garage',
                customer_id: order.customer_id,
                garage_id: garageId,
                cancellation_fee: 0,
                refund_amount: refundAmount,
                refund_status: stripeRefundResult ? 'completed' : 'pending',
                auto_processed: !!stripeRefundResult
            });

            return {
                message: stripeRefundResult
                    ? `Order cancelled. Refund of ${refundAmount} QAR processed.`
                    : 'Order cancelled. Customer will receive full refund.',
                impact: 'This cancellation affects your fulfillment rate.',
                refund_status: stripeRefundResult ? 'completed' : 'pending'
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

    /**
     * Cancel order (by driver)
     * Handles various driver cancellation scenarios with appropriate fee attribution
     * 
     * Fee Attribution:
     * - cant_find_garage: Platform absorbs, reassign order
     * - part_damaged_at_pickup: Garage fault, full refund to customer
     * - customer_unreachable_driver: Customer fault, 10% fee applies
     * - vehicle_issue: Platform absorbs, reassign order
     */
    async cancelOrderByDriver(
        orderId: string,
        driverId: string,
        reasonCode: 'cant_find_garage' | 'part_damaged_at_pickup' | 'customer_unreachable_driver' | 'vehicle_issue',
        reasonText?: string
    ): Promise<CancelOrderResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            // Lock and get order
            const orderResult = await client.query(
                `SELECT * FROM orders WHERE order_id = $1 AND driver_id = $2 FOR UPDATE`,
                [orderId, driverId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found or not assigned to you');
            }

            const order = orderResult.rows[0];

            // Driver can only cancel if assigned/picked_up/in_transit
            const cancelableStatuses = ['assigned', 'picked_up', 'in_transit'];
            if (!cancelableStatuses.includes(order.order_status)) {
                throw new Error(`Cannot cancel order with status: ${order.order_status}`);
            }

            const totalAmount = parseFloat(order.total_amount);
            const deliveryFee = parseFloat(order.delivery_fee || 0);
            const partPrice = totalAmount - deliveryFee;
            const orderCreatedAt = new Date(order.created_at);
            const minutesSinceOrder = Math.floor((Date.now() - orderCreatedAt.getTime()) / 60000);

            // Determine who pays based on reason
            let cancellationFee = 0;
            let refundAmount = totalAmount;
            let faultParty: 'driver' | 'garage' | 'customer' | 'platform' = 'platform';
            let newStatus = 'cancelled_by_driver';

            switch (reasonCode) {
                case 'cant_find_garage':
                case 'vehicle_issue':
                    // Platform absorbs - full refund, reassign
                    faultParty = 'platform';
                    refundAmount = totalAmount;
                    cancellationFee = 0;
                    break;

                case 'part_damaged_at_pickup':
                    // Garage fault - full refund to customer
                    faultParty = 'garage';
                    refundAmount = totalAmount;
                    cancellationFee = 0;
                    break;

                case 'customer_unreachable_driver':
                    // Customer fault - 10% fee applies + delivery retained
                    faultParty = 'customer';
                    cancellationFee = partPrice * CANCELLATION_FEES.IN_DELIVERY;
                    refundAmount = partPrice - cancellationFee; // Delivery fee not refunded
                    break;
            }

            // Create cancellation request
            const cancelResult = await client.query(
                `INSERT INTO cancellation_requests 
                 (order_id, requested_by, requested_by_type, reason_code, reason_text, 
                  order_status_at_cancel, time_since_order_minutes, cancellation_fee, 
                  refund_amount, status)
                 VALUES ($1, $2, 'driver', $3, $4, $5, $6, $7, $8, 'processed')
                 RETURNING cancellation_id`,
                [orderId, driverId, reasonCode, reasonText,
                    order.order_status, minutesSinceOrder, cancellationFee, refundAmount]
            );

            // Update order status
            await client.query(
                `UPDATE orders 
                 SET order_status = $2, 
                     driver_id = NULL,
                     updated_at = NOW()
                 WHERE order_id = $1`,
                [orderId, newStatus]
            );

            // Log status change
            await client.query(
                `INSERT INTO order_status_history 
                 (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, $2, $3, $4, 'driver', $5)`,
                [orderId, order.order_status, newStatus, driverId, reasonText || reasonCode]
            );

            let stripeRefundResult = null;

            // Process Stripe refund if order was paid
            if (order.payment_status === 'paid' && refundAmount > 0) {
                const piResult = await client.query(
                    `SELECT provider_intent_id FROM payment_intents 
                     WHERE order_id = $1 AND status = 'succeeded' LIMIT 1`,
                    [orderId]
                );

                const refundInsert = await client.query(
                    `INSERT INTO refunds 
                     (order_id, cancellation_id, original_amount, refund_amount, fee_retained, 
                      delivery_fee_retained, refund_status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'processing')
                     RETURNING refund_id`,
                    [orderId, cancelResult.rows[0].cancellation_id, totalAmount,
                        refundAmount, cancellationFee, faultParty === 'customer' ? deliveryFee : 0]
                );

                if (piResult.rows.length > 0 && piResult.rows[0].provider_intent_id) {
                    try {
                        const Stripe = require('stripe');
                        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                            apiVersion: '2025-12-15.clover'
                        });

                        // G-04 FIX: Add idempotency key for Stripe-level duplicate protection
                        const stripeRefund = await stripe.refunds.create({
                            payment_intent: piResult.rows[0].provider_intent_id,
                            amount: Math.round(refundAmount * 100),
                            metadata: {
                                order_id: orderId,
                                order_number: order.order_number,
                                reason: `driver_${reasonCode}`,
                                fault_party: faultParty
                            }
                        }, {
                            idempotencyKey: `driver_cancel_${orderId}_${refundInsert.rows[0].refund_id}`
                        });

                        await client.query(
                            `UPDATE refunds SET 
                                refund_status = 'completed',
                                stripe_refund_id = $2,
                                processed_at = NOW()
                             WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeRefund.id]
                        );

                        await client.query(
                            `UPDATE orders SET payment_status = 'refunded' WHERE order_id = $1`,
                            [orderId]
                        );

                        stripeRefundResult = { refund_id: stripeRefund.id, amount: refundAmount };
                        logger.info('Driver-Cancel refund', { refundId: stripeRefund.id, amount: refundAmount, faultParty });
                    } catch (stripeErr: any) {
                        logger.error('Driver-Cancel Stripe refund failed', { error: stripeErr.message });
                        await client.query(
                            `UPDATE refunds SET refund_status = 'failed', 
                             refund_reason = $2 WHERE refund_id = $1`,
                            [refundInsert.rows[0].refund_id, stripeErr.message]
                        );
                    }
                }
            }

            // If garage fault, record penalty
            if (faultParty === 'garage') {
                await client.query(`
                    INSERT INTO garage_penalties 
                    (garage_id, order_id, penalty_type, amount, status, notes)
                    VALUES ($1, $2, 'driver_reported_damage', $3, 'pending', $4)
                `, [order.garage_id, orderId, GARAGE_PENALTIES.DAMAGED_PART_PENALTY_QAR,
                `Driver reported part damaged at pickup: ${reasonText || 'No details'}`]);
            }

            // Cancel garage payout
            await client.query(
                `UPDATE garage_payouts SET payout_status = 'cancelled', updated_at = NOW() 
                 WHERE order_id = $1 AND payout_status IN ('pending', 'processing')`,
                [orderId]
            );

            await client.query('COMMIT');

            // Notify customer
            await createNotification({
                userId: order.customer_id,
                type: 'order_cancelled',
                title: '🚫 Delivery Cancelled',
                message: stripeRefundResult
                    ? `Order #${order.order_number} cancelled. Refund of ${refundAmount.toFixed(2)} QAR processed.`
                    : `Order #${order.order_number} has been cancelled. Refund will be processed.`,
                data: {
                    order_id: orderId,
                    order_number: order.order_number,
                    cancelled_by: 'driver',
                    reason: reasonCode,
                    refund_amount: refundAmount
                },
                target_role: 'customer'
            });

            // SMS notification for refund (driver cancellation)
            if (stripeRefundResult) {
                try {
                    const customerResult = await this.pool.query(
                        'SELECT phone_number FROM customers WHERE customer_id = $1',
                        [order.customer_id]
                    );
                    if (customerResult.rows[0]?.phone_number) {
                        await smsService.sendRefundConfirmation(
                            customerResult.rows[0].phone_number,
                            order.order_number,
                            refundAmount
                        );
                    }
                } catch (smsErr) {
                    logger.error('Driver-Cancel SMS notification failed', { error: (smsErr as Error).message });
                }
            }

            // PUSH to customer
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    order.customer_id,
                    '🚫 Delivery Cancelled',
                    `Order #${order.order_number} cancelled.`,
                    { type: 'order_cancelled', order_id: orderId },
                    { channelId: 'orders', sound: true }
                );
            } catch (pushErr) {
                logger.error('Driver-Cancel push to customer failed', { error: (pushErr as Error).message });
            }

            // Notify garage
            await createNotification({
                userId: order.garage_id,
                type: 'order_cancelled',
                title: '🚫 Delivery Issue',
                message: `Order #${order.order_number} cancelled by driver: ${reasonCode.replace(/_/g, ' ')}`,
                data: { order_id: orderId, reason: reasonCode, fault_party: faultParty },
                target_role: 'garage'
            });

            // Notify Operations for re-assignment or investigation
            emitToOperations('order_cancelled', {
                order_id: orderId,
                order_number: order.order_number,
                cancelled_by: 'driver',
                driver_id: driverId,
                customer_id: order.customer_id,
                garage_id: order.garage_id,
                reason_code: reasonCode,
                fault_party: faultParty,
                cancellation_fee: cancellationFee,
                refund_amount: refundAmount,
                refund_status: stripeRefundResult ? 'completed' : 'pending',
                requires_reassignment: ['cant_find_garage', 'vehicle_issue'].includes(reasonCode)
            });

            return {
                message: `Order cancelled (${reasonCode.replace(/_/g, ' ')}).`,
                fault_party: faultParty,
                refund_amount: refundAmount,
                refund_status: stripeRefundResult ? 'completed' : 'pending'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Cancel order by Operations (admin-level cleanup)
     * Can cancel orders in ANY status, handles refunds, releases bids
     */
    async cancelOrderByOperations(
        orderId: string,
        operationsUserId: string,
        reason: string,
        options: {
            refund_type?: 'full' | 'partial' | 'none';
            partial_refund_amount?: number;
            notify_customer?: boolean;
            notify_garage?: boolean;
        } = {}
    ): Promise<{
        success: boolean;
        message: string;
        previous_status: string;
        refund_processed: boolean;
        refund_amount?: number;
    }> {
        const client = await this.pool.connect();
        const {
            refund_type = 'full',
            notify_customer = true,
            notify_garage = true
        } = options;

        try {
            await client.query('BEGIN');

            // Get order details
            const orderResult = await client.query(
                `SELECT o.*, b.bid_id, b.request_id, r.status as request_status
                 FROM orders o
                 LEFT JOIN bids b ON o.bid_id = b.bid_id
                 LEFT JOIN part_requests r ON b.request_id = r.request_id
                 WHERE o.order_id = $1
                 FOR UPDATE`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = orderResult.rows[0];
            const previousStatus = order.order_status;

            // Skip if already cancelled
            if (previousStatus.includes('cancelled')) {
                return {
                    success: false,
                    message: `Order already cancelled (${previousStatus})`,
                    previous_status: previousStatus,
                    refund_processed: false
                };
            }

            // Update order status
            await client.query(
                `UPDATE orders 
                 SET order_status = 'cancelled_by_operations',
                     cancellation_reason = $2,
                     cancelled_by = $3,
                     cancelled_at = NOW(),
                     updated_at = NOW()
                 WHERE order_id = $1`,
                [orderId, reason, operationsUserId]
            );

            // Log status change
            await client.query(
                `INSERT INTO order_status_history 
                 (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, $2, 'cancelled_by_operations', $3, 'operations', $4)`,
                [orderId, previousStatus, operationsUserId, reason]
            );

            let refundProcessed = false;
            let refundAmount = 0;

            // Handle refund if order was paid
            if (order.payment_status === 'paid' && refund_type !== 'none') {
                const paymentIntentResult = await client.query(
                    `SELECT provider_intent_id FROM payment_intents 
                     WHERE order_id = $1 AND status = 'succeeded' 
                     ORDER BY created_at DESC LIMIT 1`,
                    [orderId]
                );

                if (paymentIntentResult.rows.length > 0) {
                    refundAmount = refund_type === 'partial'
                        ? (options.partial_refund_amount || parseFloat(order.total_amount))
                        : parseFloat(order.total_amount);

                    try {
                        const Stripe = require('stripe');
                        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                            apiVersion: '2025-12-15.clover'
                        });

                        const stripeRefund = await stripe.refunds.create({
                            payment_intent: paymentIntentResult.rows[0].provider_intent_id,
                            amount: Math.round(refundAmount * 100),
                            metadata: {
                                order_id: orderId,
                                order_number: order.order_number,
                                reason: 'operations_cancellation',
                                cancelled_by: operationsUserId
                            }
                        });

                        // Create refund record
                        await client.query(
                            `INSERT INTO refunds 
                             (order_id, original_amount, refund_amount, refund_status, 
                              stripe_refund_id, processed_by, processed_at, refund_reason)
                             VALUES ($1, $2, $3, 'completed', $4, $5, NOW(), $6)`,
                            [orderId, order.total_amount, refundAmount, stripeRefund.id,
                                operationsUserId, reason]
                        );

                        // Update payment status
                        await client.query(
                            `UPDATE orders SET payment_status = 'refunded' WHERE order_id = $1`,
                            [orderId]
                        );

                        refundProcessed = true;
                        logger.info('Operations refund processed', { amount: refundAmount, orderNumber: order.order_number });
                    } catch (stripeErr: any) {
                        logger.error('Operations Stripe refund failed', { error: stripeErr.message });
                        // Log failed refund for manual processing
                        await client.query(
                            `INSERT INTO refunds 
                             (order_id, original_amount, refund_amount, refund_status, 
                              processed_by, refund_reason)
                             VALUES ($1, $2, $3, 'failed', $4, $5)`,
                            [orderId, order.total_amount, refundAmount, operationsUserId,
                                `${reason} (Stripe error: ${stripeErr.message})`]
                        );
                    }
                }
            }

            // If order was pending_payment, release the bid back
            if (previousStatus === 'pending_payment' && order.bid_id) {
                // Reset bid status to pending so it can be accepted again
                await client.query(
                    `UPDATE bids SET status = 'pending', updated_at = NOW() 
                     WHERE bid_id = $1`,
                    [order.bid_id]
                );

                // Reactivate request if it was matched
                if (order.request_id && order.request_status === 'matched') {
                    await client.query(
                        `UPDATE part_requests SET status = 'active', updated_at = NOW() 
                         WHERE request_id = $1`,
                        [order.request_id]
                    );
                }
            }

            // CR-03: Atomic payout cancellation - prevent paying garage for cancelled orders
            await client.query(
                `UPDATE garage_payouts SET payout_status = 'cancelled', updated_at = NOW() 
                 WHERE order_id = $1 AND payout_status IN ('pending', 'processing')`,
                [orderId]
            );

            await client.query('COMMIT');

            // Send notifications
            if (notify_customer && order.customer_id) {
                await createNotification({
                    userId: order.customer_id,
                    type: 'order_cancelled',
                    title: '🚫 Order Cancelled',
                    message: refundProcessed
                        ? `Order #${order.order_number} has been cancelled. Refund of ${refundAmount} QAR processed.`
                        : `Order #${order.order_number} has been cancelled.`,
                    data: { order_id: orderId, refund_amount: refundAmount },
                    target_role: 'customer'
                });
            }

            if (notify_garage && order.garage_id) {
                await createNotification({
                    userId: order.garage_id,
                    type: 'order_cancelled',
                    title: '🚫 Order Cancelled by Operations',
                    message: `Order #${order.order_number} has been cancelled by Operations: ${reason}`,
                    data: { order_id: orderId },
                    target_role: 'garage'
                });
            }

            return {
                success: true,
                message: `Order cancelled successfully${refundProcessed ? ` (${refundAmount} QAR refunded)` : ''}`,
                previous_status: previousStatus,
                refund_processed: refundProcessed,
                refund_amount: refundAmount
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get orphan orders (stuck in limbo states)
     */
    async getOrphanOrders(): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT 
                o.order_id, o.order_number, o.order_status, o.payment_status,
                o.total_amount, o.delivery_fee, o.created_at, o.updated_at,
                c.full_name as customer_name, c.phone_number as customer_phone,
                g.garage_name, g.phone_number as garage_phone,
                EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 as hours_old
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            LEFT JOIN garages g ON o.garage_id = g.garage_id
            WHERE 
                -- Payment abandoned (pending_payment for > 2 hours)
                (o.order_status = 'pending_payment' AND o.created_at < NOW() - INTERVAL '2 hours')
                -- Stuck in processing (> 24 hours)
                OR (o.order_status IN ('pending_driver', 'driver_assigned') AND o.created_at < NOW() - INTERVAL '24 hours')
                -- Failed payment never recovered
                OR (o.payment_status = 'failed' AND o.updated_at < NOW() - INTERVAL '1 hour')
            ORDER BY o.created_at ASC
            LIMIT 50
        `);

        return result.rows;
    }
}
