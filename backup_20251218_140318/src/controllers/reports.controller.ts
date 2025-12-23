import { Request, Response } from 'express';
import pool from '../config/db';

interface AuthRequest extends Request {
    user?: { userId: string; userType: string };
}

// Orders Report - Comprehensive order data for a date range
export const getOrdersReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to, status } = req.query;

        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        let statusFilter = '';
        if (status && status !== 'all') {
            statusFilter = `AND o.order_status = '${status}'`;
        }

        // Get orders with full details
        const ordersResult = await pool.query(
            `SELECT o.order_id, o.order_number, o.order_status, o.payment_status,
                    o.part_price, o.platform_fee, o.delivery_fee, o.total_amount, o.garage_payout_amount,
                    o.created_at, o.completed_at,
                    cu.full_name as customer_name, cu.phone_number as customer_phone,
                    g.garage_name,
                    pr.part_description, pr.car_make, pr.car_model, pr.car_year
             FROM orders o
             JOIN users cu ON o.customer_id = cu.user_id
             JOIN garages g ON o.garage_id = g.garage_id
             LEFT JOIN part_requests pr ON o.request_id = pr.request_id
             WHERE o.created_at >= $1 AND o.created_at <= $2::date + interval '1 day'
             ${statusFilter}
             ORDER BY o.created_at DESC`,
            [fromDate, toDate]
        );

        // Get summary statistics
        const summaryResult = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE order_status = 'completed') as completed_orders,
                COUNT(*) FILTER (WHERE order_status IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as cancelled_orders,
                COUNT(*) FILTER (WHERE order_status = 'disputed') as disputed_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(platform_fee), 0) as total_platform_fees,
                COALESCE(SUM(garage_payout_amount), 0) as total_garage_payouts,
                COALESCE(AVG(total_amount), 0) as average_order_value
             FROM orders
             WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'
             ${statusFilter}`,
            [fromDate, toDate]
        );

        res.json({
            report_type: 'orders',
            period: { from: fromDate, to: toDate },
            generated_at: new Date().toISOString(),
            generated_by: req.user?.userId,
            summary: summaryResult.rows[0],
            data: ordersResult.rows,
            total_records: ordersResult.rows.length
        });
    } catch (err: any) {
        console.error('Orders report error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Revenue Report - Financial summary
export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;

        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        // Daily breakdown
        const dailyResult = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as order_count,
                SUM(total_amount) as revenue,
                SUM(platform_fee) as platform_fees,
                SUM(garage_payout_amount) as garage_payouts,
                SUM(delivery_fee) as delivery_fees
             FROM orders
             WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'
               AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at)`,
            [fromDate, toDate]
        );

        // Top performing garages
        const topGaragesResult = await pool.query(
            `SELECT g.garage_name, g.garage_id,
                    COUNT(o.order_id) as order_count,
                    SUM(o.garage_payout_amount) as total_earnings,
                    AVG(g.rating_average) as rating
             FROM orders o
             JOIN garages g ON o.garage_id = g.garage_id
             WHERE o.created_at >= $1 AND o.created_at <= $2::date + interval '1 day'
               AND o.order_status = 'completed'
             GROUP BY g.garage_id, g.garage_name
             ORDER BY total_earnings DESC
             LIMIT 10`,
            [fromDate, toDate]
        );

        // Summary
        const summaryResult = await pool.query(
            `SELECT 
                COALESCE(SUM(total_amount), 0) as gross_revenue,
                COALESCE(SUM(platform_fee), 0) as platform_revenue,
                COALESCE(SUM(garage_payout_amount), 0) as garage_payouts,
                COALESCE(SUM(delivery_fee), 0) as delivery_revenue,
                COUNT(*) as total_transactions
             FROM orders
             WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'
               AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')`,
            [fromDate, toDate]
        );

        res.json({
            report_type: 'revenue',
            period: { from: fromDate, to: toDate },
            generated_at: new Date().toISOString(),
            summary: summaryResult.rows[0],
            daily_breakdown: dailyResult.rows,
            top_garages: topGaragesResult.rows
        });
    } catch (err: any) {
        console.error('Revenue report error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Disputes Report
export const getDisputesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;

        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        const disputesResult = await pool.query(
            `SELECT d.dispute_id, d.reason, d.description, d.resolution,
                    d.refund_amount, d.status, d.created_at, d.resolved_at,
                    o.order_number, o.total_amount,
                    cu.full_name as customer_name,
                    g.garage_name
             FROM disputes d
             JOIN orders o ON d.order_id = o.order_id
             JOIN users cu ON d.customer_id = cu.user_id
             JOIN garages g ON d.garage_id = g.garage_id
             WHERE d.created_at >= $1 AND d.created_at <= $2::date + interval '1 day'
             ORDER BY d.created_at DESC`,
            [fromDate, toDate]
        );

        const summaryResult = await pool.query(
            `SELECT 
                COUNT(*) as total_disputes,
                COUNT(*) FILTER (WHERE status = 'resolved' OR status = 'accepted') as resolved,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COALESCE(SUM(refund_amount) FILTER (WHERE status IN ('resolved', 'accepted')), 0) as total_refunded,
                COUNT(*) FILTER (WHERE resolution = 'refund_approved') as full_refunds,
                COUNT(*) FILTER (WHERE resolution = 'partial_refund') as partial_refunds
             FROM disputes
             WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'`,
            [fromDate, toDate]
        );

        res.json({
            report_type: 'disputes',
            period: { from: fromDate, to: toDate },
            generated_at: new Date().toISOString(),
            summary: summaryResult.rows[0],
            data: disputesResult.rows,
            total_records: disputesResult.rows.length
        });
    } catch (err: any) {
        console.error('Disputes report error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Deliveries Report
export const getDeliveriesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;

        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        // Driver performance
        const driversResult = await pool.query(
            `SELECT u.full_name as driver_name, u.user_id as driver_id,
                    COUNT(o.order_id) as total_deliveries,
                    COUNT(*) FILTER (WHERE o.order_status = 'completed') as completed,
                    AVG(EXTRACT(EPOCH FROM (o.actual_delivery_at - o.created_at))/3600) as avg_hours_to_deliver
             FROM orders o
             JOIN users u ON o.driver_id = u.user_id
             WHERE o.driver_id IS NOT NULL
               AND o.created_at >= $1 AND o.created_at <= $2::date + interval '1 day'
             GROUP BY u.user_id, u.full_name
             ORDER BY total_deliveries DESC`,
            [fromDate, toDate]
        );

        // Delivery summary
        const summaryResult = await pool.query(
            `SELECT 
                COUNT(*) FILTER (WHERE driver_id IS NOT NULL) as total_deliveries,
                COUNT(*) FILTER (WHERE order_status = 'delivered' OR order_status = 'completed') as successful_deliveries,
                COUNT(*) FILTER (WHERE order_status = 'in_transit') as in_transit,
                AVG(EXTRACT(EPOCH FROM (actual_delivery_at - created_at))/3600) as avg_delivery_hours
             FROM orders
             WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'`,
            [fromDate, toDate]
        );

        res.json({
            report_type: 'deliveries',
            period: { from: fromDate, to: toDate },
            generated_at: new Date().toISOString(),
            summary: summaryResult.rows[0],
            drivers: driversResult.rows,
            total_drivers: driversResult.rows.length
        });
    } catch (err: any) {
        console.error('Deliveries report error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Garages Performance Report
export const getGaragesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;

        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        const garagesResult = await pool.query(
            `SELECT g.garage_id, g.garage_name, g.rating_average, g.rating_count, g.total_transactions,
                    COUNT(o.order_id) as period_orders,
                    SUM(o.garage_payout_amount) as period_earnings,
                    COUNT(*) FILTER (WHERE o.order_status = 'completed') as completed_orders,
                    COUNT(*) FILTER (WHERE o.order_status IN ('cancelled_by_garage')) as cancelled_orders,
                    ROUND(COUNT(*) FILTER (WHERE o.order_status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate
             FROM garages g
             LEFT JOIN orders o ON g.garage_id = o.garage_id 
                AND o.created_at >= $1 AND o.created_at <= $2::date + interval '1 day'
             GROUP BY g.garage_id, g.garage_name, g.rating_average, g.rating_count, g.total_transactions
             ORDER BY period_earnings DESC NULLS LAST`,
            [fromDate, toDate]
        );

        res.json({
            report_type: 'garages',
            period: { from: fromDate, to: toDate },
            generated_at: new Date().toISOString(),
            data: garagesResult.rows,
            total_garages: garagesResult.rows.length
        });
    } catch (err: any) {
        console.error('Garages report error:', err);
        res.status(500).json({ error: err.message });
    }
};
