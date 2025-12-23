import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { io } from '../server';

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

        // Notify Operations
        io.to('user_operations').emit('new_ticket', {
            ticket: ticket,
            message: messageResult.rows[0]
        });

        res.status(201).json({ ticket: ticket, message: messageResult.rows[0] });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get tickets for current user (or all for operations)
export const getTickets = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        let query = `
            SELECT t.*, 
                   (SELECT message_text FROM chat_messages WHERE ticket_id = t.ticket_id ORDER BY created_at DESC LIMIT 1) as last_message,
                   u.full_name as customer_name
            FROM support_tickets t
            JOIN users u ON t.customer_id = u.user_id
        `;
        const params: any[] = [];

        if (userType === 'customer') {
            query += ` WHERE t.customer_id = $1`;
            params.push(userId);
        } else if (userType === 'admin' || userType === 'operations') {
            // Operations sees all
        } else {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        query += ` ORDER BY t.last_message_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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

            // Real-time notification
            // Notify the room specific to the ticket
            io.to(`ticket_${ticket_id}`).emit('new_message', message);

            // Also notify the other party if not in the room
            const ticketRes = await client.query('SELECT customer_id FROM support_tickets WHERE ticket_id = $1', [ticket_id]);
            const customerId = ticketRes.rows[0].customer_id;

            if (senderType === 'admin') {
                io.to(`user_${customerId}`).emit('support_reply', { ticket_id, message });
            } else {
                io.to('user_operations').emit('support_reply', { ticket_id, message });
            }

            res.json(message);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
