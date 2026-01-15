import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { io } from '../server';
import { createNotification } from '../services/notification.service';

// Create a new support ticket
export const createTicket = async (req: AuthRequest, res: Response) => {
    const { subject, message, priority = 'normal', order_id } = req.body;
    const userId = req.user!.userId;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create main ticket
        const ticketResult = await client.query(`
            INSERT INTO support_tickets (customer_id, subject, priority, order_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, subject, priority, order_id || null]);

        const ticket = ticketResult.rows[0];

        // Create first message
        const messageResult = await client.query(`
            INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text)
            VALUES ($1, $2, 'customer', $3)
            RETURNING *
        `, [ticket.ticket_id, userId, message]);

        await client.query('COMMIT');

        // Notify Operations (Persistent + Socket)
        await createNotification({
            userId: 'operations',
            type: 'new_support_ticket',
            title: 'New Support Ticket 🎫',
            message: `New ticket: ${subject}`,
            data: { ticket_id: ticket.ticket_id, subject },
            target_role: 'operations'
        });

        io.to('operations').emit('new_ticket', {
            ticket: ticket,
            message: messageResult.rows[0]
        });

        res.status(201).json({ ticket: ticket, message: messageResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SUPPORT] createTicket error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get tickets for current user (or all for operations) - with pagination
export const getTickets = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        let whereClause = '';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (userType === 'customer') {
            whereClause = `WHERE t.customer_id = $${paramIndex++}`;
            params.push(userId);
        } else if (userType === 'admin' || userType === 'operations' || userType === 'staff') {
            // Operations sees all - no customer filter
            whereClause = 'WHERE 1=1';
        } else {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (status) {
            whereClause += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }

        // Count query
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM support_tickets t ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limitNum);

        // Main query with pagination
        const query = `
            SELECT t.*, 
                   (SELECT message_text FROM chat_messages WHERE ticket_id = t.ticket_id ORDER BY created_at DESC LIMIT 1) as last_message,
                   u.full_name as customer_name
            FROM support_tickets t
            JOIN users u ON t.customer_id = u.user_id
            ${whereClause}
            ORDER BY t.last_message_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `;

        const result = await pool.query(query, [...params, limitNum, offset]);
        res.json({
            tickets: result.rows,
            pagination: { page: pageNum, limit: limitNum, total, pages: totalPages }
        });
    } catch (err) {
        console.error('[SUPPORT] getTickets error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get messages for a ticket
export const getTicketMessages = async (req: AuthRequest, res: Response) => {
    const { ticket_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        // Verify access
        const ticketCheck = await pool.query(`SELECT customer_id FROM support_tickets WHERE ticket_id = $1`, [ticket_id]);
        if (ticketCheck.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

        if (userType === 'customer' && ticketCheck.rows[0].customer_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await pool.query(`
            SELECT m.*, u.full_name as sender_name
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE m.ticket_id = $1
            ORDER BY m.created_at ASC
        `, [ticket_id]);

        res.json(result.rows);
    } catch (err) {
        console.error('[SUPPORT] getTicketMessages error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Send a message
export const sendMessage = async (req: AuthRequest, res: Response) => {
    const { ticket_id } = req.params;
    const { message_text } = req.body;
    const userId = req.user!.userId;
    const userType = req.user!.userType; // 'customer' or 'admin'

    // Map userType to sender_type
    const senderType = userType === 'customer' ? 'customer' : 'admin';

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify access and get customer info for notification
            const ticketRes = await client.query('SELECT customer_id FROM support_tickets WHERE ticket_id = $1', [ticket_id]);
            if (ticketRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Ticket not found' });
            }

            const customerId = ticketRes.rows[0].customer_id;

            // Security check: Customers can only message their own tickets
            if (userType === 'customer' && customerId !== userId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Security violation: Access denied' });
            }

            const result = await client.query(`
                INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [ticket_id, userId, senderType, message_text]);

            // Update ticket timestamp
            await client.query(`
                UPDATE support_tickets 
                SET last_message_at = NOW(), updated_at = NOW()
                WHERE ticket_id = $1
            `, [ticket_id]);

            await client.query('COMMIT');

            const message = result.rows[0];

            // Real-time notification (Persistent + Socket)
            io.to(`ticket_${ticket_id}`).emit('new_message', message);

            if (senderType === 'admin') {
                // Notify customer of admin reply (Persistent)
                await createNotification({
                    userId: customerId,
                    type: 'support_reply',
                    title: 'Support Reply 💬',
                    message: 'You have a new reply from support',
                    data: { ticket_id },
                    target_role: 'customer'
                });
                io.to(`user_${customerId}`).emit('support_reply', { ticket_id, message });
            } else {
                // Notify operations of customer message (Persistent)
                await createNotification({
                    userId: 'operations',
                    type: 'support_reply',
                    title: 'Customer Reply 💬',
                    message: 'Customer replied to a support ticket',
                    data: { ticket_id },
                    target_role: 'operations'
                });
                io.to('operations').emit('support_reply', { ticket_id, message });
            }

            res.json(message);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[SUPPORT] sendMessage error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Update ticket status (Admin only)
export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
    const { ticket_id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(`
            UPDATE support_tickets 
            SET status = $1, updated_at = NOW()
            WHERE ticket_id = $2
            RETURNING *
        `, [status, ticket_id]);

        const ticket = result.rows[0];

        io.to(`ticket_${ticket_id}`).emit('ticket_updated', { status });

        res.json(ticket);
    } catch (err) {
        console.error('[SUPPORT] updateTicketStatus error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ==========================================
// SUPPORT DASHBOARD ENDPOINTS
// ==========================================

// Get support stats for dashboard overview
export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
                COUNT(*) FILTER (WHERE status = 'resolved' AND DATE(updated_at) = CURRENT_DATE) as resolved_today
            FROM support_tickets
        `);

        const disputeResult = await pool.query(`
            SELECT COUNT(*) as order_disputes 
            FROM order_disputes WHERE status = 'pending'
        `);

        const paymentDisputeResult = await pool.query(`
            SELECT COUNT(*) as payment_disputes 
            FROM garage_payouts WHERE status = 'disputed'
        `);

        const reviewResult = await pool.query(`
            SELECT COUNT(*) as pending_reviews 
            FROM reviews WHERE status = 'pending'
        `);

        const stats = statsResult.rows[0];

        res.json({
            open_tickets: parseInt(stats.open_tickets) || 0,
            in_progress_tickets: parseInt(stats.in_progress_tickets) || 0,
            resolved_today: parseInt(stats.resolved_today) || 0,
            order_disputes: parseInt(disputeResult.rows[0]?.order_disputes) || 0,
            payment_disputes: parseInt(paymentDisputeResult.rows[0]?.payment_disputes) || 0,
            pending_reviews: parseInt(reviewResult.rows[0]?.pending_reviews) || 0
        });
    } catch (err) {
        console.error('[SUPPORT] getStats error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get urgent items requiring immediate action
export const getUrgent = async (req: AuthRequest, res: Response) => {
    try {
        // Get tickets open for more than 24 hours
        const urgentTickets = await pool.query(`
            SELECT 
                ticket_id as id,
                'ticket' as type,
                subject as title,
                created_at
            FROM support_tickets
            WHERE status = 'open'
              AND created_at < NOW() - INTERVAL '24 hours'
            ORDER BY created_at ASC
            LIMIT 5
        `);

        // Get escalated disputes
        const urgentDisputes = await pool.query(`
            SELECT 
                dispute_id as id,
                'dispute' as type,
                reason as title,
                created_at
            FROM order_disputes
            WHERE status = 'pending'
              AND created_at < NOW() - INTERVAL '48 hours'
            ORDER BY created_at ASC
            LIMIT 5
        `);

        const items = [
            ...urgentTickets.rows,
            ...urgentDisputes.rows
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        res.json({ items });
    } catch (err) {
        console.error('[SUPPORT] getUrgent error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get recent activity for dashboard
export const getActivity = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.ticket_id,
                'ticket' as type,
                t.subject,
                t.status,
                t.created_at,
                u.full_name as customer_name
            FROM support_tickets t
            JOIN users u ON t.customer_id = u.user_id
            ORDER BY t.last_message_at DESC
            LIMIT 10
        `);

        res.json({ activities: result.rows });
    } catch (err) {
        console.error('[SUPPORT] getActivity error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get single ticket with full details
export const getTicketDetail = async (req: AuthRequest, res: Response) => {
    const { ticket_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        // Get ticket
        const ticketResult = await pool.query(`
            SELECT t.*, u.full_name as customer_name, o.order_number
            FROM support_tickets t
            JOIN users u ON t.customer_id = u.user_id
            LEFT JOIN orders o ON t.order_id = o.order_id
            WHERE t.ticket_id = $1
        `, [ticket_id]);

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticket = ticketResult.rows[0];

        // Security check for customers
        if (userType === 'customer' && ticket.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get messages
        const messagesResult = await pool.query(`
            SELECT m.*, u.full_name as sender_name
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE m.ticket_id = $1
            ORDER BY m.created_at ASC
        `, [ticket_id]);

        res.json({
            ticket,
            messages: messagesResult.rows
        });
    } catch (err) {
        console.error('[SUPPORT] getTicketDetail error:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
