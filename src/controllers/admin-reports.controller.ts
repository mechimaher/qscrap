import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// ============================================================================
// ADMIN REPORTS CONTROLLER
// Premium Reports Module - Comprehensive Business Analytics
// ============================================================================

/**
 * Helper: Get date range from period parameter
 */
const getPeriodDates = (period: string): { start: Date; end: Date } => {
    const end = new Date();
    let start = new Date();

    switch (period) {
        case '7d':
            start.setDate(start.getDate() - 7);
            break;
        case '30d':
            start.setDate(start.getDate() - 30);
            break;
        case '90d':
            start.setDate(start.getDate() - 90);
            break;
        case '1y':
            start.setFullYear(start.getFullYear() - 1);
            break;
        case 'all':
        default:
            start = new Date('2020-01-01');
    }

    return { start, end };
};

/**
 * Helper: Format CSV from data array
 */
const formatCSV = (data: any[], columns: { key: string; label: string }[]): string => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const val = row[c.key];
            if (val === null || val === undefined) return '';
            // Escape quotes and wrap in quotes if contains comma
            const str = String(val).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') ? `"${str}"` : str;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

// ============================================================================
// GARAGE LIFECYCLE REPORTS
// ============================================================================

/**
 * Report: Active Demo Garages
 * Lists all garages currently in demo period with key metrics
 */
export const getDemoGaragesReport = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, format = 'json', sort = 'demo_expires_at' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    try {
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'demo' AND g.demo_expires_at > NOW()
        `);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                u.phone_number,
                u.email,
                g.demo_expires_at,
                EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int as days_left,
                g.created_at as registered_at,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) as total_bids,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) as total_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue,
                u.last_login_at
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            WHERE g.approval_status = 'demo' AND g.demo_expires_at > NOW()
            ORDER BY ${sort === 'days_left' ? 'g.demo_expires_at ASC' :
                sort === 'bids' ? 'total_bids DESC' :
                    sort === 'revenue' ? 'total_revenue DESC' : 'g.demo_expires_at ASC'}
            LIMIT $1 OFFSET $2
        `, [limitNum, offset]);

        // Handle CSV export
        if (format === 'csv') {
            const csv = formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'days_left', label: 'Days Left' },
                { key: 'total_bids', label: 'Total Bids' },
                { key: 'total_orders', label: 'Orders' },
                { key: 'total_revenue', label: 'Revenue (QAR)' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=demo_garages_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'demo_garages',
            generated_at: new Date().toISOString(),
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            },
            summary: {
                total_demo_garages: total,
                expiring_soon: result.rows.filter(r => r.days_left <= 7).length
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getDemoGaragesReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: Expired Demo Garages
 * Lists garages whose demo has expired for follow-up
 */
export const getExpiredDemosReport = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, format = 'json', period = '30d' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;
    const { start } = getPeriodDates(period as string);

    try {
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'expired' 
            OR (g.approval_status = 'demo' AND g.demo_expires_at <= NOW() AND g.demo_expires_at >= $1)
        `, [start]);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                u.phone_number,
                u.email,
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

        if (format === 'csv') {
            const csv = formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'expired_at', label: 'Expired Date' },
                { key: 'days_since_expired', label: 'Days Since Expired' },
                { key: 'total_bids', label: 'Total Bids' },
                { key: 'total_orders', label: 'Orders' },
                { key: 'activity_level', label: 'Activity Level' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=expired_demos_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'expired_demos',
            generated_at: new Date().toISOString(),
            period: period,
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            },
            summary: {
                total_expired: total,
                with_activity: result.rows.filter(r => r.activity_level !== 'no_activity').length,
                potential_conversions: result.rows.filter(r => r.total_orders > 0).length
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getExpiredDemosReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: Demo to Subscription Conversions
 * Tracks successful demo-to-paid conversions with timing analysis
 */
export const getDemoConversionsReport = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, format = 'json', period = '90d' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;
    const { start } = getPeriodDates(period as string);

    try {
        // Garages that moved from demo to approved/subscribed
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM garages g 
            WHERE g.approval_status = 'approved' 
            AND g.approval_date >= $1
            AND EXISTS (SELECT 1 FROM garage_subscriptions gs WHERE gs.garage_id = g.garage_id)
        `, [start]);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                u.phone_number,
                g.created_at as registered_at,
                g.approval_date as converted_at,
                EXTRACT(DAYS FROM (g.approval_date - g.created_at))::int as days_to_convert,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id AND b.created_at <= g.approval_date) as bids_before_convert,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id AND o.created_at <= g.approval_date) as orders_before_convert,
                sp.plan_name,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as lifetime_revenue
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

        // Calculate conversion metrics
        const demoCount = await pool.query(`
            SELECT COUNT(*) FROM garages WHERE created_at >= $1
        `, [start]);

        if (format === 'csv') {
            const csv = formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'registered_at', label: 'Registered' },
                { key: 'converted_at', label: 'Converted Date' },
                { key: 'days_to_convert', label: 'Days to Convert' },
                { key: 'plan_name', label: 'Plan' },
                { key: 'lifetime_revenue', label: 'Lifetime Revenue' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=demo_conversions_report.csv');
            return res.send(csv);
        }

        const totalNewGarages = parseInt(demoCount.rows[0].count);
        const conversionRate = totalNewGarages > 0 ? ((total / totalNewGarages) * 100).toFixed(1) : '0';

        res.json({
            report_type: 'demo_conversions',
            generated_at: new Date().toISOString(),
            period: period,
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            },
            summary: {
                total_conversions: total,
                total_new_garages: totalNewGarages,
                conversion_rate: `${conversionRate}%`,
                avg_days_to_convert: result.rows.length > 0
                    ? Math.round(result.rows.reduce((sum, r) => sum + (r.days_to_convert || 0), 0) / result.rows.length)
                    : 0
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getDemoConversionsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// ============================================================================
// SUBSCRIPTION & REVENUE REPORTS
// ============================================================================

/**
 * Report: Subscription Renewals Due
 * Lists subscriptions expiring soon for proactive retention
 */
export const getSubscriptionRenewalsReport = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, format = 'json', days_ahead = 30 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;
    const daysAhead = Math.min(90, Math.max(7, Number(days_ahead)));

    try {
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM garage_subscriptions gs 
            WHERE gs.status = 'active' 
            AND gs.billing_cycle_end <= NOW() + INTERVAL '${daysAhead} days'
            AND gs.billing_cycle_end > NOW()
        `);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                u.phone_number,
                u.email,
                sp.plan_name,
                gs.billing_cycle_end as expires_at,
                EXTRACT(DAYS FROM (gs.billing_cycle_end - NOW()))::int as days_until_expiry,
                gs.created_at as subscription_start,
                EXTRACT(MONTHS FROM AGE(NOW(), gs.created_at))::int as months_subscribed,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue
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

        if (format === 'csv') {
            const csv = formatCSV(result.rows, [
                { key: 'garage_name', label: 'Garage Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'plan_name', label: 'Plan' },
                { key: 'days_until_expiry', label: 'Days Until Expiry' },
                { key: 'months_subscribed', label: 'Months Subscribed' },
                { key: 'total_orders', label: 'Total Orders' },
                { key: 'total_revenue', label: 'Revenue (QAR)' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=subscription_renewals_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'subscription_renewals',
            generated_at: new Date().toISOString(),
            days_ahead: daysAhead,
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            },
            summary: {
                total_expiring: total,
                expiring_7_days: result.rows.filter(r => r.days_until_expiry <= 7).length,
                high_value_at_risk: result.rows.filter(r => parseFloat(r.total_revenue) > 10000).length
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getSubscriptionRenewalsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: Commission Revenue
 * Platform earnings from completed orders
 */
export const getCommissionRevenueReport = async (req: AuthRequest, res: Response) => {
    const { period = '30d', format = 'json', group_by = 'day' } = req.query;
    const { start, end } = getPeriodDates(period as string);

    try {
        // Overall summary
        const summary = await pool.query(`
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

        // Breakdown by time period
        const groupFormat = group_by === 'month' ? 'YYYY-MM' : group_by === 'week' ? 'YYYY-WW' : 'YYYY-MM-DD';
        const breakdown = await pool.query(`
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

        // Top earning garages
        const topGarages = await pool.query(`
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

        if (format === 'csv') {
            const csv = formatCSV(breakdown.rows, [
                { key: 'period', label: 'Period' },
                { key: 'order_count', label: 'Orders' },
                { key: 'gross_revenue', label: 'Gross Revenue (QAR)' },
                { key: 'commission_revenue', label: 'Commission (QAR)' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=commission_revenue_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'commission_revenue',
            generated_at: new Date().toISOString(),
            period: period,
            summary: {
                total_orders: parseInt(summary.rows[0].total_orders),
                gross_revenue: parseFloat(summary.rows[0].gross_revenue),
                commission_revenue: parseFloat(summary.rows[0].commission_revenue),
                avg_commission_per_order: parseFloat(summary.rows[0].avg_commission_per_order).toFixed(2),
                avg_commission_rate: parseFloat(summary.rows[0].avg_commission_rate).toFixed(1) + '%'
            },
            breakdown: breakdown.rows,
            top_garages: topGarages.rows
        });
    } catch (err: any) {
        console.error('[REPORTS] getCommissionRevenueReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: All Garages Summary
 * Comprehensive garage listing with all statuses
 */
export const getAllGaragesReport = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, format = 'json', status = 'all' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            params.push(status);
        }

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM garages g ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT 
                g.garage_id,
                g.garage_name,
                g.approval_status,
                u.phone_number,
                u.email,
                g.created_at,
                g.approval_date,
                g.demo_expires_at,
                CASE 
                    WHEN g.approval_status = 'demo' AND g.demo_expires_at > NOW() 
                        THEN EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int
                    ELSE NULL 
                END as demo_days_left,
                (SELECT COUNT(*) FROM bids b WHERE b.garage_id = g.garage_id) as total_bids,
                (SELECT COUNT(*) FROM orders o WHERE o.garage_id = g.garage_id) as total_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.garage_id = g.garage_id AND o.order_status = 'completed') as total_revenue,
                g.rating_average,
                sp.plan_name as subscription_plan
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON gs.garage_id = g.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            ${whereClause}
            ORDER BY g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limitNum, offset]);

        if (format === 'csv') {
            const csv = formatCSV(result.rows, [
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
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=all_garages_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'all_garages',
            generated_at: new Date().toISOString(),
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getAllGaragesReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: New Registrations
 * User registration activity over time
 */
export const getRegistrationsReport = async (req: AuthRequest, res: Response) => {
    const { period = '30d', format = 'json', user_type = 'all' } = req.query;
    const { start, end } = getPeriodDates(period as string);

    try {
        let typeFilter = '';
        if (user_type !== 'all') {
            typeFilter = ` AND user_type = '${user_type}'`;
        }

        // Summary by user type
        const summary = await pool.query(`
            SELECT 
                user_type,
                COUNT(*) as count
            FROM users
            WHERE created_at >= $1 AND created_at <= $2 ${typeFilter}
            GROUP BY user_type
            ORDER BY count DESC
        `, [start, end]);

        // Daily breakdown
        const daily = await pool.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                user_type,
                COUNT(*) as count
            FROM users
            WHERE created_at >= $1 AND created_at <= $2 ${typeFilter}
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), user_type
            ORDER BY date DESC
        `, [start, end]);

        if (format === 'csv') {
            const csv = formatCSV(daily.rows, [
                { key: 'date', label: 'Date' },
                { key: 'user_type', label: 'User Type' },
                { key: 'count', label: 'Registrations' }
            ]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=registrations_report.csv');
            return res.send(csv);
        }

        res.json({
            report_type: 'registrations',
            generated_at: new Date().toISOString(),
            period: period,
            summary: summary.rows,
            daily_breakdown: daily.rows,
            totals: {
                total_registrations: summary.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
            }
        });
    } catch (err: any) {
        console.error('[REPORTS] getRegistrationsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

/**
 * Report: Available Report Types
 * Returns list of all available reports for UI dropdown
 */
export const getAvailableReports = async (req: AuthRequest, res: Response) => {
    res.json({
        reports: [
            { id: 'demo_garages', name: 'Demo Garages', description: 'Active demo trials', category: 'Garage Lifecycle' },
            { id: 'expired_demos', name: 'Expired Demos', description: 'Expired demo trials for follow-up', category: 'Garage Lifecycle' },
            { id: 'demo_conversions', name: 'Demo Conversions', description: 'Demo to subscription conversions', category: 'Garage Lifecycle' },
            { id: 'subscription_renewals', name: 'Subscription Renewals', description: 'Upcoming subscription renewals', category: 'Subscriptions' },
            { id: 'commission_revenue', name: 'Commission Revenue', description: 'Platform commission earnings', category: 'Revenue' },
            { id: 'all_garages', name: 'All Garages', description: 'Complete garage listing', category: 'Garages' },
            { id: 'registrations', name: 'New Registrations', description: 'User registration trends', category: 'Users' }
        ]
    });
};
