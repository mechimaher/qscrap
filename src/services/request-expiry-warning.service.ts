/**
 * Request Expiry Warning Service
 * Notifies customers 2 hours before their request expires
 * Run this as a cron job every 15 minutes
 */

import pool from '../config/db';
import { createNotification } from './notification.service';
import { logger } from '../utils/logger';

export const checkExpiringRequests = async (): Promise<number> => {
    try {
        // Find requests expiring in next 2-2.25 hours that haven't been notified
        const result = await pool.query(`
            SELECT 
                pr.request_id,
                pr.customer_id,
                pr.part_description,
                pr.expires_at,
                COALESCE(COUNT(DISTINCT b.bid_id), 0) as bid_count
            FROM part_requests pr
            LEFT JOIN bids b ON pr.request_id = b.request_id
            WHERE pr.status = 'active'
            AND pr.expires_at > NOW()
            AND pr.expires_at <= NOW() + INTERVAL '2 hours 15 minutes'
            AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = pr.customer_id
                AND n.notification_type = 'request_expiry_warning'
                AND n.data->>'request_id' = pr.request_id::text
            )
            GROUP BY pr.request_id, pr.customer_id, pr.part_description, pr.expires_at
        `);

        for (const request of result.rows) {
            const hoursLeft = Math.round(
                (new Date(request.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
            );

            const bidMessage = request.bid_count > 0
                ? `${request.bid_count} bid${request.bid_count > 1 ? 's' : ''} waiting!`
                : 'No bids yet.';

            await createNotification({
                userId: request.customer_id,
                type: 'request_expiry_warning',
                title: '⏰ Request Expiring Soon',
                message: `Your request expires in ${hoursLeft} hours. ${bidMessage}`,
                data: {
                    request_id: request.request_id,
                    part_description: request.part_description,
                    expires_at: request.expires_at,
                    bid_count: request.bid_count,
                    hours_remaining: hoursLeft
                },
                target_role: 'customer'
            });

            logger.info('[ExpiryWarning] Sent notification', {
                request_id: request.request_id,
                customer_id: request.customer_id,
                bid_count: request.bid_count
            });
        }

        return result.rows.length;
    } catch (error) {
        logger.error('[ExpiryWarning] Error checking expiring requests:', { error });
        return 0;
    }
};

// Export for cron job integration
export default { checkExpiringRequests };
