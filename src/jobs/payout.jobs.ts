/**
 * Payout Jobs
 * Handles payout scheduling, auto-processing, and confirmation
 */

import { Pool } from 'pg';
import logger from '../utils/logger';

export async function schedulePendingPayouts(pool: Pool): Promise<number> {
    try {
        const result = await pool.query(`
            INSERT INTO garage_payouts (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
            SELECT 
                o.garage_id,
                o.order_id,
                o.part_price as gross_amount,
                o.platform_fee as commission_amount,
                o.garage_payout_amount as net_amount,
                CURRENT_DATE + INTERVAL '7 days' as scheduled_for
            FROM orders o
            LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
            WHERE o.order_status = 'completed'
              AND o.payment_status = 'paid'
              AND gp.payout_id IS NULL
            RETURNING payout_id, garage_id, order_id, net_amount
        `);

        const scheduledCount = result.rowCount || 0;

        if (scheduledCount > 0) {
            logger.jobComplete('schedulePendingPayouts', { count: scheduledCount });

            const io = (global as any).io;
            if (io) {
                for (const payout of result.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_scheduled', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        amount: payout.net_amount,
                        scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        notification: `💰 Payout of ${payout.net_amount} QAR scheduled. Processing in 7 days.`
                    });
                }
            }
        }

        return scheduledCount;
    } catch (err) {
        logger.error('schedulePendingPayouts failed', { error: (err as Error).message });
        return 0;
    }
}

export async function autoProcessPayouts(pool: Pool): Promise<{ processed: number; held: number }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Hold payouts for orders with active disputes
        const holdResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'on_hold',
                failure_reason = 'Order has an active dispute - payout held pending resolution'
            FROM disputes d
            WHERE gp.order_id = d.order_id
              AND gp.payout_status = 'pending'
              AND d.status IN ('pending', 'under_review', 'contested')
            RETURNING gp.payout_id, gp.garage_id, gp.order_id
        `);

        const heldCount = holdResult.rowCount || 0;
        if (heldCount > 0) {
            logger.warn('Payouts held due to disputes', { count: heldCount });

            const io = (global as any).io;
            if (io) {
                for (const payout of holdResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_held', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        reason: 'Active dispute on order',
                        notification: '⚠️ Payout held: Order has an active dispute pending resolution.'
                    });
                }
            }
        }

        // Auto-process eligible payouts
        const processResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'completed',
                payout_method = 'auto_transfer',
                payout_reference = 'AUTO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
                processed_at = NOW()
            WHERE gp.payout_status = 'pending'
              AND gp.scheduled_for <= CURRENT_DATE
              AND NOT EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status IN ('pending', 'under_review', 'contested')
              )
            RETURNING gp.payout_id, gp.garage_id, gp.order_id, gp.net_amount, gp.payout_reference
        `);

        const processedCount = processResult.rowCount || 0;

        if (processedCount > 0) {
            logger.jobComplete('autoProcessPayouts', { processed: processedCount });

            const io = (global as any).io;
            if (io) {
                for (const payout of processResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_completed', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        amount: payout.net_amount,
                        reference: payout.payout_reference,
                        notification: `✅ Payment of ${payout.net_amount} QAR has been processed! Reference: ${payout.payout_reference}`
                    });
                }
            }
        }

        // Release payouts where dispute is resolved in garage's favor
        const releaseResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'pending',
                failure_reason = NULL,
                scheduled_for = CURRENT_DATE + INTERVAL '1 day'
            WHERE gp.payout_status = 'on_hold'
              AND NOT EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status IN ('pending', 'under_review', 'contested')
              )
              AND EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status = 'resolved' 
                  AND d.resolution NOT IN ('refund_approved', 'auto_approved')
              )
            RETURNING gp.payout_id, gp.garage_id
        `);

        if ((releaseResult.rowCount || 0) > 0) {
            logger.info('Payouts released after dispute resolution', { count: releaseResult.rowCount });

            const io = (global as any).io;
            if (io) {
                for (const payout of releaseResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_released', {
                        payout_id: payout.payout_id,
                        notification: '🔓 Payout released! Dispute resolved in your favor. Payment processing tomorrow.'
                    });
                }
            }
        }

        await client.query('COMMIT');

        return { processed: processedCount, held: heldCount };
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('autoProcessPayouts failed', { error: (err as Error).message });
        return { processed: 0, held: 0 };
    } finally {
        client.release();
    }
}

export async function autoConfirmPayouts(pool: Pool): Promise<number> {
    try {
        const result = await pool.query(`
            UPDATE garage_payouts 
            SET payout_status = 'completed',
                confirmed_at = NOW(),
                auto_confirmed = true,
                garage_confirmation_notes = 'Auto-confirmed: No response within 7-day confirmation window'
            WHERE payout_status = 'awaiting_confirmation'
              AND confirmation_deadline < NOW()
            RETURNING payout_id, garage_id, net_amount, order_id
        `);

        const confirmedCount = result.rowCount || 0;

        if (confirmedCount > 0) {
            logger.jobComplete('autoConfirmPayouts', { count: confirmedCount });

            const io = (global as any).io;
            if (io) {
                for (const payout of result.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_auto_confirmed', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        amount: payout.net_amount,
                        notification: `💰 Payout of ${payout.net_amount} QAR auto-confirmed after 7 days`
                    });
                }
            }
        }

        return confirmedCount;
    } catch (err) {
        logger.error('autoConfirmPayouts failed', { error: (err as Error).message });
        return 0;
    }
}
