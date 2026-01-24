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
                'SELECT customer_id, order_status, order_number FROM orders WHERE order_id = $1 AND garage_id = $2 FOR UPDATE',
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
                RETURNING garage_id, order_number, garage_payout_amount
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

            // Predictive maintenance suggestions (best effort)
            try {
                await this.sendPredictiveSuggestions(orderId, customerId);
            } catch (predErr) {
                console.error('[ORDER] Predictive service failed:', predErr);
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
            // Note: orders table doesn't have delivered_at column, using updated_at
            const result = await client.query(`
                UPDATE orders 
                SET order_status = 'delivered', 
                    pod_photo_url = $2,
                    updated_at = NOW()
                WHERE order_id = $1 
                  AND order_status = 'in_transit'
                RETURNING garage_id, customer_id, order_number, garage_payout_amount
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
                    delivery_photo_url = $2
                WHERE assignment_id = $3
            `, [orderId, podPhotoUrl, assignment.assignment_id]);

            // Log status change
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, 'in_transit', 'delivered', $2, 'driver', 'Driver confirmed delivery with POD')
            `, [orderId, driverId]);

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

            // Notify garage
            await createNotification({
                userId: order.garage_id,
                type: 'order_delivered',
                title: 'Order Delivered 📦',
                message: `Order #${order.order_number} delivered to customer. Awaiting confirmation.`,
                data: { order_id: orderId, order_number: order.order_number },
                target_role: 'garage'
            });

            // Socket emit for real-time update
            const io = (global as any).io;
            io.to(`user_${order.customer_id}`).emit('order_delivered', {
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
                SELECT o.order_id, o.order_number, o.garage_id, o.customer_id, o.garage_payout_amount
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
                    VALUES ($1, 'delivered', 'completed', 'system', 'system', 'Auto-completed after 48h timeout')
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
            }

            await client.query('COMMIT');

            // Log to console for monitoring
            console.log(`[AUTO-COMPLETE] Completed ${completedOrders.length} orders: ${completedOrders.join(', ')}`);

            return {
                completed_count: completedOrders.length,
                order_numbers: completedOrders
            };

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[AUTO-COMPLETE] Error:', err);
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
        await client.query(`
            UPDATE drivers 
            SET status = 'available', updated_at = NOW()
            WHERE driver_id = (SELECT driver_id FROM orders WHERE order_id = $1)
            AND driver_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM delivery_assignments 
                WHERE driver_id = drivers.driver_id 
                AND status IN ('assigned', 'picked_up', 'in_transit')
                AND order_id != $1
            )
        `, [orderId]);
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

        // Socket events
        const io = (global as any).io;
        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
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

            io.to('operations').emit('order_ready_for_pickup', {
                order_id: order.order_id,
                order_number: order.order_number
            });
        }
    }

    /**
     * Notify garage and operations about order completion
     */
    private async notifyOrderCompleted(order: any, orderId: string): Promise<void> {
        const io = (global as any).io;

        // Notify garage
        await createNotification({
            userId: order.garage_id,
            type: 'order_completed',
            title: 'Order Completed ✅',
            message: `Order #${order.order_number} delivered! Payment of ${order.garage_payout_amount} QAR will be processed soon.`,
            data: { order_id: orderId, order_number: order.order_number, payout_amount: order.garage_payout_amount },
            target_role: 'garage'
        });

        io.to(`garage_${order.garage_id}`).emit('order_completed', {
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

        io.to('operations').emit('payout_pending', {
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
