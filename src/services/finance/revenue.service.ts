/**
 * RevenueService - Business Logic for Revenue Reporting
 * Handles revenue analytics, transaction history, and financial insights
 */

import { Pool } from 'pg';
import {
    RevenuePeriod,
    RevenueFilters,
    RevenueReport,
    TransactionFilters,
    Transaction,
    TransactionDetail
} from './types';
import {
    InvalidPeriodError,
    OrderNotFoundError
} from './errors';

const ALLOWED_PERIODS: Record<RevenuePeriod, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90
};

export class RevenueService {
    constructor(private pool: Pool) { }

    /**
     * Get revenue report for specified period
     */
    async getRevenueReport(
        period: RevenuePeriod,
        filters?: RevenueFilters
    ): Promise<RevenueReport> {
        if (!ALLOWED_PERIODS[period]) {
            throw new InvalidPeriodError(period, Object.keys(ALLOWED_PERIODS));
        }

        const days = ALLOWED_PERIODS[period];
        const fromDate = filters?.from_date || new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const toDate = filters?.to_date || new Date();

        let whereClause = `WHERE o.order_status IN ('delivered', 'completed') 
                       AND o.order_status != 'refunded'
                       AND o.created_at >= $1 
                       AND o.created_at <= $2`;
        const params: unknown[] = [fromDate, toDate];
        let paramIndex = 3;

        if (filters?.garage_id) {
            whereClause += ` AND o.garage_id = $${paramIndex++}`;
            params.push(filters.garage_id);
        }

        // Get overall metrics (excluding fully refunded orders)
        const metricsResult = await this.pool.query(
            `SELECT 
            COALESCE(SUM(o.platform_fee + o.delivery_fee), 0) as gross_revenue,
            COALESCE(SUM(o.platform_fee), 0) as platform_fees,
            COALESCE(SUM(o.delivery_fee), 0) as delivery_fees,
            COUNT(*) as orders_completed,
            COALESCE(AVG(o.total_amount), 0) as average_order_value
         FROM orders o
         ${whereClause}
         AND o.order_id NOT IN (
             SELECT order_id FROM refunds 
             WHERE refund_status = 'completed' 
             AND refund_amount >= (SELECT total_amount FROM orders WHERE order_id = refunds.order_id)
         )`,
            params
        );

        // Get total refunds processed in period
        const refundResult = await this.pool.query(
            `SELECT COALESCE(SUM(refund_amount), 0) as total_refunds,
                COUNT(*) as refund_count
         FROM refunds 
         WHERE refund_status = 'completed'
         AND created_at >= $1 AND created_at <= $2`,
            [fromDate, toDate]
        );

        const metrics = metricsResult.rows[0];
        const refunds = refundResult.rows[0];
        const grossRevenue = parseFloat(metrics.gross_revenue);
        const totalRefunds = parseFloat(refunds.total_refunds);
        const netRevenue = Math.max(0, grossRevenue - totalRefunds);

        // Get daily breakdown
        const dailyResult = await this.pool.query(
            `SELECT 
            DATE(o.created_at) as date,
            COALESCE(SUM(o.platform_fee + o.delivery_fee), 0) as revenue,
            COUNT(*) as orders
         FROM orders o
         ${whereClause}
         GROUP BY DATE(o.created_at)
         ORDER BY date ASC`,
            params
        );

        // Get breakdown by garage (if not filtering by specific garage)
        let garageBreakdown;
        if (!filters?.garage_id) {
            const garageResult = await this.pool.query(
                `SELECT 
                o.garage_id,
                g.garage_name,
                COALESCE(SUM(o.platform_fee + o.delivery_fee), 0) as revenue,
                COUNT(*) as orders
             FROM orders o
             JOIN garages g ON o.garage_id = g.garage_id
             ${whereClause}
             GROUP BY o.garage_id, g.garage_name
             ORDER BY revenue DESC
             LIMIT 20`,
                params
            );

            garageBreakdown = garageResult.rows;
        }

        return {
            period,
            date_range: {
                from: fromDate,
                to: toDate
            },
            metrics: {
                gross_revenue: grossRevenue,
                total_refunds: totalRefunds,
                refund_count: parseInt(refunds.refund_count),
                total_revenue: netRevenue, // NET after refunds
                platform_fees: parseFloat(metrics.platform_fees),
                delivery_fees: parseFloat(metrics.delivery_fees),
                orders_completed: parseInt(metrics.orders_completed),
                average_order_value: parseFloat(metrics.average_order_value)
            },
            breakdown: {
                by_day: dailyResult.rows,
                by_garage: garageBreakdown
            }
        };
    }

    /**
     * Get unified transaction history (payouts + refunds)
     */
    async getTransactions(filters: TransactionFilters): Promise<Transaction[]> {
        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (filters.user_type === 'garage' && filters.user_id) {
            whereClause += ` AND garage_id = $${paramIndex++}`;
            params.push(filters.user_id);
        }

        if (filters.status && filters.status.length > 0) {
            whereClause += ` AND status = ANY($${paramIndex++}::text[])`;
            params.push(filters.status);
        }

        if (filters.from_date) {
            whereClause += ` AND created_at >= $${paramIndex++}`;
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            whereClause += ` AND created_at <= $${paramIndex++}`;
            params.push(filters.to_date);
        }

        const offset = ((filters.page || 1) - 1) * (filters.limit || 20);

        // UNION query for payouts and refunds
        const result = await this.pool.query(
            `SELECT * FROM (
                SELECT 
                    gp.payout_id as transaction_id,
                    'payout' as type,
                    gp.net_amount as amount,
                    gp.payout_status as status,
                    gp.created_at,
                    gp.garage_id,
                    g.garage_name,
                    o.order_number
                FROM garage_payouts gp
                JOIN garages g ON gp.garage_id = g.garage_id
                LEFT JOIN orders o ON gp.order_id = o.order_id
                
                UNION ALL
                
                SELECT 
                    r.refund_id as transaction_id,
                    'refund' as type,
                    r.refund_amount as amount,
                    r.refund_status as status,
                    r.created_at,
                    o.garage_id,
                    g.garage_name,
                    o.order_number
                FROM refunds r
                JOIN orders o ON r.order_id = o.order_id
                JOIN garages g ON o.garage_id = g.garage_id
            ) transactions
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, filters.limit || 20, offset]
        );

        return result.rows;
    }

    /**
     * Get detailed transaction information
     */
    async getTransactionDetail(orderId: string): Promise<TransactionDetail> {
        const result = await this.pool.query(
            `SELECT 
                o.*,
                u.full_name as customer_name,
                g.garage_name,
                gp.payout_id, gp.net_amount as payout_amount, gp.payout_status,
                r.refund_id, r.refund_amount, r.refund_status
             FROM orders o
             LEFT JOIN users u ON o.customer_id = u.user_id
             LEFT JOIN garages g ON o.garage_id = g.garage_id
             LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
             LEFT JOIN refunds r ON o.order_id = r.order_id
             WHERE o.order_id = $1`,
            [orderId]
        );

        if (result.rows.length === 0) {
            throw new OrderNotFoundError(orderId);
        }

        const row = result.rows[0];

        return {
            order_id: row.order_id,
            order_number: row.order_number,
            customer_name: row.customer_name,
            garage_name: row.garage_name,
            part_price: row.part_price,
            platform_fee: row.platform_fee,
            delivery_fee: row.delivery_fee,
            total_amount: row.total_amount,
            garage_payout_amount: row.garage_payout_amount,
            payment_status: row.payment_status,
            order_status: row.order_status,
            payout: row.payout_id ? {
                payout_id: row.payout_id,
                net_amount: row.payout_amount,
                payout_status: row.payout_status
            } : undefined,
            refund: row.refund_id ? {
                refund_id: row.refund_id,
                refund_amount: row.refund_amount,
                refund_status: row.refund_status
            } : undefined,
            created_at: row.created_at
        };
    }
}
