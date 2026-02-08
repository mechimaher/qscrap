/**
 * Order Jobs
 * Handles auto-confirmation of deliveries
 */

import { Pool } from 'pg';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

export async function autoConfirmDeliveries(pool: Pool): Promise<number> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find orders delivered for more than 24 hours
        const result = await client.query(`
            UPDATE orders 
            SET order_status = 'completed', 
                updated_at = NOW()
            WHERE order_status = 'delivered'
              AND updated_at < NOW() - INTERVAL '24 hours'
            RETURNING order_id, order_number, customer_id, garage_id, 
                      total_amount, garage_payout_amount
        `);

        const confirmedCount = result.rowCount || 0;

        if (confirmedCount > 0) {
            logger.jobComplete('autoConfirmDeliveries', { count: confirmedCount, gracePeriodHours: 24 });

            // Record in order status history
            for (const order of result.rows) {
                await client.query(`
                    INSERT INTO order_status_history 
                    (order_id, old_status, new_status, changed_by_type, reason)
                    VALUES ($1, 'delivered', 'completed', 'system', 
                            'Auto-confirmed after 24-hour grace period. Customer did not respond.')
                `, [order.order_id]);
            }

            await client.query('COMMIT');

            // Socket notifications
            const io = getIO();
            if (io) {
                for (const order of result.rows) {
                    io.to(`user_${order.customer_id}`).emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        notification: `✅ Order #${order.order_number} was auto-confirmed after 24 hours. Thank you for your purchase!`
                    });

                    io.to(`garage_${order.garage_id}`).emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        payout_amount: order.garage_payout_amount,
                        notification: `✅ Order #${order.order_number} auto-confirmed. Payout of ${order.garage_payout_amount} QAR will be scheduled.`
                    });

                    io.to('operations').emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        notification: `📦 Order #${order.order_number} auto-confirmed (24h grace period expired)`
                    });
                }
            }
        } else {
            await client.query('COMMIT');
        }

        return confirmedCount;
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('autoConfirmDeliveries failed', { error: (err as Error).message });
        return 0;
    } finally {
        client.release();
    }
}
