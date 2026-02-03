// Smart Time-Aware Notification Service - P2 Feature
import { getIO } from '../utils/socketIO';
import pool from '../config/db';
import logger from '../utils/logger';

interface TimeAwareNotificationOptions {
    userId: string;
    title: string;
    message: string;
    type: 'bid' | 'order' | 'delivery' | 'general';
    priority: 'low' | 'medium' | 'high';
}

/**
 * Smart Time-Aware Notification System
 * Respects Ramadan hours and user preferences
 */
class SmartNotificationService {
    private isRamadan(): boolean {
        // Check if current date falls within Ramadan
        // This should be updated annually or fetched from an Islamic calendar API
        const now = new Date();
        const year = now.getFullYear();

        // Example Ramadan dates (would be dynamic in production)
        const ramadanStart = new Date(year, 2, 10); // March 10 (approx)
        const ramadanEnd = new Date(year, 3, 9); // April 9 (approx)

        return now >= ramadanStart && now <= ramadanEnd;
    }

    private isQuietHours(): boolean {
        const now = new Date();
        const hour = now.getHours();

        if (this.isRamadan()) {
            // During Ramadan, avoid notifications during:
            // - Pre-dawn meal (Suhoor): 3-5 AM
            // - Taraweeh prayers: 9-11 PM
            return (hour >= 3 && hour < 5) || (hour >= 21 && hour < 23);
        }

        // Regular quiet hours: 10 PM - 7 AM
        return hour >= 22 || hour < 7;
    }

    async sendNotification(options: TimeAwareNotificationOptions): Promise<boolean> {
        const { userId, title, message, type, priority } = options;

        // High priority notifications bypass quiet hours
        if (priority === 'high') {
            return this.sendImmediately(userId, title, message, type);
        }

        // Check quiet hours for non-urgent notifications
        if (this.isQuietHours()) {
            logger.info('Queueing notification for user until quiet hours end', { userId });
            await this.queueNotification(options);
            return false;
        }

        return this.sendImmediately(userId, title, message, type);
    }

    private async sendImmediately(
        userId: string,
        title: string,
        message: string,
        type: string
    ): Promise<boolean> {
        const io = getIO();

        if (io) {
            io.to(`user_${userId}`).emit('notification', {
                title,
                message,
                type,
                timestamp: new Date().toISOString(),
            });
        }

        // Store in database
        await pool.query(
            `INSERT INTO notifications 
             (user_id, title, message, type, sent_at) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, title, message, type]
        );

        logger.info('Sent notification to user', { userId, title });
        return true;
    }

    private async queueNotification(options: TimeAwareNotificationOptions): Promise<void> {
        // Calculate next send time (after quiet hours)
        const now = new Date();
        const hour = now.getHours();

        let sendAt = new Date(now);

        if (this.isRamadan()) {
            // Send after Ramadan quiet hours
            if (hour >= 3 && hour < 5) {
                sendAt.setHours(5, 30, 0, 0);
            } else if (hour >= 21) {
                sendAt.setDate(sendAt.getDate() + 1);
                sendAt.setHours(7, 0, 0, 0);
            }
        } else {
            // Send at 7 AM
            if (hour >= 22) {
                sendAt.setDate(sendAt.getDate() + 1);
            }
            sendAt.setHours(7, 0, 0, 0);
        }

        await pool.query(
            `INSERT INTO queued_notifications 
             (user_id, title, message, type, priority, scheduled_for) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [options.userId, options.title, options.message, options.type, options.priority, sendAt]
        );

        logger.info('Notification queued', { sendAt: sendAt.toISOString() });
    }

    /**
     * Process queued notifications (run via cron job)
     */
    async processQueuedNotifications(): Promise<void> {
        if (this.isQuietHours()) {
            logger.info('Still in quiet hours, skipping queue processing');
            return;
        }

        const result = await pool.query(
            `SELECT * FROM queued_notifications 
             WHERE scheduled_for <= NOW() AND sent = false 
             ORDER BY priority DESC, scheduled_for ASC 
             LIMIT 100`
        );

        for (const notification of result.rows) {
            await this.sendImmediately(
                notification.user_id,
                notification.title,
                notification.message,
                notification.type
            );

            await pool.query(
                'UPDATE queued_notifications SET sent = true, sent_at = NOW() WHERE id = $1',
                [notification.id]
            );
        }

        logger.info('Processed queued notifications', { count: result.rows.length });
    }
}

export const smartNotificationService = new SmartNotificationService();
export default smartNotificationService;
