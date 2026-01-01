import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';

// Helper: Get garage's plan features
async function getGaragePlanFeatures(garageId: string): Promise<{
    plan_code: string;
    features: Record<string, unknown>;
    analytics_level: string;
}> {
    const result = await pool.query(
        `SELECT COALESCE(sp.plan_code, 'starter') as plan_code,
                COALESCE(sp.features, '{}') as features
         FROM garages g
         LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
         LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
         WHERE g.garage_id = $1`,
        [garageId]
    );

    if (result.rows.length === 0) {
        return { plan_code: 'starter', features: {}, analytics_level: 'basic' };
    }

    const { plan_code, features } = result.rows[0];
    const analyticsLevel = features?.analytics || 'basic';

    return { plan_code, features, analytics_level: analyticsLevel };
}

// Check if garage has access to analytics
function hasAnalyticsAccess(analyticsLevel: string): boolean {
    return ['advanced', 'premium'].includes(analyticsLevel);
}

// GET /api/garage/analytics - Main analytics dashboard
export const getGarageAnalytics = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        // Check plan access
        const planInfo = await getGaragePlanFeatures(garageId);

        if (!hasAnalyticsAccess(planInfo.analytics_level)) {
            return res.status(403).json({
                error: 'Analytics requires Professional or Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['professional', 'enterprise'],
                upgrade_available: true
            });
        }

        const period = req.query.period as string || '30';
        const days = parseInt(period) || 30;

        // Get all analytics data in parallel
        const [
            revenueData,
            bidStats,
            orderStats,
            categoryStats,
            ratingTrend
        ] = await Promise.all([
            // Revenue by day
            pool.query(
                `SELECT DATE(o.completed_at) as date,
                        COUNT(*) as orders,
                        SUM(o.garage_payout_amount) as revenue
                 FROM orders o
                 WHERE o.garage_id = $1 
                   AND o.order_status = 'completed'
                   AND o.completed_at >= CURRENT_DATE - INTERVAL '${days} days'
                 GROUP BY DATE(o.completed_at)
                 ORDER BY date ASC`,
                [garageId]
            ),
            // Bid performance
            pool.query(
                `SELECT 
                    COUNT(*) as total_bids,
                    COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    ROUND(AVG(CASE WHEN status = 'accepted' THEN bid_amount END)::numeric, 2) as avg_winning_bid
                 FROM bids
                 WHERE garage_id = $1
                   AND created_at >= CURRENT_DATE - INTERVAL '${days} days'`,
                [garageId]
            ),
            // Order stats
            pool.query(
                `SELECT 
                    COUNT(*) as total_orders,
                    SUM(garage_payout_amount) as total_revenue,
                    ROUND(AVG(garage_payout_amount)::numeric, 2) as avg_order_value,
                    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::numeric, 1) as avg_response_hours
                 FROM orders
                 WHERE garage_id = $1 
                   AND order_status = 'completed'
                   AND completed_at >= CURRENT_DATE - INTERVAL '${days} days'`,
                [garageId]
            ),
            // Top categories (from bid data)
            pool.query(
                `SELECT pr.part_description as part_name, 
                        COUNT(b.bid_id) as bid_count,
                        COUNT(*) FILTER (WHERE b.status = 'accepted') as wins
                 FROM bids b
                 JOIN part_requests pr ON b.request_id = pr.request_id
                 WHERE b.garage_id = $1
                   AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
                 GROUP BY pr.part_description
                 ORDER BY bid_count DESC
                 LIMIT 5`,
                [garageId]
            ),
            // Rating trend
            pool.query(
                `SELECT DATE(r.created_at) as date,
                        ROUND(AVG(r.overall_rating)::numeric, 1) as avg_rating,
                        COUNT(*) as review_count
                 FROM order_reviews r
                 JOIN orders o ON r.order_id = o.order_id
                 WHERE o.garage_id = $1
                   AND r.created_at >= CURRENT_DATE - INTERVAL '${days} days'
                 GROUP BY DATE(r.created_at)
                 ORDER BY date ASC`,
                [garageId]
            )
        ]);

        // Calculate acceptance rate
        const bidStatsRow = bidStats.rows[0] || {};
        const totalBids = parseInt(bidStatsRow.total_bids) || 0;
        const acceptedBids = parseInt(bidStatsRow.accepted) || 0;
        const acceptanceRate = totalBids > 0 ? ((acceptedBids / totalBids) * 100).toFixed(1) : 0;

        res.json({
            plan: planInfo.plan_code,
            analytics_level: planInfo.analytics_level,
            period_days: days,
            summary: {
                total_revenue: parseFloat(orderStats.rows[0]?.total_revenue) || 0,
                total_orders: parseInt(orderStats.rows[0]?.total_orders) || 0,
                avg_order_value: parseFloat(orderStats.rows[0]?.avg_order_value) || 0,
                avg_response_hours: parseFloat(orderStats.rows[0]?.avg_response_hours) || 0,
                total_bids: totalBids,
                acceptance_rate: parseFloat(acceptanceRate as string),
                avg_winning_bid: parseFloat(bidStatsRow.avg_winning_bid) || 0
            },
            charts: {
                revenue_trend: revenueData.rows,
                rating_trend: ratingTrend.rows
            },
            top_categories: categoryStats.rows,

            // Premium features (Enterprise only)
            ...(planInfo.analytics_level === 'premium' && {
                premium_insights: {
                    can_export: true,
                    customer_insights_available: true
                }
            })
        });

    } catch (err) {
        console.error('getGarageAnalytics error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// GET /api/garage/analytics/export - Export analytics (Enterprise only)
export const exportAnalytics = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        if (planInfo.analytics_level !== 'premium') {
            return res.status(403).json({
                error: 'Export requires Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['enterprise']
            });
        }

        const period = req.query.period as string || '90';
        const days = parseInt(period) || 90;

        // Get detailed export data
        const result = await pool.query(
            `SELECT o.order_id, o.created_at, o.completed_at, o.order_status,
                    b.bid_amount, o.platform_fee, o.garage_payout_amount,
                    pr.part_description as part_name, pr.part_number, pr.car_make, pr.car_model, pr.car_year
             FROM orders o
             JOIN bids b ON o.bid_id = b.bid_id
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE o.garage_id = $1
               AND o.completed_at >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY o.completed_at DESC`,
            [garageId]
        );

        res.json({
            export_type: 'orders',
            period_days: days,
            total_records: result.rowCount,
            data: result.rows
        });

    } catch (err) {
        console.error('exportAnalytics error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// GET /api/garage/analytics/customers - Customer insights (Enterprise only)
export const getCustomerInsights = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        if (planInfo.analytics_level !== 'premium') {
            return res.status(403).json({
                error: 'Customer insights requires Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['enterprise']
            });
        }

        // Get customer purchase patterns
        const [repeatCustomers, topCustomers, areaBreakdown] = await Promise.all([
            // Repeat customer rate
            pool.query(
                `SELECT 
                    COUNT(DISTINCT customer_id) as unique_customers,
                    COUNT(DISTINCT customer_id) FILTER (
                        WHERE customer_id IN (
                            SELECT customer_id FROM orders 
                            WHERE garage_id = $1 
                            GROUP BY customer_id HAVING COUNT(*) > 1
                        )
                    ) as repeat_customers
                 FROM orders
                 WHERE garage_id = $1 AND order_status = 'completed'`,
                [garageId]
            ),
            // Top customers (anonymized)
            pool.query(
                `SELECT 
                    'Customer ' || ROW_NUMBER() OVER (ORDER BY SUM(garage_payout_amount) DESC) as customer,
                    COUNT(*) as orders,
                    SUM(garage_payout_amount) as total_spent
                 FROM orders
                 WHERE garage_id = $1 AND order_status = 'completed'
                 GROUP BY customer_id
                 ORDER BY total_spent DESC
                 LIMIT 10`,
                [garageId]
            ),
            // Area breakdown - simplified since orders doesn't have address_id FK
            pool.query(
                `SELECT 
                    'Qatar' as area,
                    COUNT(*) as orders,
                    SUM(o.garage_payout_amount) as revenue
                 FROM orders o
                 WHERE o.garage_id = $1 AND o.order_status = 'completed'`,
                [garageId]
            )
        ]);

        const uniqueCustomers = parseInt(repeatCustomers.rows[0]?.unique_customers) || 0;
        const repeatCount = parseInt(repeatCustomers.rows[0]?.repeat_customers) || 0;
        const repeatRate = uniqueCustomers > 0 ? ((repeatCount / uniqueCustomers) * 100).toFixed(1) : 0;

        res.json({
            insights: {
                unique_customers: uniqueCustomers,
                repeat_customers: repeatCount,
                repeat_rate: parseFloat(repeatRate as string)
            },
            top_customers: topCustomers.rows,
            area_breakdown: areaBreakdown.rows
        });

    } catch (err) {
        console.error('getCustomerInsights error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// GET /api/garage/plan-features - Get current plan features for UI gating
export const getPlanFeatures = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        res.json({
            plan_code: planInfo.plan_code,
            features: {
                analytics: planInfo.analytics_level,
                has_analytics: hasAnalyticsAccess(planInfo.analytics_level),
                has_customer_insights: planInfo.analytics_level === 'premium',
                has_export: planInfo.analytics_level === 'premium',
                has_market_insights: planInfo.analytics_level === 'premium',
                badge: planInfo.features?.badge || null,
                priority_listing: planInfo.features?.priority_listing || false,
                featured: planInfo.features?.featured || false,
                support_level: planInfo.features?.support || 'email'
            }
        });

    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// GET /api/garage/analytics/market - Market Insights (Enterprise only)
export const getMarketInsights = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        if (planInfo.analytics_level !== 'premium') {
            return res.status(403).json({
                error: 'Market Insights requires Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['enterprise']
            });
        }

        // Get all market data in parallel
        const [
            platformStats,
            garageRanking,
            myStats,
            marketAverages,
            trendingParts
        ] = await Promise.all([
            // Platform-wide stats
            pool.query(
                `SELECT 
                    COUNT(*) FILTER (WHERE approval_status = 'approved') as active_garages,
                    (SELECT COUNT(*) FROM orders WHERE order_status = 'completed' 
                     AND completed_at >= CURRENT_DATE - INTERVAL '30 days') as orders_this_month,
                    (SELECT COUNT(*) FROM part_requests WHERE status = 'active') as active_requests
                 FROM garages`
            ),
            // This garage's ranking by total_transactions
            pool.query(
                `SELECT 
                    rank,
                    total_garages
                 FROM (
                    SELECT 
                        garage_id,
                        RANK() OVER (ORDER BY total_transactions DESC) as rank,
                        COUNT(*) OVER () as total_garages
                    FROM garages 
                    WHERE approval_status = 'approved'
                 ) ranked
                 WHERE garage_id = $1`,
                [garageId]
            ),
            // My garage stats
            pool.query(
                `SELECT 
                    rating_average,
                    total_transactions,
                    response_time_avg_minutes,
                    fulfillment_rate
                 FROM garages
                 WHERE garage_id = $1`,
                [garageId]
            ),
            // Market averages (from all approved garages)
            pool.query(
                `SELECT 
                    ROUND(AVG(rating_average)::numeric, 2) as avg_rating,
                    ROUND(AVG(total_transactions)::numeric, 0) as avg_transactions,
                    ROUND(AVG(response_time_avg_minutes)::numeric, 0) as avg_response_time,
                    ROUND(AVG(fulfillment_rate)::numeric, 1) as avg_fulfillment_rate
                 FROM garages
                 WHERE approval_status = 'approved'
                   AND total_transactions > 0`
            ),
            // Trending parts (most requested in last 30 days)
            pool.query(
                `SELECT 
                    part_description as part_name,
                    COUNT(*) as request_count,
                    COUNT(*) - LAG(COUNT(*), 1, COUNT(*)) OVER (ORDER BY COUNT(*) DESC) as trend
                 FROM part_requests
                 WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                   AND status != 'cancelled'
                 GROUP BY part_description
                 ORDER BY request_count DESC
                 LIMIT 5`
            )
        ]);

        // Calculate win rate for this garage
        const winRateResult = await pool.query(
            `SELECT 
                COUNT(*) as total_bids,
                COUNT(*) FILTER (WHERE status = 'accepted') as won_bids
             FROM bids
             WHERE garage_id = $1
               AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [garageId]
        );

        const totalBids = parseInt(winRateResult.rows[0]?.total_bids) || 0;
        const wonBids = parseInt(winRateResult.rows[0]?.won_bids) || 0;
        const myWinRate = totalBids > 0 ? ((wonBids / totalBids) * 100) : 0;

        // Market average win rate
        const marketWinRateResult = await pool.query(
            `SELECT 
                COUNT(*) as total_bids,
                COUNT(*) FILTER (WHERE status = 'accepted') as won_bids
             FROM bids
             WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`
        );
        const marketTotalBids = parseInt(marketWinRateResult.rows[0]?.total_bids) || 1;
        const marketWonBids = parseInt(marketWinRateResult.rows[0]?.won_bids) || 0;
        const marketWinRate = (marketWonBids / marketTotalBids) * 100;

        const myGarage = myStats.rows[0] || {};
        const marketAvg = marketAverages.rows[0] || {};
        const ranking = garageRanking.rows[0] || { rank: 0, total_garages: 0 };

        res.json({
            platform: {
                active_garages: parseInt(platformStats.rows[0]?.active_garages) || 0,
                orders_this_month: parseInt(platformStats.rows[0]?.orders_this_month) || 0,
                active_requests: parseInt(platformStats.rows[0]?.active_requests) || 0
            },
            your_position: {
                rank: parseInt(ranking.rank) || 0,
                total_garages: parseInt(ranking.total_garages) || 0,
                percentile: ranking.total_garages > 0
                    ? Math.round((1 - (ranking.rank / ranking.total_garages)) * 100)
                    : 0
            },
            benchmarks: {
                rating: {
                    yours: parseFloat(myGarage.rating_average) || 0,
                    market_avg: parseFloat(marketAvg.avg_rating) || 0,
                    is_above_avg: parseFloat(myGarage.rating_average) >= parseFloat(marketAvg.avg_rating)
                },
                win_rate: {
                    yours: Math.round(myWinRate * 10) / 10,
                    market_avg: Math.round(marketWinRate * 10) / 10,
                    is_above_avg: myWinRate >= marketWinRate
                },
                response_time: {
                    yours: parseInt(myGarage.response_time_avg_minutes) || 0,
                    market_avg: parseInt(marketAvg.avg_response_time) || 0,
                    is_above_avg: (parseInt(myGarage.response_time_avg_minutes) || 999) <= (parseInt(marketAvg.avg_response_time) || 0)
                },
                fulfillment_rate: {
                    yours: parseFloat(myGarage.fulfillment_rate) || 0,
                    market_avg: parseFloat(marketAvg.avg_fulfillment_rate) || 0,
                    is_above_avg: parseFloat(myGarage.fulfillment_rate) >= parseFloat(marketAvg.avg_fulfillment_rate)
                }
            },
            trending_parts: trendingParts.rows.map(p => ({
                name: p.part_name,
                requests: parseInt(p.request_count)
            }))
        });

    } catch (err) {
        console.error('getMarketInsights error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
