import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { CancellationService } from '../services/cancellation';
import { getWritePool } from '../config/db';
import { getErrorMessage } from '../types';

const cancellationService = new CancellationService(getWritePool());

// ============================================
// REQUEST CANCELLATION (by Customer)
// ============================================

export const cancelRequest = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const { reason } = req.body;
    const customerId = req.user!.userId;

    try {
        const result = await cancellationService.cancelRequest(request_id, customerId, reason);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// BID WITHDRAWAL (by Garage)
// ============================================

export const withdrawBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const { reason } = req.body;
    const garageId = req.user!.userId;

    try {
        const result = await cancellationService.withdrawBid(bid_id, garageId, reason);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ORDER CANCELLATION
// ============================================

export const getCancellationPreview = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;

    try {
        const preview = await cancellationService.getCancellationPreview(order_id, userId);
        res.json(preview);
    } catch (err) {
        if (err instanceof Error && err.message === 'Order not found') {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const cancelOrderByCustomer = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason_code, reason_text } = req.body;
    const customerId = req.user!.userId;

    try {
        const result = await cancellationService.cancelOrderByCustomer(
            order_id,
            customerId,
            reason_code,
            reason_text
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const cancelOrderByGarage = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason_code, reason_text } = req.body;
    const garageId = req.user!.userId;

    try {
        const result = await cancellationService.cancelOrderByGarage(
            order_id,
            garageId,
            reason_code,
            reason_text
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getCancellationHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const history = await cancellationService.getCancellationHistory(userId, userType);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
