import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { ChatService } from '../services/chat';
import { pushService } from '../services/push.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

const chatService = new ChatService(pool);
const ACTIVE_CHAT_STATUSES = ['assigned', 'picked_up', 'in_transit'] as const;

type ChatParticipant = 'customer' | 'driver';
type JsonRecord = Record<string, unknown>;

interface AssignmentParams {
    assignment_id: string;
}

interface OrderParams {
    order_id: string;
}

interface SendMessageBody {
    message?: string;
}

interface SendOrderMessageBody {
    order_id?: string;
    message?: string;
}

interface AssignmentAccessRecord {
    assignment_id: string;
    status: string;
    customer_id: string;
    driver_user_id: string | null;
    order_id: string | null;
}

interface OrderAccessRecord {
    assignment_id: string | null;
    status: string | null;
    customer_id: string;
    order_id: string;
    order_number: string | null;
    driver_user_id: string | null;
    driver_name: string | null;
}

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asOptionalString = (value: unknown): string | null => {
    if (typeof value === 'string') {
        return value;
    }
    return null;
};

const toRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const toRecordArray = (value: unknown): JsonRecord[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(isRecord);
};

const isActiveChatStatus = (status: string): boolean =>
    ACTIVE_CHAT_STATUSES.includes(status as (typeof ACTIVE_CHAT_STATUSES)[number]);

const normalizeMessage = (value: unknown): { message: string | null; error?: string } => {
    const rawMessage = toQueryString(value)?.trim();
    if (!rawMessage) {
        return { message: null, error: 'Message is required' };
    }
    if (rawMessage.length > 500) {
        return { message: null, error: 'Message too long (max 500 characters)' };
    }
    return { message: rawMessage };
};

const toAssignmentAccessRecord = (value: unknown): AssignmentAccessRecord | null => {
    if (!isRecord(value)) {
        return null;
    }

    const assignmentId = asString(value.assignment_id);
    const status = asString(value.status);
    const customerId = asString(value.customer_id);
    const driverUserId = asOptionalString(value.driver_user_id);
    const orderId = asOptionalString(value.order_id);

    if (!assignmentId || !status || !customerId) {
        return null;
    }

    return {
        assignment_id: assignmentId,
        status,
        customer_id: customerId,
        driver_user_id: driverUserId,
        order_id: orderId
    };
};

const toOrderAccessRecord = (value: unknown): OrderAccessRecord | null => {
    if (!isRecord(value)) {
        return null;
    }

    const customerId = asString(value.customer_id);
    const orderId = asString(value.order_id);
    if (!customerId || !orderId) {
        return null;
    }

    return {
        assignment_id: asOptionalString(value.assignment_id),
        status: asOptionalString(value.status),
        customer_id: customerId,
        order_id: orderId,
        order_number: asOptionalString(value.order_number),
        driver_user_id: asOptionalString(value.driver_user_id),
        driver_name: asOptionalString(value.driver_name)
    };
};

const getAssignmentParams = (req: AuthRequest): AssignmentParams =>
    req.params as unknown as AssignmentParams;

const getOrderParams = (req: AuthRequest): OrderParams =>
    req.params as unknown as OrderParams;

const logChatError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

export const getChatMessages = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { assignment_id: assignmentId } = getAssignmentParams(req);
        const assignment = toAssignmentAccessRecord(
            await chatService.verifyAccess(assignmentId, userId) as unknown
        );

        if (!assignment) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        const messages = toRecordArray(await chatService.getMessages(assignmentId) as unknown);
        const readSenderType: ChatParticipant = assignment.customer_id === userId ? 'driver' : 'customer';
        await chatService.markAsRead(assignmentId, readSenderType);

        res.json({
            messages,
            assignment_status: assignment.status,
            can_chat: isActiveChatStatus(assignment.status)
        });
    } catch (error) {
        logChatError('getChatMessages Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const sendChatMessage = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body as unknown as SendMessageBody;
    const { message, error } = normalizeMessage(body.message);
    if (!message) {
        return res.status(400).json({ error });
    }

    try {
        const { assignment_id: assignmentId } = getAssignmentParams(req);
        const assignment = toAssignmentAccessRecord(
            await chatService.verifyAccess(assignmentId, userId) as unknown
        );

        if (!assignment) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        if (!isActiveChatStatus(assignment.status)) {
            return res.status(400).json({
                error: 'Chat is only available during active delivery',
                status: assignment.status
            });
        }

        if (!assignment.order_id) {
            return res.status(500).json({ error: 'Chat assignment is missing order context' });
        }

        const senderType: ChatParticipant = assignment.customer_id === userId ? 'customer' : 'driver';
        const recipientId = senderType === 'customer' ? assignment.driver_user_id : assignment.customer_id;

        const newMessage = toRecord(
            await chatService.sendMessage(
                assignmentId,
                assignment.order_id,
                senderType,
                userId,
                message
            ) as unknown
        );

        if (!newMessage) {
            return res.status(500).json({ error: 'Failed to create chat message' });
        }

        getIO()?.to(`chat_${assignmentId}`).emit('chat_message', {
            assignment_id: assignmentId,
            ...newMessage
        });

        if (recipientId) {
            try {
                const senderName = senderType === 'customer' ? 'Customer' : 'Driver';
                await pushService.sendToUser(
                    recipientId,
                    `New Message from ${senderName} 💬`,
                    message.substring(0, 100),
                    { type: 'chat_message', assignment_id: assignmentId },
                    { channelId: 'messages', sound: true }
                );
            } catch (pushError) {
                logChatError('Push notification failed', pushError);
            }
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        logChatError('sendChatMessage Error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const count = await chatService.getUnreadCount(userId);
        res.json({ unread_count: count });
    } catch (error) {
        logChatError('getUnreadCount Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const getOrderChatMessages = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = getOrderParams(req);
        const assignment = toOrderAccessRecord(
            await chatService.verifyOrderAccess(orderId, userId) as unknown
        );

        if (!assignment) {
            return res.status(403).json({ error: 'Access denied to this order chat' });
        }

        const messages = toRecordArray(
            await chatService.getOrderMessages(orderId, assignment.driver_name ?? undefined) as unknown
        );
        const canChat = Boolean(assignment.assignment_id) &&
            Boolean(assignment.status) &&
            isActiveChatStatus(assignment.status as string);

        res.json({ messages, can_chat: canChat });
    } catch (error) {
        logChatError('getOrderChatMessages Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const sendOrderChatMessage = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body as unknown as SendOrderMessageBody;
    const orderId = toQueryString(body.order_id);
    if (!orderId) {
        return res.status(400).json({ error: 'order_id is required' });
    }

    const { message, error } = normalizeMessage(body.message);
    if (!message) {
        return res.status(400).json({ error });
    }

    try {
        const assignment = toOrderAccessRecord(
            await chatService.verifyOrderAccess(orderId, userId) as unknown
        );

        if (!assignment) {
            return res.status(403).json({ error: 'Access denied to this order chat' });
        }

        if (!assignment.assignment_id) {
            return res.status(400).json({ error: 'Chat is unavailable for this order' });
        }

        const senderType: ChatParticipant = assignment.customer_id === userId ? 'customer' : 'driver';
        const recipientId = senderType === 'customer' ? assignment.driver_user_id : assignment.customer_id;

        const newMessage = toRecord(
            await chatService.sendMessage(
                assignment.assignment_id,
                orderId,
                senderType,
                userId,
                message
            ) as unknown
        );

        if (!newMessage) {
            return res.status(500).json({ error: 'Failed to create chat message' });
        }

        const io = getIO();
        if (io) {
            io.to(`chat_${assignment.assignment_id}`).emit('chat_message', {
                assignment_id: assignment.assignment_id,
                order_id: orderId,
                ...newMessage
            });

            io.to(`order_${orderId}`).emit('new_message', {
                ...newMessage,
                order_id: orderId,
                sender_name: senderType === 'customer' ? 'You' : (assignment.driver_name ?? 'Driver'),
                is_read: false
            });

            if (recipientId) {
                try {
                    const senderName = senderType === 'customer'
                        ? 'Customer'
                        : (assignment.driver_name ?? 'Driver');
                    await pushService.sendChatNotification(
                        recipientId,
                        senderName,
                        message,
                        orderId,
                        assignment.order_number ?? orderId
                    );
                } catch (error) {
                    logChatError('Push notification failed', error);
                }
            }
        }

        res.status(201).json({
            message: {
                ...newMessage,
                order_id: orderId,
                sender_name: 'You',
                is_read: false
            }
        });
    } catch (err) {
        logChatError('sendOrderChatMessage Error', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
