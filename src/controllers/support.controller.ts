import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { getIO } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';
import { SupportService } from '../services/support';

const supportService = new SupportService(pool);

// Create a new support ticket
export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        const result = await supportService.createTicket(req.user!.userId, req.body);

        // Notify Operations
        await createNotification({
            userId: 'operations',
            type: 'new_support_ticket',
            title: 'New Support Ticket 🎫',
            message: `New ticket: ${req.body.subject}`,
            data: { ticket_id: result.ticket.ticket_id, subject: req.body.subject },
            target_role: 'operations'
        });
        getIO()?.to('operations').emit('new_ticket', result);

        res.status(201).json(result);
    } catch (err) {
        console.error('[SUPPORT] createTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get tickets with pagination
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

// Get messages for a ticket
export const getTicketMessages = async (req: AuthRequest, res: Response) => {
    try {
        const access = await supportService.verifyTicketAccess(req.params.ticket_id, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) return res.status(access.customerId ? 403 : 404).json({ error: access.customerId ? 'Unauthorized' : 'Ticket not found' });

        const messages = await supportService.getTicketMessages(req.params.ticket_id);
        res.json(messages);
    } catch (err) {
        console.error('[SUPPORT] getTicketMessages error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Send a message
export const sendMessage = async (req: AuthRequest, res: Response) => {
    const senderType = req.user!.userType === 'customer' ? 'customer' : 'admin';

    try {
        const access = await supportService.verifyTicketAccess(req.params.ticket_id, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) return res.status(404).json({ error: 'Ticket not found' });
        if (req.user!.userType === 'customer' && access.customerId !== req.user!.userId) {
            return res.status(403).json({ error: 'Security violation: Access denied' });
        }

        const message = await supportService.sendMessage(req.params.ticket_id, req.user!.userId, senderType, req.body.message_text);

        // Real-time notifications
        getIO()?.to(`ticket_${req.params.ticket_id}`).emit('new_message', message);

        if (senderType === 'admin') {
            await createNotification({ userId: access.customerId!, type: 'support_reply', title: 'Support Reply 💬', message: 'You have a new reply from support', data: { ticket_id: req.params.ticket_id }, target_role: 'customer' });
            getIO()?.to(`user_${access.customerId}`).emit('support_reply', { ticket_id: req.params.ticket_id, message });
        } else {
            await createNotification({ userId: 'operations', type: 'support_reply', title: 'Customer Reply 💬', message: 'Customer replied to a support ticket', data: { ticket_id: req.params.ticket_id }, target_role: 'operations' });
            getIO()?.to('operations').emit('support_reply', { ticket_id: req.params.ticket_id, message });
        }

        res.json(message);
    } catch (err) {
        console.error('[SUPPORT] sendMessage error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Update ticket status
export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
    try {
        const ticket = await supportService.updateTicketStatus(req.params.ticket_id, req.body.status);
        getIO()?.to(`ticket_${req.params.ticket_id}`).emit('ticket_updated', { status: req.body.status });
        res.json(ticket);
    } catch (err) {
        console.error('[SUPPORT] updateTicketStatus error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Dashboard stats
export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await supportService.getStats();
        res.json(stats);
    } catch (err) {
        console.error('[SUPPORT] getStats error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Urgent items
export const getUrgent = async (req: AuthRequest, res: Response) => {
    try {
        const items = await supportService.getUrgentItems();
        res.json({ items });
    } catch (err) {
        console.error('[SUPPORT] getUrgent error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Recent activity
export const getActivity = async (req: AuthRequest, res: Response) => {
    try {
        const activities = await supportService.getRecentActivity();
        res.json({ activities });
    } catch (err) {
        console.error('[SUPPORT] getActivity error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Ticket detail
export const getTicketDetail = async (req: AuthRequest, res: Response) => {
    try {
        const access = await supportService.verifyTicketAccess(req.params.ticket_id, req.user!.userId, req.user!.userType);
        if (!access.hasAccess) return res.status(access.customerId ? 403 : 404).json({ error: access.customerId ? 'Access denied' : 'Ticket not found' });

        const detail = await supportService.getTicketDetail(req.params.ticket_id);
        if (!detail) return res.status(404).json({ error: 'Ticket not found' });
        res.json(detail);
    } catch (err) {
        console.error('[SUPPORT] getTicketDetail error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// SLA Statistics
export const getSLAStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await supportService.getSLAStats();
        res.json(stats);
    } catch (err) {
        console.error('[SUPPORT] getSLAStats error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Assign ticket to agent
export const assignTicket = async (req: AuthRequest, res: Response) => {
    try {
        const ticket = await supportService.assignTicket(req.params.ticket_id, req.body.assignee_id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        getIO()?.to(`ticket_${req.params.ticket_id}`).emit('ticket_updated', { assigned_to: req.body.assignee_id });
        res.json(ticket);
    } catch (err) {
        console.error('[SUPPORT] assignTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Customer: Reopen a closed ticket (within 7 days)
export const reopenTicket = async (req: AuthRequest, res: Response) => {
    try {
        // Only customers can reopen their own tickets
        if (req.user!.userType !== 'customer') {
            return res.status(403).json({ error: 'Only customers can reopen their tickets' });
        }

        const result = await supportService.reopenTicket(
            req.params.ticket_id,
            req.user!.userId,
            req.body.message
        );

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Notify operations of reopened ticket
        await createNotification({
            userId: 'operations',
            type: 'ticket_reopened',
            title: 'Ticket Reopened 🔄',
            message: `Customer reopened ticket: ${result.ticket.subject}`,
            data: { ticket_id: req.params.ticket_id },
            target_role: 'operations'
        });
        getIO()?.to('operations').emit('ticket_reopened', { ticket_id: req.params.ticket_id, ticket: result.ticket });

        res.json({ message: 'Ticket reopened successfully', ticket: result.ticket });
    } catch (err) {
        console.error('[SUPPORT] reopenTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
