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
     */
    async createRefund(details: CreateRefundDto): Promise<RefundResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get order details
            const orderResult = await client.query(
                `SELECT o.*, gp.payout_id, gp.net_amount as payout_amount, gp.payout_status
                 FROM orders o
                 LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
                 WHERE o.order_id = $1
                 FOR UPDATE OF o`,
                [details.order_id]
            );

            if (orderResult.rows.length === 0) {
                throw new OrderNotFoundError(details.order_id);
            }

            const order = orderResult.rows[0];

            // Validate refund amount
            if (details.refund_amount > order.total_amount) {
                throw new InvalidRefundAmountError(details.refund_amount, order.total_amount);
            }

            // Check if refund already exists
            const existingRefund = await client.query(
                `SELECT refund_id FROM refunds WHERE order_id = $1`,
                [details.order_id]
            );

            if (existingRefund.rows.length > 0) {
                throw new RefundAlreadyProcessedError(details.order_id);
            }

            // Create refund record
            const refundResult = await client.query(
                `INSERT INTO refunds (
                    order_id, refund_amount, refund_reason, 
                    initiated_by, refund_status
                 ) VALUES ($1, $2, $3, $4, 'pending')
                 RETURNING *`,
                [details.order_id, details.refund_amount, details.refund_reason, details.initiated_by]
            );

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
                        garage_id, order_id, net_amount, payout_status,
                        payout_type, notes
                     ) VALUES ($1, $2, $3, 'pending', 'reversal', $4)
                     RETURNING payout_id`,
                    [
                        order.garage_id,
                        order.order_id,
                        reversalAmount,
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
                payout_adjustment: payoutAdjustment,
                message: payoutAdjustment
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
             LEFT JOIN users u ON o.customer_id = u.user_id
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
}
