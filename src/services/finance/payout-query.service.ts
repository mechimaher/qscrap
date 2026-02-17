/**
 * PayoutQueryService - Read Operations for Payouts
 * Handles getPayoutSummary, getAwaitingConfirmation, getPayouts, getPayoutStatus, getPaymentStats
 */

import { Pool } from 'pg';
import {
    Payout,
    PayoutFilters,
    PayoutSummary,
    PaginatedPayouts,
    PayoutStatusDetail,
    PaymentStats
} from './types';
import { PayoutNotFoundError } from './errors';

export class PayoutQueryService {
    constructor(private pool: Pool) { }

    async getPayoutSummary(userId: string, userType: string): Promise<PayoutSummary> {
        let garageId: string | null = null;
        let whereClause = '';
        const params: unknown[] = [];

        if (userType === 'garage') {
            garageId = userId;
            whereClause = 'WHERE garage_id = $1';
            params.push(garageId);
        }


        const statsResult = await this.pool.query(`
            SELECT 
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'completed' AND (payout_type IS NULL OR payout_type != 'reversal')), 0) as completed_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'confirmed' AND (payout_type IS NULL OR payout_type != 'reversal')), 0) as confirmed_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status IN ('completed', 'confirmed') AND (payout_type IS NULL OR payout_type != 'reversal')), 0) as total_paid,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'pending' AND (payout_type IS NULL OR payout_type != 'reversal')), 0) as pending_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status IN ('processing', 'awaiting_confirmation') AND (payout_type IS NULL OR payout_type != 'reversal')), 0) as processing_payouts,
                -- Eligible pending payouts: only those past 7-day warranty window
                (SELECT COALESCE(SUM(gp2.net_amount), 0) FROM garage_payouts gp2
                 LEFT JOIN orders o2 ON gp2.order_id = o2.order_id
                 WHERE gp2.payout_status = 'pending' 
                 AND (gp2.payout_type IS NULL OR gp2.payout_type != 'reversal')
                 AND COALESCE(o2.actual_delivery_at, o2.completed_at, gp2.created_at) <= NOW() - INTERVAL '7 days'
                 ${whereClause ? `AND ${whereClause.replace('WHERE ', '').replace('garage_id', 'gp2.garage_id')}` : ''}
                ) as eligible_pending_payouts,
                -- In-warranty total: payouts still within 7-day window
                (SELECT COALESCE(SUM(gp3.net_amount), 0) FROM garage_payouts gp3
                 LEFT JOIN orders o3 ON gp3.order_id = o3.order_id
                 WHERE gp3.payout_status = 'pending' 
                 AND (gp3.payout_type IS NULL OR gp3.payout_type != 'reversal')
                 AND COALESCE(o3.actual_delivery_at, o3.completed_at, gp3.created_at) > NOW() - INTERVAL '7 days'
                 ${whereClause ? `AND ${whereClause.replace('WHERE ', '').replace('garage_id', 'gp3.garage_id')}` : ''}
                ) as in_warranty_total,
                -- CRITICAL: Only count payouts past 7-day warranty window (eligible for processing)
                (SELECT COUNT(*) FROM garage_payouts gp2
                 LEFT JOIN orders o2 ON gp2.order_id = o2.order_id
                 WHERE gp2.payout_status = 'pending' 
                 AND (gp2.payout_type IS NULL OR gp2.payout_type != 'reversal')
                 AND COALESCE(o2.actual_delivery_at, o2.completed_at, gp2.created_at) <= NOW() - INTERVAL '7 days'
                 ${whereClause ? `AND ${whereClause.replace('WHERE ', '').replace('garage_id', 'gp2.garage_id')}` : ''}
                ) as pending_count,
                COUNT(*) FILTER (WHERE payout_status = 'awaiting_confirmation') as awaiting_count,
                COUNT(*) FILTER (WHERE payout_status = 'disputed') as disputed_count,
                COALESCE(SUM(net_amount) FILTER (
                    WHERE payout_status IN ('completed', 'confirmed') 
                    AND (payout_type IS NULL OR payout_type != 'reversal')
                    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
                    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0) as this_month_completed,
                -- Count payouts still in warranty window (not yet eligible)
                COUNT(*) FILTER (
                    WHERE payout_status = 'pending' 
                    AND (payout_type IS NULL OR payout_type != 'reversal')
                ) as total_pending_count,
                COUNT(*) FILTER (
                    WHERE payout_status = 'pending' 
                    AND (payout_type IS NULL OR payout_type != 'reversal')
                    AND created_at > NOW() - INTERVAL '7 days'
                ) as in_warranty_count
            FROM garage_payouts
            ${whereClause}
        `, params);

        let totalRevenue = 0;
        if (userType === 'garage') {
            const revRes = await this.pool.query(
                `SELECT COALESCE(SUM(net_amount), 0) as total_revenue
                 FROM garage_payouts
                 WHERE garage_id = $1 AND payout_status != 'cancelled'`,
                [garageId]
            );
            totalRevenue = revRes.rows[0].total_revenue;
        } else {
            const revenueResult = await this.pool.query(`
                SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) as total_revenue
                FROM orders
                WHERE order_status = 'completed' 
                AND created_at > NOW() - INTERVAL '30 days'
            `);
            totalRevenue = revenueResult.rows[0].total_revenue;
        }

        // CRITICAL: Only show payouts for orders delivered 7+ days ago (warranty window)
        // This is a Qatar B2B business rule - no early payouts
        const pendingResult = await this.pool.query(`
            SELECT gp.*, g.garage_name, o.order_number, o.actual_delivery_at,
                   EXTRACT(DAY FROM NOW() - COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at)) as days_since_delivery,
                   GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at)))::int as days_until_eligible
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_status = 'pending' 
            AND (gp.payout_type IS NULL OR gp.payout_type != 'reversal')
            AND COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at) <= NOW() - INTERVAL '7 days'
            ${userType === 'garage' ? 'AND gp.garage_id = $1' : ''}
            ORDER BY gp.created_at ASC
            LIMIT 20
        `, userType === 'garage' ? [garageId] : []);

        return {
            stats: {
                ...statsResult.rows[0],
                total_revenue: totalRevenue
            },
            pending_payouts: pendingResult.rows
        };
    }

    // Get payouts still within 7-day warranty window (not yet eligible for processing)
    async getInWarrantyPayouts(userType: string, userId?: string): Promise<Payout[]> {
        let whereClause = `WHERE gp.payout_status = 'pending' 
            AND (gp.payout_type IS NULL OR gp.payout_type != 'reversal')
            AND COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at) > NOW() - INTERVAL '7 days'`;
        const params: unknown[] = [];

        if (userType === 'garage') {
            whereClause += ` AND gp.garage_id = $1`;
            params.push(userId);
        }

        const result = await this.pool.query(`
            SELECT gp.*, g.garage_name, o.order_number, o.actual_delivery_at,
                   EXTRACT(DAY FROM NOW() - COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at)) as days_since_delivery,
                   GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - COALESCE(o.actual_delivery_at, o.completed_at, gp.created_at)))::int as days_until_eligible
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            ${whereClause}
            ORDER BY o.actual_delivery_at ASC
            LIMIT 50
        `, params);

        return result.rows;
    }

    async getAwaitingConfirmation(garageId: string): Promise<Payout[]> {
        const result = await this.pool.query(
            `SELECT gp.*, g.garage_name, o.order_number
             FROM garage_payouts gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN orders o ON gp.order_id = o.order_id
             WHERE gp.garage_id = $1 
             AND gp.payout_status = 'awaiting_confirmation'
             ORDER BY gp.sent_at ASC`,
            [garageId]
        );

        return result.rows;
    }

    async getPayouts(filters: PayoutFilters): Promise<PaginatedPayouts> {
        // Always exclude reversal payouts from the Finance dashboard lists
        // Reversals are internal accounting records, not actionable items
        let whereClause = "WHERE (gp.payout_type IS NULL OR gp.payout_type != 'reversal')";
        const params: unknown[] = [];
        let paramIndex = 1;

        if (filters.status) {
            whereClause += ` AND gp.payout_status = $${paramIndex++}`;
            params.push(filters.status);

            // CRITICAL: For pending payouts, only show those past 7-day warranty window
            // This is a Qatar B2B business rule - no payouts before customer can return
            if (filters.status === 'pending') {
                whereClause += ` AND COALESCE(o.delivered_at, o.completed_at, gp.created_at) <= NOW() - INTERVAL '7 days'`;
            }
        }

        if (filters.garage_id) {
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            params.push(filters.garage_id);
        } else if (filters.userType === 'garage') {
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            params.push(filters.userId);
        }

        // Date range filters - use confirmed_at for confirmed/completed, otherwise created_at
        if (filters.from_date) {
            whereClause += ` AND COALESCE(gp.confirmed_at, gp.created_at)::date >= $${paramIndex++}::date`;
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            whereClause += ` AND COALESCE(gp.confirmed_at, gp.created_at)::date <= $${paramIndex++}::date`;
            params.push(filters.to_date);
        }

        const offset = ((filters.page || 1) - 1) * (filters.limit || 20);

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM garage_payouts gp 
             LEFT JOIN orders o ON gp.order_id = o.order_id
             ${whereClause}`,
            params
        );

        const result = await this.pool.query(
            `SELECT gp.*, g.garage_name, o.order_number
             FROM garage_payouts gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN orders o ON gp.order_id = o.order_id
             ${whereClause}
             ORDER BY gp.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, filters.limit || 20, offset]
        );

        return {
            payouts: result.rows,
            pagination: {
                page: filters.page || 1,
                limit: filters.limit || 20,
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / (filters.limit || 20))
            }
        };
    }

    async getPayoutStatus(payoutId: string): Promise<PayoutStatusDetail> {
        const result = await this.pool.query(
            `SELECT gp.*, g.garage_name, o.order_number
             FROM garage_payouts gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN orders o ON gp.order_id = o.order_id
             WHERE gp.payout_id = $1`,
            [payoutId]
        );

        if (result.rows.length === 0) {
            throw new PayoutNotFoundError(payoutId);
        }

        const payout = result.rows[0];

        const timeline = [
            { status: 'created', timestamp: payout.created_at },
            payout.sent_at && { status: 'sent', timestamp: payout.sent_at, notes: payout.notes },
            payout.confirmed_at && { status: 'confirmed', timestamp: payout.confirmed_at, notes: payout.confirmation_notes },
            payout.disputed_at && { status: 'disputed', timestamp: payout.disputed_at, notes: payout.dispute_description },
            payout.processed_at && { status: 'processed', timestamp: payout.processed_at }
        ].filter(Boolean) as Array<{ status: string; timestamp: Date; notes?: string }>;

        return {
            ...payout,
            timeline
        };
    }

    async getPaymentStats(): Promise<PaymentStats> {
        const statsResult = await this.pool.query(`
            SELECT 
                COUNT(*) as total_payouts,
                COALESCE(SUM(net_amount), 0) as total_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'pending') as pending_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'pending'), 0) as pending_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'processing') as processing_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'processing'), 0) as processing_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'awaiting_confirmation') as awaiting_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'awaiting_confirmation'), 0) as awaiting_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'awaiting_confirmation' 
                    AND sent_at < NOW() - INTERVAL '7 days') as overdue_count,
                
                COUNT(*) FILTER (WHERE payout_status = 'confirmed') as confirmed_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'confirmed'), 0) as confirmed_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'completed') as completed_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'completed'), 0) as completed_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'held') as held_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'held'), 0) as held_amount,
                
                COUNT(*) FILTER (WHERE payout_status = 'disputed') as disputed_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'disputed'), 0) as disputed_amount
                
            FROM garage_payouts
        `);

        const stats = statsResult.rows[0];

        return {
            total_payouts: parseInt(stats.total_payouts),
            total_amount: parseFloat(stats.total_amount),
            by_status: {
                pending: { count: parseInt(stats.pending_count), amount: parseFloat(stats.pending_amount) },
                processing: { count: parseInt(stats.processing_count), amount: parseFloat(stats.processing_amount) },
                awaiting_confirmation: { count: parseInt(stats.awaiting_count), amount: parseFloat(stats.awaiting_amount) },
                confirmed: { count: parseInt(stats.confirmed_count), amount: parseFloat(stats.confirmed_amount) },
                completed: { count: parseInt(stats.completed_count), amount: parseFloat(stats.completed_amount) },
                held: { count: parseInt(stats.held_count), amount: parseFloat(stats.held_amount) },
                disputed: { count: parseInt(stats.disputed_count), amount: parseFloat(stats.disputed_amount) },
                cancelled: { count: 0, amount: 0 }
            },
            awaiting_confirmation: {
                count: parseInt(stats.awaiting_count),
                total_amount: parseFloat(stats.awaiting_amount),
                overdue_count: parseInt(stats.overdue_count)
            },
            auto_confirm_eligible: parseInt(stats.overdue_count)
        };
    }
}
