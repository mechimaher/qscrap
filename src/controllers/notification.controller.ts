
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getUserNotifications, getUnreadCount, markNotificationsRead } from '../services/notification.service';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { BadgeCountService } from '../services/notification/badge.service';
import logger from '../utils/logger';

const badgeService = new BadgeCountService(pool);

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

/**
 * Get unread notification count only
 * Used for badge display in mobile app
 */
export const getUnreadNotificationCount = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const count = await getUnreadCount(userId);
        res.json({ count });
    } catch (err) {
        logger.error('Failed to get unread count', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get comprehensive badge counts for customer mobile app
 * Used for tab bar badges (Requests, Orders, Profile tabs)
 * Similar to Talabat/Keeta notification badges
 */
export const getBadgeCounts = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const counts = await badgeService.getCustomerBadgeCounts(userId);
        res.json({ success: true, ...counts });
    } catch (err) {
        logger.error('Failed to get badge counts', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Get badge counts for garage dashboard
 * Used for sidebar badges and header notifications
 */
export const getGarageBadgeCounts = async (req: AuthRequest, res: Response) => {
    const garageId = (req as any).garage?.garageId;

    if (!garageId) {
        return res.status(403).json({ error: 'Garage authentication required' });
    }

    try {
        const counts = await badgeService.getGarageBadgeCounts(garageId);
        res.json({ success: true, ...counts });
    } catch (err) {
        logger.error('Failed to get garage badge counts', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
