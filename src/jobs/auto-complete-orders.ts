/**
 * Auto-Complete Stale Orders Cron Job
 * Runs daily at 2:00 AM to auto-complete orders delivered 48+ hours ago
 */

import * as cron from 'node-cron';
import { getWritePool } from '../config/db';
import { OrderLifecycleService } from '../services/order/lifecycle.service';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

const lifecycleService = new OrderLifecycleService(getWritePool());

/**
 * Schedule: Every day at 2:00 AM
 * Cron expression: "0 2 * * *"
 */
export function startAutoCompleteJob() {
    const enabled = process.env.AUTO_COMPLETE_ENABLED !== 'false';

    if (!enabled) {
        logger.info('[AUTO-COMPLETE-JOB] Disabled via environment variable');
        return;
    }

    cron.schedule('0 2 * * *', async () => {
        logger.info('[AUTO-COMPLETE-JOB] Starting auto-completion job...');

        try {
            const result = await lifecycleService.autoCompleteStaleOrders();

            logger.info('[AUTO-COMPLETE-JOB] Completed successfully', {
                completed_count: result.completed_count,
                order_numbers: result.order_numbers
            });

            // Emit to operations dashboard
            const io = getIO();
            if (io) {
                io.to('operations').emit('auto_complete_summary', {
                    completed_count: result.completed_count,
                    order_numbers: result.order_numbers,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            logger.error('[AUTO-COMPLETE-JOB] Error during auto-completion', error as any);
        }
    });

    logger.info('[AUTO-COMPLETE-JOB] Scheduled to run daily at 2:00 AM');
}

/**
 * Manual trigger for testing
 */
export async function runAutoCompleteNow(): Promise<{ completed_count: number; order_numbers: string[] }> {
    logger.info('[AUTO-COMPLETE-JOB] Manual trigger initiated');
    return await lifecycleService.autoCompleteStaleOrders();
}
