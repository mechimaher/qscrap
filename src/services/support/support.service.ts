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
        // Enhanced query with order/garage context for support team
        const ticketResult = await this.pool.query(`
            SELECT t.*, 
                   u.full_name as customer_name, 
                   u.phone_number as customer_phone, 
                   u.email as customer_email,
                   o.order_number,
                   o.order_status,
                   o.delivery_status,
                   o.delivery_address,
                   o.created_at as order_created_at,
                   o.total_amount,
                   g.garage_name,
                   gu.phone_number as garage_phone,
                   g.address as garage_address
            FROM support_tickets t 
            JOIN users u ON t.customer_id = u.user_id 
            LEFT JOIN orders o ON t.order_id = o.order_id 
            LEFT JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON g.garage_id = gu.user_id
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

    // ==========================================
    // CUSTOMER RESOLUTION CENTER - NEW METHODS
    // ==========================================

    /**
     * Get complete customer 360 view by phone, name, email, or order#
     */
    async getCustomer360(searchQuery: string): Promise<any> {
        // Normalize search query
        const query = searchQuery.trim();

        // Try to find customer by different identifiers
        const result = await this.pool.query(`
            SELECT 
                u.user_id, u.full_name, u.phone_number, u.email, u.created_at as member_since,
                (SELECT COUNT(*) FROM orders WHERE customer_id = u.user_id) as total_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = u.user_id AND order_status = 'completed') as total_spent,
                (SELECT tier FROM customer_loyalty WHERE customer_id = u.user_id) as loyalty_tier,
                (SELECT COUNT(*) FROM orders WHERE customer_id = u.user_id AND order_status IN ('pending', 'confirmed', 'in_transit')) as active_orders,
                (SELECT COUNT(*) FROM disputes WHERE customer_id = u.user_id AND status IN ('pending', 'contested')) as open_issues
            FROM users u
            WHERE u.role = 'customer'
            AND (
                u.phone_number ILIKE $1 
                OR u.full_name ILIKE $1 
                OR u.email ILIKE $1
                OR u.user_id::text = $2
                OR u.user_id IN (SELECT customer_id FROM orders WHERE order_number ILIKE $1)
            )
            LIMIT 1
        `, [`%${query}%`, query]);

        if (result.rows.length === 0) {
            return null;
        }

        const customer = result.rows[0];

        // Get recent orders with issues highlighted
        const orders = await this.pool.query(`
            SELECT 
                o.order_id, o.order_number, o.order_status, o.delivery_status,
                o.total_amount, o.created_at, o.delivery_address,
                r.part_description, r.car_make, r.car_model, r.car_year,
                g.garage_name, gu.phone_number as garage_phone,
                d.dispute_id, d.reason as dispute_reason, d.status as dispute_status,
                dr.full_name as driver_name, dru.phone_number as driver_phone
            FROM orders o
            JOIN part_requests r ON o.request_id = r.request_id
            LEFT JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON g.garage_id = gu.user_id
            LEFT JOIN disputes d ON o.order_id = d.order_id AND d.status IN ('pending', 'contested')
            LEFT JOIN drivers dr ON o.driver_id = dr.driver_id
            LEFT JOIN users dru ON dr.driver_id = dru.user_id
            WHERE o.customer_id = $1
            ORDER BY 
                CASE WHEN d.dispute_id IS NOT NULL THEN 0 ELSE 1 END,
                o.created_at DESC
            LIMIT 10
        `, [customer.user_id]);

        // Get internal notes
        const notes = await this.pool.query(`
            SELECT n.*, u.full_name as agent_name
            FROM customer_notes n
            JOIN users u ON n.agent_id = u.user_id
            WHERE n.customer_id = $1
            ORDER BY n.created_at DESC
            LIMIT 10
        `, [customer.user_id]);

        // Get resolution history
        const resolutions = await this.pool.query(`
            SELECT r.*, u.full_name as agent_name, o.order_number
            FROM resolution_logs r
            JOIN users u ON r.agent_id = u.user_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE r.customer_id = $1
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [customer.user_id]);

        return {
            customer,
            orders: orders.rows,
            notes: notes.rows,
            resolutions: resolutions.rows
        };
    }

    /**
     * Add internal note about customer
     */
    async addCustomerNote(customerId: string, agentId: string, noteText: string): Promise<any> {
        const result = await this.pool.query(`
            INSERT INTO customer_notes (customer_id, agent_id, note_text)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [customerId, agentId, noteText]);
        return result.rows[0];
    }

    /**
     * Execute quick action and log resolution
     */
    async executeQuickAction(params: {
        orderId?: string;
        customerId: string;
        agentId: string;
        actionType: string;
        actionDetails?: any;
        notes?: string;
    }): Promise<{ success: boolean; result?: any; error?: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            let result: any = null;

            switch (params.actionType) {
                case 'full_refund':
                    if (!params.orderId) throw new Error('Order ID required for refund');
                    // Mark order for refund
                    await client.query(`
                        UPDATE orders SET 
                            order_status = 'refunded',
                            refund_reason = $2,
                            refunded_at = NOW()
                        WHERE order_id = $1
                    `, [params.orderId, params.notes || 'Customer requested refund']);
                    result = { action: 'full_refund', orderId: params.orderId };
                    break;

                case 'partial_refund':
                    if (!params.orderId || !params.actionDetails?.amount) throw new Error('Order ID and amount required');
                    await client.query(`
                        UPDATE orders SET 
                            partial_refund_amount = $2,
                            refund_reason = $3,
                            refunded_at = NOW()
                        WHERE order_id = $1
                    `, [params.orderId, params.actionDetails.amount, params.notes || 'Partial refund']);
                    result = { action: 'partial_refund', amount: params.actionDetails.amount };
                    break;

                case 'goodwill_credit':
                    const creditAmount = params.actionDetails?.amount || 10;
                    await client.query(`
                        UPDATE customer_loyalty 
                        SET points = points + $2
                        WHERE customer_id = $1
                    `, [params.customerId, creditAmount * 10]); // 10 points per QAR
                    result = { action: 'goodwill_credit', points: creditAmount * 10 };
                    break;

                case 'cancel_order':
                    if (!params.orderId) throw new Error('Order ID required');
                    await client.query(`
                        UPDATE orders SET 
                            order_status = 'cancelled',
                            cancellation_reason = $2,
                            cancelled_at = NOW()
                        WHERE order_id = $1
                    `, [params.orderId, params.notes || 'Cancelled by support']);
                    result = { action: 'cancel_order', orderId: params.orderId };
                    break;

                case 'reassign_driver':
                    if (!params.orderId) throw new Error('Order ID required');
                    // Clear current driver assignment so operations can reassign
                    await client.query(`
                        UPDATE orders SET 
                            driver_id = NULL,
                            delivery_status = 'pending_pickup',
                            driver_reassignment_reason = $2
                        WHERE order_id = $1
                    `, [params.orderId, params.notes || 'Reassigned by support']);
                    result = { action: 'reassign_driver', orderId: params.orderId };
                    break;

                case 'rush_delivery':
                    if (!params.orderId) throw new Error('Order ID required');
                    await client.query(`
                        UPDATE orders SET 
                            priority = 'urgent',
                            priority_notes = $2
                        WHERE order_id = $1
                    `, [params.orderId, params.notes || 'Rush delivery requested']);
                    result = { action: 'rush_delivery', orderId: params.orderId };
                    break;

                case 'escalate_to_ops':
                    if (!params.orderId) throw new Error('Order ID required');
                    await client.query(`
                        UPDATE orders SET 
                            escalated_to_ops = true,
                            escalation_reason = $2,
                            escalated_at = NOW()
                        WHERE order_id = $1
                    `, [params.orderId, params.notes || 'Escalated by support']);
                    result = { action: 'escalate_to_ops', orderId: params.orderId };
                    break;

                default:
                    throw new Error(`Unknown action type: ${params.actionType}`);
            }

            // Log the resolution action
            await client.query(`
                INSERT INTO resolution_logs (order_id, customer_id, agent_id, action_type, action_details, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [params.orderId || null, params.customerId, params.agentId, params.actionType,
            JSON.stringify(params.actionDetails || {}), params.notes || null]);

            await client.query('COMMIT');
            return { success: true, result };

        } catch (err: any) {
            await client.query('ROLLBACK');
            return { success: false, error: err.message };
        } finally {
            client.release();
        }
    }

    /**
     * Get resolution logs for an order or customer
     */
    async getResolutionLogs(params: { orderId?: string; customerId?: string }): Promise<any[]> {
        let whereClause = '';
        const queryParams: any[] = [];

        if (params.orderId) {
            whereClause = 'WHERE r.order_id = $1';
            queryParams.push(params.orderId);
        } else if (params.customerId) {
            whereClause = 'WHERE r.customer_id = $1';
            queryParams.push(params.customerId);
        }

        const result = await this.pool.query(`
            SELECT r.*, u.full_name as agent_name, o.order_number
            FROM resolution_logs r
            JOIN users u ON r.agent_id = u.user_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT 50
        `, queryParams);

        return result.rows;
    }
}
