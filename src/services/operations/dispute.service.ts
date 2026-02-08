/**
 * Dispute Service
 * Handles dispute resolution, refunds, and return-to-garage workflows
 */
import { Pool, PoolClient } from 'pg';
import { DisputeFilters, DisputeResolution, PaginationMetadata } from './types';
import { DisputeNotFoundError } from './errors';
import { createNotification } from '../notification.service';
import logger from '../../utils/logger';
import { getIO } from '../../utils/socketIO';

export class DisputeService {
    constructor(private pool: Pool) { }

    /**
     * Get disputes with filters and pagination
     */
    async getDisputes(filters: DisputeFilters): Promise<{ disputes: any[]; pagination: PaginationMetadata }> {
        const { status, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let query = `
            SELECT d.*, 
                   o.order_number, o.part_price, o.total_amount,
                   pr.car_make, pr.car_model, pr.part_description,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   g.garage_name
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON d.customer_id = u.user_id
            JOIN garages g ON d.garage_id = g.garage_id
        `;

        const params: any[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            query += ` WHERE d.status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM disputes d WHERE 1=1`;
        const countParams: any[] = [];
        if (status && status !== 'all') {
            countQuery += ` AND d.status = $1`;
            countParams.push(status);
        }
        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return {
            disputes: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get dispute details with payout status for cross-system visibility
     */
    async getDisputeDetails(disputeId: string): Promise<any> {
        const disputeResult = await this.pool.query(`
            SELECT d.*,
                   o.order_number, o.order_status, o.total_amount as order_amount,
                   o.created_at as order_created,
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description,
                   u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                   g.garage_name, gu.phone_number as garage_phone,
                   gp.payout_id, gp.payout_status, gp.net_amount as payout_amount,
                   gp.sent_at as payout_sent_at, gp.held_reason as payout_held_reason
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
            WHERE d.dispute_id = $1
        `, [disputeId]);

        if (disputeResult.rows.length === 0) {
            throw new DisputeNotFoundError(disputeId);
        }

        const dispute = disputeResult.rows[0];

        // Get order status history
        const historyResult = await this.pool.query(`
            SELECT new_status as status, created_at as changed_at, reason
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [dispute.order_id]);

        return {
            dispute,
            order_history: historyResult.rows,
            payout: dispute.payout_id ? {
                payout_id: dispute.payout_id,
                status: dispute.payout_status,
                amount: dispute.payout_amount,
                sent_at: dispute.payout_sent_at,
                held_reason: dispute.payout_held_reason
            } : null
        };
    }

    /**
     * Resolve dispute (approve refund or reject)
     */
    async resolveDispute(
        disputeId: string,
        resolution: DisputeResolution,
        staffId: string
    ): Promise<{ message: string; resolution: string; refund_amount: number | null; return_assignment: any; payout_action: any }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const disputeResult = await client.query(
                `SELECT d.*, o.order_number, o.customer_id, o.garage_id, o.order_id,
                        g.address as garage_address,
                        u.full_name as customer_name, pr.delivery_location as customer_address
                 FROM disputes d
                 JOIN orders o ON d.order_id = o.order_id
                 JOIN garages g ON o.garage_id = g.garage_id
                 JOIN users u ON o.customer_id = u.user_id
                 JOIN part_requests pr ON o.request_id = pr.request_id
                 WHERE d.dispute_id = $1`,
                [disputeId]
            );

            if (disputeResult.rows.length === 0) {
                throw new DisputeNotFoundError(disputeId);
            }

            const dispute = disputeResult.rows[0];
            const finalRefundAmount = resolution.refund_amount || dispute.refund_amount;

            // Update dispute
            await client.query(
                `UPDATE disputes 
                 SET status = 'resolved',
                     resolution = $2,
                     refund_amount = $3,
                     resolved_by = 'platform',
                     resolved_at = NOW()
                 WHERE dispute_id = $1`,
                [disputeId, resolution.resolution, finalRefundAmount]
            );

            // Update order status
            const newOrderStatus = resolution.resolution === 'refund_approved' ? 'refunded' : 'completed';
            await client.query(
                `UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2`,
                [newOrderStatus, dispute.order_id]
            );

            // Record in status history
            await client.query(
                `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, 'disputed', $2, $3, 'operations', $4)`,
                [dispute.order_id, newOrderStatus, staffId, resolution.notes || `Dispute resolved: ${resolution.resolution}`]
            );

            // If refund approved, create return-to-garage assignment
            let returnAssignment = null;
            let payoutAction = null;

            if (resolution.resolution === 'refund_approved') {
                const returnResult = await client.query(`
                    INSERT INTO delivery_assignments 
                    (order_id, driver_id, assignment_type, pickup_address, delivery_address, return_reason, status)
                    VALUES ($1, NULL, 'return_to_garage', $2, $3, $4, 'assigned')
                    RETURNING assignment_id, order_id, assignment_type, status
                `, [
                    dispute.order_id,
                    dispute.customer_address || 'Customer Location',
                    dispute.garage_address || 'Garage Address',
                    `Customer refused: ${resolution.notes || dispute.description || 'No reason provided'}`
                ]);
                returnAssignment = returnResult.rows[0];

                // Create refund record
                await client.query(`
                    INSERT INTO refunds (order_id, customer_id, amount, reason, status, processed_by)
                    VALUES ($1, $2, $3, $4, 'approved', $5)
                    ON CONFLICT DO NOTHING
                `, [
                    dispute.order_id,
                    dispute.customer_id,
                    finalRefundAmount,
                    resolution.notes || 'Customer refused delivery',
                    staffId
                ]);

                // CRITICAL: Handle payout - cancel if pending/held, or create reversal if already confirmed
                const cancelledPayout = await client.query(`
                    UPDATE garage_payouts 
                    SET payout_status = 'cancelled',
                        cancellation_reason = 'Order refunded - dispute approved by operations',
                        cancelled_at = NOW(),
                        updated_at = NOW()
                    WHERE order_id = $1 
                    AND payout_status IN ('pending', 'held', 'processing', 'awaiting_confirmation')
                    RETURNING payout_id, net_amount
                `, [dispute.order_id]);

                if (cancelledPayout.rows.length > 0) {
                    payoutAction = { action: 'cancelled', payout_id: cancelledPayout.rows[0].payout_id };
                } else {
                    // Check if payout was already confirmed - need to create reversal
                    const confirmedPayout = await client.query(`
                        SELECT payout_id, net_amount FROM garage_payouts 
                        WHERE order_id = $1 AND payout_status = 'confirmed'
                    `, [dispute.order_id]);

                    if (confirmedPayout.rows.length > 0) {
                        const payout = confirmedPayout.rows[0];
                        const reversalResult = await client.query(`
                            INSERT INTO payout_reversals (garage_id, original_payout_id, order_id, amount, reason, status)
                            VALUES ($1, $2, $3, $4, $5, 'pending')
                            RETURNING reversal_id
                        `, [
                            dispute.garage_id,
                            payout.payout_id,
                            dispute.order_id,
                            finalRefundAmount,
                            `Refund approved after payout confirmed - Dispute: ${resolution.notes || dispute.description}`
                        ]);

                        const reversalId = reversalResult.rows[0].reversal_id;
                        payoutAction = { action: 'reversal_created', payout_id: payout.payout_id, reversal_amount: finalRefundAmount };

                        // Notify garage about pending deduction
                        try {
                            await createNotification({
                                userId: dispute.garage_id,
                                type: 'payout_reversal',
                                title: '⚠️ Payout Deduction Pending',
                                message: `${finalRefundAmount} QAR will be deducted from your next payout due to dispute resolution.`,
                                data: { reversal_id: reversalId, order_number: dispute.order_number },
                                target_role: 'garage'
                            });

                            const io = getIO();
                            if (io) {
                                io.to(`garage_${dispute.garage_id}`).emit('payout_reversal', {
                                    reversal_id: reversalId,
                                    amount: finalRefundAmount,
                                    order_number: dispute.order_number,
                                    type: 'deduction_pending'
                                });
                            }
                        } catch (notifyErr) {
                            logger.error('Failed to notify garage about reversal', { error: notifyErr });
                        }
                    }
                }
            } else {
                // Dispute rejected - release held payout back to pending
                const releasedPayout = await client.query(`
                    UPDATE garage_payouts 
                    SET payout_status = 'pending',
                        held_reason = NULL,
                        held_at = NULL,
                        notes = 'Released - customer dispute rejected by operations',
                        updated_at = NOW()
                    WHERE order_id = $1 AND payout_status = 'held'
                    RETURNING payout_id
                `, [dispute.order_id]);

                if (releasedPayout.rows.length > 0) {
                    payoutAction = { action: 'released', payout_id: releasedPayout.rows[0].payout_id };
                }
            }

            await client.query('COMMIT');

            return {
                message: 'Dispute resolved',
                resolution: resolution.resolution,
                refund_amount: resolution.resolution === 'refund_approved' ? finalRefundAmount : null,
                return_assignment: returnAssignment,
                payout_action: payoutAction
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
