/**
 * QScrap Payout Service
 * 
 * Centralized service for payout management with proper reversal logic.
 * Ensures financial integrity between payouts and refunds.
 * 
 * Premium 2026 features:
 * - Payout creation on delivery confirmation
 * - Automatic reversal on refund
 * - Partial refund handling
 * - 2-way confirmation workflow support
 */

import pool from '../config/db';

export interface PayoutInfo {
    payout_id: string;
    garage_id: string;
    order_id: string;
    gross_amount: number;
    commission_amount: number;
    net_amount: number;
    payout_status: string;
}

export interface PayoutResult {
    success: boolean;
    payout_id?: string;
    message: string;
    action_taken?: string;
}

// ============================================
// PAYOUT CREATION
// ============================================

/**
 * Create payout for an order (called on customer delivery confirmation)
 * Uses INSERT ... ON CONFLICT to be idempotent
 */
export async function createPayout(orderId: string): Promise<PayoutResult> {
    try {
        const result = await pool.query(`
            INSERT INTO garage_payouts 
            (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
            SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                   CURRENT_DATE + INTERVAL '7 days'
            FROM orders o WHERE o.order_id = $1
            AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)
            RETURNING payout_id
        `, [orderId]);

        if (result.rowCount === 0) {
            return {
                success: true,
                message: 'Payout already exists for this order',
                action_taken: 'none'
            };
        }

        return {
            success: true,
            payout_id: result.rows[0].payout_id,
            message: 'Payout created successfully',
            action_taken: 'created'
        };
    } catch (err: any) {
        console.error('[PayoutService] createPayout error:', err.message);
        return { success: false, message: err.message };
    }
}

// ============================================
// PAYOUT REVERSAL (For Refunds)
// ============================================

/**
 * Reverse a payout when a refund is issued
 * Handles full and partial refunds appropriately
 */
export async function reversePayout(orderId: string, refundAmount: number): Promise<PayoutResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get the payout for this order
        const payoutResult = await client.query(`
            SELECT payout_id, garage_id, net_amount, payout_status, original_amount
            FROM garage_payouts 
            WHERE order_id = $1
            FOR UPDATE
        `, [orderId]);

        if (payoutResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'No payout exists for this order - nothing to reverse',
                action_taken: 'none'
            };
        }

        const payout = payoutResult.rows[0];

        // Determine if full or partial refund
        const isFullRefund = refundAmount >= payout.net_amount;

        if (isFullRefund) {
            // Full refund - cancel the payout entirely
            await client.query(`
                UPDATE garage_payouts 
                SET payout_status = 'cancelled',
                    original_amount = COALESCE(original_amount, net_amount),
                    net_amount = 0,
                    adjustment_reason = $2,
                    adjusted_at = NOW(),
                    failure_reason = 'Order refunded - payout cancelled'
                WHERE payout_id = $1
            `, [payout.payout_id, `Full refund of ${refundAmount} QAR issued`]);

            await client.query('COMMIT');

            // Notify garage
            try {
                (global as any).io?.to(`garage_${payout.garage_id}`).emit('payout_cancelled', {
                    payout_id: payout.payout_id,
                    order_id: orderId,
                    reason: 'Order refunded',
                    notification: '❌ Payout cancelled due to order refund'
                });
            } catch (e) {
                // Socket emission is best-effort
            }

            return {
                success: true,
                payout_id: payout.payout_id,
                message: 'Payout fully reversed due to refund',
                action_taken: 'cancelled'
            };
        } else {
            // Partial refund - adjust the payout amount
            const newNetAmount = payout.net_amount - refundAmount;

            await client.query(`
                UPDATE garage_payouts 
                SET original_amount = COALESCE(original_amount, net_amount),
                    net_amount = $2,
                    adjustment_reason = $3,
                    adjusted_at = NOW()
                WHERE payout_id = $1
            `, [payout.payout_id, newNetAmount, `Partial refund of ${refundAmount} QAR deducted`]);

            await client.query('COMMIT');

            // Notify garage
            try {
                (global as any).io?.to(`garage_${payout.garage_id}`).emit('payout_adjusted', {
                    payout_id: payout.payout_id,
                    order_id: orderId,
                    original_amount: payout.net_amount,
                    new_amount: newNetAmount,
                    adjustment: refundAmount,
                    notification: `⚠️ Payout reduced by ${refundAmount} QAR due to partial refund`
                });
            } catch (e) {
                // Socket emission is best-effort
            }

            return {
                success: true,
                payout_id: payout.payout_id,
                message: `Payout reduced by ${refundAmount} QAR`,
                action_taken: 'adjusted'
            };
        }
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[PayoutService] reversePayout error:', err.message);
        return { success: false, message: err.message };
    } finally {
        client.release();
    }
}

// ============================================
// PAYOUT STATUS HELPERS
// ============================================

/**
 * Get payout info for an order
 */
export async function getPayoutByOrderId(orderId: string): Promise<PayoutInfo | null> {
    try {
        const result = await pool.query(`
            SELECT payout_id, garage_id, order_id, gross_amount, 
                   commission_amount, net_amount, payout_status
            FROM garage_payouts 
            WHERE order_id = $1
        `, [orderId]);

        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        return null;
    }
}

/**
 * Check if payout can be safely processed (no active disputes)
 */
export async function canProcessPayout(orderId: string): Promise<{ canProcess: boolean; reason?: string }> {
    try {
        // Check for active disputes
        const disputeResult = await pool.query(`
            SELECT dispute_id, status FROM disputes 
            WHERE order_id = $1 AND status IN ('pending', 'contested', 'under_review')
        `, [orderId]);

        if (disputeResult.rows.length > 0) {
            return {
                canProcess: false,
                reason: `Active dispute (${disputeResult.rows[0].status})`
            };
        }

        // Check for pending refunds
        const refundResult = await pool.query(`
            SELECT refund_id, refund_status FROM refunds 
            WHERE order_id = $1 AND refund_status IN ('pending', 'processing')
        `, [orderId]);

        if (refundResult.rows.length > 0) {
            return {
                canProcess: false,
                reason: `Pending refund (${refundResult.rows[0].refund_status})`
            };
        }

        return { canProcess: true };
    } catch (err: any) {
        return { canProcess: false, reason: err.message };
    }
}

// Export service functions
export default {
    createPayout,
    reversePayout,
    getPayoutByOrderId,
    canProcessPayout
};
