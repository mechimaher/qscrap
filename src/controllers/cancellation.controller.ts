import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import {
    CancellationService,
    getReturnService,
    getFraudDetectionService
} from '../services/cancellation';
import { getWritePool } from '../config/db';
import { getErrorMessage } from '../types';

const pool = getWritePool();
const cancellationService = new CancellationService(pool);

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

// ============================================
// RETURN REQUESTS (7-Day Window) - BRAIN v3.0
// ============================================

export const getReturnPreview = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const customerId = req.user!.userId;

    try {
        const returnService = getReturnService(pool);
        const preview = await returnService.getReturnPreview(order_id, customerId);
        res.json(preview);
    } catch (err) {
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const createReturnRequest = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason, photo_urls, condition_description } = req.body;
    const customerId = req.user!.userId;

    // Validate required fields
    if (!reason || !['unused', 'defective', 'wrong_part'].includes(reason)) {
        return res.status(400).json({
            error: 'Invalid reason. Must be: unused, defective, or wrong_part'
        });
    }

    if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length < 3) {
        return res.status(400).json({
            error: 'Minimum 3 photos required for return request'
        });
    }

    try {
        const returnService = getReturnService(pool);
        const result = await returnService.createReturnRequest(
            order_id,
            customerId,
            reason,
            photo_urls,
            condition_description
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// CUSTOMER ABUSE STATUS - BRAIN v3.0
// ============================================

export const getCustomerAbuseStatus = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;

    try {
        const fraudService = getFraudDetectionService(pool);
        const status = await fraudService.getCustomerAbuseStatus(customerId);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Support Agent: Lookup customer abuse status by customer_id
export const getCustomerAbuseStatusByAgent = async (req: AuthRequest, res: Response) => {
    const { customer_id } = req.query;

    if (!customer_id || typeof customer_id !== 'string') {
        return res.status(400).json({ error: 'customer_id query parameter required' });
    }

    try {
        const fraudService = getFraudDetectionService(pool);
        const status = await fraudService.getCustomerAbuseStatus(customer_id);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
