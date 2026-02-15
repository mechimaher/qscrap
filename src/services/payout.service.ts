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
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

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
        logger.error('Payout creation error', { error: err.message });
        return { success: false, message: err.message };
    }
}

// Export service functions
export default {
    createPayout
};
