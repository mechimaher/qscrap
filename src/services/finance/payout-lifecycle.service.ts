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
     * Send payment to garage (Operations)
     */
    async sendPayment(payoutId: string, details: SendPaymentDto): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);
            this.helpers.validatePayoutStatus(payout, ['pending', 'processing']);

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
            } else {
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
     * Bulk confirm all awaiting payouts (Garage)
     */
    async confirmAllPayouts(garageId: string, password: string): Promise<BulkConfirmResult> {
        const isValidPassword = await this.helpers.verifyGaragePassword(garageId, password);
        if (!isValidPassword) {
            throw new InvalidPasswordError();
        }

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
