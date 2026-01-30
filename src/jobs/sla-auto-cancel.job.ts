/**
 * SLA Auto-Cancel Job (HR-03)
 * Automatically cancels orders stuck in preparing state for too long
 * 
 * Runs: Every 6 hours
 * Target: Orders in preparing > 72 hours (3 days)
 * 
 * Source: Cancellation Audit Jan 30, 2026 - HR-03 fix
 */

import { getWritePool } from '../config/db';
import { CancellationService } from '../services/cancellation/cancellation.service';
import { createNotification } from '../services/notification.service';
import { emitToOperations } from '../utils/socketIO';
import logger from '../utils/logger';

const SLA_THRESHOLD_HOURS = 72; // 72 hours = 3 days

export async function runSLAAutoCancel(): Promise<{
    cancelled_count: number;
    order_numbers: string[];
}> {
    const pool = getWritePool();
    const cancellationService = new CancellationService(pool);

    try {
        // Find SLA-breaching orders: preparing for > 72 hours
        const stuckResult = await pool.query(`
            SELECT o.order_id, o.order_number, o.customer_id, o.garage_id,
                   o.total_amount, o.payment_status,
                   g.garage_name,
                   o.created_at, o.updated_at
            FROM orders o
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE o.order_status = 'preparing' 
              AND o.updated_at < NOW() - INTERVAL '${SLA_THRESHOLD_HOURS} hours'
            ORDER BY o.updated_at ASC
            LIMIT 20
        `);

        const stuckOrders = stuckResult.rows;
        const cancelledOrders: string[] = [];

        if (stuckOrders.length === 0) {
            logger.info('[SLA-CANCEL] No SLA-breaching orders found');
            return { cancelled_count: 0, order_numbers: [] };
        }

        logger.info(`[SLA-CANCEL] Found ${stuckOrders.length} orders stuck in preparing > ${SLA_THRESHOLD_HOURS}h`);

        // System user ID for operations cleanup
        const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

        for (const order of stuckOrders) {
            try {
                // Cancel with full refund (garage's fault for not progressing)
                await cancellationService.cancelOrderByOperations(
                    order.order_id,
                    SYSTEM_USER_ID,
                    `Auto-cancel: Order stuck in preparing for ${SLA_THRESHOLD_HOURS}+ hours. SLA breach by garage.`,
                    {
                        refund_type: order.payment_status === 'paid' ? 'full' : 'none',
                        notify_customer: true,
                        notify_garage: true
                    }
                );

                // Send special notification to customer apologizing for delay
                await createNotification({
                    userId: order.customer_id,
                    type: 'order_sla_cancelled',
                    title: '😔 Order Cancelled - Delay Apology',
                    message: `We apologize! Order #${order.order_number} was cancelled because the garage (${order.garage_name}) took too long. Full refund processed.`,
                    data: {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        reason: 'garage_sla_breach'
                    },
                    target_role: 'customer'
                });

                // Flag garage for review
                await pool.query(`
                    INSERT INTO garage_penalties 
                    (garage_id, order_id, penalty_type, amount, status, notes)
                    VALUES ($1, $2, 'sla_breach', 0, 'warning', 'Auto-flagged: Order stuck in preparing > 72h')
                `, [order.garage_id, order.order_id]);

                cancelledOrders.push(order.order_number);
                logger.info(`[SLA-CANCEL] Cancelled order ${order.order_number} (garage: ${order.garage_name})`);
            } catch (err: any) {
                logger.error(`[SLA-CANCEL] Failed to cancel order ${order.order_number}:`, { error: err.message });
            }
        }

        // Notify operations dashboard
        if (cancelledOrders.length > 0) {
            emitToOperations('sla_orders_cancelled', {
                count: cancelledOrders.length,
                order_numbers: cancelledOrders,
                reason: `Stuck in preparing > ${SLA_THRESHOLD_HOURS}h`,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`[SLA-CANCEL] Completed. Cancelled ${cancelledOrders.length} orders.`);

        return {
            cancelled_count: cancelledOrders.length,
            order_numbers: cancelledOrders
        };
    } catch (err: any) {
        logger.error('[SLA-CANCEL] Job failed:', { error: err.message });
        throw err;
    }
}

// Manual trigger for testing
export async function runSLAAutoCancelNow() {
    return runSLAAutoCancel();
}
