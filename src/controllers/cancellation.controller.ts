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

// HR-01: Idempotency cache for cancel requests (prevents double-cancel race condition)
const idempotencyCache = new Map<string, { result: any; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getIdempotencyKey(req: AuthRequest): string | null {
    return req.headers['x-idempotency-key'] as string | null;
}

function getCachedResult(key: string): any | null {
    const cached = idempotencyCache.get(key);
    if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
        return cached.result;
    }
    if (cached) {
        idempotencyCache.delete(key); // Expired
    }
    return null;
}

function cacheResult(key: string, result: any): void {
    idempotencyCache.set(key, { result, timestamp: Date.now() });
    // Cleanup old entries periodically
    if (idempotencyCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of idempotencyCache) {
            if (now - v.timestamp > IDEMPOTENCY_TTL_MS) {
                idempotencyCache.delete(k);
            }
        }
    }
}

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

    // HR-01: Check idempotency cache
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
        const cacheKey = `cancel_customer:${order_id}:${idempotencyKey}`;
        const cached = getCachedResult(cacheKey);
        if (cached) {
            console.log(`[IDEMPOTENCY] Returning cached result for ${cacheKey}`);
            return res.json(cached);
        }
    }

    try {
        const result = await cancellationService.cancelOrderByCustomer(
            order_id,
            customerId,
            reason_code,
            reason_text
        );

        // Cache successful result
        if (idempotencyKey) {
            cacheResult(`cancel_customer:${order_id}:${idempotencyKey}`, result);
        }

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
// DRIVER CANCELLATION
// ============================================

export const cancelOrderByDriver = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { reason_code, reason_text } = req.body;
    const driverId = req.user!.userId;

    // Validate reason code
    const validReasons = ['cant_find_garage', 'part_damaged_at_pickup', 'customer_unreachable_driver', 'vehicle_issue'];
    if (!reason_code || !validReasons.includes(reason_code)) {
        return res.status(400).json({
            error: `Invalid reason_code. Must be one of: ${validReasons.join(', ')}`
        });
    }

    try {
        const result = await cancellationService.cancelOrderByDriver(
            order_id,
            driverId,
            reason_code,
            reason_text
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
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
