/**
 * Operations Dashboard Service
 * Handles dashboard statistics with caching support
 */
import { Pool } from 'pg';
import { cacheGetOrSet, CacheTTL, dashboardStatsKey, invalidateDashboardCache } from '../../utils/cache';
import { DashboardStats } from './types';

export class OperationsDashboardService {
    constructor(private pool: Pool) { }

    /**
     * Get live dashboard stats (cached: 1 minute TTL)
     */
    async getDashboardStats(): Promise<DashboardStats> {
        const stats = await cacheGetOrSet(
            dashboardStatsKey(),
            async () => {
                const result = await this.pool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM orders WHERE order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded')) as active_orders,
                        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'pending') as pending_disputes,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'contested') as contested_disputes,
                        (SELECT COUNT(*) FROM support_escalations WHERE status IN ('pending', 'acknowledged')) as pending_escalations,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'in_transit') as in_transit,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'delivered') as awaiting_confirmation,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'ready_for_pickup') as ready_for_pickup,
                        (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as revenue_today,
                        (SELECT COUNT(*) FROM part_requests WHERE status = 'active') as pending_requests,
                        (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as total_customers,
                        (SELECT COUNT(*) FROM garages) as total_garages,
                        -- LOYALTY PROGRAM TRANSPARENCY
                        (SELECT COALESCE(SUM(COALESCE(loyalty_discount, 0)), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as loyalty_discounts_today,
                        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND COALESCE(loyalty_discount, 0) > 0 AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as loyalty_discounts_count_today,
                        (SELECT COALESCE(SUM(COALESCE(loyalty_discount, 0)), 0) FROM orders WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE) AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as loyalty_discounts_week,
                        (SELECT COALESCE(SUM(COALESCE(loyalty_discount, 0)), 0) FROM orders WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')) as loyalty_discounts_month,
                        -- REFUNDS STATS
                        (SELECT COUNT(*) FROM refunds WHERE refund_status = 'pending') as pending_refunds
                `);
                return result.rows[0];
            },
            CacheTTL.SHORT // 1 minute - stats change frequently
        );

        return stats;
    }

    /**
     * Get detailed analytics for reports
     */
    async getAnalytics(): Promise<any> {
        const result = await this.pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM orders WHERE order_status = 'completed') as total_completed_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_status = 'completed') as total_gmv,
                (SELECT COALESCE(SUM(platform_fee), 0) FROM orders WHERE order_status = 'completed') as total_platform_revenue,
                (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as total_customers,
                (SELECT COUNT(*) FROM garages) as total_garages,
                -- Daily trend (last 30 days)
                (
                    SELECT json_agg(t) FROM (
                        SELECT 
                            DATE(created_at) as date,
                            COUNT(*) as order_count,
                            SUM(total_amount) as total_amount
                        FROM orders
                        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY DATE(created_at)
                        ORDER BY DATE(created_at) ASC
                    ) t
                ) as daily_trend,
                -- Monthly trend (last 12 months)
                (
                    SELECT json_agg(m) FROM (
                        SELECT 
                            to_char(created_at, 'YYYY-MM') as month,
                            COUNT(*) as order_count,
                            SUM(total_amount) as total_amount
                        FROM orders
                        WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
                        GROUP BY to_char(created_at, 'YYYY-MM')
                        ORDER BY to_char(created_at, 'YYYY-MM') ASC
                    ) m
                ) as monthly_trend,
                -- Top garages by volume
                (
                    SELECT json_agg(g) FROM (
                        SELECT 
                            ga.garage_name,
                            COUNT(o.order_id) as order_count,
                            SUM(o.total_amount) as total_volume
                        FROM orders o
                        JOIN garages ga ON o.garage_id = ga.garage_id
                        WHERE o.order_status = 'completed'
                        GROUP BY ga.garage_name
                        ORDER BY order_count DESC
                        LIMIT 10
                    ) g
                ) as top_garages
        `);
        return result.rows[0];
    }

    /**
     * Invalidate dashboard cache (call after status updates)
     */
    async invalidateCache(): Promise<void> {
        await invalidateDashboardCache();
    }
}
