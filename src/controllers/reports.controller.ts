import { Request, Response } from 'express';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { ReportsService } from '../services/reports';

interface AuthRequest extends Request { user?: { userId: string; userType: string }; }

const reportsService = new ReportsService(pool);

export const getOrdersReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to, status } = req.query;
        const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = (to as string) || new Date().toISOString().split('T')[0];
        const result = await reportsService.getOrdersReport(fromDate, toDate, status as string);
        res.json({ report_type: 'orders', period: { from: fromDate, to: toDate }, generated_at: new Date().toISOString(), generated_by: req.user?.userId, summary: result.summary, data: result.orders, total_records: result.orders.length });
    } catch (err) {
        console.error('Orders report error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = (to as string) || new Date().toISOString().split('T')[0];
        const result = await reportsService.getRevenueReport(fromDate, toDate);
        res.json({ report_type: 'revenue', period: { from: fromDate, to: toDate }, generated_at: new Date().toISOString(), summary: result.summary, daily_breakdown: result.daily, top_garages: result.topGarages });
    } catch (err) {
        console.error('Revenue report error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDisputesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = (to as string) || new Date().toISOString().split('T')[0];
        const result = await reportsService.getDisputesReport(fromDate, toDate);
        res.json({ report_type: 'disputes', period: { from: fromDate, to: toDate }, generated_at: new Date().toISOString(), summary: result.summary, data: result.disputes, total_records: result.disputes.length });
    } catch (err) {
        console.error('Disputes report error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDeliveriesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = (to as string) || new Date().toISOString().split('T')[0];
        const result = await reportsService.getDeliveriesReport(fromDate, toDate);
        res.json({ report_type: 'deliveries', period: { from: fromDate, to: toDate }, generated_at: new Date().toISOString(), summary: result.summary, drivers: result.drivers, total_drivers: result.drivers.length });
    } catch (err) {
        console.error('Deliveries report error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getGaragesReport = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate = (to as string) || new Date().toISOString().split('T')[0];
        const garages = await reportsService.getGaragesReport(fromDate, toDate);
        res.json({ report_type: 'garages', period: { from: fromDate, to: toDate }, generated_at: new Date().toISOString(), data: garages, total_garages: garages.length });
    } catch (err) {
        console.error('Garages report error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
