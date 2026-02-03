/**
 * FinanceService - Payout & Financial Operations Business Logic
 * 
 * Extracted from finance.controller.ts (1,293 lines) to enable:
 * - Testability
 * - Reusability
 * - Consistent error handling
 */

import pool from '../config/db';
import { ApiError, ErrorCode } from '../middleware/errorHandler.middleware';
import { createNotification } from './notification.service';
import { emitToGarage, emitToOperations } from '../utils/socketIO';
import logger from '../utils/logger';

// ============================================
// TYPES
// ============================================

export interface PayoutRecord {
    payout_id: string;
    garage_id: string;
    order_id: string;
    order_number?: string;
    garage_name?: string;
    amount: number;
    platform_fee: number;
    net_amount: number;
    status: 'pending' | 'sent' | 'confirmed' | 'disputed' | 'on_hold' | 'completed';
    sent_at?: string;
    confirmed_at?: string;
    created_at: string;
}

export interface PayoutSummary {
    total_pending: number;
    total_pending_count: number;
    total_sent: number;
    total_sent_count: number;
    total_confirmed: number;
    total_confirmed_count: number;
    total_disputed: number;
    total_disputed_count: number;
}

export interface PayoutFilters {
    status?: string;
    garage_id?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
}

export interface RevenueReport {
    period: string;
    total_orders: number;
    total_revenue: number;
    platform_fees: number;
    delivery_fees: number;
    refunds: number;
    net_revenue: number;
}

// ============================================
// FINANCE SERVICE
// ============================================

export class FinanceService {

    /**
     * Get payout summary statistics
     */
    static async getPayoutSummary(): Promise<PayoutSummary> {
        const result = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) as total_pending,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending_count,
                COALESCE(SUM(CASE WHEN status = 'sent' THEN net_amount ELSE 0 END), 0) as total_sent,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_sent_count,
                COALESCE(SUM(CASE WHEN status = 'confirmed' THEN net_amount ELSE 0 END), 0) as total_confirmed,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as total_confirmed_count,
                COALESCE(SUM(CASE WHEN status = 'disputed' THEN net_amount ELSE 0 END), 0) as total_disputed,
                COUNT(CASE WHEN status = 'disputed' THEN 1 END) as total_disputed_count
            FROM garage_payouts
        `);
        return result.rows[0];
    }

    /**
     * Get payouts with filters
     */
    static async getPayouts(filters: PayoutFilters): Promise<{
        payouts: PayoutRecord[];
        pagination: { page: number; total: number; pages: number };
    }> {
        const { status, garage_id, from_date, to_date, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause += ` AND gp.status = $${paramIndex++}`;
            params.push(status);
        }
        if (garage_id) {
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            params.push(garage_id);
        }
        if (from_date) {
            whereClause += ` AND gp.created_at >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            whereClause += ` AND gp.created_at <= $${paramIndex++}`;
            params.push(to_date);
        }

        // Count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM garage_payouts gp ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Data
        const result = await pool.query(`
            SELECT gp.*, o.order_number, g.garage_name
            FROM garage_payouts gp
            JOIN orders o ON gp.order_id = o.order_id
            JOIN garages g ON gp.garage_id = g.garage_id
            ${whereClause}
            ORDER BY gp.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        return {
            payouts: result.rows,
            pagination: {
                page,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Send payment to garage (Operations action)
     */
    static async sendPayment(params: {
        payout_id: string;
        sent_by: string;
        reference_number?: string;
        notes?: string;
    }): Promise<{ payout: PayoutRecord }> {
        const { payout_id, sent_by, reference_number, notes } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update payout status
            const result = await client.query(`
                UPDATE garage_payouts SET
                    status = 'sent',
                    sent_at = NOW(),
                    sent_by = $1,
                    reference_number = $2,
                    notes = COALESCE(notes || E'\n', '') || $3,
                    updated_at = NOW()
                WHERE payout_id = $4 AND status = 'pending'
                RETURNING *
            `, [sent_by, reference_number, notes || 'Payment sent', payout_id]);

            if (result.rows.length === 0) {
                throw ApiError.badRequest('Payout not found or already processed');
            }

            const payout = result.rows[0];

            // Notify garage
            await createNotification({
                userId: payout.garage_id,
                type: 'payment_sent',
                title: 'Payment Sent 💰',
                message: `Payment of ${payout.net_amount} QAR has been sent to your account`,
                data: { payout_id, amount: payout.net_amount },
                target_role: 'garage'
            });

            emitToGarage(payout.garage_id, 'payment_sent', {
                payout_id,
                amount: payout.net_amount,
                reference_number
            });

            await client.query('COMMIT');
            return { payout };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Garage confirms payment receipt
     */
    static async confirmPayment(params: {
        payout_id: string;
        garage_id: string;
    }): Promise<{ payout: PayoutRecord }> {
        const { payout_id, garage_id } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify ownership and status
            const result = await client.query(`
                UPDATE garage_payouts SET
                    status = 'confirmed',
                    confirmed_at = NOW(),
                    updated_at = NOW()
                WHERE payout_id = $1 AND garage_id = $2 AND status = 'sent'
                RETURNING *
            `, [payout_id, garage_id]);

            if (result.rows.length === 0) {
                throw ApiError.badRequest('Payout not found or cannot be confirmed');
            }

            const payout = result.rows[0];

            // Notify operations
            emitToOperations('payment_confirmed', {
                payout_id,
                garage_id,
                amount: payout.net_amount
            });

            await client.query('COMMIT');
            return { payout };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Garage disputes payment
     */
    static async disputePayment(params: {
        payout_id: string;
        garage_id: string;
        reason: string;
    }): Promise<{ payout: PayoutRecord }> {
        const { payout_id, garage_id, reason } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garage_payouts SET
                    status = 'disputed',
                    dispute_reason = $1,
                    disputed_at = NOW(),
                    updated_at = NOW()
                WHERE payout_id = $2 AND garage_id = $3 AND status = 'sent'
                RETURNING *
            `, [reason, payout_id, garage_id]);

            if (result.rows.length === 0) {
                throw ApiError.badRequest('Payout not found or cannot be disputed');
            }

            const payout = result.rows[0];

            // Alert operations
            emitToOperations('payment_disputed', {
                payout_id,
                garage_id,
                reason,
                amount: payout.net_amount
            });

            await client.query('COMMIT');
            return { payout };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get revenue report for period
     */
    static async getRevenueReport(period: '7d' | '30d' | '90d'): Promise<RevenueReport> {
        const days = { '7d': 7, '30d': 30, '90d': 90 }[period];

        const result = await pool.query(`
            SELECT
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(platform_fee), 0) as platform_fees,
                COALESCE(SUM(delivery_fee), 0) as delivery_fees
            FROM orders
            WHERE order_status IN ('delivered', 'completed')
            AND created_at >= NOW() - INTERVAL '${days} days'
        `);

        const refundResult = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as refunds
            FROM refunds
            WHERE created_at >= NOW() - INTERVAL '${days} days'
        `);

        const data = result.rows[0];
        const refunds = parseFloat(refundResult.rows[0].refunds);

        return {
            period,
            total_orders: parseInt(data.total_orders),
            total_revenue: parseFloat(data.total_revenue),
            platform_fees: parseFloat(data.platform_fees),
            delivery_fees: parseFloat(data.delivery_fees),
            refunds,
            net_revenue: parseFloat(data.platform_fees) + parseFloat(data.delivery_fees) - refunds
        };
    }

    /**
     * Create a refund
     * 
     * @deprecated This method does NOT call Stripe. Use RefundService.createRefund() instead.
     * This is a legacy path that only creates a DB record without executing the actual refund.
     * Scheduled for removal in Q2 2026.
     * 
     * @see src/services/finance/refund.service.ts for the canonical implementation
     */
    static async createRefund(params: {
        order_id: string;
        amount: number;
        reason: string;
        created_by: string;
    }): Promise<{ refund: unknown }> {
        // G-01 FIX: Deprecation warning - this method doesn't call Stripe!
        logger.warn('DEPRECATED FinanceService.createRefund() called - use RefundService.createRefund() instead', { orderId: params.order_id });

        const { order_id, amount, reason, created_by } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get order details
            const orderResult = await client.query(
                `SELECT * FROM orders WHERE order_id = $1`,
                [order_id]
            );

            if (orderResult.rows.length === 0) {
                throw ApiError.notFound('Order not found');
            }

            const order = orderResult.rows[0];

            if (amount > order.total_amount) {
                throw ApiError.badRequest('Refund amount cannot exceed order total');
            }

            // Create refund record
            const refundResult = await client.query(`
                INSERT INTO refunds (order_id, amount, reason, created_by, status)
                VALUES ($1, $2, $3, $4, 'completed')
                RETURNING *
            `, [order_id, amount, reason, created_by]);

            // Adjust payout if exists
            await client.query(`
                UPDATE garage_payouts SET
                    net_amount = net_amount - $1,
                    notes = COALESCE(notes || E'\n', '') || $2,
                    updated_at = NOW()
                WHERE order_id = $3 AND status IN ('pending', 'sent')
            `, [amount, `Refund: ${amount} QAR - ${reason}`, order_id]);

            // Notify customer
            await createNotification({
                userId: order.customer_id,
                type: 'refund_processed',
                title: 'Refund Processed 💳',
                message: `Refund of ${amount} QAR has been processed`,
                data: { order_id, amount },
                target_role: 'customer'
            });

            await client.query('COMMIT');
            return { refund: refundResult.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Hold a payout
     */
    static async holdPayout(payout_id: string, reason: string): Promise<{ success: boolean }> {
        await pool.query(`
            UPDATE garage_payouts SET
                status = 'on_hold',
                notes = COALESCE(notes || E'\n', '') || $1,
                updated_at = NOW()
            WHERE payout_id = $2 AND status = 'pending'
        `, [`Hold: ${reason}`, payout_id]);

        return { success: true };
    }

    /**
     * Release a held payout
     */
    static async releasePayout(payout_id: string): Promise<{ success: boolean }> {
        await pool.query(`
            UPDATE garage_payouts SET
                status = 'pending',
                notes = COALESCE(notes || E'\n', '') || $1,
                updated_at = NOW()
            WHERE payout_id = $2 AND status = 'on_hold'
        `, ['Released from hold', payout_id]);

        return { success: true };
    }

    /**
     * Get preview of batch payouts before processing
     * Returns count and total amount for confirmation dialog
     */
    static async getBatchPayoutPreview(params: {
        payout_ids?: string[];
        garage_id?: string;
        all_pending?: boolean;
    }): Promise<{
        count: number;
        total_amount: number;
        garages: { garage_id: string; garage_name: string; payout_count: number; total: number }[];
    }> {
        const { payout_ids, garage_id, all_pending } = params;

        let whereClause = "WHERE gp.status = 'pending'";
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (payout_ids && payout_ids.length > 0) {
            whereClause += ` AND gp.payout_id = ANY($${paramIndex++})`;
            queryParams.push(payout_ids);
        } else if (garage_id) {
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            queryParams.push(garage_id);
        }
        // all_pending = true means no additional filter

        const result = await pool.query(`
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
     * Processes all in a single transaction for atomicity
     * Uses bulk UPDATE for performance (not a loop)
     */
    static async sendBatchPayments(params: {
        payout_ids?: string[];
        garage_id?: string;
        all_pending?: boolean;
        sent_by: string;
        reference_number: string;
        notes?: string;
    }): Promise<{
        success: boolean;
        processed_count: number;
        failed_count: number;
        total_amount: number;
        garages_notified: number;
    }> {
        const { payout_ids, garage_id, all_pending, sent_by, reference_number, notes } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Build WHERE clause based on filter mode
            let whereClause = "status = 'pending'";
            const queryParams: unknown[] = [sent_by, reference_number, notes || 'Batch payment'];
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
                    status = 'sent',
                    sent_at = NOW(),
                    sent_by = $1,
                    reference_number = $2,
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
            const total_amount = processedPayouts.reduce((sum, p) => sum + parseFloat(p.net_amount), 0);

            // Group by garage for notifications
            const garagePayouts = new Map<string, { count: number; total: number }>();
            for (const p of processedPayouts) {
                const existing = garagePayouts.get(p.garage_id) || { count: 0, total: 0 };
                existing.count++;
                existing.total += parseFloat(p.net_amount);
                garagePayouts.set(p.garage_id, existing);
            }

            // Send notifications to each garage (summarized)
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

            // Notify operations
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
     * Get list of garages with pending payouts (for filter dropdown)
     */
    static async getGaragesWithPendingPayouts(): Promise<{
        garages: { garage_id: string; garage_name: string; pending_count: number; pending_total: number }[];
    }> {
        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                COUNT(*)::int as pending_count,
                COALESCE(SUM(gp.net_amount), 0)::numeric as pending_total
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            WHERE gp.status = 'pending'
            GROUP BY g.garage_id, g.garage_name
            ORDER BY pending_count DESC
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
}

export default FinanceService;

