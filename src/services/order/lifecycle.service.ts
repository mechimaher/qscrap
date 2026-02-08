/**
 * OrderLifecycleService - Order Status Transitions & Completion
 * Handles commission calculation, status updates, delivery confirmation, and payouts
 */

import { Pool, PoolClient } from 'pg';
import { StatusChange } from './types';
import {
    OrderNotFoundError,
    UnauthorizedOrderAccessError,
    InvalidStatusTransitionError,
    OrderNotDeliveredError
} from './errors';
import { createNotification } from '../notification.service';
import { predictiveService } from '../predictive.service';
import { LoyaltyService } from '../loyalty.service';
import logger from '../../utils/logger';
import { getIO } from '../../utils/socketIO';

export class OrderLifecycleService {
    constructor(private pool: Pool) { }

    /**
     * Get commission rate based on garage's subscription status
     * - Demo trial: 0% commission (garage keeps 100%)
     * - Subscribed: plan-specific rate (typically 15%)
     */
    async getGarageCommissionRate(garageId: string): Promise<number> {
        // Check if garage is in demo mode
        const garageResult = await this.pool.query(
            'SELECT approval_status FROM garages WHERE garage_id = $1',
            [garageId]
        );

        if (garageResult.rows.length > 0 && garageResult.rows[0].approval_status === 'demo') {
            return 0; // Demo = 0% commission
        }

        // Check for active subscription with custom commission rate
        const result = await this.pool.query(`
            SELECT sp.commission_rate 
            FROM garage_subscriptions gs
            JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
            ORDER BY gs.created_at DESC LIMIT 1
        `, [garageId]);

        return result.rows.length > 0 ? parseFloat(result.rows[0].commission_rate) : 0.15;
    }

    /**
     * Update order status (garage workflow only)
     * Garages can only transition: confirmed → preparing → ready_for_pickup
     */
    async updateOrderStatus(
        orderId: string,
        garageId: string,
        newStatus: string,
        notes?: string
    ): Promise<StatusChange> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ownership and get current status
            const check = await client.query(
                'SELECT order_id, customer_id, order_status, order_number FROM orders WHERE order_id = $1 AND garage_id = $2 FOR UPDATE',
                [orderId, garageId]
            );

            if (check.rows.length === 0) {
                throw new UnauthorizedOrderAccessError(orderId, garageId);
            }

            const currentOrder = check.rows[0];
            const oldStatus = currentOrder.order_status;

            // Idempotency check
            if (oldStatus === newStatus) {
                await client.query('ROLLBACK');
                return { old_status: oldStatus, new_status: newStatus };
            }

            // Validate transition
            const allowedTransitions: Record<string, string[]> = {
                'confirmed': ['preparing'],
                'preparing': ['ready_for_pickup']
            };

            const allowed = allowedTransitions[oldStatus] || [];
            if (!allowed.includes(newStatus)) {
                throw new InvalidStatusTransitionError(oldStatus, newStatus);
            }

            // Update order
            await client.query(
                'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
                [newStatus, orderId]
            );

            // Log status change
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, $2, $3, $4, 'garage', $5)
            `, [orderId, oldStatus, newStatus, garageId, notes]);

            await client.query('COMMIT');

            // Notifications (async, best effort)
            await this.notifyStatusChange(currentOrder, newStatus, garageId);

            return { old_status: oldStatus, new_status: newStatus };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Confirm delivery (customer)
     * Marks order complete, creates payout, releases driver
     */
    async confirmDelivery(orderId: string, customerId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE orders 
                SET order_status = 'completed', 
                    completed_at = NOW(),
                    payment_status = 'paid',
                    updated_at = NOW()
                WHERE order_id = $1 AND customer_id = $2 AND order_status = 'delivered'
                RETURNING garage_id, order_number, garage_payout_amount, part_price, delivery_fee, customer_id
            `, [orderId, customerId]);

            if (result.rows.length === 0) {
                throw new OrderNotDeliveredError(orderId);
            }

            const order = result.rows[0];

            // Log status change
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, 'delivered', 'completed', $2, 'customer', 'Customer confirmed receipt')
            `, [orderId, customerId]);

            // Create payout record
            await this.createPayoutForOrder(orderId, client);

            // Release driver
            await this.releaseDriver(orderId, client);

            await client.query('COMMIT');

            // Notifications
            await this.notifyOrderCompleted(order, orderId);

            // Award loyalty points (1 point per 10 QAR spent)
            try {
                const totalSpent = (parseFloat(order.part_price) || 0) + (parseFloat(order.delivery_fee) || 0);
                const pointsToAward = LoyaltyService.calculatePointsFromAmount(totalSpent);
                if (pointsToAward > 0) {
                    await LoyaltyService.addPoints(
                        order.customer_id,
                        pointsToAward,
                        'order_completion',
                        orderId,
                        `Earned ${pointsToAward} points for order #${order.order_number}`
                    );
                    logger.info('Loyalty points awarded', { points: pointsToAward, customerId: order.customer_id, orderId });
                }
            } catch (loyaltyErr) {
                logger.error('Failed to award loyalty points', { error: (loyaltyErr as Error).message });
                // Don't fail the order completion if loyalty fails
            }

            // Predictive maintenance suggestions (best effort)
            try {
                await this.sendPredictiveSuggestions(orderId, customerId);
            } catch (predErr) {
                logger.error('Predictive service failed', { error: (predErr as Error).message });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Mark order as delivered by driver (with POD)
     * Driver confirms delivery with proof of delivery photo
     * Order becomes 'delivered' - awaits customer confirmation or 48h auto-complete
     */
    async completeOrderByDriver(orderId: string, driverId: string, podPhotoUrl: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify driver assignment - must be in_transit
            const assignmentCheck = await client.query(`
                SELECT da.assignment_id, da.driver_id, d.user_id
                FROM delivery_assignments da
                JOIN drivers d ON da.driver_id = d.driver_id
                WHERE da.order_id = $1 
                  AND d.user_id = $2
                  AND da.status = 'in_transit'
            `, [orderId, driverId]);

            if (assignmentCheck.rows.length === 0) {
                throw new Error('No active delivery assignment found for this driver');
            }

            const assignment = assignmentCheck.rows[0];

            // Update order status: in_transit → delivered (NOT completed)
            // Customer confirmation or 48h auto-complete will mark as completed
            const result = await client.query(`
                UPDATE orders 
                SET order_status = 'delivered', 
                    delivered_at = NOW(),
                    pod_photo_url = $2,
                    updated_at = NOW()
                WHERE order_id = $1 
                  AND order_status = 'in_transit'
                RETURNING garage_id, customer_id, order_number, garage_payout_amount, total_amount, payment_method, payment_status
            `, [orderId, podPhotoUrl]);

            if (result.rows.length === 0) {
                throw new Error('Order not found or not in in_transit status');
            }

            const order = result.rows[0];

            // Update delivery assignment status
            await client.query(`
                UPDATE delivery_assignments
                SET status = 'delivered',
                    delivered_at = NOW(),
                    delivery_photo_url = $1
                WHERE assignment_id = $2
            `, [podPhotoUrl, assignment.assignment_id]);

            // Log status change
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, 'in_transit', 'delivered', $2, 'driver', 'Driver confirmed delivery with POD')
            `, [orderId, driverId]);

            // ============================================================
            // DRIVER PAYOUT & EARNINGS (Critical: was missing before!)
            // ============================================================
            const orderTotal = parseFloat(order.total_amount) || 0;
            const payoutAmount = Math.max(20, orderTotal * 0.15); // 15% of order total, min 20 QAR

            // 1. Create driver payout record
            await client.query(`
                INSERT INTO driver_payouts 
                    (driver_id, assignment_id, order_id, order_number, amount, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
            `, [assignment.driver_id, assignment.assignment_id, orderId, order.order_number, payoutAmount.toFixed(2)]);

            // 2. Update driver's total earnings
            await client.query(`
                UPDATE drivers SET 
                    total_earnings = COALESCE(total_earnings, 0) + $1,
                    total_deliveries = COALESCE(total_deliveries, 0) + 1,
                    updated_at = NOW()
                WHERE driver_id = $2
            `, [payoutAmount.toFixed(2), assignment.driver_id]);

            // 3. Wallet transactions (earning credit + COD debit)
            try {
                const { walletService } = await import('../wallet.service');

                // Credit delivery earning
                await walletService.addTransaction(
                    assignment.driver_id,
                    payoutAmount,
                    'earning',
                    orderId,
                    `Delivery Earning #${order.order_number}`
                );

                // Debit cash collection (if COD)
                if (order.payment_method === 'cash' || order.payment_status === 'pending') {
                    await walletService.addTransaction(
                        assignment.driver_id,
                        -orderTotal,
                        'cash_collection',
                        orderId,
                        `Cash Collected #${order.order_number}`
                    );
                }
            } catch (walletErr) {
                logger.error('Wallet transaction failed in POD completion', { error: (walletErr as Error).message });
                // Don't fail the delivery, just log
            }

            logger.info('Driver payout created via POD', {
                driver_id: assignment.driver_id,
                order_id: orderId,
                payout_amount: payoutAmount,
                order_total: orderTotal
            });

            // Release driver (they're done with this delivery)
            await this.releaseDriver(orderId, client);

            await client.query('COMMIT');

            // Notify customer - order delivered, awaiting confirmation
            await createNotification({
                userId: order.customer_id,
                type: 'order_delivered',
                title: 'Order Delivered! 📦',
                message: `Order #${order.order_number} has been delivered! Please confirm receipt.`,
                data: { order_id: orderId, order_number: order.order_number, pod_photo_url: podPhotoUrl },
                target_role: 'customer'
            });

            // PUSH: Customer - order delivered
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    order.customer_id,
                    'Order Delivered! 📦',
                    `Order #${order.order_number} has arrived! Please confirm receipt.`,
                    { type: 'order_delivered', order_id: orderId, order_number: order.order_number },
                    { channelId: 'orders', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to customer failed', { error: (pushErr as Error).message });
            }

            // Notify garage
            await createNotification({
                userId: order.garage_id,
                type: 'order_delivered',
                title: 'Order Delivered 📦',
                message: `Order #${order.order_number} delivered to customer. Awaiting confirmation.`,
                data: { order_id: orderId, order_number: order.order_number },
                target_role: 'garage'
            });

            // PUSH: Garage - order delivered
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    order.garage_id,
                    'Order Delivered 📦',
                    `Order #${order.order_number} delivered! Awaiting customer confirmation.`,
                    { type: 'order_delivered', order_id: orderId, order_number: order.order_number },
                    { channelId: 'orders', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to garage failed', { error: (pushErr as Error).message });
            }

            // Socket emit for real-time update
            const io = getIO();
            io?.to(`user_${order.customer_id}`).emit('order_delivered', {
                order_id: orderId,
                order_number: order.order_number,
                pod_photo_url: podPhotoUrl
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Auto-complete stale delivered orders (cron job)
     * Finds orders delivered 48+ hours ago with no disputes
     * Automatically marks as completed and creates payouts
     */
    async autoCompleteStaleOrders(): Promise<{ completed_count: number; order_numbers: string[] }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Find orders eligible for auto-completion
            const eligibleOrders = await client.query(`
                SELECT o.order_id, o.order_number, o.garage_id, o.customer_id, o.garage_payout_amount, o.part_price, o.delivery_fee
                FROM orders o
                WHERE o.order_status = 'delivered'
                  AND o.delivered_at < NOW() - INTERVAL '48 hours'
                  AND NOT EXISTS (
                      SELECT 1 FROM disputes d 
                      WHERE d.order_id = o.order_id 
                      AND d.status = 'open'
                  )
                FOR UPDATE
            `);

            const completedOrders: string[] = [];

            for (const order of eligibleOrders.rows) {
                // Mark as completed
                await client.query(`
                    UPDATE orders 
                    SET order_status = 'completed',
                        completed_at = NOW(),
                        payment_status = 'paid',
                        auto_completed = TRUE,
                        updated_at = NOW()
                    WHERE order_id = $1
                `, [order.order_id]);

                // Log status change
                await client.query(`
                    INSERT INTO order_status_history 
                    (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                    VALUES ($1, 'delivered', 'completed', NULL, 'system', 'Auto-completed after 48h timeout')
                `, [order.order_id]);

                // Create payout
                await this.createPayoutForOrder(order.order_id, client);

                // Release driver
                await this.releaseDriver(order.order_id, client);

                completedOrders.push(order.order_number);

                // Notify customer
                await createNotification({
                    userId: order.customer_id,
                    type: 'order_completed',
                    title: 'Order Auto-Completed ✅',
                    message: `Order #${order.order_number} has been automatically marked as complete.`,
                    data: { order_id: order.order_id, order_number: order.order_number, auto_completed: true },
                    target_role: 'customer'
                });

                // Notify garage
                await createNotification({
                    userId: order.garage_id,
                    type: 'order_completed',
                    title: 'Order Completed ✅',
                    message: `Order #${order.order_number} auto-completed. Payment of ${order.garage_payout_amount} QAR will be processed soon.`,
                    data: { order_id: order.order_id, order_number: order.order_number, payout_amount: order.garage_payout_amount },
                    target_role: 'garage'
                });

                // Award loyalty points (1 point per 10 QAR spent)
                try {
                    const totalSpent = (parseFloat(order.part_price) || 0) + (parseFloat(order.delivery_fee) || 0);
                    const pointsToAward = LoyaltyService.calculatePointsFromAmount(totalSpent);
                    if (pointsToAward > 0) {
                        await LoyaltyService.addPoints(
                            order.customer_id,
                            pointsToAward,
                            'order_completion',
                            order.order_id,
                            `Earned ${pointsToAward} points for order #${order.order_number} (auto-completed)`
                        );
                        logger.info('Loyalty points awarded for auto-complete', { points: pointsToAward, customerId: order.customer_id, orderId: order.order_id });
                    }
                } catch (loyaltyErr) {
                    logger.error('Failed to award points for auto-complete', { error: (loyaltyErr as Error).message });
                }
            }

            await client.query('COMMIT');

            // Log to console for monitoring
            logger.info('Auto-complete processed', { count: completedOrders.length, orders: completedOrders });

            return {
                completed_count: completedOrders.length,
                order_numbers: completedOrders
            };

        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Auto-complete error', { error: (err as Error).message });
            throw err;
        } finally {
            client.release();
        }
    }


    /**
     * Create payout record for garage (7-day schedule)
     */
    private async createPayoutForOrder(orderId: string, client: PoolClient): Promise<void> {
        await client.query(`
            INSERT INTO garage_payouts 
            (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
            SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                   CURRENT_DATE + INTERVAL '7 days'
            FROM orders o WHERE o.order_id = $1
            AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)
        `, [orderId]);
    }

    /**
     * Release driver if no other active assignments
     */
    private async releaseDriver(orderId: string, client: PoolClient): Promise<void> {
        // Get driver_id from delivery_assignments (not orders.driver_id which may be null)
        const driverResult = await client.query(`
            SELECT driver_id FROM delivery_assignments WHERE order_id = $1 LIMIT 1
        `, [orderId]);

        if (driverResult.rows.length === 0) {
            return; // No driver assigned
        }

        const driverId = driverResult.rows[0].driver_id;

        // Check if driver has other active assignments
        const activeCheck = await client.query(`
            SELECT 1 FROM delivery_assignments 
            WHERE driver_id = $1 
            AND status IN ('assigned', 'picked_up', 'in_transit')
            AND order_id != $2
            LIMIT 1
        `, [driverId, orderId]);

        if (activeCheck.rows.length === 0) {
            // No other active assignments, release driver
            await client.query(`
                UPDATE drivers 
                SET status = 'available', updated_at = NOW()
                WHERE driver_id = $1
            `, [driverId]);
        }
    }

    /**
     * Notify customer and operations about status change
     */
    private async notifyStatusChange(order: any, newStatus: string, garageId: string): Promise<void> {
        const statusMessages: Record<string, string> = {
            'preparing': '🔧 Your order is being prepared',
            'ready_for_pickup': '📦 Your order is ready and waiting for pickup'
        };

        const pushTitles: Record<string, string> = {
            'preparing': 'Order Preparing 🔧',
            'ready_for_pickup': 'Ready for Pickup 📦'
        };

        // Get garage name
        const garageResult = await this.pool.query(
            'SELECT garage_name FROM garages WHERE garage_id = $1',
            [garageId]
        );
        const garageName = garageResult.rows[0]?.garage_name || 'Garage';

        // Notify customer
        await createNotification({
            userId: order.customer_id,
            type: 'order_status_updated',
            title: pushTitles[newStatus] || 'Order Update 🔔',
            message: statusMessages[newStatus] || `Order status updated to ${newStatus}`,
            data: {
                order_id: order.order_id,
                order_number: order.order_number,
                old_status: order.order_status,
                new_status: newStatus,
                garage_name: garageName
            },
            target_role: 'customer'
        });

        // PUSH NOTIFICATION - Works when phone locked/background
        try {
            const { pushService } = await import('../push.service');
            await pushService.sendToUser(
                order.customer_id,
                pushTitles[newStatus] || 'Order Update 🔔',
                `Order #${order.order_number}: ${statusMessages[newStatus] || `Status: ${newStatus}`}`,
                { type: 'order_status_updated', order_id: order.order_id, order_number: order.order_number, new_status: newStatus },
                { channelId: 'orders', sound: true }
            );
        } catch (pushErr) {
            logger.error('Push notification failed', { error: (pushErr as Error).message });
        }

        // Socket events
        const io = getIO();
        io?.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id: order.order_id,
            order_number: order.order_number,
            status: newStatus,
            garage_name: garageName
        });

        // Notify operations when ready for pickup
        if (newStatus === 'ready_for_pickup') {
            await createNotification({
                userId: 'operations',
                type: 'order_ready_for_pickup',
                title: 'Ready for Collection 📦',
                message: `Order #${order.order_number} is ready for collection!`,
                data: { order_id: order.order_id, order_number: order.order_number },
                target_role: 'operations'
            });

            io?.to('operations').emit('order_ready_for_pickup', {
                order_id: order.order_id,
                order_number: order.order_number
            });
        }
    }

    /**
     * Notify garage and operations about order completion
     */
    private async notifyOrderCompleted(order: any, orderId: string): Promise<void> {
        const io = getIO();

        // Notify garage
        await createNotification({
            userId: order.garage_id,
            type: 'order_completed',
            title: 'Order Completed ✅',
            message: `Order #${order.order_number} delivered! Payment of ${order.garage_payout_amount} QAR will be processed soon.`,
            data: { order_id: orderId, order_number: order.order_number, payout_amount: order.garage_payout_amount },
            target_role: 'garage'
        });

        io?.to(`garage_${order.garage_id}`).emit('order_completed', {
            order_id: orderId,
            order_number: order.order_number,
            payout_amount: order.garage_payout_amount
        });

        // Notify operations
        await createNotification({
            userId: 'operations',
            type: 'order_completed',
            title: 'Order Completed',
            message: `Order #${order.order_number} completed - customer confirmed receipt`,
            data: { order_id: orderId, order_number: order.order_number, garage_id: order.garage_id },
            target_role: 'operations'
        });

        io?.to('operations').emit('payout_pending', {
            order_id: orderId,
            order_number: order.order_number,
            garage_id: order.garage_id,
            payout_amount: order.garage_payout_amount
        });
    }

    /**
     * Send predictive maintenance suggestions
     */
    private async sendPredictiveSuggestions(orderId: string, customerId: string): Promise<void> {
        const partDescResult = await this.pool.query(
            'SELECT part_description FROM part_requests WHERE request_id = (SELECT request_id FROM orders WHERE order_id = $1)',
            [orderId]
        );

        const partName = partDescResult.rows[0]?.part_description;
        if (!partName) return;

        const suggestions = predictiveService.getSuggestions(partName);
        if (suggestions.length > 0) {
            const suggestion = suggestions[0];
            await createNotification({
                userId: customerId,
                type: 'maintenance_reminder',
                title: '💡 Smart Tip for your Car',
                message: `Since you bought ${partName}, we recommend a ${suggestion.service_name} soon.`,
                data: { suggestion },
                target_role: 'customer'
            });
        }
    }
}
