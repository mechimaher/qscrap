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
import { getIO } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';
import { SupportService } from '../services/support';
import { SupportActionsService } from '../services/support/support-actions.service';

const supportService = new SupportService(pool);
const supportActionsService = new SupportActionsService(pool);

// Helper: Check if user is agent (admin/operations/support/cs_admin)
const requireAgent = (req: AuthRequest) => {
    const allowed = ['admin', 'superadmin', 'operations', 'cs_admin', 'support', 'staff'];
    if (!allowed.includes(req.user!.userType)) {
        throw new Error('Agent access required');
    }
};

// ==========================================
// CORE TICKET ENDPOINTS
// ==========================================

export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        const result = await supportService.createTicket(req.user!.userId, req.body);

        await createNotification({
            userId: 'operations',
            type: 'new_support_ticket',
            title: 'New Support Ticket 🎫',
            message: `New ticket: ${req.body.subject}`,
            data: { ticket_id: result.ticket.ticket_id },
            target_role: 'operations'
        });
        getIO()?.to('operations').emit('new_ticket', result);

        res.status(201).json(result);
    } catch (err) {
        console.error('[SUPPORT] createTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
    try {
        const result = await supportService.getTickets({
            userId: req.user!.userId,
            userType: req.user!.userType,
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
            status: req.query.status as string
        });
        res.json(result);
    } catch (err) {
        console.error('[SUPPORT] getTickets error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getTicketMessages = async (req: AuthRequest, res: Response) => {
    try {
        const { ticketId } = req.params;

        const access = await supportService.verifyTicketAccess(ticketId, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await supportService.getTicketMessages(ticketId, req.user!.userType);
        res.json(messages);
    } catch (err) {
        console.error('[SUPPORT] getTicketMessages error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { ticketId } = req.params;
        const { message_text, attachments, is_internal } = req.body;

        const access = await supportService.verifyTicketAccess(ticketId, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const senderType = req.user!.userType === 'customer' ? 'customer' : 'admin';

        let message;
        if (is_internal && senderType === 'admin') {
            // Internal note
            message = await supportService.addInternalNote(ticketId, req.user!.userId, message_text);
        } else {
            message = await supportService.sendMessage(
                ticketId,
                req.user!.userId,
                senderType,
                message_text,
                attachments
            );
        }

        // Real-time broadcast
        getIO()?.to(`ticket_${ticketId}`).emit('new_message', message);

        // Notifications
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
        console.error('[SUPPORT] sendMessage error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const ticket = await supportService.updateTicketStatus(req.params.ticketId, req.body.status);
        getIO()?.to(`ticket_${req.params.ticketId}`).emit('ticket_updated', { status: req.body.status });
        res.json(ticket);
    } catch (err: any) {
        console.error('[SUPPORT] updateTicketStatus error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
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
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getMyEscalations = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const agentId = req.user!.userId;
        const status = req.query.status as string || 'all';

        const result = await pool.query(`
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
        `, status !== 'all' ? [agentId, status] : [agentId]);

        res.json({
            escalations: result.rows,
            count: result.rows.length,
            pending_count: result.rows.filter((e: any) => e.status === 'pending').length,
            resolved_count: result.rows.filter((e: any) => e.status === 'resolved').length
        });
    } catch (err: any) {
        console.error('[SUPPORT] getMyEscalations error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getUrgent = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const items = await supportService.getUrgentItems();
        res.json({ items });
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getActivity = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const activities = await supportService.getRecentActivity();
        res.json({ activities });
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getTicketDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { ticketId } = req.params;

        // Allow agents OR the ticket owner to view
        const access = await supportService.verifyTicketAccess(ticketId, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const detail = await supportService.getTicketDetail(ticketId);
        if (!detail) return res.status(404).json({ error: 'Ticket not found' });
        res.json(detail);
    } catch (err: any) {
        console.error('[SUPPORT] getTicketDetail error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getSLAStats = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const stats = await supportService.getSLAStats();
        res.json(stats);
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const assignTicket = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const ticket = await supportService.assignTicket(req.params.ticketId, req.body.assignee_id);
        getIO()?.to(`ticket_${req.params.ticketId}`).emit('ticket_assigned', { assigned_to: req.body.assignee_id });
        res.json(ticket);
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const reopenTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user!.userType !== 'customer') {
            return res.status(403).json({ error: 'Only customers can reopen tickets' });
        }

        const result = await supportService.reopenTicket(req.params.ticketId, req.user!.userId, req.body.message);
        if (!result.success) return res.status(400).json({ error: result.error });

        getIO()?.to('operations').emit('ticket_reopened', result.ticket);
        res.json(result);
    } catch (err) {
        console.error('[SUPPORT] reopenTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ==========================================
// RESOLUTION CENTER ENDPOINTS
// ==========================================

export const getCustomer360 = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const query = (req.params.query || req.query.q) as string;
        if (!query) return res.status(400).json({ error: 'Search query required' });

        const result = await supportService.getCustomer360(query);
        if (!result) return res.status(404).json({ error: 'Customer not found' });

        res.json(result);
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const addCustomerNote = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const { customer_id, note_text } = req.body;
        if (!customer_id || !note_text) return res.status(400).json({ error: 'Missing required fields' });

        const note = await supportService.addCustomerNote(customer_id, req.user!.userId, note_text);
        res.status(201).json(note);
    } catch (err: any) {
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const executeQuickAction = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const { order_id, customer_id, action_type, action_details, notes } = req.body;
        if (!customer_id || !action_type) return res.status(400).json({ error: 'customer_id and action_type required' });

        let result;

        // Prefer SupportActionsService for actions with real business logic
        switch (action_type) {
            case 'full_refund':
                if (!order_id) return res.status(400).json({ error: 'order_id required for refund' });
                result = await supportActionsService.executeFullRefund({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: req.user!.userId,
                    reason: notes || 'Quick action from resolution center'
                });
                break;

            case 'cancel_order':
                if (!order_id) return res.status(400).json({ error: 'order_id required for cancel' });
                result = await supportActionsService.executeCancelOrder({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: req.user!.userId,
                    reason: notes || 'Quick action from resolution center'
                });
                break;

            case 'reassign_driver':
                if (!order_id) return res.status(400).json({ error: 'order_id required for reassign' });
                result = await supportActionsService.executeReassignDriver({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: req.user!.userId,
                    reason: notes || 'Quick action from resolution center'
                });
                break;

            case 'escalate_to_ops':
                if (!order_id) return res.status(400).json({ error: 'order_id required for escalation' });
                result = await supportActionsService.executeEscalateToOps({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: req.user!.userId,
                    reason: notes || 'Quick action from resolution center',
                    priority: action_details?.priority || 'normal'
                });
                break;

            default:
                // Fallback for logging-only actions
                result = await supportService.executeQuickAction({
                    orderId: order_id,
                    customerId: customer_id,
                    agentId: req.user!.userId,
                    actionType: action_type,
                    actionDetails: action_details,
                    notes
                });
        }

        if (!result.success) return res.status(400).json({ error: result.error, message: (result as any).message || result.error });

        getIO()?.to('operations').emit('resolution_action', { action_type, customer_id, order_id, result });
        getIO()?.to(`user_${customer_id}`).emit('order_updated', { order_id });

        res.json(result);
    } catch (err: any) {
        console.error('[SUPPORT] executeQuickAction error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getResolutionLogs = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const logs = await supportService.getResolutionLogs({
            orderId: req.query.order_id as string,
            customerId: req.query.customer_id as string
        });
        res.json({ logs });
    } catch (err: any) {
        console.error('[SUPPORT] getResolutionLogs error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const createTicketForCustomer = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const { customer_id, subject, message, order_id, category, priority, subcategory } = req.body;
        if (!customer_id || !subject || !message) return res.status(400).json({ error: 'Missing required fields' });

        const result = await supportService.createTicket(customer_id, {
            subject,
            message,
            order_id,
            category,
            subcategory,
            priority,
            requester_type: 'customer'
        });

        getIO()?.to('operations').emit('new_ticket', result);
        res.status(201).json(result);
    } catch (err: any) {
        console.error('[SUPPORT] createTicketForCustomer error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const getCannedResponses = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const responses = await supportService.getCannedResponses(req.query.category as string);
        res.json(responses);
    } catch (err: any) {
        console.error('[SUPPORT] getCannedResponses error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

export const grantGoodwillCredit = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const { customer_id, amount, reason, ticket_id, order_id, expires_in_days = 90 } = req.body;
        if (!customer_id || !amount || !reason) return res.status(400).json({ error: 'Missing required fields' });

        const result = await supportService.grantGoodwillCredit({
            customerId: customer_id,
            amount,
            reason,
            grantedBy: req.user!.userId,
            ticketId: ticket_id,
            orderId: order_id,
            expiresInDays: expires_in_days
        });

        getIO()?.to(`user_${customer_id}`).emit('goodwill_credit', result);
        res.json(result);
    } catch (err: any) {
        console.error('[SUPPORT] grantGoodwillCredit error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get full order details for support - includes all fields, images, timeline
 * Support agents need this to make informed decisions
 */
export const getOrderDetailsForSupport = async (req: AuthRequest, res: Response) => {
    try {
        requireAgent(req);
        const { order_id } = req.params;

        if (!order_id) {
            return res.status(400).json({ error: 'order_id required' });
        }

        // Get full order details with all related data
        // o.* already includes part_price, delivery_fee, total_amount from orders table
        const result = await pool.query(`
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
                r.rating, r.review_text, r.created_at as review_date,
                cr.reason_code, cr.reason_text as cancellation_reason, 
                cr.refund_percentage, cr.cancelled_at, cr.cancelled_by_role
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

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = result.rows[0];

        // Get status history timeline
        const historyResult = await pool.query(`
            SELECT status, notes, created_at, changed_by
            FROM order_status_history 
            WHERE order_id = $1 
            ORDER BY created_at ASC
        `, [order_id]);

        // Get payout info if exists
        const payoutResult = await pool.query(`
            SELECT payout_id, payout_status, gross_amount, commission_amount, net_amount,
                   created_at, paid_at, payment_method, payment_reference
            FROM garage_payouts 
            WHERE order_id = $1
        `, [order_id]);

        // Get refund info if exists
        const refundResult = await pool.query(`
            SELECT refund_id, amount, status, reason, created_at, processed_at
            FROM refunds 
            WHERE order_id = $1
        `, [order_id]);

        // Get related tickets
        const ticketsResult = await pool.query(`
            SELECT ticket_id, subject, status, priority, created_at
            FROM support_tickets 
            WHERE order_id = $1 
            ORDER BY created_at DESC
        `, [order_id]);

        res.json({
            success: true,
            order,
            status_history: historyResult.rows,
            payout: payoutResult.rows[0] || null,
            refund: refundResult.rows[0] || null,
            tickets: ticketsResult.rows
        });
    } catch (err: any) {
        console.error('[SUPPORT] getOrderDetailsForSupport error:', getErrorMessage(err));
        res.status(err.message === 'Agent access required' ? 403 : 500).json({ error: getErrorMessage(err) });
    }
};
