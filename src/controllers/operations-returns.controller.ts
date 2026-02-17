import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Operations Returns Controller
 * Handles return request management for Operations Dashboard
 */

/**
 * GET /returns
 * Get pending return requests
 */
export const getReturns = async (req: Request, res: Response): Promise<void> => {
    try {
        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const returns = await returnService.getPendingReturns();
        res.json({ returns });
    } catch (error) {
        logger.error('Get returns error', { error });
        res.json({ returns: [] });
    }
};

/**
 * POST /returns/:return_id/approve
 * Approve return request (BRAIN v3.0)
 */
export const approveReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { notes } = req.body;
        const operatorId = (req as any).user?.userId;

        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const result = await returnService.approveReturn(return_id, operatorId, notes);

        res.json(result);
    } catch (error: any) {
        logger.error('Approve return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to approve return' });
    }
};

/**
 * POST /returns/:return_id/reject
 * Reject return request
 */
export const rejectReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { reason } = req.body;
        const operatorId = (req as any).user?.userId;

        if (!reason) {
            res.status(400).json({ success: false, message: 'Rejection reason is required' });
            return;
        }

        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const result = await returnService.rejectReturn(return_id, operatorId, reason);

        res.json(result);
    } catch (error: any) {
        logger.error('Reject return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to reject return' });
    }
};
