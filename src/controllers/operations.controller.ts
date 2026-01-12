import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { createNotification } from '../services/notification.service';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import logger from '../utils/logger';

// Type for SQL query parameters - uses unknown for flexibility with Express query params
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlParams = unknown[];

import { cacheGetOrSet, CacheTTL, dashboardStatsKey, invalidateDashboardCache } from '../utils/cache';

// Get live dashboard stats (CACHED: 1 minute TTL for real-time feel)
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await cacheGetOrSet(
            dashboardStatsKey(),
            async () => {
                const result = await pool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM orders WHERE order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded')) as active_orders,
                        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'pending') as pending_disputes,
                        (SELECT COUNT(*) FROM disputes WHERE status = 'contested') as contested_disputes,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'in_transit') as in_transit,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'delivered') as awaiting_confirmation,
                        (SELECT COUNT(*) FROM orders WHERE order_status = 'ready_for_pickup') as ready_for_pickup,
                        (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage')) as revenue_today,
                        (SELECT COUNT(*) FROM part_requests WHERE status = 'active') as pending_requests,
                        (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as total_customers,
                        (SELECT COUNT(*) FROM garages) as total_garages
                `);
                return result.rows[0];
            },
            CacheTTL.SHORT // 1 minute - stats change frequently
        );

        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get all orders with filters
export const getOrders = async (req: AuthRequest, res: Response) => {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let query = `
            SELECT o.*, 
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   g.garage_name, gu.phone_number as garage_phone
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            WHERE 1=1
        `;
        const params: SqlParams = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            // Handle 'cancelled' as a group of all cancelled statuses
            if (status === 'cancelled') {
                query += ` AND o.order_status LIKE 'cancelled%'`;
            } else if (typeof status === 'string' && status.includes(',')) {
                // Handle comma-separated statuses (e.g., "delivered,completed")
                const statuses = status.split(',').map(s => s.trim());
                query += ` AND o.order_status IN (${statuses.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
                params.push(...statuses);
                paramIndex += statuses.length;
            } else {
                query += ` AND o.order_status = $${paramIndex++}`;
                params.push(status);
            }
        }

        if (search) {
            query += ` AND (o.order_number ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR pr.part_description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(Number(limit), offset);

        const result = await pool.query(query, params);

        // Get total count with same filters
        let countQuery = `SELECT COUNT(*) FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE 1=1`;
        const countParams: SqlParams = [];
        let countParamIndex = 1;

        if (status && status !== 'all') {
            if (status === 'cancelled') {
                countQuery += ` AND o.order_status LIKE 'cancelled%'`;
            } else if (typeof status === 'string' && status.includes(',')) {
                // Handle comma-separated statuses (e.g., "delivered,completed")
                const statuses = status.split(',').map(s => s.trim());
                countQuery += ` AND o.order_status IN (${statuses.map((_, i) => `$${countParamIndex + i}`).join(', ')})`;
                countParams.push(...statuses);
                countParamIndex += statuses.length;
            } else {
                countQuery += ` AND o.order_status = $${countParamIndex++}`;
                countParams.push(status);
            }
        }
        if (search) {
            countQuery += ` AND (o.order_number ILIKE $${countParamIndex} OR u.full_name ILIKE $${countParamIndex} OR pr.part_description ILIKE $${countParamIndex})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            orders: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err) {
        console.error('getOrders Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get order details with full history
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;

    try {
        const orderResult = await pool.query(`
            SELECT o.*, 
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.vin_number, pr.image_urls as request_images,
                   u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                   g.garage_name, gu.phone_number as garage_phone, g.address as garage_address,
                   b.bid_amount, b.part_condition, b.warranty_days, b.notes as bid_notes, b.image_urls as bid_photos
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            LEFT JOIN bids b ON o.bid_id = b.bid_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get status history
        const historyResult = await pool.query(`
            SELECT history_id, order_id, old_status, new_status as status, changed_by, reason, created_at as changed_at
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [order_id]);

        // Get dispute if exists
        const disputeResult = await pool.query(`
            SELECT * FROM disputes WHERE order_id = $1
        `, [order_id]);

        res.json({
            order: orderResult.rows[0],
            status_history: historyResult.rows,
            dispute: disputeResult.rows[0] || null
        });
    } catch (err) {
        console.error('getOrderDetails Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Update order status (admin override)
// Special handling for 'completed' status: creates payout, frees driver
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { new_status, notes } = req.body;
    const staffId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current status with all needed fields including garage_name
        const orderResult = await client.query(
            `SELECT o.order_status, o.customer_id, o.garage_id, o.order_number, 
                    o.part_price, o.platform_fee, o.garage_payout_amount, o.driver_id,
                    g.garage_name
             FROM orders o
             JOIN garages g ON o.garage_id = g.garage_id
             WHERE o.order_id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const oldStatus = orderResult.rows[0].order_status;
        const order = orderResult.rows[0];

        // Build the update query based on new_status
        let updateQuery = `UPDATE orders SET order_status = $1, updated_at = NOW()`;
        const updateParams: SqlParams = [new_status];

        // Special handling for 'completed' status
        if (new_status === 'completed') {
            updateQuery += `, completed_at = NOW(), payment_status = 'paid'`;
        }

        updateQuery += ` WHERE order_id = $${updateParams.length + 1}`;
        updateParams.push(order_id);

        await client.query(updateQuery, updateParams);

        // Record in history
        await client.query(
            `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason, changed_by_type)
             VALUES ($1, $2, $3, $4, $5, 'operations')`,
            [order_id, oldStatus, new_status, staffId, notes || 'Manually updated by Operations']
        );

        // If completing the order, create payout and free driver
        if (new_status === 'completed') {
            // Create payout record for garage (skip if already exists)
            await client.query(
                `INSERT INTO garage_payouts 
                 (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
                 SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                        CURRENT_DATE + INTERVAL '7 days'
                 FROM orders o WHERE o.order_id = $1
                 AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)`,
                [order_id]
            );

            // Free up the driver - set status back to available if no other active assignments
            if (order.driver_id) {
                await client.query(
                    `UPDATE drivers 
                     SET status = 'available', updated_at = NOW()
                     WHERE driver_id = $1
                     AND NOT EXISTS (
                         SELECT 1 FROM delivery_assignments 
                         WHERE driver_id = drivers.driver_id 
                         AND status IN ('assigned', 'picked_up', 'in_transit')
                         AND order_id != $2
                     )`,
                    [order.driver_id, order_id]
                );
            }
        }

        await client.query('COMMIT');

        // Invalidate dashboard stats cache so UI updates immediately
        await invalidateDashboardCache();

        // Notify customer and garage
        const io = (global as any).io;

        const customerNotification = new_status === 'completed'
            ? `✅ Order #${order.order_number} has been marked as completed by Operations.`
            : `Order #${order.order_number} status updated to ${new_status}`;

        const garageNotification = new_status === 'completed'
            ? `✅ Order #${order.order_number} completed. Payment will be processed soon.`
            : `Order #${order.order_number} status updated to ${new_status}`;

        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: oldStatus,
            new_status,
            garage_name: order.garage_name,
            notification: customerNotification
        });

        io.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: oldStatus,
            new_status,
            notification: garageNotification
        });

        // Notify Operations about completion and pending payout
        if (new_status === 'completed') {
            io.to('operations').emit('order_completed', {
                order_id,
                order_number: order.order_number,
                notification: `Order #${order.order_number} manually completed by Operations`
            });

            io.to('operations').emit('payout_pending', {
                order_id,
                order_number: order.order_number,
                garage_id: order.garage_id,
                payout_amount: order.garage_payout_amount,
                notification: `💰 Order #${order.order_number} complete - payout pending`
            });
        }

        res.json({
            message: 'Status updated',
            old_status: oldStatus,
            new_status,
            payout_created: new_status === 'completed'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Collect order from garage (Operations team action)
// Transitions: ready_for_pickup → collected
export const collectOrder = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { notes } = req.body;
    const staffId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current order status
        const orderResult = await client.query(
            `SELECT order_status, customer_id, garage_id, order_number 
             FROM orders WHERE order_id = $1 FOR UPDATE`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        // STRICT: Only allow collection from ready_for_pickup status
        if (order.order_status !== 'ready_for_pickup') {
            throw new Error(`Cannot collect order. Current status is "${order.order_status}". Must be "ready_for_pickup".`);
        }

        // Update order status to 'collected'
        await client.query(
            `UPDATE orders SET order_status = 'collected', updated_at = NOW() WHERE order_id = $1`,
            [order_id]
        );

        // Record in history
        await client.query(
            `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, $2, $3, $4, 'operations', $5)`,
            [order_id, 'ready_for_pickup', 'collected', staffId, notes || 'Order collected from garage']
        );

        await client.query('COMMIT');

        // Invalidate dashboard stats cache
        await invalidateDashboardCache();

        // Notify customer and garage
        const io = (global as any).io;
        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `📦 Order #${order.order_number} has been collected and is now being inspected.`
        });

        io.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${order.order_number} has been collected by QScrap team.`
        });

        // Notify other operations staff
        io.to('operations').emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${order.order_number} marked as collected by Operations`
        });

        res.json({
            message: 'Order collected successfully',
            order_id,
            order_number: order.order_number,
            new_status: 'collected'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('collectOrder Error:', err);
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get all disputes with pagination
export const getDisputes = async (req: AuthRequest, res: Response) => {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let query = `
            SELECT d.*, 
                   o.order_number, o.part_price, o.total_amount,
                   pr.car_make, pr.car_model, pr.part_description,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   g.garage_name
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON d.customer_id = u.user_id
            JOIN garages g ON d.garage_id = g.garage_id
        `;

        const params: SqlParams = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            query += ` WHERE d.status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(Number(limit), offset);

        const result = await pool.query(query, params);

        // Get total count with filters
        let countQuery = `SELECT COUNT(*) FROM disputes d WHERE 1=1`;
        const countParams: SqlParams = [];
        if (status && status !== 'all') {
            countQuery += ` AND d.status = $1`;
            countParams.push(status);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            disputes: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err) {
        console.error('getDisputes Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Admin resolve dispute
export const resolveDispute = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;
    const { resolution, refund_amount, notes } = req.body;
    const staffId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const disputeResult = await client.query(
            `SELECT d.*, o.order_number, o.customer_id, o.garage_id, o.order_id,
                    g.address as garage_address,
                    u.full_name as customer_name, pr.delivery_location as customer_address
             FROM disputes d
             JOIN orders o ON d.order_id = o.order_id
             JOIN garages g ON o.garage_id = g.garage_id
             JOIN users u ON o.customer_id = u.user_id
             JOIN part_requests pr ON o.request_id = pr.request_id
             WHERE d.dispute_id = $1`,
            [dispute_id]
        );

        if (disputeResult.rows.length === 0) {
            throw new Error('Dispute not found');
        }

        const dispute = disputeResult.rows[0];
        const finalRefundAmount = refund_amount || dispute.refund_amount;

        // Update dispute
        await client.query(
            `UPDATE disputes 
             SET status = 'resolved',
                 resolution = $2,
                 refund_amount = $3,
                 resolved_by = 'platform',
                 resolved_at = NOW()
             WHERE dispute_id = $1`,
            [dispute_id, resolution, finalRefundAmount]
        );

        // Update order status based on resolution
        // Approach A: Refund immediately, but track pending return
        const newOrderStatus = resolution === 'refund_approved' ? 'refunded' : 'completed';
        await client.query(
            `UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2`,
            [newOrderStatus, dispute.order_id]
        );

        // Record in status history
        await client.query(
            `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, 'disputed', $2, $3, 'operations', $4)`,
            [dispute.order_id, newOrderStatus, staffId, notes || `Dispute resolved: ${resolution}`]
        );

        // =================================================================
        // CRITICAL: If refund approved, create return-to-garage assignment
        // Customer gets refund immediately, part returns to garage via driver
        // =================================================================
        let returnAssignment = null;
        if (resolution === 'refund_approved') {
            // Create return assignment (driver will be assigned later)
            const returnResult = await client.query(`
                INSERT INTO delivery_assignments 
                (order_id, driver_id, assignment_type, pickup_address, delivery_address, return_reason, status)
                VALUES ($1, NULL, 'return_to_garage', $2, $3, $4, 'assigned')
                RETURNING assignment_id, order_id, assignment_type, status
            `, [
                dispute.order_id,
                dispute.customer_address || 'Customer Location',
                dispute.garage_address || 'Garage Address',
                `Customer refused: ${notes || dispute.description || 'No reason provided'}`
            ]);
            returnAssignment = returnResult.rows[0];

            // Create refund record (for finance tracking)
            await client.query(`
                INSERT INTO refunds (order_id, customer_id, amount, reason, status, processed_by)
                VALUES ($1, $2, $3, $4, 'approved', $5)
                ON CONFLICT DO NOTHING
            `, [
                dispute.order_id,
                dispute.customer_id,
                finalRefundAmount,
                notes || 'Customer refused delivery',
                staffId
            ]);
        }

        await client.query('COMMIT');

        // Invalidate dashboard stats cache
        await invalidateDashboardCache();

        // =================================================================
        // Socket.IO Notifications + Persistent
        // =================================================================
        const io = (global as any).io;

        // Notify customer - refund approved (Persistent)
        const refundMsg = resolution === 'refund_approved'
            ? `Refund of ${finalRefundAmount} QAR approved. Your refund will be processed shortly.`
            : 'Dispute resolved in favor of garage';

        await createNotification({
            userId: dispute.customer_id,
            type: 'dispute_resolved',
            title: resolution === 'refund_approved' ? 'Refund Approved ✅' : 'Dispute Resolved',
            message: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`,
            data: { dispute_id, order_id: dispute.order_id, order_number: dispute.order_number, resolution, refund_amount: finalRefundAmount },
            target_role: 'customer'
        });

        io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            refund_amount: finalRefundAmount,
            notification: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`
        });

        // Notify garage (Persistent)
        const garageResolutionMsg = resolution === 'refund_approved'
            ? `Dispute for Order #${dispute.order_number} resolved. Part will be returned to your garage.`
            : `Dispute for Order #${dispute.order_number} has been resolved in your favor.`;

        await createNotification({
            userId: dispute.garage_id,
            type: 'dispute_resolved',
            title: 'Dispute Resolved ⚖️',
            message: garageResolutionMsg,
            data: { dispute_id, order_id: dispute.order_id, order_number: dispute.order_number, resolution },
            target_role: 'garage'
        });

        io.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: garageResolutionMsg
        });

        // Notify other operations staff
        io.to('operations').emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: `Dispute #${dispute.order_number} resolved by Operations`
        });

        // If return assignment created, notify Operations about pending return
        if (resolution === 'refund_approved' && returnAssignment) {
            io.to('operations').emit('return_assignment_created', {
                assignment_id: returnAssignment.assignment_id,
                order_id: dispute.order_id,
                order_number: dispute.order_number,
                notification: `📦 Return pending: Order #${dispute.order_number} needs driver assignment for return to garage`
            });
        }

        res.json({
            message: 'Dispute resolved',
            resolution,
            refund_amount: resolution === 'refund_approved' ? finalRefundAmount : null,
            return_assignment: returnAssignment
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('resolveDispute Error:', err);
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get users (customers or garages)
export const getUsers = async (req: AuthRequest, res: Response) => {
    const { type, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        if (type === 'garage') {
            let query = `
                SELECT g.*, u.email, u.phone_number as phone, u.created_at as user_created,
                       (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                       (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id AND order_status = 'completed') as completed_orders
                FROM garages g
                JOIN users u ON g.garage_id = u.user_id
            `;
            const params: SqlParams = [];
            let paramIndex = 1;

            if (search) {
                query += ` WHERE (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY g.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(Number(limit), offset);

            const result = await pool.query(query, params);

            // Get count
            let countQuery = `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id`;
            const countParams: SqlParams = [];
            if (search) {
                countQuery += ` WHERE (g.garage_name ILIKE $1 OR u.phone_number ILIKE $1)`;
                countParams.push(`%${search}%`);
            }
            const countResult = await pool.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].count);

            res.json({
                users: result.rows,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } else {
            let query = `
                SELECT u.*,
                       (SELECT COUNT(*) FROM orders WHERE customer_id = u.user_id) as total_orders,
                       (SELECT COUNT(*) FROM part_requests WHERE customer_id = u.user_id) as total_requests
                FROM users u
                WHERE u.user_type = 'customer'
            `;
            const params: SqlParams = [];
            let paramIndex = 1;

            if (search) {
                query += ` AND (u.full_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(Number(limit), offset);

            const result = await pool.query(query, params);

            // Get count
            let countQuery = `SELECT COUNT(*) FROM users u WHERE u.user_type = 'customer'`;
            const countParams: SqlParams = [];
            if (search) {
                countQuery += ` AND (u.full_name ILIKE $1 OR u.phone_number ILIKE $1)`;
                countParams.push(`%${search}%`);
            }
            const countResult = await pool.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].count);

            res.json({
                users: result.rows,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            });
        }
    } catch (err) {
        console.error('getUsers Error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Get single dispute details
export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;

    try {
        // Get dispute with order and user details
        const disputeResult = await pool.query(`
            SELECT d.*,
                   o.order_number, o.order_status, o.total_amount as order_amount,
                   o.created_at as order_created,
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description,
                   u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                   g.garage_name, gu.phone_number as garage_phone
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            WHERE d.dispute_id = $1
        `, [dispute_id]);

        if (disputeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dispute not found' });
        }

        const dispute = disputeResult.rows[0];

        // Get order status history
        const historyResult = await pool.query(`
            SELECT new_status as status, created_at as changed_at, reason
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [dispute.order_id]);

        res.json({
            dispute,
            order_history: historyResult.rows
        });
    } catch (err) {
        console.error('getDisputeDetails Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get analytics dashboard data
// SECURITY: Whitelist-based period validation to prevent SQL injection
const ANALYTICS_PERIODS: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
    const { period = '7d' } = req.query;

    // SECURITY: Validate period against whitelist (prevents SQL injection)
    const periodStr = String(period);
    const daysBack = ANALYTICS_PERIODS[periodStr] || 7;

    try {
        // Orders summary - PARAMETERIZED
        const ordersResult = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE order_status = 'completed') as completed,
                COUNT(*) FILTER (WHERE order_status = 'confirmed') as confirmed,
                COUNT(*) FILTER (WHERE order_status = 'in_transit') as in_transit,
                COUNT(*) FILTER (WHERE order_status = 'disputed') as disputed,
                COUNT(*) FILTER (WHERE order_status = 'refunded') as refunded,
                COALESCE(SUM(platform_fee + delivery_fee), 0) as total_revenue,
                COALESCE(SUM(platform_fee + delivery_fee) FILTER (WHERE order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'refunded')), 0) as net_revenue
            FROM orders
            WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        `, [daysBack]);

        // Orders by day for chart - PARAMETERIZED
        const ordersByDayResult = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(platform_fee + delivery_fee), 0) as revenue
            FROM orders
            WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [daysBack]);

        // Disputes summary - PARAMETERIZED
        const disputesResult = await pool.query(`
            SELECT 
                COUNT(*) as total_disputes,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                COUNT(*) FILTER (WHERE resolution = 'refund_approved') as refunds_approved,
                COUNT(*) FILTER (WHERE resolution = 'refund_denied') as refunds_denied
            FROM disputes
            WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        `, [daysBack]);

        // Top garages by order count - PARAMETERIZED
        const topGaragesResult = await pool.query(`
            SELECT g.garage_name, COUNT(*) as order_count, COALESCE(SUM(o.platform_fee + o.delivery_fee), 0) as total_revenue
            FROM orders o
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE o.created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
            GROUP BY g.garage_id, g.garage_name
            ORDER BY order_count DESC
            LIMIT 5
        `, [daysBack]);

        // Top parts requested - PARAMETERIZED
        const topPartsResult = await pool.query(`
            SELECT pr.part_description, COUNT(*) as request_count
            FROM part_requests pr
            WHERE pr.created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
            GROUP BY pr.part_description
            ORDER BY request_count DESC
            LIMIT 5
        `, [daysBack]);

        res.json({
            period: periodStr,
            orders: {
                ...ordersResult.rows[0],
                by_day: ordersByDayResult.rows
            },
            disputes: disputesResult.rows[0],
            top_garages: topGaragesResult.rows,
            top_parts: topPartsResult.rows
        });
    } catch (err) {
        console.error('getAnalytics Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};



// Get user details with activity history
export const getUserDetails = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;

    try {
        // Get user basic info
        const userResult = await pool.query(`
            SELECT u.*, g.garage_name, g.address, g.rating_average, g.rating_count
            FROM users u
            LEFT JOIN garages g ON u.user_id = g.garage_id
            WHERE u.user_id = $1
        `, [user_id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get orders
        let ordersQuery = '';
        if (user.user_type === 'customer') {
            ordersQuery = `
                SELECT o.order_id, o.order_number, o.order_status, o.total_amount, o.created_at,
                       pr.part_description, g.garage_name
                FROM orders o
                JOIN part_requests pr ON o.request_id = pr.request_id
                JOIN garages g ON o.garage_id = g.garage_id
                WHERE o.customer_id = $1
                ORDER BY o.created_at DESC LIMIT 10
            `;
        } else if (user.user_type === 'garage') {
            ordersQuery = `
                SELECT o.order_id, o.order_number, o.order_status, o.total_amount, o.created_at,
                       pr.part_description, u.full_name as customer_name
                FROM orders o
                JOIN part_requests pr ON o.request_id = pr.request_id
                JOIN users u ON o.customer_id = u.user_id
                WHERE o.garage_id = $1
                ORDER BY o.created_at DESC LIMIT 10
            `;
        }

        const ordersResult = ordersQuery
            ? await pool.query(ordersQuery, [user_id])
            : { rows: [] };

        // Get disputes
        const disputesResult = await pool.query(`
            SELECT d.dispute_id, d.status, d.reason, d.created_at, o.order_number
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            WHERE d.customer_id = $1
            ORDER BY d.created_at DESC LIMIT 5
        `, [user_id]);

        res.json({
            user,
            orders: ordersResult.rows,
            disputes: disputesResult.rows
        });
    } catch (err) {
        console.error('getUserDetails Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Suspend user
export const suspendUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const { reason } = req.body;

    try {
        const result = await pool.query(`
            UPDATE users SET 
                is_suspended = true,
                suspension_reason = $1,
                suspended_at = NOW(),
                updated_at = NOW()
            WHERE user_id = $2
            RETURNING user_id, full_name, user_type, is_suspended
        `, [reason || 'Suspended by operations team', user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: result.rows[0],
            message: 'User suspended successfully'
        });
    } catch (err) {
        console.error('suspendUser Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Activate user
export const activateUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE users SET 
                is_suspended = false,
                suspension_reason = NULL,
                suspended_at = NULL,
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING user_id, full_name, user_type, is_suspended
        `, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: result.rows[0],
            message: 'User activated successfully'
        });
    } catch (err) {
        console.error('activateUser Error:', err);
        res.status(500).json({ error: 'Failed to activate user' });
    }
};

// Get user statistics
export const getUserStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE user_type = 'customer') as total_customers,
                COUNT(*) FILTER (WHERE user_type = 'garage') as total_garages,
                COUNT(*) FILTER (WHERE user_type = 'customer' AND is_active = true) as active_customers,
                COUNT(*) FILTER (WHERE user_type = 'garage' AND is_active = true) as active_garages,
                COUNT(*) FILTER (WHERE is_suspended = true) as suspended_users,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
            FROM users
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('[OPERATIONS] getUserStats error:', err);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
};

// Get all garages
export const getGarages = async (req: AuthRequest, res: Response) => {
    const { search, status } = req.query;

    try {
        let query = `
            SELECT g.*, u.phone_number, u.email, u.is_active, u.is_suspended, u.created_at as user_created,
                   (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                   (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id AND order_status = 'completed') as completed_orders,
                   (SELECT COUNT(*) FROM bids WHERE garage_id = g.garage_id) as total_bids,
                   gs.status as subscription_status, gs.plan_id, sp.plan_name
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE 1=1
        `;

        const params: SqlParams = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status === 'active') {
            query += ` AND u.is_active = true AND u.is_suspended = false`;
        } else if (status === 'suspended') {
            query += ` AND u.is_suspended = true`;
        }

        query += ` ORDER BY g.created_at DESC LIMIT 100`;

        const result = await pool.query(query, params);
        res.json({ garages: result.rows });
    } catch (err) {
        console.error('[OPERATIONS] getGarages error:', err);
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

// =================================================================
// RETURN ASSIGNMENT MANAGEMENT
// =================================================================

// Get all pending return-to-garage assignments
export const getPendingReturns = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT da.assignment_id, da.order_id, da.status, da.assignment_type,
                   da.pickup_address, da.delivery_address, da.return_reason,
                   da.driver_id, da.created_at,
                   o.order_number, o.total_amount,
                   g.garage_name, g.address as garage_address,
                   d.full_name as driver_name, d.phone as driver_phone
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_type = 'return_to_garage'
              AND da.status NOT IN ('delivered', 'failed')
            ORDER BY da.created_at DESC
        `);

        res.json({
            returns: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        console.error('[OPERATIONS] getPendingReturns error:', err);
        res.status(500).json({ error: 'Failed to fetch pending returns' });
    }
};

// Assign a driver to a return assignment
export const assignDriverToReturn = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { driver_id } = req.body;
    const staffId = req.user!.userId;

    if (!driver_id) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get assignment and verify it's a return
        const assignmentResult = await client.query(`
            SELECT da.*, o.order_number, o.garage_id,
                   g.garage_name
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE da.assignment_id = $1
              AND da.assignment_type = 'return_to_garage'
        `, [assignment_id]);

        if (assignmentResult.rows.length === 0) {
            throw new Error('Return assignment not found');
        }

        const assignment = assignmentResult.rows[0];

        if (assignment.status === 'delivered') {
            throw new Error('Return already completed');
        }

        // Verify driver exists and is available
        const driverResult = await client.query(
            'SELECT driver_id, full_name, status FROM drivers WHERE driver_id = $1',
            [driver_id]
        );

        if (driverResult.rows.length === 0) {
            throw new Error('Driver not found');
        }

        // Update assignment with driver
        await client.query(`
            UPDATE delivery_assignments 
            SET driver_id = $1, status = 'assigned', updated_at = NOW()
            WHERE assignment_id = $2
        `, [driver_id, assignment_id]);

        // Update driver status to busy
        await client.query(
            'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
            ['busy', driver_id]
        );

        await client.query('COMMIT');

        // Invalidate dashboard stats cache
        await invalidateDashboardCache();

        // Notify driver (Persistent + Socket)
        try {
            const io = (global as any).io;

            // Get user_id for notification
            const driverUserData = await pool.query('SELECT user_id FROM drivers WHERE driver_id = $1', [driver_id]);
            const driverUserId = driverUserData.rows[0]?.user_id;

            if (driverUserId) {
                await createNotification({
                    userId: driverUserId,
                    type: 'new_assignment',
                    title: 'New Return Assignment 📦',
                    message: `Pick up from customer and return to ${assignment.garage_name}`,
                    data: { assignment_id, order_id: assignment.order_id, order_number: assignment.order_number, assignment_type: 'return_to_garage' },
                    target_role: 'driver'
                });

                if (io) {
                    io.to(`driver_${driverUserId}`).emit('new_assignment', {
                        assignment_id,
                        order_id: assignment.order_id,
                        order_number: assignment.order_number,
                        pickup_address: assignment.pickup_address,
                        delivery_address: assignment.delivery_address,
                        garage_name: assignment.garage_name,
                        assignment_type: 'return_to_garage',
                        notification: `📦 New return pickup: Order #${assignment.order_number}`
                    });

                    // Real-time status update
                    io.to(`driver_${driverUserId}`).emit('driver_status_changed', {
                        status: 'busy',
                        driver_id: driver_id
                    });
                }
            }

            // Notify garage
            if (io) {
                io.to(`garage_${assignment.garage_id}`).emit('return_driver_assigned', {
                    assignment_id,
                    order_number: assignment.order_number,
                    driver_name: driverResult.rows[0].full_name,
                    notification: `Driver ${driverResult.rows[0].full_name} assigned to return Order #${assignment.order_number}`
                });
            }
        } catch (notifyErr) {
            console.error('[OperationsController] Notification failed:', notifyErr);
        }

        res.json({
            message: 'Driver assigned to return successfully',
            assignment_id,
            driver_id,
            driver_name: driverResult.rows[0].full_name
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[OPERATIONS] assignDriverToReturn error:', err);
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get return statistics for dashboard
export const getReturnStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE assignment_type = 'return_to_garage' AND status NOT IN ('delivered', 'failed')) as pending_returns,
                COUNT(*) FILTER (WHERE assignment_type = 'return_to_garage' AND driver_id IS NULL) as unassigned_returns,
                COUNT(*) FILTER (WHERE assignment_type = 'return_to_garage' AND status = 'in_transit') as returns_in_transit,
                COUNT(*) FILTER (WHERE assignment_type = 'return_to_garage' AND status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE) as completed_today
            FROM delivery_assignments
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('[OPERATIONS] getReturnStats error:', err);
        res.status(500).json({ error: 'Failed to fetch return statistics' });
    }
};
