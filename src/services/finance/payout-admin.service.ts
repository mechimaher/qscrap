/**
 * PayoutAdminService - Admin/Operations Payout Management
 * Handles processPayout, holdPayout, releasePayout, forceProcessPayout, autoConfirmPayouts
 */

import { Pool } from 'pg';
import { createNotification } from '../notification.service';
import { PayoutResult } from './types';
import { PayoutNotFoundError } from './errors';
import { PayoutHelpers } from './payout-helpers';

export class PayoutAdminService {
    private helpers: PayoutHelpers;

    constructor(private pool: Pool) {
        this.helpers = new PayoutHelpers(pool);
    }

    async processPayout(payoutId: string): Promise<void> {
        const result = await this.pool.query(
            `UPDATE garage_payouts SET
                payout_status = 'completed',
                processed_at = NOW(),
                updated_at = NOW()
             WHERE payout_id = $1
             RETURNING *`,
            [payoutId]
        );

        if (result.rows.length === 0) {
            throw new PayoutNotFoundError(payoutId);
        }
    }

    async holdPayout(payoutId: string, reason: string): Promise<void> {
        const result = await this.pool.query(
            `UPDATE garage_payouts SET
                payout_status = 'held',
                hold_reason = $1,
                held_at = NOW(),
                updated_at = NOW()
             WHERE payout_id = $2
             RETURNING *`,
            [reason, payoutId]
        );

        if (result.rows.length === 0) {
            throw new PayoutNotFoundError(payoutId);
        }
    }

    async releasePayout(payoutId: string): Promise<void> {
        const result = await this.pool.query(
            `UPDATE garage_payouts SET
                payout_status = 'pending',
                hold_reason = NULL,
                held_at = NULL,
                updated_at = NOW()
             WHERE payout_id = $1
             RETURNING *`,
            [payoutId]
        );

        if (result.rows.length === 0) {
            throw new PayoutNotFoundError(payoutId);
        }
    }

    async forceProcessPayout(payoutId: string, reason: string): Promise<PayoutResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const payout = await this.helpers.getPayoutForUpdate(payoutId, client);

            const result = await client.query(
                `UPDATE garage_payouts SET
                    payout_status = 'completed',
                    processed_at = NOW(),
                    force_processed = true,
                    force_process_reason = $1,
                    updated_at = NOW()
                 WHERE payout_id = $2
                 RETURNING *`,
                [reason, payoutId]
            );

            await client.query('COMMIT');

            return {
                payout: result.rows[0],
                message: 'Payout force-processed successfully'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Auto-confirm payouts after 7 days (Static for cron job use)
     */
    static async autoConfirmPayouts(pool: Pool): Promise<{ confirmed: number; failed: number }> {
        const client = await pool.connect();
        let confirmed = 0;
        let failed = 0;

        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garage_payouts
                SET payout_status = 'confirmed',
                    confirmed_at = NOW(),
                    auto_confirmed = true,
                    confirmation_notes = 'Auto-confirmed after 7 days',
                    updated_at = NOW()
                WHERE payout_status = 'awaiting_confirmation'
                AND sent_at < NOW() - INTERVAL '7 days'
                RETURNING payout_id, garage_id, net_amount
            `);

            confirmed = result.rowCount || 0;

            for (const payout of result.rows) {
                await createNotification({
                    userId: payout.garage_id,
                    type: 'payout_auto_confirmed',
                    title: 'Payout Auto-Confirmed',
                    message: `Payout of ${payout.net_amount} QAR was automatically confirmed after 7 days`,
                    data: { payout_id: payout.payout_id },
                    target_role: 'garage'
                });
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            failed++;
            console.error('autoConfirmPayouts error:', err);
        } finally {
            client.release();
        }

        return { confirmed, failed };
    }
}
