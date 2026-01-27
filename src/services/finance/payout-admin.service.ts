/**
 * PayoutAdminService - Admin/Operations Payout Management
 * Handles processPayout, holdPayout, releasePayout, forceProcessPayout, autoConfirmPayouts
 * And batch payment operations
 */

import { Pool, PoolClient } from 'pg';
import { createNotification } from '../notification.service';
import { emitToGarage, emitToOperations } from '../../utils/socketIO';
import {
    PayoutResult,
    BatchPaymentDto,
    BatchPaymentResult,
    BatchPaymentPreview,
    GarageWithPendingPayouts,
    PayoutStatementParams,
    PayoutStatementData
} from './types';
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

    // ============================================
    // BATCH PAYMENT OPERATIONS
    // ============================================

    /**
     * Get preview of batch payouts before processing
     * Returns count and total amount for confirmation dialog
     */
    async getBatchPayoutPreview(params: {
        payout_ids?: string[];
        garage_id?: string;
        all_pending?: boolean;
    }): Promise<BatchPaymentPreview> {
        const { payout_ids, garage_id } = params;

        let whereClause = "WHERE gp.payout_status = 'pending'";
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (payout_ids && payout_ids.length > 0) {
            whereClause += ` AND gp.payout_id = ANY($${paramIndex++})`;
            queryParams.push(payout_ids);
        } else if (garage_id) {
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            queryParams.push(garage_id);
        }

        const result = await this.pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                COUNT(*)::int as payout_count,
                COALESCE(SUM(gp.net_amount), 0)::numeric as total
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            ${whereClause}
            GROUP BY g.garage_id, g.garage_name
            ORDER BY total DESC
        `, queryParams);

        const garages = result.rows.map(r => ({
            garage_id: r.garage_id,
            garage_name: r.garage_name,
            payout_count: r.payout_count,
            total: parseFloat(r.total)
        }));

        const count = garages.reduce((sum, g) => sum + g.payout_count, 0);
        const total_amount = garages.reduce((sum, g) => sum + g.total, 0);

        return { count, total_amount, garages };
    }

    /**
     * Send batch payments efficiently
     * Processes all matching payouts in a single transaction
     * Uses bulk UPDATE for performance (not a loop)
     */
    async sendBatchPayments(
        dto: BatchPaymentDto,
        sentBy: string
    ): Promise<BatchPaymentResult> {
        const { payout_ids, garage_id, all_pending, reference_number, notes } = dto;
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Build WHERE clause based on filter mode
            let whereClause = "payout_status = 'pending'";
            const queryParams: unknown[] = [sentBy, reference_number, notes || 'Batch payment'];
            let paramIndex = 4;

            if (payout_ids && payout_ids.length > 0) {
                whereClause += ` AND payout_id = ANY($${paramIndex++})`;
                queryParams.push(payout_ids);
            } else if (garage_id) {
                whereClause += ` AND garage_id = $${paramIndex++}`;
                queryParams.push(garage_id);
            }
            // all_pending = true processes everything with status = 'pending'

            // Single bulk UPDATE for efficiency
            const updateResult = await client.query(`
                UPDATE garage_payouts SET
                    payout_status = 'awaiting_confirmation',
                    sent_at = NOW(),
                    sent_by = $1,
                    payout_reference = $2,
                    notes = COALESCE(notes || E'\n', '') || $3,
                    updated_at = NOW()
                WHERE ${whereClause}
                RETURNING payout_id, garage_id, net_amount
            `, queryParams);

            const processedPayouts = updateResult.rows;
            const processed_count = processedPayouts.length;

            if (processed_count === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    processed_count: 0,
                    failed_count: 0,
                    total_amount: 0,
                    garages_notified: 0
                };
            }

            // Calculate totals
            const total_amount = processedPayouts.reduce(
                (sum, p) => sum + parseFloat(p.net_amount),
                0
            );

            // Group by garage for summarized notifications
            const garagePayouts = new Map<string, { count: number; total: number }>();
            for (const p of processedPayouts) {
                const existing = garagePayouts.get(p.garage_id) || { count: 0, total: 0 };
                existing.count++;
                existing.total += parseFloat(p.net_amount);
                garagePayouts.set(p.garage_id, existing);
            }

            // Send notifications to each garage (summarized, not per-payout)
            for (const [garageId, data] of garagePayouts) {
                await createNotification({
                    userId: garageId,
                    type: 'payment_sent',
                    title: 'Payments Sent 💰',
                    message: data.count === 1
                        ? `Payment of ${data.total.toFixed(2)} QAR has been sent`
                        : `${data.count} payments totaling ${data.total.toFixed(2)} QAR have been sent`,
                    data: {
                        batch: true,
                        count: data.count,
                        total: data.total,
                        reference_number
                    },
                    target_role: 'garage'
                });

                emitToGarage(garageId, 'payments_sent', {
                    count: data.count,
                    total: data.total,
                    reference_number
                });
            }

            await client.query('COMMIT');

            // Notify operations dashboard
            emitToOperations('batch_payments_sent', {
                processed_count,
                total_amount,
                garages_count: garagePayouts.size,
                reference_number
            });

            return {
                success: true,
                processed_count,
                failed_count: 0,
                total_amount,
                garages_notified: garagePayouts.size
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get list of all active garages for filter dropdown
     * Shows all garages with their pending payout counts (if any)
     */
    async getGaragesWithPendingPayouts(): Promise<{ garages: GarageWithPendingPayouts[] }> {
        const result = await this.pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                COUNT(gp.payout_id)::int as pending_count,
                COALESCE(SUM(gp.net_amount), 0)::numeric as pending_total
            FROM garages g
            LEFT JOIN garage_payouts gp ON g.garage_id = gp.garage_id 
                AND gp.payout_status = 'pending'
            WHERE g.approval_status = 'approved' OR g.approval_status = 'demo'
            GROUP BY g.garage_id, g.garage_name
            ORDER BY pending_count DESC, g.garage_name ASC
        `);

        return {
            garages: result.rows.map(r => ({
                garage_id: r.garage_id,
                garage_name: r.garage_name,
                pending_count: r.pending_count,
                pending_total: parseFloat(r.pending_total)
            }))
        };
    }

    // ============================================
    // CONSOLIDATED PAYOUT STATEMENTS
    // ============================================

    /**
     * Generate consolidated payout statement for a garage within a date range
     * Returns data for PDF generation with order-by-order breakdown
     */
    async generatePayoutStatement(params: PayoutStatementParams): Promise<PayoutStatementData> {
        const { garage_id, from_date, to_date } = params;

        // 1. Get garage details
        const garageResult = await this.pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                g.garage_name_ar,
                g.cr_number,
                g.iban,
                g.bank_name
            FROM garages g
            WHERE g.garage_id = $1
        `, [garage_id]);

        if (garageResult.rows.length === 0) {
            throw new Error(`Garage not found: ${garage_id}`);
        }

        const garage = garageResult.rows[0];

        // 2. Generate invoice number (INV-YYYYMM-XXXX)
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const statement_number = `INV-${datePrefix}-${randomSuffix}`;

        // 3. Get all confirmed/completed payouts within date range
        const ordersResult = await this.pool.query(`
            SELECT 
                gp.payout_id,
                gp.order_id,
                o.order_number,
                COALESCE(b.part_name, r.part_name, 'Part') as part_name,
                o.delivered_at,
                gp.confirmed_at,
                (gp.net_amount + COALESCE(gp.platform_fee_amount, 0)) as gross_amount,
                COALESCE(gp.platform_fee_amount, 0) as platform_fee,
                gp.net_amount,
                gp.payout_reference
            FROM garage_payouts gp
            LEFT JOIN orders o ON gp.order_id = o.order_id
            LEFT JOIN bids b ON o.winning_bid_id = b.bid_id
            LEFT JOIN requests r ON o.request_id = r.request_id
            WHERE gp.garage_id = $1
            AND gp.payout_status IN ('confirmed', 'completed')
            AND gp.confirmed_at::date >= $2::date
            AND gp.confirmed_at::date <= $3::date
            ORDER BY gp.confirmed_at ASC
        `, [garage_id, from_date, to_date]);

        const orders = ordersResult.rows.map(row => ({
            order_id: row.order_id,
            order_number: row.order_number || 'N/A',
            part_name: row.part_name || 'Auto Part',
            delivered_at: row.delivered_at,
            confirmed_at: row.confirmed_at,
            gross_amount: parseFloat(row.gross_amount) || 0,
            platform_fee: parseFloat(row.platform_fee) || 0,
            net_amount: parseFloat(row.net_amount) || 0,
            payout_reference: row.payout_reference
        }));

        // 4. Calculate summary totals
        const total_orders = orders.length;
        const gross_amount = orders.reduce((sum, o) => sum + o.gross_amount, 0);
        const total_platform_fee = orders.reduce((sum, o) => sum + o.platform_fee, 0);
        const net_payout = orders.reduce((sum, o) => sum + o.net_amount, 0);
        const platform_fee_percentage = gross_amount > 0
            ? Math.round((total_platform_fee / gross_amount) * 100)
            : 10; // Default 10%

        return {
            statement_number,
            period: {
                from_date,
                to_date
            },
            garage: {
                garage_id: garage.garage_id,
                garage_name: garage.garage_name,
                garage_name_ar: garage.garage_name_ar || undefined,
                cr_number: garage.cr_number || undefined,
                iban: garage.iban || undefined,
                bank_name: garage.bank_name || undefined
            },
            summary: {
                total_orders,
                gross_amount,
                total_platform_fee,
                net_payout,
                platform_fee_percentage
            },
            orders,
            generated_at: new Date()
        };
    }
}
