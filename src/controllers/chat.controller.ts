import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { pushService } from '../services/push.service';

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
    } catch (err) {
        console.error('getChatMessages Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
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

        // Emit to chat room (for web dashboard)
        io.to(`chat_${assignment_id}`).emit('chat_message', {
            assignment_id,
            message_id: newMessage.message_id,
            sender_type: senderType,
            sender_id: userId,
            message: message.trim(),
            created_at: newMessage.created_at
        });

        // Emit to order room (for mobile app)
        io.to(`order_${assignment.order_id}`).emit('new_message', {
            message_id: newMessage.message_id,
            order_id: assignment.order_id,
            sender_id: userId,
            sender_type: senderType,
            sender_name: senderType === 'driver' ? 'Driver' : 'You',
            message: message.trim(),
            created_at: newMessage.created_at,
            is_read: false
        });

        // Also notify recipient directly (in case not in chat room)
        const recipientRoom = senderType === 'customer'
            ? `driver_${recipientId}`
            : `user_${recipientId}`;

        io.to(recipientRoom).emit('chat_notification', {
            assignment_id,
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            sender_type: senderType,
            message: message.trim().substring(0, 50) + (message.length > 50 ? '...' : ''),
            notification: `💬 New message for Order #${assignment.order_number}`
        });

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error('sendChatMessage Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
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
    } catch (err) {
        console.error('getUnreadCount Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// ORDER-BASED CHAT (for mobile app)
// Maps order_id to assignment_id and uses same logic
// ============================================================================

/**
 * Get chat messages by order ID (mobile app)
 */
export const getOrderChatMessages = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;

    try {
        // Get assignment for this order
        const assignmentResult = await pool.query(`
            SELECT da.assignment_id, da.status, o.customer_id, d.user_id as driver_user_id,
                   d.full_name as driver_name
            FROM orders o
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE o.order_id = $1
              AND (o.customer_id = $2 OR d.user_id = $2)
        `, [order_id, userId]);

        if (assignmentResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this order chat' });
        }

        const assignment = assignmentResult.rows[0];

        // Get messages for this order
        const messages = await pool.query(`
            SELECT dc.message_id, dc.order_id, dc.sender_type, dc.sender_id, dc.message, 
                   dc.created_at, dc.read_at IS NOT NULL as is_read,
                   CASE 
                     WHEN dc.sender_type = 'customer' THEN 'You'
                     WHEN dc.sender_type = 'driver' THEN $2
                     ELSE dc.sender_type
                   END as sender_name
            FROM delivery_chats dc
            WHERE dc.order_id = $1
            ORDER BY dc.created_at ASC
        `, [order_id, assignment.driver_name || 'Driver']);

        res.json({
            messages: messages.rows,
            can_chat: assignment.assignment_id && ['assigned', 'picked_up', 'in_transit'].includes(assignment.status)
        });
    } catch (err) {
        console.error('getOrderChatMessages Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Send chat message by order ID (mobile app)
 */
export const sendOrderChatMessage = async (req: AuthRequest, res: Response) => {
    const { order_id, message } = req.body;
    const userId = req.user!.userId;

    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
    }

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
        return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    try {
        // Get assignment for this order
        const assignmentResult = await pool.query(`
            SELECT da.assignment_id, da.status, o.order_id, o.customer_id, o.order_number,
                   d.user_id as driver_user_id, d.full_name as driver_name
            FROM orders o
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE o.order_id = $1
              AND (o.customer_id = $2 OR d.user_id = $2)
        `, [order_id, userId]);

        if (assignmentResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this order chat' });
        }

        const assignment = assignmentResult.rows[0];

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
        `, [assignment.assignment_id, order_id, senderType, userId, message.trim()]);

        const newMessage = result.rows[0];

        // Send real-time notification via Socket.IO
        const io = (global as any).io;

        if (io) {
            // Emit to chat room (for driver web dashboard)
            if (assignment.assignment_id) {
                io.to(`chat_${assignment.assignment_id}`).emit('chat_message', {
                    assignment_id: assignment.assignment_id,
                    order_id: order_id,
                    message_id: newMessage.message_id,
                    sender_type: senderType,
                    sender_id: userId,
                    message: message.trim(),
                    created_at: newMessage.created_at
                });
            }

            // Emit to order room (for mobile app)
            io.to(`order_${order_id}`).emit('new_message', {
                message_id: newMessage.message_id,
                order_id: order_id,
                sender_id: userId,
                sender_type: senderType,
                sender_name: senderType === 'customer' ? 'You' : assignment.driver_name,
                message: message.trim(),
                created_at: newMessage.created_at,
                is_read: false
            });

            // Notify recipient directly (failsafe)
            const recipientRoom = senderType === 'customer'
                ? `driver_${recipientId}`
                : `user_${recipientId}`;

            io.to(recipientRoom).emit('chat_notification', {
                order_id: order_id,
                order_number: assignment.order_number,
                sender_type: senderType,
                message: message.trim().substring(0, 50) + (message.length > 50 ? '...' : ''),
                notification: `💬 New message for Order #${assignment.order_number}`
            });

            // Also emit chat_message to driver room for guaranteed delivery
            if (senderType === 'customer' && assignment.assignment_id) {
                io.to(`driver_${recipientId}`).emit('chat_message', {
                    assignment_id: assignment.assignment_id,
                    order_id: order_id,
                    message_id: newMessage.message_id,
                    sender_type: senderType,
                    sender_id: userId,
                    message: message.trim(),
                    created_at: newMessage.created_at
                });

                // CRITICAL: Send push notification for background/locked phone delivery
                // Socket.IO only works when app is active - push notifications work always
                try {
                    await pushService.sendChatNotification(
                        recipientId,        // driver's user_id
                        'Customer',         // sender name
                        message.trim(),     // message content
                        order_id,
                        assignment.order_number
                    );
                } catch (pushError) {
                    console.error('[Chat] Push notification failed:', pushError);
                    // Don't fail the request if push fails - socket already sent
                }
            }
        }

        res.status(201).json({
            message: {
                message_id: newMessage.message_id,
                order_id: order_id,
                sender_id: userId,
                sender_type: senderType,
                sender_name: 'You',
                message: message.trim(),
                created_at: newMessage.created_at,
                is_read: false
            }
        });
    } catch (err) {
        console.error('sendOrderChatMessage Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
