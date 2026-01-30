/**
 * Expo Push Notification Service
 * 
 * Enterprise-grade push notification service using Expo's Push API.
 * Sends notifications to users even when app is backgrounded or phone is locked.
 * 
 * @module services/push.service
 */

import pool from '../config/db';

// Expo Push API endpoint
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
    to: string;
    sound?: 'default' | null;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: 'default' | 'normal' | 'high';
    badge?: number;
    channelId?: string;
}

interface PushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

interface ExpoResponse {
    data: PushTicket[];
}

interface SendResult {
    success: boolean;
    ticketId?: string;
    error?: string;
}

class PushService {
    /**
     * Register a push token for a user
     */
    async registerToken(
        userId: string,
        token: string,
        platform: 'ios' | 'android',
        appType: 'customer' | 'driver' = 'customer',
        deviceId?: string
    ): Promise<void> {
        // Validate Expo push token format
        if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
            console.warn('[Push] Invalid token format:', token.substring(0, 30));
            return;
        }

        await pool.query(`
            INSERT INTO push_tokens (user_id, token, platform, app_type, device_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (user_id, token) 
            DO UPDATE SET 
                platform = EXCLUDED.platform,
                app_type = EXCLUDED.app_type,
                device_id = EXCLUDED.device_id,
                is_active = true,
                updated_at = NOW()
        `, [userId, token, platform, appType, deviceId]);

        console.log('[Push] Token registered for user:', userId, appType);
    }

    /**
     * Unregister a push token (on logout)
     */
    async unregisterToken(userId: string, token?: string): Promise<void> {
        if (token) {
            await pool.query(
                'UPDATE push_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND token = $2',
                [userId, token]
            );
        } else {
            // Deactivate all tokens for user
            await pool.query(
                'UPDATE push_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1',
                [userId]
            );
        }
        console.log('[Push] Token(s) deactivated for user:', userId);
    }

    /**
     * Get active push tokens for a user
     */
    async getTokensForUser(userId: string): Promise<string[]> {
        const result = await pool.query(
            'SELECT token FROM push_tokens WHERE user_id = $1 AND is_active = true',
            [userId]
        );
        return result.rows.map(row => row.token);
    }

    /**
     * Send push notification to a single user
     */
    async sendToUser(
        userId: string,
        title: string,
        body: string,
        data?: Record<string, any>,
        options?: { sound?: boolean; badge?: number; channelId?: string }
    ): Promise<SendResult[]> {
        const tokens = await this.getTokensForUser(userId);

        if (tokens.length === 0) {
            console.log('[Push] No active tokens for user:', userId);
            return [];
        }

        const messages: PushMessage[] = tokens.map(token => ({
            to: token,
            sound: options?.sound !== false ? 'default' : null,
            title,
            body,
            data: { ...data, timestamp: new Date().toISOString() },
            priority: 'high',
            badge: options?.badge,
            channelId: options?.channelId || 'default',
        }));

        return this.sendMessages(messages, userId);
    }

    /**
     * Send push notification to multiple users
     */
    async sendToUsers(
        userIds: string[],
        title: string,
        body: string,
        data?: Record<string, any>
    ): Promise<Map<string, SendResult[]>> {
        const results = new Map<string, SendResult[]>();

        // Batch fetch all tokens
        const tokenResult = await pool.query(
            'SELECT user_id, token FROM push_tokens WHERE user_id = ANY($1) AND is_active = true',
            [userIds]
        );

        // Group tokens by user
        const tokensByUser = new Map<string, string[]>();
        for (const row of tokenResult.rows) {
            const tokens = tokensByUser.get(row.user_id) || [];
            tokens.push(row.token);
            tokensByUser.set(row.user_id, tokens);
        }

        // Build all messages
        const allMessages: PushMessage[] = [];
        const messageUserMap: string[] = []; // Track which user each message belongs to

        for (const [userId, tokens] of Array.from(tokensByUser.entries())) {
            for (const token of tokens) {
                allMessages.push({
                    to: token,
                    sound: 'default',
                    title,
                    body,
                    data: { ...data, userId, timestamp: new Date().toISOString() },
                    priority: 'high',
                });
                messageUserMap.push(userId);
            }
        }

        if (allMessages.length === 0) {
            console.log('[Push] No active tokens for any of the users');
            return results;
        }

        // Send in batches of 100 (Expo limit)
        const BATCH_SIZE = 100;
        for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
            const batch = allMessages.slice(i, i + BATCH_SIZE);
            const batchUserIds = messageUserMap.slice(i, i + BATCH_SIZE);
            const batchResults = await this.sendMessages(batch);

            // Map results back to users
            batchResults.forEach((result, idx) => {
                const userId = batchUserIds[idx];
                const userResults = results.get(userId) || [];
                userResults.push(result);
                results.set(userId, userResults);
            });
        }

        return results;
    }

    /**
     * Send messages to Expo Push API
     */
    private async sendMessages(messages: PushMessage[], userId?: string): Promise<SendResult[]> {
        try {
            const response = await fetch(EXPO_PUSH_API, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });

            if (!response.ok) {
                console.error('[Push] API error:', response.status, response.statusText);
                return messages.map(() => ({ success: false, error: `HTTP ${response.status}` }));
            }

            const data = await response.json() as ExpoResponse;
            const tickets: PushTicket[] = data.data || [];

            const results: SendResult[] = tickets.map((ticket, idx) => {
                if (ticket.status === 'ok') {
                    return { success: true, ticketId: ticket.id };
                } else {
                    // Handle invalid tokens
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        this.deactivateToken(messages[idx].to);
                    }
                    return { success: false, error: ticket.message || ticket.details?.error };
                }
            });

            const successCount = results.filter(r => r.success).length;
            console.log(`[Push] Sent ${successCount}/${messages.length} notifications${userId ? ` to user ${userId}` : ''}`);

            return results;
        } catch (error) {
            console.error('[Push] Send error:', error);
            return messages.map(() => ({ success: false, error: 'Network error' }));
        }
    }

    /**
     * Deactivate an invalid token
     */
    private async deactivateToken(token: string): Promise<void> {
        try {
            await pool.query(
                'UPDATE push_tokens SET is_active = false, updated_at = NOW() WHERE token = $1',
                [token]
            );
            console.log('[Push] Deactivated invalid token');
        } catch (err) {
            console.error('[Push] Failed to deactivate token:', err);
        }
    }

    /**
     * Send chat message notification
     */
    async sendChatNotification(
        recipientUserId: string,
        senderName: string,
        message: string,
        orderId: string,
        orderNumber: string
    ): Promise<void> {
        await this.sendToUser(
            recipientUserId,
            `💬 ${senderName}`,
            message.length > 100 ? message.substring(0, 100) + '...' : message,
            {
                type: 'chat_message',
                orderId,
                orderNumber,
            },
            { channelId: 'messages' }
        );
    }

    /**
     * Send new assignment notification to driver
     */
    async sendAssignmentNotification(
        driverUserId: string,
        orderNumber: string,
        pickupAddress: string,
        assignmentId: string
    ): Promise<void> {
        await this.sendToUser(
            driverUserId,
            '🚚 New Delivery Assignment!',
            pickupAddress ? `Pickup from: ${pickupAddress}` : `Order #${orderNumber}`,
            {
                type: 'new_assignment',
                assignmentId,
                orderNumber,
            },
            { channelId: 'assignments' } // CRITICAL: Use high-priority channel for drivers
        );
    }

    /**
     * Send order status notification to customer
     */
    async sendOrderStatusNotification(
        customerId: string,
        orderNumber: string,
        newStatus: string,
        orderId: string,
        additionalInfo?: { driverName?: string; garageName?: string }
    ): Promise<void> {
        const statusMessages: Record<string, { title: string; body: string }> = {
            'preparing': {
                title: '🔧 Part Being Prepared',
                body: `${additionalInfo?.garageName || 'Garage'} is preparing your part`
            },
            'ready_for_pickup': {
                title: '📦 Part Ready',
                body: `Your part is ready for collection`
            },
            'collected': {
                title: '✅ Part Collected',
                body: 'QScrap has collected your part for quality check'
            },
            'in_transit': {
                title: '🚗 Out for Delivery',
                body: additionalInfo?.driverName
                    ? `${additionalInfo.driverName} is on the way!`
                    : 'Your part is on its way!'
            },
            'delivered': {
                title: '🎉 Delivered!',
                body: `Order #${orderNumber} has arrived. Please confirm receipt.`
            },
        };

        const message = statusMessages[newStatus];
        if (!message) return;

        await this.sendToUser(
            customerId,
            message.title,
            message.body,
            {
                type: 'order_status',
                orderId,
                orderNumber,
                status: newStatus,
            },
            { channelId: 'orders' }
        );
    }
}

export const pushService = new PushService();
