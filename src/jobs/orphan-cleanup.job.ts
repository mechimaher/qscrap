/**
 * Orphan Cleanup Job (HR-02)
 * Automatically cancels stuck orders in pending_payment state
 * 
 * Runs: Every hour
 * Target: Orders in pending_payment > 2 hours old
 * 
 * Source: Cancellation Audit Jan 30, 2026 - HR-02 fix
 */

import { getWritePool } from '../config/db';
import { CancellationService } from '../services/cancellation/cancellation.service';
import { emitToOperations } from '../utils/socketIO';
import logger from '../utils/logger';

const ORPHAN_THRESHOLD_HOURS = 2; // Orders stuck longer than this are considered orphan

export async function runOrphanCleanup(): Promise<{
    cleaned_count: number;
    order_numbers: string[];
}> {
    const pool = getWritePool();
    const cancellationService = new CancellationService(pool);

    try {
        // Find orphan orders: pending_payment for > 2 hours
        const orphanResult = await pool.query(`
            SELECT order_id, order_number, customer_id, garage_id, 
                   created_at, bid_id
            FROM orders 
            WHERE order_status = 'pending_payment' 
              AND created_at < NOW() - INTERVAL '${ORPHAN_THRESHOLD_HOURS} hours'
            ORDER BY created_at ASC
            LIMIT 50
        `);

        const orphanOrders = orphanResult.rows;
        const cleanedOrders: string[] = [];

        if (orphanOrders.length === 0) {
            logger.info('[ORPHAN-CLEANUP] No orphan orders found');
            return { cleaned_count: 0, order_numbers: [] };
        }

        logger.info(`[ORPHAN-CLEANUP] Found ${orphanOrders.length} orphan orders to clean up`);

        // System user ID for operations cleanup
        const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

        for (const order of orphanOrders) {
            try {
                // Use operations cancel which handles bid release
                await cancellationService.cancelOrderByOperations(
                    order.order_id,
                    SYSTEM_USER_ID,
                    `Auto-cleanup: Order stuck in pending_payment for ${ORPHAN_THRESHOLD_HOURS}+ hours`,
                    {
                        refund_type: 'none', // No payment was made
                        notify_customer: true,
                        notify_garage: true
                    }
                );

                cleanedOrders.push(order.order_number);
                logger.info(`[ORPHAN-CLEANUP] Cleaned order ${order.order_number}`);
            } catch (err: any) {
                logger.error(`[ORPHAN-CLEANUP] Failed to clean order ${order.order_number}:`, { error: err.message });
            }
        }

        // Notify operations dashboard
        if (cleanedOrders.length > 0) {
            emitToOperations('orphan_orders_cleaned', {
                count: cleanedOrders.length,
                order_numbers: cleanedOrders,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`[ORPHAN-CLEANUP] Completed. Cleaned ${cleanedOrders.length} orders.`);

        return {
            cleaned_count: cleanedOrders.length,
            order_numbers: cleanedOrders
        };
    } catch (err: any) {
        logger.error('[ORPHAN-CLEANUP] Job failed:', { error: err.message });
        throw err;
    }
}

// Manual trigger for testing (called from operations controller)
export async function runOrphanCleanupNow() {
    return runOrphanCleanup();
}
