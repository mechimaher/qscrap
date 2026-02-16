/**
 * Support Controller - Cleaned & Production-Ready Version
 *
 * Key Fixes & Improvements:
 * - Removed duplicate getTicketMessages
 * - Fixed param mismatches (sendMessage now passes correct args)
 * - Added consistent access control (admin/operations only for agent actions)
 * - Standardized error handling & logging
 * - Added missing endpoints with proper auth checks
 * - Routed all financial/order actions through SupportActionsService where possible
 * - Added real-time emits for all customer-facing changes
 * - Added canned responses & goodwill credit endpoints
 * - Internal notes handled via new addInternalNote method
 * - createTicketForCustomer now properly sets requester_type and calculates SLA
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';
import { SupportService } from '../services/support';
import { SupportActionsService } from '../services/support/support-actions.service';

const supportService = new SupportService(pool);
const supportActionsService = new SupportActionsService(pool);

const AGENT_ROLES = ['admin', 'superadmin', 'operations', 'cs_admin', 'support', 'staff'] as const;

class AgentAccessError extends Error {
    constructor(message = 'Agent access required') {
        super(message);
        this.name = 'AgentAccessError';
    }
}

interface AuthUser {
    userId: string;
    userType: string;
}

interface TicketAccessResult {
    hasAccess: boolean;
    customerId?: string;
}

interface CreateTicketBody {
    subject?: string;
    message?: string;
    priority?: string;
    category?: string;
    subcategory?: string;
    order_id?: string;
    attachments?: unknown;
}

interface SendMessageBody {
    message_text?: string;
    attachments?: unknown;
    is_internal?: boolean;
}

interface UpdateTicketStatusBody {
    status?: string;
}

interface AssignTicketBody {
    assignee_id?: string;
}

interface ReopenTicketBody {
    message?: string;
}

interface CustomerNoteBody {
    customer_id?: string;
    note_text?: string;
}

interface QuickActionBody {
    order_id?: string;
    customer_id?: string;
    action_type?: string;
    action_details?: Record<string, unknown>;
    notes?: string;
}

interface CreateTicketForCustomerBody {
    customer_id?: string;
    subject?: string;
    message?: string;
    order_id?: string;
    category?: string;
    subcategory?: string;
    priority?: string;
}

interface GoodwillCreditBody {
    customer_id?: string;
    amount?: number | string;
    reason?: string;
    ticket_id?: string;
    order_id?: string;
    expires_in_days?: number | string;
}

interface ReopenTicketResult {
    success: boolean;
    ticket?: Record<string, unknown>;
    error?: string;
}

interface SupportActionResult {
    success: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
}

interface CreateTicketResult {
    ticket: {
        ticket_id: string;
        [key: string]: unknown;
    };
    message: Record<string, unknown>;
}

interface EscalationRow extends Record<string, unknown> {
    status: string;
}

type JsonRecord = Record<string, unknown>;

const getAuthenticatedUser = (req: AuthRequest): AuthUser | null => {
    if (!req.user?.userId || !req.user.userType) {
        return null;
    }
    return {
        userId: req.user.userId,
        userType: req.user.userType
    };
};

const requireAgent = (req: AuthRequest): AuthUser => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        throw new AgentAccessError('Authentication required');
    }
    if (!AGENT_ROLES.includes(user.userType as (typeof AGENT_ROLES)[number])) {
        throw new AgentAccessError();
    }
    return user;
};

const isAgentAccessError = (error: unknown): error is AgentAccessError =>
    error instanceof AgentAccessError;

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

const toStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const normalized = value.filter((item): item is string => typeof item === 'string');
    return normalized.length > 0 ? normalized : [];
};

const toEscalationPriority = (value: unknown): 'normal' | 'high' | 'urgent' => {
    if (value === 'high' || value === 'urgent' || value === 'normal') {
        return value;
    }
    return 'normal';
};

const logError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

const respondAgentError = (res: Response, error: unknown): Response => {
    const status = isAgentAccessError(error) ? 403 : 500;
    return res.status(status).json({ error: getErrorMessage(error) });
};

// ==========================================
// CORE TICKET ENDPOINTS
// ==========================================

export const createTicket = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as CreateTicketBody;
        if (!body.subject || !body.message) {
            return res.status(400).json({ error: 'subject and message are required' });
        }

        const result = await supportService.createTicket(user.userId, {
            subject: body.subject,
            message: body.message,
            priority: body.priority,
            category: body.category,
            subcategory: body.subcategory,
            order_id: body.order_id,
            attachments: toStringArray(body.attachments)
        }) as unknown as CreateTicketResult;

        await createNotification({
            userId: 'operations',
            type: 'new_support_ticket',
            title: 'New Support Ticket 🎫',
            message: `New ticket: ${body.subject}`,
            data: { ticket_id: result.ticket.ticket_id },
            target_role: 'operations'
        });

        getIO()?.to('operations').emit('new_ticket', result);
        res.status(201).json(result);
    } catch (err) {
        logError('createTicket error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await supportService.getTickets({
            userId: user.userId,
            userType: user.userType,
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit),
            status: toQueryString(req.query.status)
        });
        res.json(result);
    } catch (err) {
        logError('getTickets error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getTicketMessages = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const params = req.params as unknown as { ticketId: string };
        const { ticketId } = params;

        const access = await supportService.verifyTicketAccess(ticketId, user.userId, user.userType) as TicketAccessResult;
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await supportService.getTicketMessages(ticketId, user.userType) as unknown as JsonRecord[];
        res.json(messages);
    } catch (err) {
        logError('getTicketMessages error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const params = req.params as unknown as { ticketId: string };
        const body = req.body as unknown as SendMessageBody;
        const { ticketId } = params;
        const { message_text, is_internal } = body;

        if (!message_text || !message_text.trim()) {
            return res.status(400).json({ error: 'message_text is required' });
        }

        const access = await supportService.verifyTicketAccess(ticketId, user.userId, user.userType) as TicketAccessResult;
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const senderType = user.userType === 'customer' ? 'customer' : 'admin';
        const attachments = toStringArray(body.attachments);

        const message = is_internal && senderType === 'admin'
            ? await supportService.addInternalNote(ticketId, user.userId, message_text.trim()) as unknown as JsonRecord
            : await supportService.sendMessage(
                ticketId,
                user.userId,
                senderType,
                message_text.trim(),
                attachments
            ) as unknown as JsonRecord;

        getIO()?.to(`ticket_${ticketId}`).emit('new_message', message);

        if (senderType === 'admin' && access.customerId) {
            await createNotification({
                userId: access.customerId,
                type: 'support_reply',
                title: 'Support Reply 💬',
                message: 'You have a new message from support',
                data: { ticket_id: ticketId },
                target_role: 'customer'
            });
        }

        res.json(message);
    } catch (err) {
        logError('sendMessage error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);

        const params = req.params as unknown as { ticketId: string };
        const body = req.body as unknown as UpdateTicketStatusBody;
        if (!body.status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const ticket = await supportService.updateTicketStatus(params.ticketId, body.status) as unknown as JsonRecord;
        getIO()?.to(`ticket_${params.ticketId}`).emit('ticket_updated', { status: body.status });
        res.json(ticket);
    } catch (err) {
        logError('updateTicketStatus error', err);
        return respondAgentError(res, err);
    }
};

// ==========================================
// DASHBOARD ENDPOINTS
// ==========================================

export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const stats = await supportService.getStats();
        res.json(stats);
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const getMyEscalations = async (req: AuthRequest, res: Response) => {
    try {
        const agent = requireAgent(req);
        const status = toQueryString(req.query.status) || 'all';

        const queryParams = status !== 'all'
            ? [agent.userId, status]
            : [agent.userId];

        const result = await pool.query<EscalationRow>(`
            SELECT e.escalation_id, e.order_id, e.ticket_id, e.priority, e.reason,
                   e.status, e.created_at, e.resolved_at, e.resolution_notes, e.resolution_action,
                   o.order_number,
                   u.full_name as customer_name,
                   CASE 
                       WHEN e.status = 'pending' THEN 'Awaiting Operations Review'
                       WHEN e.status = 'in_progress' THEN 'Under Review by Ops'
                       WHEN e.status = 'resolved' THEN 'Resolved'
                       ELSE e.status
                   END as status_label
            FROM support_escalations e
            LEFT JOIN orders o ON e.order_id = o.order_id
            LEFT JOIN users u ON o.customer_id = u.user_id
            WHERE e.escalated_by = $1
            ${status !== 'all' ? 'AND e.status = $2' : ''}
            ORDER BY e.created_at DESC
            LIMIT 50
        `, queryParams);

        res.json({
            escalations: result.rows,
            count: result.rows.length,
            pending_count: result.rows.filter((item) => item.status === 'pending').length,
            resolved_count: result.rows.filter((item) => item.status === 'resolved').length
        });
    } catch (err) {
        logError('getMyEscalations error', err);
        return respondAgentError(res, err);
    }
};

export const getUrgent = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const items = await supportService.getUrgentItems();
        res.json({ items });
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const getActivity = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const activities = await supportService.getRecentActivity();
        res.json({ activities });
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const getTicketDetail = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const params = req.params as unknown as { ticketId: string };
        const { ticketId } = params;

        const access = await supportService.verifyTicketAccess(ticketId, user.userId, user.userType) as TicketAccessResult;
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const detail = await supportService.getTicketDetail(ticketId) as unknown as {
            ticket: JsonRecord;
            messages: JsonRecord[];
        } | null;

        if (!detail) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(detail);
    } catch (err) {
        logError('getTicketDetail error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getSLAStats = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const stats = await supportService.getSLAStats() as unknown as JsonRecord;
        res.json(stats);
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const assignTicket = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);

        const params = req.params as unknown as { ticketId: string };
        const body = req.body as unknown as AssignTicketBody;
        if (!body.assignee_id) {
            return res.status(400).json({ error: 'assignee_id is required' });
        }

        const ticket = await supportService.assignTicket(params.ticketId, body.assignee_id) as unknown as JsonRecord;
        getIO()?.to(`ticket_${params.ticketId}`).emit('ticket_assigned', { assigned_to: body.assignee_id });
        res.json(ticket);
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const reopenTicket = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        if (user.userType !== 'customer') {
            return res.status(403).json({ error: 'Only customers can reopen tickets' });
        }

        const params = req.params as unknown as { ticketId: string };
        const body = req.body as unknown as ReopenTicketBody;
        const result = await supportService.reopenTicket(
            params.ticketId,
            user.userId,
            body.message
        ) as unknown as ReopenTicketResult;

        if (!result.success) {
            return res.status(400).json({ error: result.error ?? 'Failed to reopen ticket' });
        }

        getIO()?.to('operations').emit('ticket_reopened', result.ticket ?? null);
        res.json(result);
    } catch (err) {
        logError('reopenTicket error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ==========================================
// RESOLUTION CENTER ENDPOINTS
// ==========================================

export const getCustomer360 = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);

        const paramQuery = (req.params as unknown as { query?: string }).query;
        const query = paramQuery || toQueryString(req.query.q);

        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const result = await supportService.getCustomer360(query) as unknown as JsonRecord | null;
        if (!result) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json(result);
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const addCustomerNote = async (req: AuthRequest, res: Response) => {
    try {
        const agent = requireAgent(req);
        const body = req.body as unknown as CustomerNoteBody;

        if (!body.customer_id || !body.note_text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const note = await supportService.addCustomerNote(
            body.customer_id,
            agent.userId,
            body.note_text
        ) as unknown as JsonRecord;

        res.status(201).json(note);
    } catch (err) {
        return respondAgentError(res, err);
    }
};

export const executeQuickAction = async (req: AuthRequest, res: Response) => {
    try {
        const agent = requireAgent(req);
        const body = req.body as unknown as QuickActionBody;
        const { order_id, customer_id, action_type, action_details, notes } = body;

        if (!customer_id || !action_type) {
            return res.status(400).json({ error: 'customer_id and action_type required' });
        }

        let result: SupportActionResult;

        switch (action_type) {
            case 'full_refund':
                if (!order_id) {
                    return res.status(400).json({ error: 'order_id required for refund' });
                }
                result = await supportActionsService.executeFullRefund({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: agent.userId,
                    reason: notes || 'Quick action from resolution center'
                }) as unknown as SupportActionResult;
                break;

            case 'cancel_order':
                if (!order_id) {
                    return res.status(400).json({ error: 'order_id required for cancel' });
                }
                result = await supportActionsService.executeCancelOrder({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: agent.userId,
                    reason: notes || 'Quick action from resolution center'
                }) as unknown as SupportActionResult;
                break;

            case 'reassign_driver':
                if (!order_id) {
                    return res.status(400).json({ error: 'order_id required for reassign' });
                }
                result = await supportActionsService.executeReassignDriver({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: agent.userId,
                    reason: notes || 'Quick action from resolution center'
                }) as unknown as SupportActionResult;
                break;

            case 'escalate_to_ops': {
                if (!order_id) {
                    return res.status(400).json({ error: 'order_id required for escalation' });
                }

                const priority = toEscalationPriority(action_details?.priority);

                result = await supportActionsService.executeEscalateToOps({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: agent.userId,
                    reason: notes || 'Quick action from resolution center',
                    priority
                }) as unknown as SupportActionResult;
                break;
            }

            default:
                result = await supportService.executeQuickAction({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: agent.userId,
                    actionType: action_type,
                    actionDetails: action_details,
                    notes
                }) as unknown as SupportActionResult;
        }

        if (!result.success) {
            return res.status(400).json({
                error: result.error || 'Action failed',
                message: result.message || result.error || 'Action failed'
            });
        }

        getIO()?.to('operations').emit('resolution_action', {
            action_type,
            customer_id,
            order_id,
            result
        });

        getIO()?.to(`user_${customer_id}`).emit('order_updated', { order_id });

        res.json(result);
    } catch (err) {
        logError('executeQuickAction error', err);
        return respondAgentError(res, err);
    }
};

export const getResolutionLogs = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const logs = await supportService.getResolutionLogs({
            orderId: toQueryString(req.query.order_id),
            customerId: toQueryString(req.query.customer_id)
        }) as unknown as JsonRecord[];

        res.json({ logs });
    } catch (err) {
        logError('getResolutionLogs error', err);
        return respondAgentError(res, err);
    }
};

export const createTicketForCustomer = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const body = req.body as unknown as CreateTicketForCustomerBody;
        const { customer_id, subject, message, order_id, category, priority, subcategory } = body;

        if (!customer_id || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await supportService.createTicket(customer_id, {
            subject,
            message,
            order_id,
            category,
            subcategory,
            priority,
            requester_type: 'customer'
        }) as unknown as CreateTicketResult;

        getIO()?.to('operations').emit('new_ticket', result);
        res.status(201).json(result);
    } catch (err) {
        logError('createTicketForCustomer error', err);
        return respondAgentError(res, err);
    }
};

export const getCannedResponses = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const responses = await supportService.getCannedResponses(
            toQueryString(req.query.category)
        ) as unknown as JsonRecord[];

        res.json(responses);
    } catch (err) {
        logError('getCannedResponses error', err);
        return respondAgentError(res, err);
    }
};

export const grantGoodwillCredit = async (req: AuthRequest, res: Response) => {
    try {
        const agent = requireAgent(req);
        const body = req.body as unknown as GoodwillCreditBody;
        const amount = toOptionalNumber(body.amount);
        const expiresInDays = toOptionalInt(body.expires_in_days) || 90;

        if (!body.customer_id || amount === undefined || !body.reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await supportService.grantGoodwillCredit({
            customerId: body.customer_id,
            amount,
            reason: body.reason,
            grantedBy: agent.userId,
            ticketId: body.ticket_id,
            orderId: body.order_id,
            expiresInDays
        }) as unknown as JsonRecord;

        getIO()?.to(`user_${body.customer_id}`).emit('goodwill_credit', result);
        res.json(result);
    } catch (err) {
        logError('grantGoodwillCredit error', err);
        return respondAgentError(res, err);
    }
};

/**
 * Get full order details for support - includes all fields, images, timeline
 * Support agents need this to make informed decisions
 */
export const getOrderDetailsForSupport = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const params = req.params as unknown as { order_id?: string };
        const { order_id } = params;

        if (!order_id) {
            return res.status(400).json({ error: 'order_id required' });
        }

        const orderResult = await pool.query<JsonRecord>(`
            SELECT 
                o.*,
                o.pod_photo_url,
                pr.car_make, pr.car_model, pr.car_year,
                pr.part_description, pr.part_category, pr.part_subcategory,
                pr.image_urls as request_images,
                pr.delivery_lat::float as delivery_lat,
                pr.delivery_lng::float as delivery_lng,
                b.warranty_days, b.part_condition, b.brand_name,
                b.image_urls as bid_images, b.notes as bid_notes,
                g.garage_name, g.phone_number as garage_phone, g.address as garage_address,
                g.rating_average as garage_rating, g.rating_count as garage_rating_count,
                g.subscription_plan as garage_plan,
                u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                u.created_at as customer_since,
                d.full_name as driver_name, d.phone as driver_phone,
                d.vehicle_type, d.vehicle_plate,
                d.current_lat::float as driver_lat, d.current_lng::float as driver_lng,
                da.status as delivery_status, da.estimated_delivery,
                da.pickup_at, da.delivered_at, da.created_at as delivery_assigned_at,
                r.overall_rating, r.review_text, r.created_at as review_date,
                cr.reason_code, cr.reason_text as cancellation_reason,
                cr.refund_amount, cr.cancellation_fee_rate as refund_percentage,
                cr.requested_by_type as cancelled_by_role, cr.created_at as cancelled_at
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN bids b ON o.bid_id = b.bid_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            LEFT JOIN order_reviews r ON o.order_id = r.order_id
            LEFT JOIN cancellation_requests cr ON o.order_id = cr.order_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const historyResult = await pool.query<JsonRecord>(`
            SELECT new_status as status, old_status, reason as notes, created_at, changed_by
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [order_id]);

        const payoutResult = await pool.query<JsonRecord>(`
            SELECT payout_id, payout_status, gross_amount, commission_amount, net_amount,
                   created_at, sent_at, confirmed_at, notes
            FROM garage_payouts
            WHERE order_id = $1
        `, [order_id]);

        const refundResult = await pool.query<JsonRecord>(`
            SELECT refund_id, refund_amount, refund_status, refund_reason, original_amount, fee_retained, created_at
            FROM refunds
            WHERE order_id = $1
        `, [order_id]);

        const ticketsResult = await pool.query<JsonRecord>(`
            SELECT ticket_id, subject, status, priority, created_at
            FROM support_tickets
            WHERE order_id = $1
            ORDER BY created_at DESC
        `, [order_id]);

        res.json({
            success: true,
            order: orderResult.rows[0],
            status_history: historyResult.rows,
            payout: payoutResult.rows[0] || null,
            refund: refundResult.rows[0] || null,
            tickets: ticketsResult.rows
        });
    } catch (err) {
        logError('getOrderDetailsForSupport error', err);
        return respondAgentError(res, err);
    }
};
