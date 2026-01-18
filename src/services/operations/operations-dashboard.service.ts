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
                        (SELECT COUNT(*) FROM orders WHERE order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded')) as active_orders,
                        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'pending') as pending_disputes,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'contested') as contested_disputes,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'in_transit') as in_transit,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'delivered') as awaiting_confirmation,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'ready_for_pickup') as ready_for_pickup,
                        (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage')) as revenue_today,
                        (SELECT COUNT(*) FROM part_requests WHERE status = 'active') as pending_requests,
                        (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as total_customers,
                        (SELECT COUNT(*) FROM garages) as total_garages
                `);
                return result.rows[0];
            },
            CacheTTL.SHORT // 1 minute - stats change frequently
        );

        return stats;
    }

    /**
     * Invalidate dashboard cache (call after status updates)
     */
    async invalidateCache(): Promise<void> {
        await invalidateDashboardCache();
    }
}
