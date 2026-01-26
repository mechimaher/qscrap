/**
 * Support Service
 * Handles support tickets, messages, dashboard stats, and urgent items
 */
import { Pool, PoolClient } from 'pg';

export class SupportService {
    constructor(private pool: Pool) { }

    async createTicket(userId: string, data: { subject: string; message: string; priority?: string; order_id?: string; attachments?: string[] }) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const ticketResult = await client.query(`INSERT INTO support_tickets (customer_id, subject, priority, order_id) VALUES ($1, $2, $3, $4) RETURNING *`, [userId, data.subject, data.priority || 'normal', data.order_id || null]);
            const ticket = ticketResult.rows[0];
            const messageResult = await client.query(
                `INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text, attachments) VALUES ($1, $2, 'customer', $3, $4) RETURNING *`,
                [ticket.ticket_id, userId, data.message, data.attachments || []]
            );
            await client.query('COMMIT');
            return { ticket, message: messageResult.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getTickets(params: { userId: string; userType: string; page?: number; limit?: number; status?: string }) {
        const pageNum = Math.max(1, params.page || 1);
        const limitNum = Math.min(100, Math.max(1, params.limit || 20));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '';
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (params.userType === 'customer') {
            whereClause = `WHERE t.customer_id = $${paramIndex++}`;
            queryParams.push(params.userId);
        } else {
            whereClause = 'WHERE 1=1';
        }

        if (params.status) {
            whereClause += ` AND t.status = $${paramIndex++}`;
            queryParams.push(params.status);
        }

        const countResult = await this.pool.query(`SELECT COUNT(*) FROM support_tickets t ${whereClause}`, queryParams);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limitNum);

        const result = await this.pool.query(`
            SELECT t.*, 
                   (SELECT message_text FROM chat_messages WHERE ticket_id = t.ticket_id ORDER BY created_at DESC LIMIT 1) as last_message, 
                   u.full_name as customer_name,
                   o.order_number
            FROM support_tickets t 
            JOIN users u ON t.customer_id = u.user_id 
            LEFT JOIN orders o ON t.order_id = o.order_id
            ${whereClause}
            ORDER BY t.last_message_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...queryParams, limitNum, offset]);

        return { tickets: result.rows, pagination: { page: pageNum, limit: limitNum, total, pages: totalPages } };
    }

    async getTicketMessages(ticketId: string) {
        const result = await this.pool.query(`SELECT m.*, u.full_name as sender_name FROM chat_messages m JOIN users u ON m.sender_id = u.user_id WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`, [ticketId]);
        return result.rows;
    }

    async verifyTicketAccess(ticketId: string, userId: string, userType: string): Promise<{ hasAccess: boolean; customerId?: string }> {
        const result = await this.pool.query(`SELECT customer_id FROM support_tickets WHERE ticket_id = $1`, [ticketId]);
        if (result.rows.length === 0) return { hasAccess: false };
        const customerId = result.rows[0].customer_id;
        if (userType === 'customer' && customerId !== userId) return { hasAccess: false };
        return { hasAccess: true, customerId };
    }

    async sendMessage(ticketId: string, senderId: string, senderType: string, messageText: string, attachments?: string[]) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text, attachments) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [ticketId, senderId, senderType, messageText, attachments || []]
            );

            // Track first_response_at for SLA metrics when staff responds
            if (senderType === 'admin') {
                await client.query(`
                    UPDATE support_tickets 
                    SET last_message_at = NOW(), 
                        updated_at = NOW(),
                        first_response_at = COALESCE(first_response_at, NOW())
                    WHERE ticket_id = $1`, [ticketId]);
            } else {
                await client.query(`UPDATE support_tickets SET last_message_at = NOW(), updated_at = NOW() WHERE ticket_id = $1`, [ticketId]);
            }

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async updateTicketStatus(ticketId: string, status: string) {
        // Calculate resolution time when marking as resolved/closed
        if (status === 'resolved' || status === 'closed') {
            const result = await this.pool.query(`
                UPDATE support_tickets 
                SET status = $1, 
                    updated_at = NOW(),
                    resolution_time_minutes = EXTRACT(EPOCH FROM (NOW() - created_at))/60
                WHERE ticket_id = $2 
                RETURNING *`, [status, ticketId]);
            return result.rows[0];
        }
        const result = await this.pool.query(`UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE ticket_id = $2 RETURNING *`, [status, ticketId]);
        return result.rows[0];
    }

    async getStats() {
        const [statsResult, orderDisputeResult, paymentDisputeResult, reviewResult] = await Promise.all([
            this.pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'open') as open_tickets, COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets, COUNT(*) FILTER (WHERE status = 'resolved' AND DATE(updated_at) = CURRENT_DATE) as resolved_today FROM support_tickets`),
            this.pool.query(`SELECT COUNT(*) as order_disputes FROM disputes WHERE status IN ('pending', 'contested')`),
            this.pool.query(`SELECT COUNT(*) as payment_disputes FROM garage_payouts WHERE payout_status = 'disputed'`),
            this.pool.query(`SELECT COUNT(*) as pending_reviews FROM order_reviews WHERE moderation_status = 'pending'`)
        ]);
        const stats = statsResult.rows[0];
        return {
            open_tickets: parseInt(stats.open_tickets) || 0,
            in_progress_tickets: parseInt(stats.in_progress_tickets) || 0,
            resolved_today: parseInt(stats.resolved_today) || 0,
            order_disputes: parseInt(orderDisputeResult.rows[0]?.order_disputes) || 0,
            payment_disputes: parseInt(paymentDisputeResult.rows[0]?.payment_disputes) || 0,
            pending_reviews: parseInt(reviewResult.rows[0]?.pending_reviews) || 0
        };
    }

    async getUrgentItems() {
        // Query tickets that are either SLA breached or waiting too long
        const urgentTickets = await this.pool.query(
            `SELECT ticket_id as id, 'ticket' as type, subject as title, created_at, sla_deadline,
                    CASE WHEN sla_deadline < NOW() THEN true ELSE false END as sla_breached
             FROM support_tickets 
             WHERE status IN ('open', 'in_progress') 
             AND (created_at < NOW() - INTERVAL '24 hours' OR sla_deadline < NOW())
             ORDER BY sla_breached DESC, created_at ASC 
             LIMIT 10`
        );
        return urgentTickets.rows;
    }

    async getRecentActivity() {
        const result = await this.pool.query(`
            SELECT t.ticket_id, 'ticket' as type, t.subject, t.status, t.created_at, 
                   u.full_name as customer_name, o.order_number
            FROM support_tickets t 
            JOIN users u ON t.customer_id = u.user_id 
            LEFT JOIN orders o ON t.order_id = o.order_id
            ORDER BY t.last_message_at DESC LIMIT 10
        `);
        return result.rows;
    }

    async getTicketDetail(ticketId: string) {
        const ticketResult = await this.pool.query(`
            SELECT t.*, u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email, o.order_number 
            FROM support_tickets t 
            JOIN users u ON t.customer_id = u.user_id 
            LEFT JOIN orders o ON t.order_id = o.order_id 
            WHERE t.ticket_id = $1
        `, [ticketId]);
        if (ticketResult.rows.length === 0) return null;
        const messagesResult = await this.pool.query(`SELECT m.*, u.full_name as sender_name FROM chat_messages m JOIN users u ON m.sender_id = u.user_id WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`, [ticketId]);
        return { ticket: ticketResult.rows[0], messages: messagesResult.rows };
    }

    async getSLAStats() {
        const result = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status IN ('open','in_progress')) as breached,
                COUNT(*) FILTER (WHERE first_response_at IS NOT NULL AND status IN ('open','in_progress','resolved')) as responded,
                COUNT(*) FILTER (WHERE status IN ('open','in_progress')) as active,
                ROUND(AVG(resolution_time_minutes) FILTER (WHERE status = 'resolved' AND resolution_time_minutes IS NOT NULL)) as avg_resolution_mins
            FROM support_tickets
            WHERE created_at > NOW() - INTERVAL '30 days'
        `);
        return result.rows[0];
    }

    async assignTicket(ticketId: string, assigneeId: string) {
        const result = await this.pool.query(`
            UPDATE support_tickets 
            SET assigned_to = $1, 
                status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at = NOW()
            WHERE ticket_id = $2 
            RETURNING *
        `, [assigneeId, ticketId]);
        return result.rows[0];
    }

    /**
     * Auto-escalate stale tickets after 24 hours without response
     * Called by scheduled job hourly
     */
    async escalateStaleTickets(): Promise<{ escalated: number; tickets: any[] }> {
        const result = await this.pool.query(`
            UPDATE support_tickets 
            SET priority = 'urgent',
                escalated_at = NOW(),
                notes = COALESCE(notes, '') || '[AUTO-ESCALATED: No response after 24h] ',
                updated_at = NOW()
            WHERE status = 'open'
            AND first_response_at IS NULL
            AND created_at < NOW() - INTERVAL '24 hours'
            AND (escalated_at IS NULL)
            RETURNING ticket_id, subject, customer_id, created_at
        `);

        return {
            escalated: result.rowCount || 0,
            tickets: result.rows
        };
    }

    /**
     * Customer can reopen a closed ticket within 7 days
     */
    async reopenTicket(ticketId: string, customerId: string, message?: string): Promise<{ success: boolean; ticket?: any; error?: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ticket belongs to customer and was closed within 7 days
            const ticketResult = await client.query(`
                SELECT * FROM support_tickets 
                WHERE ticket_id = $1 
                AND customer_id = $2
                FOR UPDATE
            `, [ticketId, customerId]);

            if (ticketResult.rows.length === 0) {
                return { success: false, error: 'Ticket not found' };
            }

            const ticket = ticketResult.rows[0];

            if (!['resolved', 'closed'].includes(ticket.status)) {
                return { success: false, error: 'Ticket is not closed' };
            }

            // Check if closed within last 7 days
            const closedDate = new Date(ticket.updated_at);
            const daysSinceClosed = (Date.now() - closedDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceClosed > 7) {
                return { success: false, error: 'Cannot reopen ticket after 7 days. Please create a new ticket.' };
            }

            // Reopen the ticket
            const updateResult = await client.query(`
                UPDATE support_tickets 
                SET status = 'open',
                    reopened_at = NOW(),
                    reopened_count = COALESCE(reopened_count, 0) + 1,
                    updated_at = NOW()
                WHERE ticket_id = $1
                RETURNING *
            `, [ticketId]);

            // Add reopen message if provided
            if (message) {
                await client.query(`
                    INSERT INTO chat_messages (ticket_id, sender_id, sender_type, message_text)
                    VALUES ($1, $2, 'customer', $3)
                `, [ticketId, customerId, `[TICKET REOPENED] ${message}`]);
            }

            await client.query('COMMIT');

            return { success: true, ticket: updateResult.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
