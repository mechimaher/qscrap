import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { DashboardUrgentService } from '../services/dashboard';

const dashboardUrgentService = new DashboardUrgentService(pool);

// ===== CUSTOMER URGENT ACTIONS =====
export const getCustomerUrgentActions = async (req: AuthRequest, res: Response) => {
    try {
        const urgentActions = await dashboardUrgentService.getCustomerUrgentActions(req.user!.userId);
        res.json({ success: true, urgent_actions: urgentActions, count: urgentActions.length });
    } catch (err) {
        console.error('[Dashboard] Get urgent actions error:', err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

// ===== CUSTOMER CONTEXTUAL DATA =====
export const getCustomerContextualData = async (req: AuthRequest, res: Response) => {
    try {
        const contextualData = await dashboardUrgentService.getCustomerContextualData(req.user!.userId);
        res.json({ success: true, contextual_data: contextualData });
    } catch (err) {
        console.error('[Dashboard] Get contextual data error:', err);
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};
