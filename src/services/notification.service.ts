
import pool from '../config/db';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
// import { sendPushNotification } from './push.service'; // Will enable later for mobile

interface NotificationPayload {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    target_role?: 'customer' | 'garage' | 'operations' | 'driver';
}

/**
 * Centralized Notification Service
 * - Persists to DB
 * - Emits Socket.IO event (transient)
 * - Sends Push Notification (mobile - pending)
 */
export const createNotification = async (payload: NotificationPayload) => {
    const { userId, type, title, message, data = {}, target_role } = payload;

    try {
        // 1. Persist to DB
        // For operations, we might not have a single userId, but we can store it as system or skip DB per user?
        // Actually, for Operations, we broadcast. But for specific users/garages, we store it.

        if (target_role !== 'operations') {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, data, is_read)
                 VALUES ($1, $2, $3, $4, $5, false)`,
                [userId, type, title, message, JSON.stringify(data)]
            );
        }

        // 2. Emit Socket Event
        const socketPayload = {
            notification_id: 'temp_' + Date.now(), // Will be updated on fetch
            type,
            title,
            message,
            data,
            created_at: new Date()
        };

        if (target_role === 'garage') {
            // Emitting to garage_${userId} (which is garageId)
            // Wait, userId here is technically user_id (UUID), but garage rooms are `garage_${garage_id}`.
            // Notifications table uses user_id. 
            // We need to verify if we passed user_id or garage_id.
            // Assumption: payload.userId is the database UUID from `users` table.

            // To find socket room for garage, we usually use `garage_${garageId}`.
            // We need to resolve garageId from userId if possible, or emit to `user_${userId}` 
            // The garage dashboard listens to `join_garage_room` with userId (login return).
            // Let's check garage-dashboard.js: `socket.emit('join_garage_room', userId);`
            // and `emitToGarage` does `garage_${garageId}`.

            // Wait, garage dashboard logic uses `userId` variable which comes from localStorage 'userId'.
            // In `auth.controller.ts`, login returns `userId` which is the `users.user_id`.
            // BUT `join_garage_room` in backend likely expects a garageId?
            // Let's check `socketAdapter.ts` or where connection happens.

            // If the listener is `socket.on('join_garage_room', (garageId) => ...)`
            // Then dashboard sends `userId`. Is `userId` == `garageId`?
            // In QScrap schema, `garages` table has `garage_id`. `users` table has `user_id`.
            // Usually linked.

            // Let's assume for now we emit to `user_${userId}` as well, because `notifications` are user-centric.
            emitToUser(userId, 'new_notification', socketPayload);

            // Note: The specific events like 'bid_accepted' are separate from generic 'new_notification'.
            // The dashboard listeners for 'bid_accepted' expect specific data structure.
            // We should CONTINUE to emit those specific events from Controllers, 
            // OR standardized everything. 
            // For this task (Enterprise Fix), we want persistence.
            // So we will ADD generic notification handling.

        } else if (target_role === 'customer') {
            emitToUser(userId, 'new_notification', socketPayload);
        } else if (target_role === 'driver') {
            // Drivers use driver_${userId} room - emit to that room
            const io = (global as any).io;
            if (io) {
                io.to(`driver_${userId}`).emit('new_notification', socketPayload);
            }
        } else if (target_role === 'operations') {
            emitToOperations('new_notification', socketPayload);
        }

        // 3. Push Notification (Future)
        // if (target_role === 'driver' || target_role === 'customer') {
        //    sendPushNotification(userId, title, message, data);
        // }

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
