import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import { AnalyticsService } from '../services/analytics.service';

export const getGarageAnalytics = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const period = (req.query.period as 'today' | 'week' | 'month' | 'year') || 'month';

    try {
        const result = await AnalyticsService.getGarageOverview(garageId, period);

        // Map response keys to match frontend expectations
        res.json({
            summary: {
                total_revenue: parseFloat(result.summary.total_revenue as unknown as string) || 0,
                total_orders: result.summary.total_orders || 0,
                total_bids: result.summary.total_bids || 0,
                acceptance_rate: parseFloat(result.summary.win_rate as unknown as string) || 0,
                avg_response_hours: 2.5 // Default average
            },
            charts: {
                revenue_trend: result.sales_trend || []
            },
            top_categories: result.top_parts || [],
            premium_insights: {
                can_export: true,
                customer_insights_available: true
            }
        });
    } catch (err: any) {
        if (err.message?.includes('requires')) {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const exportAnalytics = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const period = (req.query.period as 'today' | 'week' | 'month' | 'year') || 'month';

    try {
        const [salesTrend, bidPerformance, popularParts] = await Promise.all([
            AnalyticsService.getSalesTrend(garageId),
            AnalyticsService.getBidPerformance(garageId),
            AnalyticsService.getPopularParts(garageId)
        ]);
        res.json({ sales_trend: salesTrend, bid_performance: bidPerformance, popular_parts: popularParts, export_format: 'json', generated_at: new Date().toISOString() });
    } catch (err: any) {
        if (err.message?.includes('requires')) {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getCustomerInsights = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const summary = await AnalyticsService.getSummary(garageId, 'month');
        res.json({ insights: { unique_customers: summary.unique_customers, avg_rating: summary.avg_rating, total_orders: summary.total_orders } });
    } catch (err: any) {
        if (err.message?.includes('requires')) {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getPlanFeatures = async (req: AuthRequest, res: Response) => {
    // Returns static plan feature information
    res.json({ features: { analytics: true, export: true, comparison: true, popular_parts: true, bid_performance: true } });
};

export const getMarketInsights = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const comparison = await AnalyticsService.getComparison(garageId, 'month');
        res.json({ market_insights: { changes: comparison.changes, current_period: comparison.current, previous_period: comparison.previous } });
    } catch (err: any) {
        if (err.message?.includes('requires')) {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
