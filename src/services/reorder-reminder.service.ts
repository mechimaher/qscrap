/**
 * Reorder Reminder Service
 * Sends reorder reminders to customers 30 days after their last completed order
 */

import pool from '../config/db';
import { createNotification } from './notification.service';
import { logger } from '../utils/logger';

export const sendReorderReminders = async (): Promise<number> => {
    try {
        // Find customers with completed orders exactly 30 days ago
        // who haven't placed a new order since
        const result = await pool.query(`
            WITH last_orders AS (
                SELECT DISTINCT ON (customer_id)
                    customer_id,
                    order_id,
                    part_description,
                    car_make,
                    car_model,
                    car_year,
                    garage_name,
                    completed_at
                FROM orders
                WHERE order_status = 'completed'
                AND completed_at IS NOT NULL
                ORDER BY customer_id, completed_at DESC
            )
            SELECT 
                lo.customer_id,
                lo.order_id,
                lo.part_description,
                lo.car_make,
                lo.car_model,
                lo.car_year,
                lo.garage_name,
                lo.completed_at
            FROM last_orders lo
            WHERE lo.completed_at::date = (CURRENT_DATE - INTERVAL '30 days')::date
            AND NOT EXISTS (
                SELECT 1 FROM orders o2
                WHERE o2.customer_id = lo.customer_id
                AND o2.created_at > lo.completed_at
            )
            AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = lo.customer_id
                AND n.notification_type = 'reorder_reminder'
                AND n.created_at > lo.completed_at
            )
        `);

        let remindersSent = 0;

        for (const order of result.rows) {
            await createNotification({
                userId: order.customer_id,
                type: 'reorder_reminder',
                title: '🔄 Time for Maintenance?',
                message: `It's been 30 days since your ${order.part_description} order. Need another part for your ${order.car_make} ${order.car_model}?`,
                data: {
                    previous_order_id: order.order_id,
                    part_description: order.part_description,
                    car_make: order.car_make,
                    car_model: order.car_model,
                    car_year: order.car_year,
                    garage_name: order.garage_name,
                    days_since_order: 30
                },
                target_role: 'customer'
            });

            remindersSent++;

            logger.info('[ReorderReminder] Sent reminder', {
                customer_id: order.customer_id,
                previous_order_id: order.order_id
            });
        }

        return remindersSent;
    } catch (error) {
        logger.error('[ReorderReminder] Error sending reminders:', { error });
        return 0;
    }
};

// Export for cron job integration
export default { sendReorderReminders };
