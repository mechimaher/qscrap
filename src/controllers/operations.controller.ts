import { Response } from 'express';
import { getReadPool, getWritePool } from '../config/db';
import { runAutoCompleteNow } from '../jobs/auto-complete-orders';
import { AuthRequest } from '../middleware/auth.middleware';
import { createNotification } from '../services/notification.service';
import { CancellationService } from '../services/cancellation/cancellation.service';
import {
    DisputeService,
    OperationsDashboardService,
    OrderManagementService,
    UserManagementService
} from '../services/operations';
import { SupportActionsService } from '../services/support/support-actions.service';
import { getErrorMessage } from '../types';
import { emitToOperations, getIO } from '../utils/socketIO';
import logger from '../utils/logger';

const dashboardService = new OperationsDashboardService(getReadPool());
const orderService = new OrderManagementService(getWritePool());
const disputeService = new DisputeService(getWritePool());
const userService = new UserManagementService(getReadPool());
const supportActionsService = new SupportActionsService(getWritePool());
const cancellationService = new CancellationService(getWritePool());

interface CountRow {
    count: string;
}

interface OrderNotificationRecord {
    order_number: string;
    customer_id: string;
    garage_id: string;
    garage_name?: string | null;
    garage_payout_amount?: number | string | null;
}

interface OrderDetailsPayload {
    order: OrderNotificationRecord;
}

interface DisputeNotificationRecord {
    customer_id: string;
    garage_id: string;
    order_id: string;
    order_number: string;
}

interface DisputeDetailsPayload {
    dispute: DisputeNotificationRecord;
}

interface ResolveDisputeResult {
    message: string;
    resolution: string;
    refund_amount: number | null;
    return_assignment: { assignment_id: string } | null;
    payout_action: unknown;
}

type ResolutionAction = 'approve_refund' | 'approve_cancellation' | 'reject' | 'acknowledge';

interface EscalationRow {
    escalation_id: string;
    ticket_id: string | null;
    resolved_order_id: string | null;
    customer_id: string | null;
    garage_id: string | null;
    order_number: string | null;
    escalated_by: string | null;
}

type EscalationListRow = Record<string, unknown>;

type EscalationUpdateRow = Record<string, unknown>;

interface SupportActionResult {
    success: boolean;
    action?: string;
    orderId?: string;
    message?: string;
    payoutAction?: unknown;
    refundAction?: unknown;
    refundId?: string;
    status?: string;
    error?: string;
}

interface UpdateOrderStatusBody {
    new_status?: string;
    notes?: string;
}

interface CollectOrderBody {
    notes?: string;
}

interface BulkOrderActionBody {
    action?: string;
    order_ids?: unknown;
    notes?: string;
    reason?: string;
    refund_type?: 'full' | 'partial' | 'none' | string;
    partial_refund_amount?: number | string;
}

interface ResolveDisputeBody {
    resolution?: string;
    refund_amount?: number | string;
    notes?: string;
}

interface ResolveEscalationBody {
    resolution_notes?: string;
    resolution_action?: string;
}

interface CancelOrderByOperationsBody {
    reason?: string;
    refund_type?: 'full' | 'partial' | 'none' | string;
    partial_refund_amount?: number | string;
    notify_customer?: boolean | string;
    notify_garage?: boolean | string;
}

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const parseOptionalInt = (value: unknown): number | undefined => {
    const normalized = toQueryString(value);
    if (!normalized) {
        return undefined;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoundedInt = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = parseOptionalInt(value);
    if (parsed === undefined) {
        return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
};

const toOptionalNumber = (value: number | string | undefined): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const toOptionalBoolean = (value: boolean | string | undefined): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    return undefined;
};

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const logControllerError = (context: string, err: unknown): void => {
    logger.error(context, { error: getErrorMessage(err) });
};

const isResolutionAction = (value: string | undefined): value is ResolutionAction =>
    value === 'approve_refund' ||
    value === 'approve_cancellation' ||
    value === 'reject' ||
    value === 'acknowledge';

// ============================================
// DASHBOARD STATS
// ============================================

export const getDashboardStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await dashboardService.getDashboardStats();
        res.json({ stats });
    } catch (err) {
        logControllerError('[OPERATIONS] getDashboardStats error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getAnalytics = async (_req: AuthRequest, res: Response) => {
    try {
        const analytics = await dashboardService.getAnalytics();
        res.json({ analytics });
    } catch (err) {
        logControllerError('[OPERATIONS] getAnalytics error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ORDER MANAGEMENT
// ============================================

export const getOrders = async (req: AuthRequest, res: Response) => {
    const status = toQueryString(req.query.status);
    const search = toQueryString(req.query.search);
    const from = toQueryString(req.query.from);  // Date filter (frontend contract)
    const to = toQueryString(req.query.to);      // Date filter (frontend contract)
    const garage_id = toQueryString(req.query.garage_id); // Garage filter (frontend contract)
    const page = req.query.page;
    const limit = req.query.limit;

    try {
        const result = await orderService.getOrders({
            status,
            search,
            from,
            to,
            garage_id,
            page: parseOptionalInt(page),
            limit: parseOptionalInt(limit)
        });

        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] getOrders error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const bulkOrderAction = async (req: AuthRequest, res: Response) => {
    const body = req.body as unknown as BulkOrderActionBody;
    const staffId = getUserId(req);

    if (!staffId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const action = typeof body.action === 'string' ? body.action : '';
    const allowedActions = new Set(['mark_collected', 'mark_delivered', 'cancel_orders']);
    if (!allowedActions.has(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed: mark_collected, mark_delivered, cancel_orders' });
    }

    const rawOrderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
    const orderIds = [...new Set(
        rawOrderIds
            .filter((id): id is string => typeof id === 'string')
            .map(id => id.trim())
            .filter(Boolean)
    )].slice(0, 100);

    if (orderIds.length === 0) {
        return res.status(400).json({ error: 'order_ids must be a non-empty array of order IDs' });
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Bulk cancellation by operations';
    const refundType = body.refund_type === 'full' || body.refund_type === 'partial' || body.refund_type === 'none'
        ? body.refund_type
        : 'none';
    const partialRefundAmount = toOptionalNumber(body.partial_refund_amount);

    const successes: Array<{ order_id: string; result?: unknown }> = [];
    const failures: Array<{ order_id: string; error: string }> = [];

    for (const orderId of orderIds) {
        try {
            if (action === 'mark_collected') {
                const result = await orderService.collectOrder(
                    orderId,
                    staffId,
                    notes || 'Bulk action: marked as collected by operations'
                );
                successes.push({ order_id: orderId, result });
            } else if (action === 'mark_delivered') {
                const result = await orderService.updateOrderStatus(
                    orderId,
                    'delivered',
                    staffId,
                    notes || 'Bulk action: marked as delivered by operations'
                );
                successes.push({ order_id: orderId, result });
            } else {
                const result = await cancellationService.cancelOrderByOperations(
                    orderId,
                    staffId,
                    reason,
                    {
                        refund_type: refundType,
                        partial_refund_amount: partialRefundAmount,
                        notify_customer: false,
                        notify_garage: false
                    }
                );
                successes.push({ order_id: orderId, result });
            }
        } catch (err) {
            failures.push({ order_id: orderId, error: getErrorMessage(err) });
        }
    }

    try {
        await dashboardService.invalidateCache();
    } catch (cacheErr) {
        logControllerError('[OPERATIONS] bulkOrderAction cache invalidation failed:', cacheErr);
    }

    logger.info('[OPERATIONS] Bulk order action executed', {
        action,
        requested_count: orderIds.length,
        success_count: successes.length,
        failed_count: failures.length,
        executed_by: staffId
    });

    res.json({
        action,
        total: orderIds.length,
        success_count: successes.length,
        failed_count: failures.length,
        successes,
        failures
    });
};

export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { order_id: string };
    const { order_id } = params;

    try {
        const result = await orderService.getOrderDetails(order_id) as unknown as Record<string, unknown>;
        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] getOrderDetails error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { order_id: string };
    const body = req.body as unknown as UpdateOrderStatusBody;
    const { order_id } = params;
    const { new_status, notes } = body;
    const staffId = getUserId(req);

    if (!staffId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!new_status) {
        return res.status(400).json({ error: 'new_status is required' });
    }

    try {
        const result = await orderService.updateOrderStatus(order_id, new_status, staffId, notes);

        await dashboardService.invalidateCache();

        const io = getIO();
        const orderDetails = await orderService.getOrderDetails(order_id) as unknown as OrderDetailsPayload;
        const order = orderDetails.order;
        const orderNumber = order.order_number;

        const customerNotification = new_status === 'completed'
            ? `✅ Order #${orderNumber} has been marked as completed by Operations.`
            : `Order #${orderNumber} status updated to ${new_status}`;

        const garageNotification = new_status === 'completed'
            ? `✅ Order #${orderNumber} completed. Payment will be processed soon.`
            : `Order #${orderNumber} status updated to ${new_status}`;

        io?.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: orderNumber,
            old_status: result.old_status,
            new_status,
            garage_name: order.garage_name ?? undefined,
            notification: customerNotification
        });

        io?.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: orderNumber,
            old_status: result.old_status,
            new_status,
            notification: garageNotification
        });

        if (new_status === 'completed') {
            io?.to('operations').emit('order_completed', {
                order_id,
                order_number: orderNumber,
                notification: `Order #${orderNumber} manually completed by Operations`
            });

            io?.to('operations').emit('payout_pending', {
                order_id,
                order_number: orderNumber,
                garage_id: order.garage_id,
                payout_amount: order.garage_payout_amount ?? null,
                notification: `💰 Order #${orderNumber} complete - payout pending`
            });
        }

        res.json({
            message: 'Status updated',
            old_status: result.old_status,
            new_status: result.new_status,
            payout_created: result.payout_created
        });
    } catch (err) {
        logControllerError('[OPERATIONS] updateOrderStatus error', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const collectOrder = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { order_id: string };
    const body = req.body as unknown as CollectOrderBody;
    const { order_id } = params;
    const { notes } = body;
    const staffId = getUserId(req);

    if (!staffId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await orderService.collectOrder(order_id, staffId, notes);

        await dashboardService.invalidateCache();

        const orderDetails = await orderService.getOrderDetails(order_id) as unknown as OrderDetailsPayload;
        const order = orderDetails.order;

        const io = getIO();
        io?.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `📦 Order #${result.order_number} has been collected and is now being inspected.`
        });

        io?.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${result.order_number} has been collected by QScrap team.`
        });

        io?.to('operations').emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${result.order_number} marked as collected by Operations`
        });

        res.json({
            message: 'Order collected successfully',
            ...result
        });
    } catch (err) {
        logControllerError('[OPERATIONS] collectOrder error', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (err instanceof Error && err.message.includes('Invalid status transition')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DISPUTE MANAGEMENT
// ============================================

export const getDisputes = async (req: AuthRequest, res: Response) => {
    const status = toQueryString(req.query.status);
    const page = req.query.page;
    const limit = req.query.limit;

    try {
        const result = await disputeService.getDisputes({
            status,
            page: parseOptionalInt(page),
            limit: parseOptionalInt(limit)
        });

        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] getDisputes error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { dispute_id: string };
    const { dispute_id } = params;

    try {
        const result = await disputeService.getDisputeDetails(dispute_id) as unknown as Record<string, unknown>;
        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] getDisputeDetails error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const resolveDispute = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { dispute_id: string };
    const body = req.body as unknown as ResolveDisputeBody;
    const { dispute_id } = params;
    const { resolution, refund_amount, notes } = body;
    const staffId = getUserId(req);

    if (!staffId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (resolution !== 'refund_approved' && resolution !== 'dispute_rejected') {
        return res.status(400).json({ error: 'resolution must be refund_approved or dispute_rejected' });
    }

    try {
        const result = await disputeService.resolveDispute(
            dispute_id,
            {
                resolution,
                refund_amount: toOptionalNumber(refund_amount),
                notes
            },
            staffId
        ) as unknown as ResolveDisputeResult;

        await dashboardService.invalidateCache();

        const disputeDetails = await disputeService.getDisputeDetails(dispute_id) as unknown as DisputeDetailsPayload;
        const dispute = disputeDetails.dispute;

        const io = getIO();

        const refundMsg = resolution === 'refund_approved'
            ? `Refund of ${result.refund_amount} QAR approved. Your refund will be processed shortly.`
            : 'Dispute resolved in favor of garage';

        await createNotification({
            userId: dispute.customer_id,
            type: 'dispute_resolved',
            title: resolution === 'refund_approved' ? 'Refund Approved ✅' : 'Dispute Resolved',
            message: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`,
            data: {
                dispute_id,
                order_id: dispute.order_id,
                order_number: dispute.order_number,
                resolution,
                refund_amount: result.refund_amount
            },
            target_role: 'customer'
        });

        io?.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            refund_amount: result.refund_amount,
            notification: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`
        });

        const garageResolutionMsg = resolution === 'refund_approved'
            ? `Dispute for Order #${dispute.order_number} resolved. Part will be returned to your garage.`
            : `Dispute for Order #${dispute.order_number} has been resolved in your favor.`;

        await createNotification({
            userId: dispute.garage_id,
            type: 'dispute_resolved',
            title: 'Dispute Resolved ⚖️',
            message: garageResolutionMsg,
            data: {
                dispute_id,
                order_id: dispute.order_id,
                order_number: dispute.order_number,
                resolution
            },
            target_role: 'garage'
        });

        io?.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: garageResolutionMsg
        });

        io?.to('operations').emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: `Dispute #${dispute.order_number} resolved by Operations`
        });

        if (resolution === 'refund_approved' && result.return_assignment) {
            io?.to('operations').emit('return_assignment_created', {
                assignment_id: result.return_assignment.assignment_id,
                order_id: dispute.order_id,
                order_number: dispute.order_number,
                notification: `📦 Return pending: Order #${dispute.order_number} needs driver assignment for return to garage`
            });
        }

        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] resolveDispute error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// SUPPORT ESCALATIONS (from Support Dashboard)
// ============================================

export const getEscalations = async (req: AuthRequest, res: Response) => {
    const status = toQueryString(req.query.status);
    const page = req.query.page;
    const limit = req.query.limit;

    try {
        const pool = getReadPool();
        const pageNum = parseBoundedInt(page, 1, 1, 1000000);
        const limitNum = parseBoundedInt(limit, 20, 1, 100);
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '';
        const params: Array<string | number> = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause = `WHERE e.status = $${paramIndex++}`;
            params.push(status);
        }

        const countResult = await pool.query<CountRow>(
            `SELECT COUNT(*) FROM support_escalations e ${whereClause}`,
            params
        );
        const total = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);

        const result = await pool.query<EscalationListRow>(
            `
            SELECT e.*,
                   t.ticket_id, t.subject as ticket_subject, t.status as ticket_status,
                   t.category,
                   COALESCE(o.order_number, o2.order_number) as order_number,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   eu.full_name as escalated_by_name,
                   au.full_name as assigned_to_name
            FROM support_escalations e
            LEFT JOIN support_tickets t ON e.ticket_id = t.ticket_id
            LEFT JOIN orders o ON t.order_id = o.order_id
            LEFT JOIN orders o2 ON e.order_id = o2.order_id
            LEFT JOIN users u ON e.customer_id = u.user_id
            LEFT JOIN users eu ON e.escalated_by = eu.user_id
            LEFT JOIN users au ON e.assigned_to = au.user_id
            ${whereClause}
            ORDER BY 
                CASE WHEN e.priority = 'urgent' THEN 0 WHEN e.priority = 'high' THEN 1 ELSE 2 END,
                e.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `,
            [...params, limitNum, offset]
        );

        res.json({
            escalations: result.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        logControllerError('[OPERATIONS] getEscalations error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const resolveEscalation = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { escalation_id: string };
    const body = req.body as unknown as ResolveEscalationBody;
    const { escalation_id } = params;
    const { resolution_notes, resolution_action } = body;
    const staffId = getUserId(req);

    if (!staffId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const pool = getWritePool();
        const readPool = getReadPool();

        const escalationResult = await readPool.query<EscalationRow>(
            `
            SELECT e.*,
                   t.ticket_id, t.customer_id as ticket_customer_id,
                   COALESCE(o.order_number, o2.order_number) as order_number,
                   COALESCE(o.order_id, o2.order_id, e.order_id) as resolved_order_id,
                   COALESCE(o.customer_id, o2.customer_id, e.customer_id) as customer_id,
                   COALESCE(o.garage_id, o2.garage_id) as garage_id,
                   eu.full_name as escalated_by_name
            FROM support_escalations e
            LEFT JOIN support_tickets t ON e.ticket_id = t.ticket_id
            LEFT JOIN orders o ON t.order_id = o.order_id
            LEFT JOIN orders o2 ON e.order_id = o2.order_id
            LEFT JOIN users eu ON e.escalated_by = eu.user_id
            WHERE e.escalation_id = $1
        `,
            [escalation_id]
        );

        const escalation = escalationResult.rows[0];
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }

        const action: ResolutionAction = isResolutionAction(resolution_action) ? resolution_action : 'acknowledge';
        let actionResult: SupportActionResult | null = null;
        const orderId = escalation.resolved_order_id;
        const customerId = escalation.customer_id;

        if (action !== 'acknowledge' && action !== 'reject' && !orderId) {
            return res.status(400).json({
                error: 'Cannot execute action: no order linked to this escalation'
            });
        }

        switch (action) {
            case 'approve_refund':
                if (!orderId || !customerId) {
                    return res.status(400).json({ error: 'Order and customer required for refund' });
                }
                actionResult = await supportActionsService.executeFullRefund({
                    orderId,
                    customerId,
                    agentId: staffId,
                    reason: resolution_notes ?? `Escalation #${escalation_id} — refund approved by Operations`
                }) as SupportActionResult;

                if (!actionResult.success) {
                    return res.status(400).json({
                        error: actionResult.error ?? 'Refund request failed',
                        details: actionResult.message
                    });
                }
                logger.info('[OPERATIONS] Escalation resolved with REFUND action', {
                    escalation_id,
                    order_id: orderId,
                    refund_id: actionResult.refundId,
                    status: actionResult.status
                });
                break;

            case 'approve_cancellation':
                if (!orderId || !customerId) {
                    return res.status(400).json({ error: 'Order and customer required for cancellation' });
                }
                actionResult = await supportActionsService.executeCancelOrder({
                    orderId,
                    customerId,
                    agentId: staffId,
                    reason: resolution_notes ?? `Escalation #${escalation_id} — cancellation approved by Operations`
                }) as SupportActionResult;

                if (!actionResult.success) {
                    return res.status(400).json({
                        error: actionResult.error ?? 'Cancellation failed',
                        details: actionResult.message
                    });
                }
                logger.info('[OPERATIONS] Escalation resolved with CANCELLATION action', {
                    escalation_id,
                    order_id: orderId,
                    payout_action: actionResult.payoutAction,
                    refund_action: actionResult.refundAction
                });
                break;

            case 'reject':
                logger.info('[OPERATIONS] Escalation REJECTED', {
                    escalation_id,
                    reason: resolution_notes
                });
                break;

            case 'acknowledge':
            default:
                logger.info('[OPERATIONS] Escalation acknowledged (no order action)', {
                    escalation_id
                });
                break;
        }

        const updateResult = await pool.query<EscalationUpdateRow>(
            `
            UPDATE support_escalations 
            SET status = $4,
                resolved_at = NOW(),
                resolved_by = $2,
                resolution_notes = $3,
                resolution_action = $5
            WHERE escalation_id = $1
            RETURNING *
        `,
            [
                escalation_id,
                staffId,
                resolution_notes ?? 'Resolved by Operations',
                action === 'reject' ? 'rejected' : 'resolved',
                action
            ]
        );

        if (escalation.ticket_id) {
            const actionLabels: Record<ResolutionAction, string> = {
                approve_refund: 'Refund Approved — Awaiting Finance approval',
                approve_cancellation: 'Order Cancelled — Refund processed',
                reject: 'Escalation Rejected',
                acknowledge: 'Escalation Acknowledged'
            };

            const actionLabel = actionLabels[action];
            await pool.query(
                `
                INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text, is_internal)
                VALUES ($1, $2, 'admin', $3, false)
            `,
                [
                    escalation.ticket_id,
                    staffId,
                    `Escalation Resolved by Operations\n\nAction: ${actionLabel}\n${resolution_notes ?? 'Your concern has been addressed.'}`
                ]
            );

            if (action !== 'reject') {
                await pool.query(
                    `
                    UPDATE support_tickets 
                    SET status = 'resolved', resolved_at = NOW()
                    WHERE ticket_id = $1 AND status NOT IN ('resolved', 'closed')
                `,
                    [escalation.ticket_id]
                );
            }
        }

        const io = getIO();
        const orderRef = escalation.order_number ? `Order #${escalation.order_number}` : 'your escalated issue';

        const actionMessages: Record<ResolutionAction, string> = {
            approve_refund: `Refund approved for ${orderRef}. Awaiting Finance team processing.`,
            approve_cancellation: `${orderRef} has been cancelled and refund processed.`,
            reject: `Escalation for ${orderRef} was reviewed and rejected.`,
            acknowledge: `Your escalation for ${orderRef} has been resolved by Operations.`
        };

        const notificationMsg = actionMessages[action];

        if (escalation.escalated_by) {
            await createNotification({
                userId: escalation.escalated_by,
                type: 'escalation_resolved',
                title: action === 'reject' ? 'Escalation Rejected' : 'Escalation Resolved',
                message: notificationMsg,
                data: {
                    escalation_id,
                    order_number: escalation.order_number,
                    resolution_action: action,
                    resolution_notes,
                    action_result: actionResult ? {
                        refund_id: actionResult.refundId ?? null,
                        status: actionResult.status ?? null
                    } : null
                },
                target_role: 'operations'
            });

            io?.to(`support_${escalation.escalated_by}`).emit('escalation_resolved', {
                escalation_id,
                order_number: escalation.order_number,
                resolution_notes,
                resolution_action: action,
                action_result: actionResult?.success ? 'executed' : null
            });
        }

        if (escalation.customer_id) {
            const customerMessages: Record<ResolutionAction, string> = {
                approve_refund: `Your refund request for ${orderRef} has been approved and is being processed.`,
                approve_cancellation: `${orderRef} has been cancelled. Your refund will be processed shortly.`,
                reject: `Your issue regarding ${orderRef} has been reviewed by our team.`,
                acknowledge: `Your issue regarding ${orderRef} has been reviewed and resolved by our team.`
            };

            const customerMessage = customerMessages[action];

            await createNotification({
                userId: escalation.customer_id,
                type: 'issue_resolved',
                title: action === 'approve_refund'
                    ? 'Refund Approved'
                    : action === 'approve_cancellation'
                        ? 'Order Cancelled'
                        : 'Issue Resolved',
                message: customerMessage,
                data: { order_number: escalation.order_number },
                target_role: 'customer'
            });

            io?.to(`user_${escalation.customer_id}`).emit('order_update', {
                order_number: escalation.order_number,
                type: 'escalation_resolved',
                resolution_action: action,
                notification: customerMessage
            });
        }

        if (escalation.garage_id) {
            io?.to(`garage_${escalation.garage_id}`).emit('escalation_update', {
                order_number: escalation.order_number,
                type: 'resolved',
                resolution_action: action,
                notification: `Escalation for ${orderRef} has been resolved by Operations.`
            });
        }

        io?.to('operations').emit('escalation_resolved', {
            escalation_id,
            order_number: escalation.order_number,
            resolved_by: staffId,
            resolution_action: action,
            notification: `Escalation ${escalation.order_number ? `for Order #${escalation.order_number}` : escalation_id} resolved (${action})`
        });

        await dashboardService.invalidateCache();

        logger.info('[OPERATIONS] Escalation resolved', {
            escalation_id,
            resolution_action: action,
            order_number: escalation.order_number,
            action_executed: actionResult?.success ?? null,
            customer_notified: !!escalation.customer_id,
            support_notified: !!escalation.escalated_by,
            garage_notified: !!escalation.garage_id
        });

        res.json({
            message: action === 'reject' ? 'Escalation rejected' : 'Escalation resolved',
            resolution_action: action,
            escalation: updateResult.rows[0] ?? null,
            action_result: actionResult ? {
                success: actionResult.success,
                action: actionResult.action ?? action,
                refund_id: actionResult.refundId ?? null,
                refund_status: actionResult.status ?? null,
                payout_action: actionResult.payoutAction ?? null,
                refund_action: actionResult.refundAction ?? null,
                message: actionResult.message ?? null
            } : null,
            notifications_sent: {
                support: !!escalation.escalated_by,
                customer: !!escalation.customer_id,
                garage: !!escalation.garage_id
            }
        });
    } catch (err) {
        logControllerError('[OPERATIONS] resolveEscalation error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// USER MANAGEMENT
// ============================================

export const getUsers = async (req: AuthRequest, res: Response) => {
    const type = toQueryString(req.query.type);
    const search = toQueryString(req.query.search);
    const page = req.query.page;
    const limit = req.query.limit;

    const normalizedType = type === 'customer' || type === 'garage' ? type : undefined;

    try {
        const result = await userService.getUsers({
            type: normalizedType,
            search,
            page: parseOptionalInt(page),
            limit: parseOptionalInt(limit)
        });

        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] getUsers error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const getUserStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await userService.getUserStats();
        res.json({ stats });
    } catch (err) {
        logControllerError('[OPERATIONS] getUserStats error:', err);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
};

export const getUserDetails = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    try {
        const user = await userService.getUserDetails(user_id);
        res.json({ user });
    } catch (err) {
        logControllerError('[OPERATIONS] getUserDetails error:', err);
        res.status(404).json({ error: 'User not found' });
    }
};

export const suspendUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const { reason } = req.body;
    try {
        await userService.suspendUser(user_id, reason || 'Suspended by operations');
        res.json({ success: true, message: 'User suspended' });
    } catch (err) {
        logControllerError('[OPERATIONS] suspendUser error:', err);
        res.status(400).json({ error: 'Failed to suspend user' });
    }
};

export const activateUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    try {
        await userService.activateUser(user_id);
        res.json({ success: true, message: 'User activated' });
    } catch (err) {
        logControllerError('[OPERATIONS] activateUser error:', err);
        res.status(400).json({ error: 'Failed to activate user' });
    }
};

// ============================================
// ORDER CLEANUP (Orphan Management)
// ============================================

export const cancelOrderByOperations = async (req: AuthRequest, res: Response) => {
    const params = req.params as unknown as { order_id: string };
    const body = req.body as unknown as CancelOrderByOperationsBody;
    const { order_id } = params;
    const { reason, refund_type, partial_refund_amount, notify_customer, notify_garage } = body;
    const operationsUserId = getUserId(req);

    if (!operationsUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const normalizedRefundType: 'full' | 'partial' | 'none' =
        refund_type === 'partial' || refund_type === 'none' || refund_type === 'full'
            ? refund_type
            : 'full';

    try {
        const result = await cancellationService.cancelOrderByOperations(
            order_id,
            operationsUserId,
            reason.trim(),
            {
                refund_type: normalizedRefundType,
                partial_refund_amount: toOptionalNumber(partial_refund_amount),
                notify_customer: toOptionalBoolean(notify_customer) ?? true,
                notify_garage: toOptionalBoolean(notify_garage) ?? true
            }
        );

        await dashboardService.invalidateCache();

        emitToOperations('order_cancelled_by_operations', {
            order_id,
            previous_status: result.previous_status,
            refund_processed: result.refund_processed,
            refund_amount: result.refund_amount,
            cancelled_by: operationsUserId,
            reason: reason.trim()
        });

        logger.info('[OPERATIONS] Order cancelled', {
            order_id,
            previous_status: result.previous_status,
            refund_processed: result.refund_processed,
            cancelled_by: operationsUserId
        });

        res.json(result);
    } catch (err) {
        logControllerError('[OPERATIONS] cancelOrder error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getOrphanOrders = async (_req: AuthRequest, res: Response) => {
    try {
        const orphanOrders = await cancellationService.getOrphanOrders();

        res.json({
            orphan_orders: orphanOrders,
            count: orphanOrders.length,
            message: orphanOrders.length > 0
                ? `${orphanOrders.length} orphan order(s) require attention`
                : 'No orphan orders found'
        });
    } catch (err) {
        logControllerError('[OPERATIONS] getOrphanOrders error:', err);
        res.status(500).json({ error: 'Failed to fetch orphan orders' });
    }
};

// ============================================
// AUTO-COMPLETE TRIGGER (for testing)
// ============================================

export const triggerAutoComplete = async (req: AuthRequest, res: Response) => {
    try {
        logger.info('[OPERATIONS] Manual auto-complete triggered by:', { userId: req.user?.userId });

        const result = await runAutoCompleteNow();

        await dashboardService.invalidateCache();

        res.json({
            success: true,
            completed_count: result.completed_count,
            order_numbers: result.order_numbers,
            message: result.completed_count > 0
                ? `Auto-completed ${result.completed_count} order(s): ${result.order_numbers.join(', ')}`
                : 'No orders eligible for auto-completion (must be delivered 48h+ with no open disputes)'
        });
    } catch (err) {
        logControllerError('[OPERATIONS] triggerAutoComplete error:', err);
        res.status(500).json({ error: 'Failed to run auto-complete job' });
    }
};

export const getReturnStats = async (_req: AuthRequest, res: Response) => {
    try {
        const { getReturnService } = await import('../services/cancellation/return.service');
        const returnService = getReturnService(getWritePool());
        const stats = await returnService.getReturnStats();
        res.json({ stats });
    } catch (err) {
        logControllerError('[OPERATIONS] getReturnStats error:', err);
        res.status(500).json({ error: 'Failed to fetch return stats' });
    }
};

export const getGarages = async (req: AuthRequest, res: Response) => {
    // Reusing getUsers with type=garage for simplicity
    req.query.type = 'garage';
    return getUsers(req, res);
};
