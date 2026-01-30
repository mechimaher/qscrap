/**
 * RefundService - Business Logic for Refunds
 * Handles refund creation, processing, and payout adjustments
 */

import { Pool, PoolClient } from 'pg';
import {
    Refund,
    CreateRefundDto,
    RefundResult,
    RefundDetail
} from './types';
import {
    RefundNotFoundError,
    OrderNotFoundError,
    InvalidRefundAmountError,
    RefundAlreadyProcessedError
} from './errors';

export class RefundService {
    constructor(private pool: Pool) { }

    /**
     * Create refund with automatic payout adjustment
     * Creates refund record and adjusts garage payout if applicable
     * 
     * IMPORTANT: Delivery fee is retained on customer refusals to protect business
     */
    async createRefund(details: CreateRefundDto): Promise<RefundResult> {
        const client = await this.pool.connect();
        try {
            // FIX CC-01: Use SERIALIZABLE isolation for strongest double-refund protection
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            // Get order details
            const orderResult = await client.query(
                `SELECT o.*, gp.payout_id, gp.net_amount as payout_amount, gp.payout_status,
                        da.assignment_id as has_driver_assigned
                 FROM orders o
                 LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
                 LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
                 WHERE o.order_id = $1
                 FOR UPDATE OF o`,
                [details.order_id]
            );

            if (orderResult.rows.length === 0) {
                throw new OrderNotFoundError(details.order_id);
            }

            const order = orderResult.rows[0];
            const deliveryFee = parseFloat(order.delivery_fee || 0);
            const driverAssigned = !!order.has_driver_assigned;

            // Determine refund type (default to customer_refusal if driver was assigned)
            // FIX T-02: First validate order status allows refund
            const refundableStates = [
                'confirmed', 'processing', 'awaiting_pickup', 'in_delivery',
                'delivered', 'completed', 'disputed'
            ];
            if (!refundableStates.includes(order.order_status)) {
                throw new Error(`Cannot refund order with status: ${order.order_status}. Order must be in refundable state.`);
            }

            // FIX SM-01: Check 7-day warranty for post-delivery refunds
            if (['delivered', 'completed'].includes(order.order_status)) {
                const deliveredAt = new Date(order.delivered_at || order.completed_at || order.created_at);
                const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince > 7) {
                    throw new Error(`Order past 7-day warranty (${Math.ceil(daysSince)} days). Please escalate to operations manager.`);
                }
            }

            const refundType = details.refund_type ||

                (driverAssigned ? 'customer_refusal' : 'cancelled_before_dispatch');

            // Calculate delivery fee to retain based on refund type
            let deliveryFeeRetained = 0;
            if (refundType === 'customer_refusal' || refundType === 'wrong_part') {
                // Customer caused the issue - retain delivery fee
                deliveryFeeRetained = deliveryFee;
            } else if (refundType === 'cancelled_before_dispatch' && driverAssigned) {
                // Driver was already assigned when cancelled - retain fee
                deliveryFeeRetained = deliveryFee;
            }
            // driver_failure or cancelled_before_dispatch (no driver) = no fee retained

            // Calculate maximum refundable amount
            const partAmount = parseFloat(order.total_amount) - deliveryFee;
            const maxRefundable = partAmount + (deliveryFee - deliveryFeeRetained);

            // Validate refund amount
            if (details.refund_amount > maxRefundable) {
                throw new InvalidRefundAmountError(details.refund_amount, maxRefundable);
            }

            // Check if refund already exists
            const existingRefund = await client.query(
                `SELECT refund_id FROM refunds WHERE order_id = $1`,
                [details.order_id]
            );

            if (existingRefund.rows.length > 0) {
                throw new RefundAlreadyProcessedError(details.order_id);
            }

            // FIX CS-01: Include idempotency_key if provided
            const refundResult = await client.query(
                `INSERT INTO refunds (
                    order_id, original_amount, refund_amount, refund_reason, 
                    refund_method, initiated_by, refund_status, refund_type, 
                    delivery_fee_retained, idempotency_key
                 ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
                 ON CONFLICT (order_id, refund_type) DO NOTHING
                 RETURNING *`,
                [details.order_id, order.total_amount, details.refund_amount, details.refund_reason,
                details.refund_method || 'original_payment', details.initiated_by,
                    refundType, deliveryFeeRetained, (details as any).idempotency_key || null]
            );

            // Handle ON CONFLICT case (duplicate refund attempt)
            if (refundResult.rows.length === 0) {
                throw new RefundAlreadyProcessedError(details.order_id);
            }

            const refund = refundResult.rows[0];
            let payoutAdjustment;

            // Adjust payout if it exists and hasn't been paid yet
            if (order.payout_id && ['pending', 'processing'].includes(order.payout_status)) {
                const refundPortion = details.refund_amount / order.total_amount;
                const payoutReduction = order.payout_amount * refundPortion;
                const newPayoutAmount = order.payout_amount - payoutReduction;

                await client.query(
                    `UPDATE garage_payouts 
                     SET net_amount = $1,
                         adjustment_reason = $2,
                         updated_at = NOW()
                     WHERE payout_id = $3`,
                    [newPayoutAmount, `Refund: ${details.refund_reason}`, order.payout_id]
                );

                payoutAdjustment = {
                    payout_id: order.payout_id,
                    original_amount: order.payout_amount,
                    adjusted_amount: newPayoutAmount,
                    reversal_created: false
                };
            } else if (order.payout_id && ['completed', 'confirmed'].includes(order.payout_status)) {
                // Create reversal payout (negative amount)
                const refundPortion = details.refund_amount / order.total_amount;
                const reversalAmount = -(order.payout_amount * refundPortion);

                const reversalResult = await client.query(
                    `INSERT INTO garage_payouts (
                        garage_id, order_id, gross_amount, commission_amount, net_amount, 
                        payout_status, payout_type, notes
                     ) VALUES ($1, $2, $3, $4, $5, 'pending', 'reversal', $6)
                     RETURNING payout_id`,
                    [
                        order.garage_id,
                        order.order_id,
                        reversalAmount,  // gross_amount (negative)
                        0,               // commission_amount (no commission on reversal)
                        reversalAmount,  // net_amount (same as gross for reversal)
                        `Payout reversal for refund: ${details.refund_reason}`
                    ]
                );

                payoutAdjustment = {
                    payout_id: reversalResult.rows[0].payout_id,
                    original_amount: order.payout_amount,
                    adjusted_amount: reversalAmount,
                    reversal_created: true
                };
            }

            await client.query('COMMIT');

            return {
                refund_id: refund.refund_id,
                refund_amount: refund.refund_amount,
                delivery_fee_retained: deliveryFeeRetained,
                payout_adjustment: payoutAdjustment,
                message: deliveryFeeRetained > 0
                    ? `Refund created. Delivery fee of ${deliveryFeeRetained} QAR retained (driver was assigned).`
                    : payoutAdjustment
                        ? payoutAdjustment.reversal_created
                            ? 'Refund created with payout reversal'
                            : 'Refund created with payout adjustment'
                        : 'Refund created (no payout impact)'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getRefundStatus(refundId: string): Promise<RefundDetail> {
        const result = await this.pool.query(
            `SELECT r.*, o.order_number, 
                    u.full_name as customer_name,
                    g.garage_name
             FROM refunds r
             JOIN orders o ON r.order_id = o.order_id
             LEFT JOIN users u ON o.customer_id::uuid = u.user_id
             LEFT JOIN garages g ON o.garage_id = g.garage_id
             WHERE r.refund_id = $1`,
            [refundId]
        );

        if (result.rows.length === 0) {
            throw new RefundNotFoundError(refundId);
        }

        return result.rows[0];
    }

    async processRefund(refundId: string): Promise<void> {
        const result = await this.pool.query(
            `UPDATE refunds SET
                refund_status = 'completed',
                processed_at = NOW()
             WHERE refund_id = $1
             RETURNING *`,
            [refundId]
        );

        if (result.rows.length === 0) {
            throw new RefundNotFoundError(refundId);
        }
    }

    /**
     * Get list of all refunds with optional filtering
     */
    async getRefunds(options: { status?: string; limit?: number; offset?: number } = {}): Promise<{
        refunds: RefundDetail[];
        total: number;
    }> {
        const { status, limit = 50, offset = 0 } = options;

        let whereClause = '';
        const params: any[] = [];

        if (status) {
            params.push(status);
            whereClause = `WHERE r.refund_status = $${params.length}`;
        }

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM refunds r ${whereClause}`,
            params
        );

        // Get refunds with related data
        params.push(limit, offset);
        const result = await this.pool.query(
            `SELECT r.*, 
                    o.order_number,
                    u.full_name as customer_name,
                    g.garage_name,
                    staff.full_name as processed_by_name
             FROM refunds r
             JOIN orders o ON r.order_id = o.order_id
             LEFT JOIN users u ON o.customer_id::uuid = u.user_id
             LEFT JOIN garages g ON o.garage_id = g.garage_id
             LEFT JOIN users staff ON r.processed_by::uuid = staff.user_id
             ${whereClause}
             ORDER BY r.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return {
            refunds: result.rows,
            total: parseInt(countResult.rows[0].count)
        };
    }

    /**
     * Get pending refunds for Operations dashboard
     */
    async getPendingRefunds(): Promise<{
        refunds: RefundDetail[];
        total: number;
    }> {
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM refunds WHERE refund_status = 'pending'`
        );

        const result = await this.pool.query(
            `SELECT r.*, 
                    o.order_number, o.customer_id, o.payment_method,
                    u.full_name as customer_name, u.phone_number as customer_phone,
                    g.garage_name,
                    pi.provider_intent_id as stripe_payment_intent_id
             FROM refunds r
             JOIN orders o ON r.order_id = o.order_id
             LEFT JOIN users u ON o.customer_id::uuid = u.user_id
             LEFT JOIN garages g ON o.garage_id = g.garage_id
             LEFT JOIN payment_intents pi ON o.order_id = pi.order_id AND pi.status = 'succeeded'
             WHERE r.refund_status = 'pending'
             ORDER BY r.created_at ASC`
        );

        return {
            refunds: result.rows,
            total: parseInt(countResult.rows[0].count)
        };
    }

    /**
     * Execute Stripe refund and update status
     * Called by Operations to actually process the refund via Stripe
     */
    async executeStripeRefund(refundId: string, processedBy: string): Promise<{
        success: boolean;
        stripe_refund_id?: string;
        message: string;
    }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get refund details with payment intent
            const refundResult = await client.query(
                `SELECT r.*, o.order_id, o.order_number, o.customer_id,
                        pi.provider_intent_id as stripe_payment_intent_id
                 FROM refunds r
                 JOIN orders o ON r.order_id = o.order_id
                 LEFT JOIN payment_intents pi ON o.order_id = pi.order_id AND pi.status = 'succeeded'
                 WHERE r.refund_id = $1
                 FOR UPDATE OF r`,
                [refundId]
            );

            if (refundResult.rows.length === 0) {
                throw new RefundNotFoundError(refundId);
            }

            const refund = refundResult.rows[0];

            if (refund.refund_status !== 'pending') {
                throw new RefundAlreadyProcessedError(refund.order_id);
            }

            let stripeRefundId: string | undefined = undefined;
            let refundMethod = 'stripe';

            if (!refund.stripe_payment_intent_id) {
                // No Stripe payment found - mark as manual refund (COD, test order, etc.)
                console.log(`[RefundService] No Stripe payment for order ${refund.order_number} - processing as manual refund`);
                refundMethod = 'manual';
            } else {
                // Initialize Stripe and process refund
                const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
                if (!stripeSecretKey) {
                    throw new Error('Stripe not configured');
                }

                const Stripe = require('stripe');
                const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

                // Execute Stripe refund
                const refundAmountCents = Math.round(parseFloat(refund.refund_amount) * 100);
                const stripeRefund = await stripe.refunds.create({
                    payment_intent: refund.stripe_payment_intent_id,
                    amount: refundAmountCents,
                    metadata: {
                        refund_id: refundId,
                        order_number: refund.order_number,
                        processed_by: processedBy
                    }
                });
                stripeRefundId = stripeRefund.id;
            }

            // Update refund record
            await client.query(
                `UPDATE refunds SET
                    refund_status = 'completed',
                    stripe_refund_id = $2,
                    processed_by = $3,
                    processed_at = NOW(),
                    refund_reason = COALESCE(refund_reason, '') || $4
                 WHERE refund_id = $1`,
                [refundId, stripeRefundId, processedBy, refundMethod === 'manual' ? ' [Manual refund]' : '']
            );

            // Update order payment status
            await client.query(
                `UPDATE orders SET payment_status = 'refunded' WHERE order_id = $1`,
                [refund.order_id]
            );

            // CRITICAL: Cancel or reverse the garage payout to maintain data consistency
            // This ensures Finance Dashboard and Support Dashboard show consistent data
            const payoutResult = await client.query(
                `SELECT payout_id, payout_status, net_amount FROM garage_payouts WHERE order_id = $1`,
                [refund.order_id]
            );

            if (payoutResult.rows.length > 0) {
                const payout = payoutResult.rows[0];

                // Cancel the payout - 'cancelled' is the valid status for refunded orders
                // This works for both pending payouts and already-confirmed payouts
                const newPayoutStatus = 'cancelled';

                await client.query(
                    `UPDATE garage_payouts SET 
                        payout_status = $2,
                        updated_at = NOW()
                     WHERE payout_id = $1`,
                    [payout.payout_id, newPayoutStatus]
                );

                console.log(`[RefundService] Payout ${payout.payout_id} ${newPayoutStatus} due to refund (was: ${payout.payout_status})`);
            }

            await client.query('COMMIT');

            // Notify customer (import would be at top of file)
            const { createNotification } = require('../notification.service');
            await createNotification({
                userId: refund.customer_id,
                type: 'refund_completed',
                title: '💰 Refund Processed',
                message: `Your refund of ${refund.refund_amount} QAR for Order #${refund.order_number} has been processed. It may take 5-10 business days to appear in your account.`,
                data: { order_id: refund.order_id, refund_amount: refund.refund_amount },
                target_role: 'customer'
            });

            console.log(`[RefundService] Refund ${stripeRefundId || 'MANUAL'} processed for ${refund.refund_amount} QAR`);

            return {
                success: true,
                stripe_refund_id: stripeRefundId,
                message: `Refund of ${refund.refund_amount} QAR processed successfully${refundMethod === 'manual' ? ' (manual)' : ''}`
            };
        } catch (err: any) {
            await client.query('ROLLBACK');
            console.error('[RefundService] Stripe refund error:', err.message);
            throw err;
        } finally {
            client.release();
        }
    }
}
