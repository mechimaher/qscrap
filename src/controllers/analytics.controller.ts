import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import { AnalyticsService } from '../services/analytics.service';

export const getGarageAnalytics = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const period = (req.query.period as 'today' | 'week' | 'month' | 'year') || 'month';

    try {
        const result = await AnalyticsService.getGarageOverview(garageId, period);
        res.json(result);
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
