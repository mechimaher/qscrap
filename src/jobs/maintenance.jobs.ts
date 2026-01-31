/**
 * Maintenance Jobs
 * Handles cleanup and stale data management
 */

import { Pool } from 'pg';
import logger from '../utils/logger';

export async function cleanupOldData(pool: Pool): Promise<void> {
    try {
        // Delete read notifications older than 30 days
        const notifResult = await pool.query(`
            DELETE FROM notifications 
            WHERE is_read = true 
              AND created_at < NOW() - INTERVAL '30 days'
        `);

        // Delete old order status history (keep last 90 days)
        const historyResult = await pool.query(`
            DELETE FROM order_status_history 
            WHERE created_at < NOW() - INTERVAL '90 days'
              AND order_id IN (
                  SELECT order_id FROM orders 
                  WHERE order_status IN ('completed', 'refunded', 'cancelled_by_customer', 'cancelled_by_garage')
              )
        `);

        logger.info('Cleanup complete', {
            notifications: notifResult.rowCount || 0,
            historyRecords: historyResult.rowCount || 0
        });
    } catch (err) {
        logger.error('cleanupOldData failed', { error: (err as Error).message });
    }
}

// abandonStaleInspections function removed 2026-02-01
// QC workflow was cancelled - quality_inspections table is orphaned and will be dropped

/**
 * Auto-escalate support tickets without response after 24 hours
 * Sets priority to 'urgent' and notifies operations
 */
export async function escalateStaleTickets(pool: Pool): Promise<number> {
    try {
        // Import SupportService dynamically to avoid circular dependencies
        const { SupportService } = await import('../services/support/support.service');
        const supportService = new SupportService(pool);

        const result = await supportService.escalateStaleTickets();

        if (result.escalated > 0) {
            logger.warn('Tickets auto-escalated', { count: result.escalated });

            const io = (global as any).io;
            if (io) {
                io.to('operations').emit('tickets_escalated', {
                    count: result.escalated,
                    tickets: result.tickets,
                    notification: `⚠️ ${result.escalated} ticket(s) auto-escalated: No response after 24 hours`
                });
            }
        }

        return result.escalated;
    } catch (err) {
        logger.error('escalateStaleTickets failed', { error: (err as Error).message });
        return 0;
    }
}
