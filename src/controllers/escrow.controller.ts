import { Request, Response } from 'express';
import pool from '../config/db';
import { EscrowService } from '../services/escrow.service';
import { ApiError } from '../middleware/errorHandler.middleware';

const escrowService = new EscrowService(pool);

const getUserContext = (req: any): { userId: string; userType: string } | null => {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const userType = (req as any).user?.role || (req as any).user?.userType;
    if (!userId || !userType) {
        return null;
    }
    return { userId, userType };
};

export const getEscrowForOrder = async (req: Request, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const { order_id } = req.params;
    const escrow = await escrowService.getEscrowByOrder(order_id);
    if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
    }
    // basic authorization: only customer or garage on this order
    if (user.userId !== escrow.customer_id && user.userId !== escrow.seller_id) {
        throw ApiError.forbidden('Not authorized to view this escrow');
    }
    return res.json({
        escrow_id: escrow.escrow_id,
        status: escrow.status,
        amount: escrow.amount,
        inspection_expires_at: escrow.inspection_expires_at,
        inspection_window_hours: escrow.inspection_window_hours,
        dispute_raised_at: escrow.dispute_raised_at,
        dispute_reason: escrow.dispute_reason
    });
};

export const raiseEscrowDisputeHandler = async (req: Request, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.userType !== 'customer') {
        return res.status(403).json({ error: 'Only customers can dispute escrow' });
    }
    const { escrow_id } = req.params;
    const { reason, note } = req.body || {};
    const escrow = await escrowService.raiseDispute(escrow_id, user.userId, reason, note);
    return res.json({
        escrow_id: escrow.escrow_id,
        status: escrow.status,
        dispute_reason: escrow.dispute_reason,
        dispute_raised_at: escrow.dispute_raised_at
    });
};
