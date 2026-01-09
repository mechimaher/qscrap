
import pool from '../config/db';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { pushService } from './push.service';

interface NotificationPayload {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    target_role?: 'customer' | 'garage' | 'operations' | 'driver';
}

/**
 * Map notification types to Android channels for proper sound/vibration
 */
const getChannelId = (type: string): string => {
    // Driver high-priority channels
    if (type.includes('assignment') || type === 'new_assignment') return 'assignments';

    // Customer order channels
    if (type.includes('order') || type.includes('delivery') || type === 'driver_assigned') return 'orders';

    // Bid/negotiation channels
    if (type.includes('bid') || type.includes('counter_offer')) return 'bids';

    // Chat/support channels
    if (type.includes('chat') || type.includes('support') || type.includes('message')) return 'messages';

    return 'default';
};

/**
 * Centralized Notification Service
 * - Persists to DB
 * - Emits Socket.IO event (transient)
 * - Sends Expo Push Notification (mobile)
 */
export const createNotification = async (payload: NotificationPayload) => {
    const { userId, type, title, message, data = {}, target_role } = payload;

    try {
        // 1. Persist to DB (skip operations - they don't have user-specific storage)
        if (target_role !== 'operations') {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, data, is_read)
                 VALUES ($1, $2, $3, $4, $5, false)`,
                [userId, type, title, message, JSON.stringify(data)]
            );
        }

        // 2. Emit Socket Event for real-time updates
        const socketPayload = {
            notification_id: 'temp_' + Date.now(),
            type,
            title,
            message,
            data,
            created_at: new Date()
        };

        if (target_role === 'garage') {
            emitToUser(userId, 'new_notification', socketPayload);
        } else if (target_role === 'customer') {
            emitToUser(userId, 'new_notification', socketPayload);
        } else if (target_role === 'driver') {
            const io = (global as any).io;
            if (io) {
                io.to(`driver_${userId}`).emit('new_notification', socketPayload);
            }
        } else if (target_role === 'operations') {
            emitToOperations('new_notification', socketPayload);
        }

        // 3. Send Expo Push Notification (for mobile apps - customer & driver)
        if (target_role === 'customer' || target_role === 'driver') {
            try {
                await pushService.sendToUser(
                    userId,
                    title,
                    message,
                    { ...data, type, timestamp: new Date().toISOString() },
                    {
                        sound: true,
                        channelId: getChannelId(type)
                    }
                );
                console.log(`[NotificationService] Push sent to ${target_role}: ${userId}`);
            } catch (pushErr) {
                // Don't fail the entire notification if push fails
                console.error('[NotificationService] Push failed:', pushErr);
            }
        }

        return true;
    } catch (err) {
        console.error('[NotificationService] Failed to create notification:', err);
        return false;
    }
};

/**
 * Mark notifications as read
 */
export const markNotificationsRead = async (userId: string, notificationIds: string[]) => {
    if (notificationIds.length === 0) return;

    // Handle "Mark All Read" case
    if (notificationIds.includes('all')) {
        await pool.query(
            `UPDATE notifications SET is_read = true 
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        return;
    }

    await pool.query(
        `UPDATE notifications SET is_read = true 
         WHERE user_id = $1 AND notification_id = ANY($2::uuid[])`,
        [userId, notificationIds]
    );
};

/**
 * Get notifications for user
 */
export const getUserNotifications = async (userId: string, limit = 50) => {
    const result = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
};

/**
 * Create multiple notifications efficiently (Batch Insert)
 */
export const createBatchNotifications = async (payloads: NotificationPayload[]) => {
    if (payloads.length === 0) return 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Prepare bulk insert
        // VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10), ...
        const values: any[] = [];
        const placeholders: string[] = [];
        let pIndex = 1;

        payloads.forEach(p => {
            if (p.target_role !== 'operations') {
                placeholders.push(`($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, false)`);
                values.push(p.userId, p.type, p.title, p.message, JSON.stringify(p.data || {}));
            }
        });

        if (placeholders.length > 0) {
            const query = `
                INSERT INTO notifications (user_id, type, title, message, data, is_read)
                VALUES ${placeholders.join(', ')}
            `;
            await client.query(query, values);
        }

        await client.query('COMMIT');

        // Emit socket events individually (or use room broadcast if applicable)
        // For distinct users, we must loop.
        const io = (global as any).io;
        if (io) {
            payloads.forEach(p => {
                const socketPayload = {
                    notification_id: 'temp_' + Date.now(),
                    type: p.type,
                    title: p.title,
                    message: p.message,
                    data: p.data,
                    created_at: new Date()
                };

                if (p.target_role === 'garage') {
                    io.to(`garage_${p.userId}`).emit('new_notification', socketPayload);
                } else if (p.target_role === 'customer') {
                    io.to(`user_${p.userId}`).emit('new_notification', socketPayload);
                } else if (p.target_role === 'driver') {
                    io.to(`driver_${p.userId}`).emit('new_notification', socketPayload);
                }
            });
        }

        return payloads.length;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[NotificationService] Batch create failed:', err);
        return 0;
    } finally {
        client.release();
    }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (userId: string) => {
    const result = await pool.query(
        `SELECT COUNT(*) FROM notifications 
         WHERE user_id = $1 AND is_read = false`,
        [userId]
    );
    return parseInt(result.rows[0].count);
};
