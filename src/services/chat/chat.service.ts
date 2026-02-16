/**
 * Chat Service
 * Handles delivery chat messages between customer and driver
 */
import { Pool } from 'pg';

interface VerifyAccessRow {
    assignment_id: string;
    order_id: string;
    status: string;
    customer_id: string;
    driver_user_id: string | null;
}

interface DeliveryMessageRow {
    message_id: string;
    sender_type: string;
    sender_id: string;
    message: string;
    read_at: Date | null;
    created_at: Date;
}

interface SentMessageRow {
    message_id: string;
    sender_type: string;
    message: string;
    created_at: Date;
}

interface UnreadCountRow {
    unread_count: string;
}

interface VerifyOrderAccessRow {
    assignment_id: string | null;
    status: string | null;
    customer_id: string;
    order_id: string;
    order_number: string | null;
    driver_user_id: string | null;
    driver_name: string | null;
}

interface OrderMessageRow {
    message_id: string;
    order_id: string;
    sender_type: string;
    sender_id: string;
    message: string;
    created_at: Date;
    is_read: boolean;
    sender_name: string;
}

export class ChatService {
    constructor(private pool: Pool) { }

    async verifyAccess(assignmentId: string, userId: string): Promise<VerifyAccessRow | null> {
        const result = await this.pool.query<VerifyAccessRow>(`SELECT da.assignment_id, da.order_id, da.status, o.customer_id, d.user_id as driver_user_id FROM delivery_assignments da JOIN orders o ON da.order_id = o.order_id JOIN drivers d ON da.driver_id = d.driver_id WHERE da.assignment_id = $1 AND (o.customer_id = $2 OR d.user_id = $2)`, [assignmentId, userId]);
        return result.rows[0] ?? null;
    }

    async getMessages(assignmentId: string): Promise<DeliveryMessageRow[]> {
        const result = await this.pool.query<DeliveryMessageRow>(`SELECT message_id, sender_type, sender_id, message, read_at, created_at FROM delivery_chats WHERE assignment_id = $1 ORDER BY created_at ASC`, [assignmentId]);
        return result.rows;
    }

    async markAsRead(assignmentId: string, senderType: string): Promise<void> {
        await this.pool.query(`UPDATE delivery_chats SET read_at = NOW() WHERE assignment_id = $1 AND sender_type = $2 AND read_at IS NULL`, [assignmentId, senderType]);
    }

    async sendMessage(assignmentId: string, orderId: string, senderType: string, senderId: string, message: string): Promise<SentMessageRow | null> {
        const result = await this.pool.query<SentMessageRow>(`INSERT INTO delivery_chats (assignment_id, order_id, sender_type, sender_id, message) VALUES ($1, $2, $3, $4, $5) RETURNING message_id, sender_type, message, created_at`, [assignmentId, orderId, senderType, senderId, message]);
        return result.rows[0] ?? null;
    }

    async getUnreadCount(userId: string): Promise<number> {
        const result = await this.pool.query<UnreadCountRow>(`SELECT COUNT(*) as unread_count FROM delivery_chats dc JOIN delivery_assignments da ON dc.assignment_id = da.assignment_id JOIN orders o ON da.order_id = o.order_id LEFT JOIN drivers d ON da.driver_id = d.driver_id WHERE dc.read_at IS NULL AND ((o.customer_id = $1 AND dc.sender_type = 'driver') OR (d.user_id = $1 AND dc.sender_type = 'customer'))`, [userId]);
        const unreadCount = result.rows[0]?.unread_count ?? '0';
        return Number.parseInt(unreadCount, 10) || 0;
    }

    async verifyOrderAccess(orderId: string, userId: string): Promise<VerifyOrderAccessRow | null> {
        const result = await this.pool.query<VerifyOrderAccessRow>(`SELECT da.assignment_id, da.status, o.customer_id, o.order_id, o.order_number, d.user_id as driver_user_id, d.full_name as driver_name FROM orders o LEFT JOIN delivery_assignments da ON o.order_id = da.order_id LEFT JOIN drivers d ON da.driver_id = d.driver_id WHERE o.order_id = $1 AND (o.customer_id = $2 OR d.user_id = $2)`, [orderId, userId]);
        return result.rows[0] ?? null;
    }

    async getOrderMessages(orderId: string, driverName?: string): Promise<OrderMessageRow[]> {
        const result = await this.pool.query<OrderMessageRow>(`SELECT dc.message_id, dc.order_id, dc.sender_type, dc.sender_id, dc.message, dc.created_at, dc.read_at IS NOT NULL as is_read, CASE WHEN dc.sender_type = 'customer' THEN 'You' WHEN dc.sender_type = 'driver' THEN $2 ELSE dc.sender_type END as sender_name FROM delivery_chats dc WHERE dc.order_id = $1 ORDER BY dc.created_at ASC`, [orderId, driverName || 'Driver']);
        return result.rows;
    }
}
