import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { pushService } from '../services/push.service';
import { ChatService } from '../services/chat';

const chatService = new ChatService(pool);

export const getChatMessages = async (req: AuthRequest, res: Response) => {
    try {
        const assignment = await chatService.verifyAccess(req.params.assignment_id, req.user!.userId);
        if (!assignment) return res.status(403).json({ error: 'Access denied to this chat' });
        const messages = await chatService.getMessages(req.params.assignment_id);
        const senderType = assignment.customer_id === req.user!.userId ? 'driver' : 'customer';
        await chatService.markAsRead(req.params.assignment_id, senderType);
        res.json({ messages, assignment_status: assignment.status, can_chat: ['assigned', 'picked_up', 'in_transit'].includes(assignment.status) });
    } catch (err) {
        console.error('getChatMessages Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const sendChatMessage = async (req: AuthRequest, res: Response) => {
    const { message } = req.body;
    if (!message || message.trim().length === 0) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    try {
        const assignment = await chatService.verifyAccess(req.params.assignment_id, req.user!.userId);
        if (!assignment) return res.status(403).json({ error: 'Access denied to this chat' });
        if (!['assigned', 'picked_up', 'in_transit'].includes(assignment.status)) return res.status(400).json({ error: 'Chat is only available during active delivery', status: assignment.status });
        const senderType = assignment.customer_id === req.user!.userId ? 'customer' : 'driver';
        const recipientId = senderType === 'customer' ? assignment.driver_user_id : assignment.customer_id;
        const newMessage = await chatService.sendMessage(req.params.assignment_id, assignment.order_id, senderType, req.user!.userId, message.trim());
        const io = (global as any).io;
        io.to(`chat_${req.params.assignment_id}`).emit('chat_message', { assignment_id: req.params.assignment_id, ...newMessage });

        // PUSH: Send push notification to recipient
        if (recipientId) {
            try {
                const senderName = senderType === 'customer' ? 'Customer' : 'Driver';
                await pushService.sendToUser(
                    recipientId,
                    `New Message from ${senderName} 💬`,
                    message.trim().substring(0, 100),
                    { type: 'chat_message', assignment_id: req.params.assignment_id },
                    { channelId: 'chat', sound: true }
                );
            } catch (pushErr) {
                console.error('[Chat] Push notification failed:', pushErr);
            }
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error('sendChatMessage Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const count = await chatService.getUnreadCount(req.user!.userId);
        res.json({ unread_count: count });
    } catch (err) {
        console.error('getUnreadCount Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getOrderChatMessages = async (req: AuthRequest, res: Response) => {
    try {
        const assignment = await chatService.verifyOrderAccess(req.params.order_id, req.user!.userId);
        if (!assignment) return res.status(403).json({ error: 'Access denied to this order chat' });
        const messages = await chatService.getOrderMessages(req.params.order_id, assignment.driver_name);
        res.json({ messages, can_chat: assignment.assignment_id && ['assigned', 'picked_up', 'in_transit'].includes(assignment.status) });
    } catch (err) {
        console.error('getOrderChatMessages Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const sendOrderChatMessage = async (req: AuthRequest, res: Response) => {
    const { order_id, message } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });
    if (!message || message.trim().length === 0) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    try {
        const assignment = await chatService.verifyOrderAccess(order_id, req.user!.userId);
        if (!assignment) return res.status(403).json({ error: 'Access denied to this order chat' });
        const senderType = assignment.customer_id === req.user!.userId ? 'customer' : 'driver';
        const recipientId = senderType === 'customer' ? assignment.driver_user_id : assignment.customer_id;
        const newMessage = await chatService.sendMessage(assignment.assignment_id, order_id, senderType, req.user!.userId, message.trim());
        const io = (global as any).io;
        if (io) {
            if (assignment.assignment_id) io.to(`chat_${assignment.assignment_id}`).emit('chat_message', { assignment_id: assignment.assignment_id, order_id, ...newMessage });
            io.to(`order_${order_id}`).emit('new_message', { ...newMessage, order_id, sender_name: senderType === 'customer' ? 'You' : assignment.driver_name, is_read: false });

            // Send push notification to recipient (BOTH directions - customer↔driver)
            if (recipientId) {
                try {
                    const senderName = senderType === 'customer' ? 'Customer' : (assignment.driver_name || 'Driver');
                    await pushService.sendChatNotification(recipientId, senderName, message.trim(), order_id, assignment.order_number);
                } catch (e) {
                    console.error('[Chat] Push notification failed:', e);
                }
            }
        }
        res.status(201).json({ message: { ...newMessage, order_id, sender_name: 'You', is_read: false } });
    } catch (err) {
        console.error('sendOrderChatMessage Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
