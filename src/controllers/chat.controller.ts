import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// ============================================================================
// DELIVERY CHAT CONTROLLER
// Real-time messaging between customer and driver during active delivery
// ============================================================================

/**
 * Get chat messages for an assignment
 * Both customer and driver can view if they're part of the delivery
 */
export const getChatMessages = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const userId = req.user!.userId;

    try {
        // Verify user is part of this delivery (customer or driver)
        const accessCheck = await pool.query(`
            SELECT da.assignment_id, da.status,
                   o.customer_id, d.user_id as driver_user_id
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_id = $1
              AND (o.customer_id = $2 OR d.user_id = $2)
        `, [assignment_id, userId]);

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        const assignment = accessCheck.rows[0];

        // Get messages
        const messages = await pool.query(`
            SELECT message_id, sender_type, sender_id, message, read_at, created_at
            FROM delivery_chats
            WHERE assignment_id = $1
            ORDER BY created_at ASC
        `, [assignment_id]);

        // Mark messages as read for this user
        const senderType = assignment.customer_id === userId ? 'driver' : 'customer';
        await pool.query(`
            UPDATE delivery_chats 
            SET read_at = NOW()
            WHERE assignment_id = $1 
              AND sender_type = $2 
              AND read_at IS NULL
        `, [assignment_id, senderType]);

        res.json({
            messages: messages.rows,
            assignment_status: assignment.status,
            can_chat: ['assigned', 'picked_up', 'in_transit'].includes(assignment.status)
        });
    } catch (err: any) {
        console.error('getChatMessages Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Send a chat message
 * Only allowed during active delivery (assigned, picked_up, in_transit)
 */
export const sendChatMessage = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { message } = req.body;
    const userId = req.user!.userId;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
        return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    try {
        // Verify user is part of this delivery and it's active
        const accessCheck = await pool.query(`
            SELECT da.assignment_id, da.status, da.order_id,
                   o.customer_id, d.user_id as driver_user_id,
                   o.order_number
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_id = $1
              AND (o.customer_id = $2 OR d.user_id = $2)
        `, [assignment_id, userId]);

        if (accessCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        const assignment = accessCheck.rows[0];

        // Only allow chat during active delivery
        if (!['assigned', 'picked_up', 'in_transit'].includes(assignment.status)) {
            return res.status(400).json({
                error: 'Chat is only available during active delivery',
                status: assignment.status
            });
        }

        // Determine sender type
        const senderType = assignment.customer_id === userId ? 'customer' : 'driver';
        const recipientId = senderType === 'customer'
            ? assignment.driver_user_id
            : assignment.customer_id;

        // Insert message
        const result = await pool.query(`
            INSERT INTO delivery_chats (assignment_id, order_id, sender_type, sender_id, message)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING message_id, sender_type, message, created_at
        `, [assignment_id, assignment.order_id, senderType, userId, message.trim()]);

        const newMessage = result.rows[0];

        // Send real-time notification via Socket.IO
        const io = (global as any).io;

        // Emit to chat room
        io.to(`chat_${assignment_id}`).emit('chat_message', {
            assignment_id,
            message_id: newMessage.message_id,
            sender_type: senderType,
            sender_id: userId,
            message: message.trim(),
            created_at: newMessage.created_at
        });

        // Also notify recipient directly (in case not in chat room)
        const recipientRoom = senderType === 'customer'
            ? `driver_${recipientId}`
            : `user_${recipientId}`;

        io.to(recipientRoom).emit('chat_notification', {
            assignment_id,
            order_number: assignment.order_number,
            sender_type: senderType,
            message: message.trim().substring(0, 50) + (message.length > 50 ? '...' : ''),
            notification: `💬 New message for Order #${assignment.order_number}`
        });

        res.status(201).json({ message: newMessage });
    } catch (err: any) {
        console.error('sendChatMessage Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get unread message count for user
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const result = await pool.query(`
            SELECT COUNT(*) as unread_count
            FROM delivery_chats dc
            JOIN delivery_assignments da ON dc.assignment_id = da.assignment_id
            JOIN orders o ON da.order_id = o.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE dc.read_at IS NULL
              AND (
                  (o.customer_id = $1 AND dc.sender_type = 'driver') OR
                  (d.user_id = $1 AND dc.sender_type = 'customer')
              )
        `, [userId]);

        res.json({ unread_count: parseInt(result.rows[0].unread_count) || 0 });
    } catch (err: any) {
        console.error('getUnreadCount Error:', err);
        res.status(500).json({ error: err.message });
    }
};
