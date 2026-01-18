import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getReadPool } from '../config/db';
import {
    GarageReportService,
    RevenueReportService
} from '../services/admin-reports';

const garageReportService = new GarageReportService(getReadPool());
const revenueReportService = new RevenueReportService(getReadPool());

// ============================================================================
// GARAGE LIFECYCLE REPORTS
// ============================================================================

export const getDemoGaragesReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageReportService.getDemoGaragesReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=demo_garages_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'demo_garages',
            generated_at: new Date().toISOString(),
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getDemoGaragesReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const getExpiredDemosReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageReportService.getExpiredDemosReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=expired_demos_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'expired_demos',
            generated_at: new Date().toISOString(),
            period: req.query.period,
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getExpiredDemosReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const getDemoConversionsReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageReportService.getDemoConversionsReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=demo_conversions_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'demo_conversions',
            generated_at: new Date().toISOString(),
            period: req.query.period,
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getDemoConversionsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const getAllGaragesReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageReportService.getAllGaragesReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=all_garages_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'all_garages',
            generated_at: new Date().toISOString(),
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getAllGaragesReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// ============================================================================
// SUBSCRIPTION & REVENUE REPORTS
// ============================================================================

export const getSubscriptionRenewalsReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await revenueReportService.getSubscriptionRenewalsReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=subscription_renewals_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'subscription_renewals',
            generated_at: new Date().toISOString(),
            days_ahead: req.query.days_ahead || 30,
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getSubscriptionRenewalsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const getCommissionRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await revenueReportService.getCommissionRevenueReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=commission_revenue_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'commission_revenue',
            generated_at: new Date().toISOString(),
            period: req.query.period,
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getCommissionRevenueReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const getRegistrationsReport = async (req: AuthRequest, res: Response) => {
    try {
        const result = await revenueReportService.getRegistrationsReport(req.query);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=registrations_report.csv');
            return res.send(result);
        }

        res.json({
            report_type: 'registrations',
            generated_at: new Date().toISOString(),
            period: req.query.period,
            ...(typeof result === 'object' ? result as object : { data: result })
        });
    } catch (err: any) {
        console.error('[REPORTS] getRegistrationsReport error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// ============================================================================
// CATALOG
// ============================================================================

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
