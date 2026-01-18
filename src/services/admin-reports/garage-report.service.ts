/**
 * Garage Report Service
 * Handles garage lifecycle reports (demo, conversions, all garages)
 */
import { Pool } from 'pg';
import { getPeriodDates, formatCSV, getPagination, PaginationResult } from './utils';

export class GarageReportService {
    constructor(private pool: Pool) { }

    async getDemoGaragesReport(params: { page?: number; limit?: number; format?: string; sort?: string }) {
        const { pageNum, limitNum, offset } = getPagination(params);
        const sort = params.sort || 'demo_expires_at';

        const countResult = await this.pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'demo' AND g.demo_expires_at > NOW()
        `);
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.garage_id, g.garage_name, u.phone_number, u.email, g.demo_expires_at,
                EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int as days_left,
                g.created_at as registered_at,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) as total_bids,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) as total_orders,
                (SELECT COALESCE(SUM(garage_payout_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue,
                u.last_login_at
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            WHERE g.approval_status = 'demo' AND g.demo_expires_at > NOW()
            ORDER BY ${sort === 'days_left' ? 'g.demo_expires_at ASC' :
                sort === 'bids' ? 'total_bids DESC' :
                    sort === 'revenue' ? 'total_revenue DESC' : 'g.demo_expires_at ASC'}
            LIMIT $1 OFFSET $2
        `, [limitNum, offset]);

        if (params.format === 'csv') {
            return formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'days_left', label: 'Days Left' },
                { key: 'total_bids', label: 'Total Bids' },
                { key: 'total_orders', label: 'Orders' },
                { key: 'total_revenue', label: 'Revenue (QAR)' }
            ]);
        }

        return {
            data: result.rows,
            pagination: { current_page: pageNum, total_pages: Math.ceil(total / limitNum), total, limit: limitNum },
            summary: {
                total_demo_garages: total,
                expiring_soon: result.rows.filter(r => r.days_left <= 7).length
            }
        };
    }

    async getExpiredDemosReport(params: { page?: number; limit?: number; format?: string; period?: string }) {
        const { pageNum, limitNum, offset } = getPagination(params);
        const { start } = getPeriodDates(params.period || '30d');

        const countResult = await this.pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'expired' 
            OR (g.approval_status = 'demo' AND g.demo_expires_at <= NOW() AND g.demo_expires_at >= $1)
        `, [start]);
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.garage_id, g.garage_name, u.phone_number, u.email,
                g.demo_expires_at as expired_at,
                EXTRACT(DAYS FROM (NOW() - g.demo_expires_at))::int as days_since_expired,
                g.created_at as registered_at,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) as total_bids,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) as total_orders,
                u.last_login_at,
                CASE 
                    WHEN (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) > 0 THEN 'had_activity'
                    WHEN (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) > 0 THEN 'bids_only'
                    ELSE 'no_activity'
                END as activity_level
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            WHERE g.approval_status = 'expired' 
            OR (g.approval_status = 'demo' AND g.demo_expires_at <= NOW() AND g.demo_expires_at >= $1)
            ORDER BY g.demo_expires_at DESC
            LIMIT $2 OFFSET $3
        `, [start, limitNum, offset]);

        if (params.format === 'csv') {
            return formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'expired_at', label: 'Expired Date' },
                { key: 'days_since_expired', label: 'Days Since Expired' },
                { key: 'total_bids', label: 'Total Bids' },
                { key: 'total_orders', label: 'Orders' },
                { key: 'activity_level', label: 'Activity Level' }
            ]);
        }

        return {
            data: result.rows,
            pagination: { current_page: pageNum, total_pages: Math.ceil(total / limitNum), total, limit: limitNum },
            summary: {
                total_expired: total,
                with_activity: result.rows.filter(r => r.activity_level !== 'no_activity').length,
                potential_conversions: result.rows.filter(r => r.total_orders > 0).length
            }
        };
    }

    async getDemoConversionsReport(params: { page?: number; limit?: number; format?: string; period?: string }) {
        const { pageNum, limitNum, offset } = getPagination(params);
        const { start } = getPeriodDates(params.period || '90d');

        const countResult = await this.pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'approved' 
            AND g.approval_date >= $1
            AND EXISTS (SELECT 1 FROM garage_subscriptions gs WHERE gs.garage_id = g.garage_id)
        `, [start]);
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.garage_id, g.garage_name, u.phone_number,
                g.created_at as registered_at, g.approval_date as converted_at,
                EXTRACT(DAYS FROM (g.approval_date - g.created_at))::int as days_to_convert,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id AND b.created_at <= g.approval_date) as bids_before_convert,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id AND o.created_at <= g.approval_date) as orders_before_convert,
                sp.plan_name,
                (SELECT COALESCE(SUM(garage_payout_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as lifetime_revenue
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON gs.garage_id = g.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE g.approval_status = 'approved' 
            AND g.approval_date >= $1
            AND EXISTS (SELECT 1 FROM garage_subscriptions gs2 WHERE gs2.garage_id = g.garage_id)
            ORDER BY g.approval_date DESC
            LIMIT $2 OFFSET $3
        `, [start, limitNum, offset]);

        const demoCount = await this.pool.query(`SELECT COUNT(*) FROM garages WHERE created_at >= $1`, [start]);
        const totalNewGarages = parseInt(demoCount.rows[0].count);
        const conversionRate = totalNewGarages > 0 ? ((total / totalNewGarages) * 100).toFixed(1) : '0';

        if (params.format === 'csv') {
            return formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'registered_at', label: 'Registered' },
                { key: 'converted_at', label: 'Converted Date' },
                { key: 'days_to_convert', label: 'Days to Convert' },
                { key: 'plan_name', label: 'Plan' },
                { key: 'lifetime_revenue', label: 'Lifetime Revenue' }
            ]);
        }

        return {
            data: result.rows,
            pagination: { current_page: pageNum, total_pages: Math.ceil(total / limitNum), total, limit: limitNum },
            summary: {
                total_conversions: total,
                total_new_garages: totalNewGarages,
                conversion_rate: `${conversionRate}%`,
                avg_days_to_convert: result.rows.length > 0
                    ? Math.round(result.rows.reduce((sum, r) => sum + (r.days_to_convert || 0), 0) / result.rows.length)
                    : 0
            }
        };
    }

    async getAllGaragesReport(params: { page?: number; limit?: number; format?: string; status?: string }) {
        const { pageNum, limitNum, offset } = getPagination(params);
        const status = params.status || 'all';

        let whereClause = 'WHERE 1=1';
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            queryParams.push(status);
        }

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM garages g ${whereClause}`,
            queryParams
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.garage_id, g.garage_name, g.approval_status, u.phone_number, u.email,
                g.created_at, g.approval_date, g.demo_expires_at,
                CASE 
                    WHEN g.approval_status = 'demo' AND g.demo_expires_at > NOW() 
                        THEN EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int
                    ELSE NULL 
                END as demo_days_left,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) as total_bids,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) as total_orders,
                (SELECT COALESCE(SUM(garage_payout_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue,
                g.rating_average,
                sp.plan_name as subscription_plan
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON gs.garage_id = g.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            ${whereClause}
            ORDER BY g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...queryParams, limitNum, offset]);

        if (params.format === 'csv') {
            return formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'approval_status', label: 'Status' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'created_at', label: 'Registered' },
                { key: 'subscription_plan', label: 'Plan' },
                { key: 'total_bids', label: 'Total Bids' },
                { key: 'total_orders', label: 'Orders' },
                { key: 'total_revenue', label: 'Revenue (QAR)' },
                { key: 'rating_average', label: 'Rating' }
            ]);
        }

        return {
            data: result.rows,
            pagination: { current_page: pageNum, total_pages: Math.ceil(total / limitNum), total, limit: limitNum }
        };
    }
}
