import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { DisputeOrderService } from '../services/dispute';
import { createNotification } from '../services/notification.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

const disputeService = new DisputeOrderService(pool);

interface CreateDisputeBody {
    order_id?: string;
    reason?: string;
    description?: string;
}

interface DisputeParams {
    dispute_id: string;
}

interface GarageRespondBody {
    response_message?: string;
}

interface CreateDisputeConfig {
    returnShippingBy: 'customer' | 'garage' | 'platform';
    deliveryRefund: boolean;
}

interface CreateDisputeResult {
    dispute: { dispute_id: string };
    order: { garage_id: string; order_number: string };
    refundAmount: number;
    restockingFee: number;
    config: CreateDisputeConfig;
}

interface GarageRespondResult {
    dispute: { customer_id: string };
}

interface AutoResolvedDispute {
    dispute_id: string;
    order_id: string;
    customer_id: string;
    garage_id: string;
    refund_amount: number | string;
}

type JsonRecord = Record<string, unknown>;

const getUserContext = (req: AuthRequest): { userId: string; userType: string } | null => {
    if (!req.user?.userId || !req.user.userType) {
        return null;
    }
    return { userId: req.user.userId, userType: req.user.userType };
};

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const toRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const toCreateDisputeResult = (value: unknown): CreateDisputeResult | null => {
    const root = toRecord(value);
    if (!root) {
        return null;
    }

    const dispute = toRecord(root.dispute);
    const order = toRecord(root.order);
    const config = toRecord(root.config);
    const disputeId = toQueryString(dispute?.dispute_id);
    const garageId = toQueryString(order?.garage_id);
    const orderNumber = toQueryString(order?.order_number);
    const refundAmount = toOptionalNumber(root.refundAmount);
    const restockingFee = toOptionalNumber(root.restockingFee);
    const returnShippingBy = toQueryString(config?.returnShippingBy);
    const deliveryRefundRaw = config?.deliveryRefund;

    if (!disputeId || !garageId || !orderNumber || refundAmount === undefined || restockingFee === undefined) {
        return null;
    }
    if (
        returnShippingBy !== 'customer' &&
        returnShippingBy !== 'garage' &&
        returnShippingBy !== 'platform'
    ) {
        return null;
    }
    if (typeof deliveryRefundRaw !== 'boolean') {
        return null;
    }

    return {
        dispute: { dispute_id: disputeId },
        order: { garage_id: garageId, order_number: orderNumber },
        refundAmount,
        restockingFee,
        config: {
            returnShippingBy,
            deliveryRefund: deliveryRefundRaw
        }
    };
};

const toGarageRespondResult = (value: unknown): GarageRespondResult | null => {
    const root = toRecord(value);
    const dispute = toRecord(root?.dispute);
    const customerId = toQueryString(dispute?.customer_id);
    if (!customerId) {
        return null;
    }

    return { dispute: { customer_id: customerId } };
};

const toAutoResolvedDispute = (value: unknown): AutoResolvedDispute | null => {
    const row = toRecord(value);
    if (!row) {
        return null;
    }

    const disputeId = toQueryString(row.dispute_id);
    const orderId = toQueryString(row.order_id);
    const customerId = toQueryString(row.customer_id);
    const garageId = toQueryString(row.garage_id);
    const refundAmount = toOptionalNumber(row.refund_amount) ?? toQueryString(row.refund_amount);

    if (!disputeId || !orderId || !customerId || !garageId || refundAmount === undefined) {
        return null;
    }

    return {
        dispute_id: disputeId,
        order_id: orderId,
        customer_id: customerId,
        garage_id: garageId,
        refund_amount: refundAmount
    };
};

const getUploadedPhotoUrls = (req: AuthRequest): string[] => {
    const filesValue: unknown = req.files;
    if (!Array.isArray(filesValue)) {
        return [];
    }

    return filesValue
        .filter((file): file is Express.Multer.File =>
            isRecord(file) && typeof file.filename === 'string'
        )
        .map((file) => `/uploads/${file.filename}`);
};

const logDisputeError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

export const createDispute = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as CreateDisputeBody;
        const orderId = toQueryString(body.order_id);
        const reason = toQueryString(body.reason);
        const description = toQueryString(body.description);
        const photoUrls = getUploadedPhotoUrls(req);

        if (!orderId || !reason || !description) {
            return res.status(400).json({ error: 'order_id, reason, and description are required' });
        }

        const resultValue: unknown = await disputeService.createDispute(user.userId, {
            order_id: orderId,
            reason,
            description,
            photoUrls
        });
        const result = toCreateDisputeResult(resultValue);
        if (!result) {
            return res.status(500).json({ error: 'Failed to create dispute' });
        }

        // Notifications
        await createNotification({
            userId: result.order.garage_id,
            type: 'dispute_created',
            title: 'New Dispute ⚠️',
            message: `A dispute was opened for Order #${result.order.order_number}`,
            data: { dispute_id: result.dispute.dispute_id, order_id: orderId },
            target_role: 'garage'
        });
        await createNotification({
            userId: 'operations',
            type: 'dispute_created',
            title: 'New Dispute Opened',
            message: `Dispute opened for Order #${result.order.order_number}`,
            data: { dispute_id: result.dispute.dispute_id },
            target_role: 'operations'
        });

        const io = getIO();
        io?.to(`garage_${result.order.garage_id}`).emit('dispute_created', {
            dispute_id: result.dispute.dispute_id,
            order_id: orderId,
            reason,
            refund_amount: result.refundAmount
        });

        res.status(201).json({
            message: 'Dispute submitted successfully',
            dispute_id: result.dispute.dispute_id,
            expected_refund: result.refundAmount,
            restocking_fee: result.restockingFee,
            return_shipping_by: result.config.returnShippingBy,
            delivery_refunded: result.config.deliveryRefund
        });
    } catch (error) {
        logDisputeError('createDispute error', error);
        res.status(400).json({ error: getErrorMessage(error) });
    }
};

export const getMyDisputes = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await disputeService.getMyDisputes(user.userId, user.userType, {
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit),
            status: toQueryString(req.query.status)
        });
        res.json(result);
    } catch (error) {
        logDisputeError('getMyDisputes error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { dispute_id: disputeId } = req.params as unknown as DisputeParams;
        const disputeValue: unknown = await disputeService.getDisputeDetails(disputeId, user.userId);
        if (disputeValue === null) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        const dispute = toRecord(disputeValue);
        if (!dispute) {
            return res.status(500).json({ error: 'Failed to load dispute details' });
        }
        res.json({ dispute });
    } catch (error) {
        logDisputeError('getDisputeDetails error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const garageRespondToDispute = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { dispute_id: disputeId } = req.params as unknown as DisputeParams;
        const body = req.body as unknown as GarageRespondBody;
        const responseMessage = toQueryString(body.response_message);

        if (!responseMessage) {
            return res.status(400).json({ error: 'response_message is required' });
        }

        const resultValue: unknown = await disputeService.garageRespond(
            disputeId,
            user.userId,
            responseMessage
        );
        const result = toGarageRespondResult(resultValue);
        if (!result) {
            return res.status(500).json({ error: 'Failed to process garage response' });
        }

        const io = getIO();
        io?.to(`user_${result.dispute.customer_id}`).emit('dispute_updated', {
            dispute_id: disputeId,
            notification: 'Garage has responded to your dispute.'
        });
        io?.to('operations').emit('dispute_needs_review', { dispute_id: disputeId });
        res.json({ message: 'Response submitted. Customer service will review.', status: 'under_review' });
    } catch (error) {
        logDisputeError('garageRespondToDispute error', error);
        res.status(400).json({ error: getErrorMessage(error) });
    }
};

export const autoResolveDisputes = async () => {
    try {
        const resolvedValue: unknown = await disputeService.autoResolveDisputes();
        const resolved = Array.isArray(resolvedValue)
            ? resolvedValue
                .map((row) => toAutoResolvedDispute(row))
                .filter((row): row is AutoResolvedDispute => row !== null)
            : [];

        const io = getIO();
        for (const dispute of resolved) {
            io?.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
                dispute_id: dispute.dispute_id,
                resolution: 'refund_approved',
                refund_amount: dispute.refund_amount
            });
            io?.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', {
                dispute_id: dispute.dispute_id,
                resolution: 'refund_approved'
            });
        }
        if (resolved.length > 0) {
            logger.info(`Auto-resolved ${resolved.length} disputes`);
        }
    } catch (error) {
        logDisputeError('Auto-resolve disputes failed', error);
    }
};

export const getPendingDisputesCount = async (req: AuthRequest, res: Response) => {
    const user = getUserContext(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const count = await disputeService.getPendingDisputesCount(user.userId);
        res.json({ pending_count: count });
    } catch (error) {
        logDisputeError('getPendingDisputesCount error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};
