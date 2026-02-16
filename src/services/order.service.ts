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

export interface UndoOrderResult {
    success: boolean;
    message: string;
    order_status?: string;
    error?: string;
    expired?: boolean;
}

// ============================================
// ORDER CREATION
// ============================================

export interface CreateOrderParams {
    bidId: string;
    customerId: string;
    paymentMethod: string;
    deliveryNotes?: string;
    deliveryFee: number;
    deliveryZoneId: number | null;
    deliveryAddress: string;
}

/**
 * Create an order from an accepted bid.
 * Handles all transaction logic, status updates, and notifications.
 */
export async function createOrderFromBid(params: CreateOrderParams): Promise<{ order: any; totalAmount: number }> {
    const { bidId, customerId } = params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        // 1. Lock and Validate Bid
        const bidResult = await client.query(
            'SELECT * FROM bids WHERE bid_id = $1 FOR UPDATE',
            [bidId]
        );
        if (bidResult.rows.length === 0) {throw new Error('Bid not found');}
        const bid = bidResult.rows[0];

        if (bid.status !== 'pending') {throw new Error('Bid no longer available');}

        // 2. Lock and Validate Request
        const reqResult = await client.query(
            'SELECT * FROM part_requests WHERE request_id = $1 FOR UPDATE',
            [bid.request_id]
        );
        if (reqResult.rows.length === 0) {throw new Error('Request not found');}
        const request = reqResult.rows[0];

        if (request.customer_id !== customerId) {throw new Error('Access denied');}
        if (request.status !== 'active') {throw new Error('Request already processed');}

        // 2b. TURN VALIDATION: Customer cannot accept if they have a pending counter-offer
        // (meaning it's garage's turn to respond)
        const pendingCustomerOffer = await client.query(`
            SELECT counter_offer_id FROM counter_offers 
            WHERE bid_id = $1 AND offered_by_type = 'customer' AND status = 'pending'
        `, [bidId]);

        if (pendingCustomerOffer.rows.length > 0) {
            throw new Error('Cannot accept bid - waiting for garage response to your counter-offer');
        }


        // 3. Calculate Commission (Logic moved inline for transaction safety, ideally in GarageService)
        // Check demo/subscription status
        const garageRateResult = await client.query(`
            SELECT 
                g.approval_status,
                sp.commission_rate
            FROM garages g
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE g.garage_id = $1
            ORDER BY gs.created_at DESC LIMIT 1
        `, [bid.garage_id]);

        const garageStats = garageRateResult.rows[0];
        let commissionRate = 0.15; // Default

        if (garageStats) {
            if (garageStats.approval_status === 'demo') {
                commissionRate = 0;
            } else if (garageStats.commission_rate) {
                commissionRate = parseFloat(garageStats.commission_rate);
            }
        }

        // 4. Determine Final Price (Negotiation Logic)
        const negotiatedPriceResult = await client.query(
            `SELECT 
                COALESCE(
                    (SELECT proposed_amount FROM counter_offers 
                     WHERE bid_id = $1 AND status = 'accepted' AND offered_by_type = 'customer'
                     ORDER BY created_at DESC LIMIT 1),
                    (SELECT proposed_amount FROM counter_offers 
                     WHERE bid_id = $1 AND status = 'pending' AND offered_by_type = 'garage'
                     ORDER BY created_at DESC LIMIT 1),
                    (SELECT proposed_amount FROM counter_offers 
                     WHERE bid_id = $1 AND offered_by_type = 'garage'
                     ORDER BY created_at DESC LIMIT 1),
                    $2
                ) as final_price`,
            [bidId, bid.bid_amount]
        );

        const partPrice = parseFloat(negotiatedPriceResult.rows[0].final_price);
        const platformFee = Math.round(partPrice * commissionRate * 100) / 100;
        const totalAmount = partPrice + params.deliveryFee;
        const garagePayout = partPrice - platformFee;

        // 5. Create Order (with pending_payment status - requires delivery fee payment)
        // VVIP G-01: Set undo_deadline for 30-second grace window
        const orderResult = await client.query(
            `INSERT INTO orders 
             (request_id, bid_id, customer_id, garage_id, part_price, commission_rate, 
              platform_fee, delivery_fee, total_amount, garage_payout_amount, 
              payment_method, delivery_address, delivery_notes, order_status, deposit_amount, deposit_status,
              undo_deadline)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending_payment', $8, 'pending',
                     NOW() + INTERVAL '30 seconds')
             RETURNING order_id, order_number, order_status, undo_deadline`,
            [bid.request_id, bidId, customerId, bid.garage_id, partPrice, commissionRate,
                platformFee, params.deliveryFee, totalAmount, garagePayout,
            params.paymentMethod || 'card', params.deliveryAddress, params.deliveryNotes]
        );
        const order = orderResult.rows[0];

        // 6. Update Statuses
        await client.query("UPDATE bids SET status = 'accepted', updated_at = NOW() WHERE bid_id = $1", [bidId]);
        await client.query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE request_id = $1 AND bid_id != $2 AND status = 'pending'",
            [bid.request_id, bidId]
        );
        await client.query("UPDATE part_requests SET status = 'accepted', updated_at = NOW() WHERE request_id = $1", [bid.request_id]);

        // 7. Log History
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, NULL, 'pending_payment', $2, 'customer', 'Order created - awaiting delivery fee payment')`,
            [order.order_id, customerId]
        );

        await client.query('COMMIT');

        // 9. Notifications (Async) - CRITICAL FIX: Only notify customer at order creation
        // Garage is notified by Stripe webhook AFTER payment succeeds (stripe-webhook.routes.ts:130)
        // This prevents garage from starting work before payment is confirmed
        notifyCustomerOrderPending(order, customerId, totalAmount);

        // Notify Rejected Bidders
        notifyRejectedBidders(bid.request_id, bidId);

        return { order, totalAmount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}


/**
 * CRITICAL FIX: Customer-only notification for order creation
 * Garage is NOT notified here - they are notified by Stripe webhook after payment
 * See: stripe-webhook.routes.ts -> notifyGarageAsync()
 */
async function notifyCustomerOrderPending(order: any, customerId: string, totalAmount: number) {
    // Create in-app notification for customer only
    await import('../services/notification.service').then(ns => ns.createNotification({
        userId: customerId,
        type: 'order_pending_payment',
        title: 'Order Reserved ⏳',
        message: `Order #${order.order_number} reserved. Complete payment to confirm your order.`,
        data: {
            order_id: order.order_id,
            order_number: order.order_number,
            total_amount: totalAmount
        },
        target_role: 'customer'
    }));

    // Emit socket event to customer
    emitToUser(customerId, 'order_reserved', {
        order_id: order.order_id,
        order_number: order.order_number,
        total_amount: totalAmount,
        notification: `Order #${order.order_number} reserved. Please complete payment.`
    });
}

async function notifyRejectedBidders(requestId: string, winningBidId: string) {
    const rejectedBids = await pool.query(
        `SELECT DISTINCT garage_id FROM bids WHERE request_id = $1 AND bid_id != $2`,
        [requestId, winningBidId]
    );
    const ns = await import('../services/notification.service');
    for (const r of rejectedBids.rows) {
        await ns.createNotification({
            userId: r.garage_id,
            type: 'bid_rejected',
            title: 'Bid Update',
            message: "Another bid was selected for this request.",
            data: { request_id: requestId },
            target_role: 'garage'
        });
    }
}
export async function updateOrderStatus(update: OrderStatusUpdate): Promise<OrderCompletionResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current order state
        const orderResult = await client.query(`
            SELECT o.order_id, o.order_status, o.customer_id, o.garage_id, o.order_number,
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
 * Send notifications for order status changes
 * Sends push notification, in-app record, and WebSocket events
 */
function notifyOrderStatusChange(
    order: { order_id: string; customer_id: string; garage_id: string; order_number: string; garage_payout_amount?: number },
    oldStatus: string,
    newStatus: string,
    payoutCreated: boolean
): void {
    const isCompleted = newStatus === 'completed';

    // Customer notification
    const customerMsg = isCompleted
        ? `✅ Order #${order.order_number} has been completed.`
        : `Order #${order.order_number} status updated to ${newStatus}`;

    // Push notification to customer (async, fire-and-forget)
    import('./push.service').then(({ pushService }) => {
        pushService.sendOrderStatusNotification(
            order.customer_id,
            order.order_number,
            newStatus,
            order.order_id
        );
    }).catch(err => logger.error('Order status push failed', { error: err }));

    // In-app notification record for customer
    import('../services/notification.service').then(ns => {
        ns.createNotification({
            userId: order.customer_id,
            type: 'order_status',
            title: isCompleted ? '✅ Order Completed' : `Order #${order.order_number} Update`,
            message: customerMsg,
            data: { order_id: order.order_id, order_number: order.order_number, new_status: newStatus },
            target_role: 'customer'
        });
    }).catch(err => logger.error('Order status in-app notification failed', { error: err }));

    // WebSocket to customer
    emitToUser(order.customer_id, 'order_status_updated', {
        order_id: order.order_id,
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
               pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.part_category, pr.part_subcategory, pr.vin_number,
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

// ============================================
// UNDO ORDER (VVIP G-01)
// ============================================

/**
 * Undo an order within the 30-second grace window.
 * Idempotent: multiple calls return same result.
 * Reverts order, bid, and request statuses.
 * Creates audit trail for compliance.
 */
export async function undoOrder(
    orderId: string,
    actorId: string,
    actorType: 'customer' | 'garage',
    reason?: string
): Promise<UndoOrderResult> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock order for update
        const orderResult = await client.query(
            `SELECT order_id, order_status, customer_id, garage_id, bid_id, request_id,
                    undo_deadline, undo_used, order_number
             FROM orders WHERE order_id = $1 FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, message: 'Order not found', error: 'ORDER_NOT_FOUND' };
        }

        const order = orderResult.rows[0];

        // Authorization check
        if (actorType === 'customer' && order.customer_id !== actorId) {
            await client.query('ROLLBACK');
            return { success: false, message: 'Access denied', error: 'ACCESS_DENIED' };
        }
        if (actorType === 'garage' && order.garage_id !== actorId) {
            await client.query('ROLLBACK');
            return { success: false, message: 'Access denied', error: 'ACCESS_DENIED' };
        }

        // Idempotency: already undone
        if (order.undo_used) {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'Order already undone',
                order_status: 'cancelled_by_undo'
            };
        }

        // Check grace window
        const now = new Date();
        const deadline = new Date(order.undo_deadline);
        if (now > deadline) {
            // Log expired attempt
            await client.query(`
                INSERT INTO undo_audit_log (order_id, action, actor_id, actor_type, reason, metadata)
                VALUES ($1, 'undo_expired', $2, $3, $4, $5)
            `, [orderId, actorId, actorType, reason || 'Grace window expired',
                JSON.stringify({ deadline: order.undo_deadline, attempted_at: now.toISOString() })]);

            await client.query('COMMIT');
            return {
                success: false,
                message: 'Undo window expired',
                error: 'UNDO_EXPIRED',
                expired: true
            };
        }

        // Check status allows undo
        if (!['pending_payment', 'confirmed'].includes(order.order_status)) {
            await client.query('ROLLBACK');
            return {
                success: false,
                message: `Cannot undo order in ${order.order_status} status`,
                error: 'INVALID_STATUS'
            };
        }

        // Revert order status
        await client.query(`
            UPDATE orders SET 
                order_status = 'cancelled_by_undo',
                undo_used = TRUE,
                undo_at = NOW(),
                undo_reason = $2,
                updated_at = NOW()
            WHERE order_id = $1
        `, [orderId, reason || 'User initiated undo']);

        // Revert bid status back to pending
        await client.query(`
            UPDATE bids SET status = 'pending', updated_at = NOW() 
            WHERE bid_id = $1
        `, [order.bid_id]);

        // Revert other rejected bids for this request back to pending
        await client.query(`
            UPDATE bids SET status = 'pending', updated_at = NOW()
            WHERE request_id = $1 AND status = 'rejected'
        `, [order.request_id]);

        // Revert request status back to active
        await client.query(`
            UPDATE part_requests SET status = 'active', updated_at = NOW()
            WHERE request_id = $1
        `, [order.request_id]);

        // Record in order history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, 'cancelled_by_undo', $3, $4, $5)
        `, [orderId, order.order_status, actorId, actorType, reason || 'Order undone within grace window']);

        // Create audit log entry
        await client.query(`
            INSERT INTO undo_audit_log (order_id, action, actor_id, actor_type, reason, metadata)
            VALUES ($1, 'undo_completed', $2, $3, $4, $5)
        `, [orderId, actorId, actorType, reason || 'User initiated undo',
            JSON.stringify({
                original_status: order.order_status,
                deadline: order.undo_deadline,
                undone_at: now.toISOString()
            })]);

        await client.query('COMMIT');

        // Notify both parties
        emitToUser(order.customer_id, 'order_undone', {
            order_id: orderId,
            order_number: order.order_number,
            message: 'Order has been undone. You can select a different bid.'
        });
        emitToGarage(order.garage_id, 'order_undone', {
            order_id: orderId,
            order_number: order.order_number,
            message: 'Order was undone by customer.'
        });

        logger.info('Order undone successfully', {
            orderId,
            actorId,
            actorType,
            originalStatus: order.order_status
        });

        return {
            success: true,
            message: 'Order undone successfully',
            order_status: 'cancelled_by_undo'
        };

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Undo order failed', { orderId, error: getErrorMessage(err) });
        return { success: false, message: 'Undo failed', error: getErrorMessage(err) };
    } finally {
        client.release();
    }
}
