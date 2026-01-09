
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getUserNotifications, getUnreadCount, markNotificationsRead } from '../services/notification.service';
import { getErrorMessage } from '../types';

/**
 * Get user's notifications
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        const notifications = await getUserNotifications(userId, limit);
        const unreadCount = await getUnreadCount(userId);
        res.json({ notifications, unread_count: unreadCount });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Mark notifications as read
 */
export const markRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
        return res.status(400).json({ error: 'notification_ids array is required' });
    }

    try {
        await markNotificationsRead(userId, notification_ids);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
