/**
 * Order Management Service
 * Handles order filtering, status updates, and operations workflows
 */
import { Pool, PoolClient } from 'pg';
import { OrderFilters, OrderWithDetails, PaginationMetadata } from './types';
import { OrderNotFoundError, InvalidStatusTransitionError } from './errors';

export class OrderManagementService {
    constructor(private pool: Pool) { }

    /**
     * Get orders with filters and pagination
     */
    async getOrders(filters: OrderFilters): Promise<{ orders: OrderWithDetails[]; pagination: PaginationMetadata }> {
        const { status, search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

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
        const params: any[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            if (status === 'cancelled') {
                query += ` AND o.order_status LIKE 'cancelled%'`;
            } else if (status.includes(',')) {
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
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE 1=1`;
        const countParams: any[] = [];
        let countParamIndex = 1;

        if (status && status !== 'all') {
            if (status === 'cancelled') {
                countQuery += ` AND o.order_status LIKE 'cancelled%'`;
            } else if (status.includes(',')) {
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

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return {
            orders: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get order details with full history
     */
    async getOrderDetails(orderId: string): Promise<any> {
        const orderResult = await this.pool.query(`
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
        `, [orderId]);

        if (orderResult.rows.length === 0) {
            throw new OrderNotFoundError(orderId);
        }

        // Get status history
        const historyResult = await this.pool.query(`
            SELECT history_id, order_id, old_status, new_status as status, changed_by, reason, created_at as changed_at
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [orderId]);

        // Get dispute if exists
        const disputeResult = await this.pool.query(`
            SELECT * FROM disputes WHERE order_id = $1
        `, [orderId]);

        return {
            order: orderResult.rows[0],
            status_history: historyResult.rows,
            dispute: disputeResult.rows[0] || null
        };
    }

    /**
     * Update order status (admin override with side effects)
     */
    async updateOrderStatus(
        orderId: string,
        newStatus: string,
        staffId: string,
        notes?: string
    ): Promise<{ old_status: string; new_status: string; payout_created: boolean }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current status and order details
            const orderResult = await client.query(
                `SELECT o.order_status, o.customer_id, o.garage_id, o.order_number, 
                        o.part_price, o.platform_fee, o.garage_payout_amount, o.driver_id,
                        g.garage_name
                 FROM orders o
                 JOIN garages g ON o.garage_id = g.garage_id
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new OrderNotFoundError(orderId);
            }

            const oldStatus = orderResult.rows[0].order_status;
            const order = orderResult.rows[0];

            // Build update query
            let updateQuery = `UPDATE orders SET order_status = $1, updated_at = NOW()`;
            const updateParams: any[] = [newStatus];

            // Special handling for 'completed' status
            if (newStatus === 'completed') {
                updateQuery += `, completed_at = NOW(), payment_status = 'paid'`;
            }

            updateQuery += ` WHERE order_id = $${updateParams.length + 1}`;
            updateParams.push(orderId);

            await client.query(updateQuery, updateParams);

            // Record in history
            await client.query(
                `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason, changed_by_type)
                 VALUES ($1, $2, $3, $4, $5, 'operations')`,
                [orderId, oldStatus, newStatus, staffId, notes || 'Manually updated by Operations']
            );

            let payoutCreated = false;

            // If completing the order, create payout and free driver
            if (newStatus === 'completed') {
                await client.query(
                    `INSERT INTO garage_payouts 
                     (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
                     SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                            CURRENT_DATE + INTERVAL '7 days'
                     FROM orders o WHERE o.order_id = $1
                     AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)`,
                    [orderId]
                );
                payoutCreated = true;

                // Free up the driver
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
                        [order.driver_id, orderId]
                    );
                }
            }

            await client.query('COMMIT');

            return {
                old_status: oldStatus,
                new_status: newStatus,
                payout_created: payoutCreated
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Collect order from garage (ready_for_pickup → collected)
     */
    async collectOrder(
        orderId: string,
        staffId: string,
        notes?: string
    ): Promise<{ order_id: string; order_number: string; new_status: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const orderResult = await client.query(
                `SELECT order_status, customer_id, garage_id, order_number 
                 FROM orders WHERE order_id = $1 FOR UPDATE`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new OrderNotFoundError(orderId);
            }

            const order = orderResult.rows[0];

            // STRICT: Only allow collection from ready_for_pickup status
            if (order.order_status !== 'ready_for_pickup') {
                throw new InvalidStatusTransitionError(
                    order.order_status,
                    'collected'
                );
            }

            // Update order status
            await client.query(
                `UPDATE orders SET order_status = 'collected', updated_at = NOW() WHERE order_id = $1`,
                [orderId]
            );

            // Record in history
            await client.query(
                `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                 VALUES ($1, $2, $3, $4, 'operations', $5)`,
                [orderId, 'ready_for_pickup', 'collected', staffId, notes || 'Order collected from garage']
            );

            await client.query('COMMIT');

            return {
                order_id: orderId,
                order_number: order.order_number,
                new_status: 'collected'
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
