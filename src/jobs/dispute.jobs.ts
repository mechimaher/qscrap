/**
 * Dispute Jobs
 * Handles auto-resolution of disputes after timeout
 */

import { Pool } from 'pg';
import logger from '../utils/logger';

export async function autoResolveDisputes(pool: Pool): Promise<number> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find disputes pending for more than 48 hours
        const result = await client.query(`
            SELECT d.dispute_id, d.order_id, d.customer_id, d.refund_amount,
                   o.garage_id, o.order_number
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            WHERE d.status = 'pending'
              AND d.created_at < NOW() - INTERVAL '48 hours'
        `);

        let resolvedCount = 0;

        for (const dispute of result.rows) {
            // Auto-approve in favor of customer
            await client.query(`
                UPDATE disputes 
                SET status = 'resolved',
                    resolution = 'auto_approved',
                    resolution_notes = 'Auto-resolved: No garage response within 48 hours',
                    resolved_at = NOW(),
                    resolved_by = NULL
                WHERE dispute_id = $1
            `, [dispute.dispute_id]);

            // Update order to refunded
            await client.query(`
                UPDATE orders SET order_status = 'refunded', updated_at = NOW()
                WHERE order_id = $1
            `, [dispute.order_id]);

            // Add to order history
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by_type, reason)
                VALUES ($1, 'disputed', 'refunded', 'system', 'Auto-resolved dispute - no garage response')
            `, [dispute.order_id]);

            resolvedCount++;

            // Notify customer
            const io = (global as any).io;
            if (io) {
                io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
                    order_id: dispute.order_id,
                    order_number: dispute.order_number,
                    notification: '✅ Your dispute has been auto-approved. Refund will be processed.',
                    refund_amount: dispute.refund_amount
                });
            }
        }

        await client.query('COMMIT');

        if (resolvedCount > 0) {
            logger.jobComplete('autoResolveDisputes', { count: resolvedCount });
        }

        return resolvedCount;
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('autoResolveDisputes failed', { error: (err as Error).message });
        return 0;
    } finally {
        client.release();
    }
}
