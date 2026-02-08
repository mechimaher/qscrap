/**
 * PayoutLifecycleService - 2-Way Confirmation Workflow
 * Handles sendPayment, confirmPayment, disputePayment, resolveDispute
 */

import { Pool } from 'pg';
import { createNotification } from '../notification.service';
import { emitToOperations } from '../../utils/socketIO';
import {
    Payout,
    SendPaymentDto,
    ConfirmPaymentDto,
    DisputeDto,
    ResolveDisputeDto,
    PayoutResult,
    BulkConfirmResult
} from './types';
import {
    UnauthorizedPayoutAccessError,
    InvalidPasswordError
} from './errors';
import { PayoutHelpers } from './payout-helpers';

export class PayoutLifecycleService {
    private helpers: PayoutHelpers;

    constructor(private pool: Pool) {
        this.helpers = new PayoutHelpers(pool);
    }

    /**
     * Send payment to garage (Operations/Finance)
     * VALIDATION: Blocks payout for orders with active disputes
     */
    async sendPayment(payoutId: string, details: SendPaymentDto): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);
            this.helpers.validatePayoutStatus(payout, ['pending', 'processing']);

            // CRITICAL: Check for active disputes on this order
            if (payout.order_id) {
                const disputeCheck = await client.query(`
                    SELECT dispute_id, status, reason 
                    FROM disputes 
                    WHERE order_id = $1 
                    AND status IN ('pending', 'under_review', 'contested')
                `, [payout.order_id]);

                if (disputeCheck.rows.length > 0) {
                    const dispute = disputeCheck.rows[0];
                    throw new Error(
                        `Cannot send payout: Order has active dispute (${dispute.status}). ` +
                        `Dispute reason: ${dispute.reason}. Resolve dispute first.`
                    );
                }

                // CRITICAL: 7-day warranty window check (Qatar B2B business rule)
                // Customer has 7 days from delivery to report issues/request refund
                const warrantyCheck = await client.query(`
                    SELECT o.order_number, o.delivered_at, o.completed_at,
                           EXTRACT(DAY FROM NOW() - COALESCE(o.delivered_at, o.completed_at)) as days_since_delivery,
                           GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - COALESCE(o.delivered_at, o.completed_at)))::int as days_remaining
                    FROM orders o
                    WHERE o.order_id = $1
                `, [payout.order_id]);

                if (warrantyCheck.rows.length > 0) {
                    const order = warrantyCheck.rows[0];
                    const daysRemaining = parseInt(order.days_remaining) || 0;

                    if (daysRemaining > 0) {
                        throw new Error(
                            `Cannot send payout: Order #${order.order_number} is still within the 7-day warranty window. ` +
                            `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining until payout eligible. ` +
                            `Customer may still request refund or report issues.`
                        );
                    }
                }
            }

            const updated = await this.helpers.markAsSent(payout, details, client);
            await this.helpers.createPaymentNotification(updated, 'sent');

            await client.query('COMMIT');
            return {
                payout: updated,
                message: 'Payment sent successfully. Awaiting garage confirmation.'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Confirm payment receipt (Garage)
     */
    async confirmPayment(
        payoutId: string,
        garageId: string,
        details: ConfirmPaymentDto
    ): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);

            if (payout.garage_id !== garageId) {
                throw new UnauthorizedPayoutAccessError(garageId, payoutId);
            }

            this.helpers.validatePayoutStatus(payout, ['awaiting_confirmation']);

            const updated = await this.helpers.markAsConfirmed(payout, details, client);
            await this.helpers.createPaymentNotification(updated, 'confirmed');

            await client.query('COMMIT');
            return {
                payout: updated,
                message: 'Payment confirmed successfully'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Dispute payment (Garage)
     */
    async disputePayment(
        payoutId: string,
        garageId: string,
        dispute: DisputeDto
    ): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);

            if (payout.garage_id !== garageId) {
                throw new UnauthorizedPayoutAccessError(garageId, payoutId);
            }

            this.helpers.validatePayoutStatus(payout, ['awaiting_confirmation', 'confirmed']);

            const updated = await this.helpers.markAsDisputed(payout, dispute, client);
            await this.helpers.createPaymentNotification(updated, 'disputed');

            await client.query('COMMIT');
            return {
                payout: updated,
                message: 'Payment dispute registered. Operations will investigate.'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Resolve payment dispute (Operations)
     */
    async resolveDispute(
        payoutId: string,
        resolution: ResolveDisputeDto
    ): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);
            this.helpers.validatePayoutStatus(payout, ['disputed']);

            let updated: Payout;

            if (resolution.resolution === 'corrected' || resolution.resolution === 'resent') {
                updated = await this.helpers.markAsSent(payout, {
                    payout_method: resolution.new_payout_method || payout.payout_method!,
                    payout_reference: resolution.new_payout_reference,
                    notes: resolution.resolution_notes
                }, client);

                if (resolution.new_amount) {
                    await client.query(
                        `UPDATE garage_payouts SET net_amount = $1 WHERE payout_id = $2`,
                        [resolution.new_amount, payoutId]
                    );
                    updated.net_amount = resolution.new_amount;
                }
            } else if (resolution.resolution === 'confirmed') {
                // Garage actually received the payment - mark as confirmed
                updated = await this.helpers.markAsConfirmed(payout, {
                    confirmation_notes: resolution.resolution_notes || 'Dispute resolved - payment confirmed received'
                }, client);
            } else {
                // Cancelled - garage not receiving this payout
                updated = await this.helpers.markAsCancelled(payout, resolution.resolution_notes, client);
            }

            await this.helpers.createPaymentNotification(updated, 'dispute_resolved');

            await client.query('COMMIT');
            return {
                payout: updated,
                message: `Dispute resolved: ${resolution.resolution}`
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Send reminder notification to garage for pending payment confirmation
     */
    async sendReminder(payoutId: string): Promise<{ success: boolean; message: string }> {
        // Fetch payout with garage details
        const result = await this.pool.query(
            `SELECT gp.*, g.garage_name, g.owner_id, o.order_number
             FROM garage_payouts gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN orders o ON gp.order_id = o.order_id
             WHERE gp.payout_id = $1`,
            [payoutId]
        );

        if (result.rows.length === 0) {
            return { success: false, message: 'Payout not found' };
        }

        const payout = result.rows[0];

        if (payout.payout_status !== 'awaiting_confirmation') {
            return { success: false, message: 'Payout is not awaiting confirmation' };
        }

        // Send notification to garage
        await createNotification({
            userId: payout.garage_id,
            type: 'payment_reminder',
            title: 'Payment Confirmation Reminder 🔔',
            message: `Please confirm receipt of ${parseFloat(payout.net_amount).toFixed(2)} QAR for order ${payout.order_number || 'N/A'}`,
            data: {
                payout_id: payoutId,
                amount: payout.net_amount,
                order_number: payout.order_number
            },
            target_role: 'garage'
        });

        return { success: true, message: 'Reminder sent to garage' };
    }

    /**
     * Bulk confirm all awaiting payouts (Garage)
     */
    async confirmAllPayouts(garageId: string): Promise<BulkConfirmResult> {

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            const result = await client.query(
                `SELECT * FROM garage_payouts 
                 WHERE garage_id = $1 
                 AND payout_status = 'awaiting_confirmation'
                 FOR UPDATE`,
                [garageId]
            );

            if (result.rows.length === 0) {
                await client.query('COMMIT');
                return { confirmed_count: 0, total_amount: 0, failed_count: 0 };
            }

            const confirmResult = await client.query(
                `UPDATE garage_payouts 
                 SET payout_status = 'confirmed',
                     confirmed_at = NOW(),
                     confirmation_notes = 'Bulk confirmation',
                     updated_at = NOW()
                 WHERE garage_id = $1 
                 AND payout_status = 'awaiting_confirmation'
                 RETURNING payout_id, net_amount`,
                [garageId]
            );

            const confirmed = confirmResult.rows;
            const totalAmount = confirmed.reduce((sum, p) => sum + parseFloat(p.net_amount), 0);

            await createNotification({
                userId: garageId,
                type: 'payouts_bulk_confirmed',
                title: 'Payouts Confirmed ✅',
                message: `You confirmed ${confirmed.length} payouts totaling ${totalAmount.toFixed(2)} QAR`,
                data: { count: confirmed.length, amount: totalAmount },
                target_role: 'garage'
            });

            emitToOperations('payouts_bulk_confirmed', {
                garage_id: garageId,
                count: confirmed.length,
                amount: totalAmount
            });

            await client.query('COMMIT');

            return {
                confirmed_count: confirmed.length,
                total_amount: totalAmount,
                failed_count: 0
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
