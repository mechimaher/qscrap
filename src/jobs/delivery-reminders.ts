/**
 * Delivery Confirmation Reminder Job
 * Sends push notifications to customers at T+24h and T+40h reminding them to confirm delivery
 */

import * as cron from 'node-cron';
import { getWritePool } from '../config/db';
import { pushService } from '../services/push.service';
import logger from '../utils/logger';

const pool = getWritePool();

/**
 * Send reminder notifications to customers with unconfirmed deliveries
 */
async function sendDeliveryReminders() {
    try {
        // Find orders delivered 24h ago (not confirmed yet)
        const reminders24h = await pool.query(`
            SELECT o.order_id, o.order_number, o.customer_id, o.delivered_at
            FROM orders o
            WHERE o.order_status = 'delivered'
              AND o.delivered_at >= NOW() - INTERVAL '25 hours'
              AND o.delivered_at < NOW() - INTERVAL '23 hours'
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n 
                  WHERE n.data->>'order_id' = o.order_id::text 
                  AND n.type = 'delivery_confirmation_reminder_24h'
              )
        `);

        // Find orders delivered 40h ago (final reminder before auto-complete)
        const reminders40h = await pool.query(`
            SELECT o.order_id, o.order_number, o.customer_id, o.delivered_at
            FROM orders o
            WHERE o.order_status = 'delivered'
              AND o.delivered_at >= NOW() - INTERVAL '41 hours'
              AND o.delivered_at < NOW() - INTERVAL '39 hours'
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n 
                  WHERE n.data->>'order_id' = o.order_id::text 
                  AND n.type = 'delivery_confirmation_reminder_40h'
              )
        `);

        let sent24h = 0;
        let sent40h = 0;

        // Send 24h reminders
        for (const order of reminders24h.rows) {
            await pushService.sendToUser(
                order.customer_id,
                'Please Confirm Your Delivery 📦',
                `Order #${order.order_number} was delivered yesterday. Please confirm receipt in the app.`,
                {
                    type: 'delivery_confirmation_reminder_24h',
                    order_id: order.order_id,
                    order_number: order.order_number
                },
                { channelId: 'orders' }
            );
            sent24h++;
        }

        // Send 40h reminders (urgent)
        for (const order of reminders40h.rows) {
            await pushService.sendToUser(
                order.customer_id,
                '⏰ Auto-Complete in 8 Hours',
                `Order #${order.order_number} will be automatically confirmed in 8 hours. Tap to confirm now or file a dispute if needed.`,
                {
                    type: 'delivery_confirmation_reminder_40h',
                    order_id: order.order_id,
                    order_number: order.order_number,
                    urgent: true
                },
                { channelId: 'orders', badge: 1 }
            );
            sent40h++;
        }

        if (sent24h > 0 || sent40h > 0) {
            logger.info('[DELIVERY-REMINDERS] Sent notifications', {
                reminders_24h: sent24h,
                reminders_40h: sent40h,
                total: sent24h + sent40h
            });
        }

    } catch (error) {
        logger.error('[DELIVERY-REMINDERS] Error sending reminders', error as any);
    }
}

/**
 * Schedule: Every hour to catch delivery reminders
 * Cron expression: "0 * * * *"
 */
export function startDeliveryReminderJob() {
    const enabled = process.env.DELIVERY_REMINDERS_ENABLED !== 'false';

    if (!enabled) {
        logger.info('[DELIVERY-REMINDERS] Disabled via environment variable');
        return;
    }

    cron.schedule('0 * * * *', async () => {
        await sendDeliveryReminders();
    });

    logger.info('[DELIVERY-REMINDERS] Scheduled to run hourly');
}
