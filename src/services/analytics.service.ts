import pool from '../config/db';

interface DailyAnalytics {
    date: string;
    orders_count: number;
    revenue: string;
    unique_customers: number;
    avg_rating: string;
    completed_orders: number;
    cancelled_orders: number;
}

interface PopularPart {
    part_name: string;
    car_make: string;
    car_model: string;
    category: string;
    order_count: number;
    total_revenue: string;
    avg_price: string;
    last_ordered: string;
}

interface BidAnalytics {
    month: string;
    total_bids: number;
    won_bids: number;
    lost_bids: number;
    win_rate_percentage: string;
    avg_bid_amount: string;
    avg_response_time_minutes: string;
}

interface AnalyticsSummary {
    total_orders: number;
    total_revenue: string;
    total_bids: number;
    win_rate: string;
    avg_rating: string;
    unique_customers: number;
}

interface PerformanceMetrics {
    period: string;
    summary: AnalyticsSummary;
    top_parts: PopularPart[];
    sales_trend: DailyAnalytics[];
    bid_performance: BidAnalytics[];
}

export class AnalyticsService {
    /**
     * Get comprehensive analytics overview for a garage
     */
    static async getGarageOverview(
        garageId: string,
        period: 'today' | 'week' | 'month' | 'year' = 'month'
    ): Promise<PerformanceMetrics> {
        try {
            // Get summary statistics using direct SQL (avoids stored function dependency)
            const daysBack = this.getPeriodDays(period);
            const summaryResult = await pool.query(`
                SELECT 
                    COALESCE((SELECT COUNT(*) FROM orders WHERE garage_id = $1 AND created_at >= NOW() - INTERVAL '${daysBack} days'), 0)::integer as total_orders,
                    COALESCE((SELECT SUM(garage_payout_amount) FROM orders WHERE garage_id = $1 AND order_status = 'completed' AND created_at >= NOW() - INTERVAL '${daysBack} days'), 0) as total_revenue,
                    COALESCE((SELECT COUNT(*) FROM bids WHERE garage_id = $1 AND created_at >= NOW() - INTERVAL '${daysBack} days'), 0)::integer as total_bids,
                    COALESCE((SELECT ROUND(COUNT(*) FILTER (WHERE status = 'accepted')::numeric * 100 / NULLIF(COUNT(*), 0), 1) FROM bids WHERE garage_id = $1 AND created_at >= NOW() - INTERVAL '${daysBack} days'), 0) as win_rate,
                    COALESCE((SELECT ROUND(AVG(overall_rating)::numeric, 1) FROM order_reviews WHERE garage_id = $1), 0) as avg_rating,
                    COALESCE((SELECT COUNT(DISTINCT customer_id) FROM orders WHERE garage_id = $1 AND created_at >= NOW() - INTERVAL '${daysBack} days'), 0)::integer as unique_customers
            `, [garageId]);

            const summary: AnalyticsSummary = summaryResult.rows[0] || {
                total_orders: 0,
                total_revenue: '0',
                total_bids: 0,
                win_rate: '0',
                avg_rating: '0',
                unique_customers: 0
            };

            // Get top parts - fallback to empty if view doesn't exist
            let topParts: any[] = [];
            try {
                const topPartsResult = await pool.query(
                    `SELECT * FROM garage_popular_parts 
                     WHERE garage_id = $1 
                     ORDER BY order_count DESC, total_revenue DESC 
                     LIMIT 10`,
                    [garageId]
                );
                topParts = topPartsResult.rows;
            } catch (e) {
                console.log('[ANALYTICS] garage_popular_parts view not available, using fallback');
            }

            // Get sales trend - fallback to empty if view doesn't exist
            let salesTrend: any[] = [];
            try {
                const trendResult = await pool.query(
                    `SELECT 
                        o.created_at::date as date,
                        COUNT(*)::integer as orders_count,
                        COALESCE(SUM(o.garage_payout_amount), 0) as revenue,
                        COUNT(DISTINCT o.customer_id)::integer as unique_customers,
                        0 as completed_orders,
                        0 as cancelled_orders
                     FROM orders o
                     WHERE o.garage_id = $1 
                       AND o.created_at >= CURRENT_DATE - INTERVAL '${daysBack} days'
                     GROUP BY o.created_at::date
                     ORDER BY date ASC`,
                    [garageId]
                );
                salesTrend = trendResult.rows;
            } catch (e) {
                console.log('[ANALYTICS] sales trend query failed, using fallback');
            }

            // Get bid performance - fallback to empty if view doesn't exist
            let bidPerformance: any[] = [];
            try {
                const bidResult = await pool.query(
                    `SELECT 
                        DATE_TRUNC('month', created_at) as month,
                        COUNT(*)::integer as total_bids,
                        COUNT(*) FILTER (WHERE status = 'accepted')::integer as won_bids,
                        COUNT(*) FILTER (WHERE status = 'rejected')::integer as lost_bids
                     FROM bids 
                     WHERE garage_id = $1
                     GROUP BY DATE_TRUNC('month', created_at)
                     ORDER BY month DESC
                     LIMIT 12`,
                    [garageId]
                );
                bidPerformance = bidResult.rows;
            } catch (e) {
                console.log('[ANALYTICS] bid performance query failed, using fallback');
            }

            return {
                period,
                summary,
                top_parts: topParts,
                sales_trend: salesTrend,
                bid_performance: bidPerformance
            };
        } catch (error) {
            console.error('Error fetching garage analytics:', error);
            throw new Error('Failed to fetch garage analytics');
        }
    }

    /**
     * Get sales trend data for charts
     */
    static async getSalesTrend(
        garageId: string,
        startDate?: string,
        endDate?: string
    ): Promise<DailyAnalytics[]> {
        try {
            const query = `
                SELECT 
                    TO_CHAR(date, 'YYYY-MM-DD') as date,
                    orders_count,
                    ROUND(revenue::numeric, 2)::text as revenue,
                    unique_customers,
                    ROUND(COALESCE(avg_rating, 0)::numeric, 2)::text as avg_rating,
                    completed_orders,
                    cancelled_orders
                FROM garage_daily_analytics
                WHERE garage_id = $1
                    ${startDate ? 'AND date >= $2::date' : ''}
                    ${endDate ? `AND date <= $${startDate ? '3' : '2'}::date` : ''}
                ORDER BY date ASC
            `;

            const params = [garageId];
            if (startDate) params.push(startDate);
            if (endDate) params.push(endDate);

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error fetching sales trend:', error);
            throw new Error('Failed to fetch sales trend');
        }
    }

    /**
     * Get popular parts analysis
     */
    static async getPopularParts(
        garageId: string,
        limit: number = 20
    ): Promise<PopularPart[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    part_name,
                    car_make,
                    car_model,
                    category,
                    order_count,
                    ROUND(total_revenue::numeric, 2)::text as total_revenue,
                    ROUND(avg_price::numeric, 2)::text as avg_price,
                    TO_CHAR(last_ordered, 'YYYY-MM-DD') as last_ordered
                 FROM garage_popular_parts
                 WHERE garage_id = $1
                 ORDER BY order_count DESC, total_revenue DESC
                 LIMIT $2`,
                [garageId, limit]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching popular parts:', error);
            throw new Error('Failed to fetch popular parts');
        }
    }

    /**
     * Get bid performance metrics
     */
    static async getBidPerformance(garageId: string): Promise<BidAnalytics[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    TO_CHAR(month, 'YYYY-MM') as month,
                    total_bids,
                    won_bids,
                    lost_bids,
                    win_rate_percentage,
                    ROUND(avg_bid_amount::numeric, 2)::text as avg_bid_amount,
                    ROUND(avg_response_time_minutes::numeric, 2)::text as avg_response_time_minutes
                 FROM garage_bid_analytics
                 WHERE garage_id = $1
                 ORDER BY month DESC
                 LIMIT 12`,
                [garageId]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching bid performance:', error);
            throw new Error('Failed to fetch bid performance');
        }
    }

    /**
     * Get real-time summary for specific period
     */
    static async getSummary(
        garageId: string,
        period: 'today' | 'week' | 'month' | 'year' = 'month'
    ): Promise<AnalyticsSummary> {
        try {
            const result = await pool.query(
                'SELECT * FROM calculate_garage_summary($1, $2)',
                [garageId, period]
            );

            return result.rows[0] || {
                total_orders: 0,
                total_revenue: '0',
                total_bids: 0,
                win_rate: '0',
                avg_rating: '0',
                unique_customers: 0
            };
        } catch (error) {
            console.error('Error fetching summary:', error);
            throw new Error('Failed to fetch summary');
        }
    }

    /**
     * Refresh materialized views (should be called periodically)
     */
    static async refreshAnalytics(): Promise<void> {
        try {
            await pool.query('SELECT refresh_garage_analytics()');
            console.log('Analytics refreshed successfully');
        } catch (error) {
            console.error('Error refreshing analytics:', error);
            throw new Error('Failed to refresh analytics');
        }
    }

    /**
     * Get comparison data (current vs previous period)
     */
    static async getComparison(
        garageId: string,
        period: 'today' | 'week' | 'month' | 'year' = 'month'
    ): Promise<{
        current: AnalyticsSummary;
        previous: AnalyticsSummary;
        changes: {
            orders: number;
            revenue: number;
            rating: number;
        };
    }> {
        try {
            const current = await this.getSummary(garageId, period);

            // Get previous period data
            const daysBack = this.getPeriodDays(period);
            const previousResult = await pool.query(
                `SELECT 
                    COUNT(DISTINCT o.order_id)::INTEGER as total_orders,
                    COALESCE(SUM(o.total_amount), 0) as total_revenue,
                    COALESCE(AVG(o.customer_rating), 0) as avg_rating
                 FROM orders o
                 WHERE o.garage_id = $1
                   AND o.created_at >= CURRENT_DATE - INTERVAL '${daysBack * 2} days'
                   AND o.created_at < CURRENT_DATE - INTERVAL '${daysBack} days'
                   AND o.status IN ('completed', 'delivered')`,
                [garageId]
            );

            const previous = {
                ...current,
                ...previousResult.rows[0]
            };

            // Calculate percentage changes
            const changes = {
                orders: this.calculateChange(
                    current.total_orders,
                    previous.total_orders
                ),
                revenue: this.calculateChange(
                    parseFloat(current.total_revenue),
                    parseFloat(previous.total_revenue)
                ),
                rating: this.calculateChange(
                    parseFloat(current.avg_rating),
                    parseFloat(previous.avg_rating)
                )
            };

            return { current, previous, changes };
        } catch (error) {
            console.error('Error fetching comparison:', error);
            throw new Error('Failed to fetch comparison data');
        }
    }

    // Helper methods
    private static getPeriodDays(period: string): number {
        switch (period) {
            case 'today': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'year': return 365;
            default: return 30;
        }
    }

    private static calculateChange(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }
}
