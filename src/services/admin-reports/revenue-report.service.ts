/**
 * Revenue Report Service
 * Handles subscription and commission reporting
 */
import { Pool } from 'pg';
import { getPeriodDates, formatCSV, getPagination } from './utils';

export class RevenueReportService {
    constructor(private pool: Pool) { }

    async getSubscriptionRenewalsReport(params: { page?: number; limit?: number; format?: string; days_ahead?: number }) {
        const { pageNum, limitNum, offset } = getPagination(params);
        const daysAhead = Math.min(90, Math.max(7, Number(params.days_ahead || 30)));

        const countResult = await this.pool.query(`
            SELECT COUNT(*) FROM garage_subscriptions gs 
            WHERE gs.status = 'active' 
            AND gs.billing_cycle_end <= NOW() + INTERVAL '${daysAhead} days'
            AND gs.billing_cycle_end > NOW()
        `);
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.garage_id, g.garage_name, u.phone_number, u.email,
                sp.plan_name, gs.billing_cycle_end as expires_at,
                EXTRACT(DAYS FROM (gs.billing_cycle_end - NOW()))::int as days_until_expiry,
                gs.created_at as subscription_start,
                EXTRACT(MONTHS FROM AGE(NOW(), gs.created_at))::int as months_subscribed,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_orders,
                (SELECT COALESCE(SUM(garage_payout_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue
            FROM garage_subscriptions gs
            JOIN garages g ON gs.garage_id = g.garage_id
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gs.status = 'active' 
            AND gs.billing_cycle_end <= NOW() + INTERVAL '${daysAhead} days'
            AND gs.billing_cycle_end > NOW()
            ORDER BY gs.billing_cycle_end ASC
            LIMIT $1 OFFSET $2
        `, [limitNum, offset]);

        if (params.format === 'csv') {
            return formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'plan_name', label: 'Plan' },
                { key: 'days_until_expiry', label: 'Days Until Expiry' },
                { key: 'months_subscribed', label: 'Months Subscribed' },
                { key: 'total_orders', label: 'Total Orders' },
                { key: 'total_revenue', label: 'Revenue (QAR)' }
            ]);
        }

        return {
            data: result.rows,
            pagination: { current_page: pageNum, total_pages: Math.ceil(total / limitNum), total, limit: limitNum },
            summary: {
                total_expiring: total,
                expiring_7_days: result.rows.filter(r => r.days_until_expiry <= 7).length,
                high_value_at_risk: result.rows.filter(r => parseFloat(r.total_revenue) > 10000).length
            }
        };
    }

    async getCommissionRevenueReport(params: { period?: string; format?: string; group_by?: string }) {
        const { start, end } = getPeriodDates(params.period || '30d');
        const groupBy = params.group_by || 'day';

        const summary = await this.pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as gross_revenue,
                COALESCE(SUM(platform_commission), 0) as commission_revenue,
                COALESCE(AVG(platform_commission), 0) as avg_commission_per_order,
                COALESCE(AVG(platform_commission / NULLIF(total_amount, 0) * 100), 0) as avg_commission_rate
            FROM orders
            WHERE order_status = 'completed'
            AND created_at >= $1 AND created_at <= $2
        `, [start, end]);

        const groupFormat = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'YYYY-WW' : 'YYYY-MM-DD';
        const breakdown = await this.pool.query(`
            SELECT 
                TO_CHAR(created_at, '${groupFormat}') as period,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as gross_revenue,
                COALESCE(SUM(platform_commission), 0) as commission_revenue
            FROM orders
            WHERE order_status = 'completed'
            AND created_at >= $1 AND created_at <= $2
            GROUP BY TO_CHAR(created_at, '${groupFormat}')
            ORDER BY period DESC
        `, [start, end]);

        const topGarages = await this.pool.query(`
            SELECT 
                g.garage_name,
                COUNT(*) as order_count,
                COALESCE(SUM(o.platform_commission), 0) as commission_generated
            FROM orders o
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE o.order_status = 'completed'
            AND o.created_at >= $1 AND o.created_at <= $2
            GROUP BY g.garage_id, g.garage_name
            ORDER BY commission_generated DESC
            LIMIT 10
        `, [start, end]);

        if (params.format === 'csv') {
            return formatCSV(breakdown.rows, [
                { key: 'period', label: 'Period' },
                { key: 'order_count', label: 'Orders' },
                { key: 'gross_revenue', label: 'Gross Revenue (QAR)' },
                { key: 'commission_revenue', label: 'Commission (QAR)' }
            ]);
        }

        return {
            summary: {
                total_orders: parseInt(summary.rows[0].total_orders),
                gross_revenue: parseFloat(summary.rows[0].gross_revenue),
                commission_revenue: parseFloat(summary.rows[0].commission_revenue),
                avg_commission_per_order: parseFloat(summary.rows[0].avg_commission_per_order).toFixed(2),
                avg_commission_rate: parseFloat(summary.rows[0].avg_commission_rate).toFixed(1) + '%'
            },
            breakdown: breakdown.rows,
            top_garages: topGarages.rows
        };
    }

    async getRegistrationsReport(params: { period?: string; format?: string; user_type?: string }) {
        const { start, end } = getPeriodDates(params.period || '30d');
        const userType = params.user_type || 'all';

        let typeFilter = '';
        if (userType !== 'all') {
            typeFilter = ` AND user_type = '${userType}'`;
        }

        const summary = await this.pool.query(`
            SELECT user_type, COUNT(*) as count
            FROM users
            WHERE created_at >= $1 AND created_at <= $2 ${typeFilter}
            GROUP BY user_type
            ORDER BY count DESC
        `, [start, end]);

        const daily = await this.pool.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                user_type,
                COUNT(*) as count
            FROM users
            WHERE created_at >= $1 AND created_at <= $2 ${typeFilter}
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), user_type
            ORDER BY date DESC
        `, [start, end]);

        if (params.format === 'csv') {
            return formatCSV(daily.rows, [
                { key: 'date', label: 'Date' },
                { key: 'user_type', label: 'User Type' },
                { key: 'count', label: 'Registrations' }
            ]);
        }

        return {
            summary: summary.rows,
            daily_breakdown: daily.rows,
            totals: {
                total_registrations: summary.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
            }
        };
    }
}
