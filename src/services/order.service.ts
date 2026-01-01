/**
 * Order Service
 * 
 * Centralized business logic for order operations.
 * Extracted from operations.controller.ts and order.controller.ts
 */

import pool from '../config/db';
import logger from '../utils/logger';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { getErrorMessage } from '../types';

// ============================================
// TYPES
// ============================================

export interface OrderStatusUpdate {
    orderId: string;
    newStatus: string;
    changedBy: string;
    changedByType: 'customer' | 'garage' | 'operations' | 'system';
    reason?: string;
}

export interface OrderCompletionResult {
    success: boolean;
    payoutCreated: boolean;
    driverReleased: boolean;
    error?: string;
}

// ============================================
// ORDER STATUS MANAGEMENT
// ============================================

/**
 * Update order status with full history tracking and notifications
 */
export async function updateOrderStatus(update: OrderStatusUpdate): Promise<OrderCompletionResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current order state
        const orderResult = await client.query(`
            SELECT o.order_status, o.customer_id, o.garage_id, o.order_number,
                   o.part_price, o.platform_fee, o.garage_payout_amount, o.driver_id
            FROM orders o WHERE o.order_id = $1 FOR UPDATE
        `, [update.orderId]);

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];
        const oldStatus = order.order_status;

        // Build update query
        let updateQuery = `UPDATE orders SET order_status = $1, updated_at = NOW()`;
        const updateParams: unknown[] = [update.newStatus];

        // Special handling for 'completed' status
        if (update.newStatus === 'completed') {
            updateQuery += `, completed_at = NOW(), payment_status = 'paid'`;
        }

        updateQuery += ` WHERE order_id = $${updateParams.length + 1}`;
        updateParams.push(update.orderId);

        await client.query(updateQuery, updateParams);

        // Record in history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason, changed_by_type)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [update.orderId, oldStatus, update.newStatus, update.changedBy, update.reason || 'Status updated', update.changedByType]);

        let payoutCreated = false;
        let driverReleased = false;

        // If completing the order, create payout and free driver
        if (update.newStatus === 'completed') {
            // Create payout record (skip if exists)
            const payoutResult = await client.query(`
                INSERT INTO garage_payouts 
                (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
                SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                       CURRENT_DATE + INTERVAL '7 days'
                FROM orders o WHERE o.order_id = $1
                AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)
                RETURNING payout_id
            `, [update.orderId]);
            payoutCreated = (payoutResult.rowCount || 0) > 0;

            // Free up the driver
            if (order.driver_id) {
                const driverResult = await client.query(`
                    UPDATE drivers 
                    SET status = 'available', updated_at = NOW()
                    WHERE driver_id = $1
                    AND NOT EXISTS (
                        SELECT 1 FROM delivery_assignments 
                        WHERE driver_id = drivers.driver_id 
                        AND status IN ('assigned', 'picked_up', 'in_transit')
                        AND order_id != $2
                    )
                `, [order.driver_id, update.orderId]);
                driverReleased = (driverResult.rowCount || 0) > 0;
            }
        }

        await client.query('COMMIT');

        // Send notifications
        notifyOrderStatusChange(order, oldStatus, update.newStatus, payoutCreated);

        logger.info('Order status updated', {
            orderId: update.orderId,
            oldStatus,
            newStatus: update.newStatus,
            payoutCreated,
            driverReleased
        });

        return { success: true, payoutCreated, driverReleased };
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Order status update failed', { orderId: update.orderId, error: getErrorMessage(err) });
        return { success: false, payoutCreated: false, driverReleased: false, error: getErrorMessage(err) };
    } finally {
        client.release();
    }
}

/**
 * Send socket notifications for order status changes
 */
function notifyOrderStatusChange(
    order: { customer_id: string; garage_id: string; order_number: string; garage_payout_amount?: number },
    oldStatus: string,
    newStatus: string,
    payoutCreated: boolean
): void {
    const isCompleted = newStatus === 'completed';

    // Customer notification
    const customerMsg = isCompleted
        ? `✅ Order #${order.order_number} has been completed.`
        : `Order #${order.order_number} status updated to ${newStatus}`;

    emitToUser(order.customer_id, 'order_status_updated', {
        order_number: order.order_number,
        old_status: oldStatus,
        new_status: newStatus,
        notification: customerMsg
    });

    // Garage notification
    const garageMsg = isCompleted
        ? `✅ Order #${order.order_number} completed. Payment will be processed.`
        : `Order #${order.order_number} status updated to ${newStatus}`;

    emitToGarage(order.garage_id, 'order_status_updated', {
        order_number: order.order_number,
        old_status: oldStatus,
        new_status: newStatus,
        notification: garageMsg
    });

    // Operations notification for completed orders
    if (isCompleted && payoutCreated) {
        emitToOperations('payout_pending', {
            order_number: order.order_number,
            garage_id: order.garage_id,
            payout_amount: order.garage_payout_amount,
            notification: `💰 Order #${order.order_number} complete - payout pending`
        });
    }
}

// ============================================
// ORDER QUERIES
// ============================================

/**
 * Get order with all related details
 */
export async function getOrderWithDetails(orderId: string): Promise<unknown | null> {
    const result = await pool.query(`
        SELECT o.*, 
               pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.vin_number,
               u.full_name as customer_name, u.phone_number as customer_phone,
               g.garage_name, gu.phone_number as garage_phone,
               b.bid_amount, b.part_condition, b.warranty_days
        FROM orders o
        JOIN part_requests pr ON o.request_id = pr.request_id
        JOIN users u ON o.customer_id = u.user_id
        JOIN garages g ON o.garage_id = g.garage_id
        JOIN users gu ON g.garage_id = gu.user_id
        LEFT JOIN bids b ON o.bid_id = b.bid_id
        WHERE o.order_id = $1
    `, [orderId]);

    return result.rows[0] || null;
}

/**
 * Get order status history
 */
export async function getOrderHistory(orderId: string): Promise<unknown[]> {
    const result = await pool.query(`
        SELECT history_id, order_id, old_status, new_status as status, 
               changed_by, reason, created_at as changed_at
        FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
    `, [orderId]);

    return result.rows;
}
