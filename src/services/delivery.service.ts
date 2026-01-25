/**
 * DeliveryService - Delivery & Driver Management Business Logic
 * 
 * Extracted from delivery.controller.ts (1,579 lines) to enable:
 * - Testability
 * - Reusability
 * - Consistent error handling
 * - Type safety
 */

import pool from '../config/db';
import { createNotification } from './notification.service';
import { ApiError, ErrorCode } from '../middleware/errorHandler.middleware';
import { emitToRoom, emitToDriver, emitToOperations } from '../utils/socketIO';

// ============================================
// TYPES
// ============================================

export interface Driver {
    driver_id: string;
    user_id: string;
    full_name: string;
    phone: string;
    email?: string;
    vehicle_type: string;
    vehicle_plate: string;
    vehicle_model?: string;
    status: 'available' | 'busy' | 'offline';
    total_deliveries: number;
    rating_average: number;
    is_active: boolean;
}

export interface Assignment {
    assignment_id: string;
    order_id: string;
    driver_id: string;
    assignment_type: 'collection' | 'delivery' | 'return_to_garage';
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
    pickup_address?: string;
    pickup_lat?: number;
    pickup_lng?: number;
    delivery_address?: string;
    delivery_lat?: number;
    delivery_lng?: number;
}

export interface AssignCollectionParams {
    order_id: string;
    driver_id: string;
    notes?: string;
    assigned_by_user_id: string;
}

export interface AssignDeliveryParams {
    order_id: string;
    driver_id: string;
    estimated_pickup?: string;
    estimated_delivery?: string;
    assigned_by_user_id: string;
}

// ============================================
// DELIVERY SERVICE
// ============================================

export class DeliveryService {

    /**
     * Get all active drivers with pagination
     */
    static async getDrivers(params: {
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{ drivers: Driver[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
        const { status, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        // Count query
        let countQuery = 'SELECT COUNT(*) FROM drivers WHERE is_active = true';
        const countParams: unknown[] = [];
        if (status) {
            countQuery += ' AND status = $1';
            countParams.push(status);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        // Data query
        let query = `
            SELECT driver_id, user_id, full_name, phone, email, vehicle_type, vehicle_plate, 
                   vehicle_model, status, total_deliveries, rating_average, is_active, created_at
            FROM drivers WHERE is_active = true
        `;
        const params_list: unknown[] = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params_list.push(status);
        }

        query += ' ORDER BY full_name ASC';
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params_list.push(limit, offset);

        const result = await pool.query(query, params_list);

        return {
            drivers: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get single driver with recent assignments
     */
    static async getDriverDetails(driver_id: string): Promise<{ driver: Driver; recent_assignments: Assignment[] }> {
        const driverResult = await pool.query(
            'SELECT * FROM drivers WHERE driver_id = $1',
            [driver_id]
        );

        if (driverResult.rows.length === 0) {
            throw ApiError.notFound('Driver not found');
        }

        const assignmentsResult = await pool.query(`
            SELECT da.*, o.order_number, pr.part_description, g.garage_name
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE da.driver_id = $1
            ORDER BY da.created_at DESC
            LIMIT 10
        `, [driver_id]);

        return {
            driver: driverResult.rows[0],
            recent_assignments: assignmentsResult.rows
        };
    }

    /**
     * Assign collection driver to pick up order from garage
     * Order remains at ready_for_pickup until driver confirms pickup
     */
    static async assignCollectionDriver(params: AssignCollectionParams): Promise<{
        success: boolean;
        assignment: Assignment;
        order_number: string;
        driver: Partial<Driver>;
    }> {
        const { order_id, driver_id, notes, assigned_by_user_id } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get order details
            const orderResult = await client.query(`
                SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
                       o.delivery_address,
                       pr.part_description, pr.delivery_lat, pr.delivery_lng,
                       g.garage_name, g.address as garage_address,
                       g.location_lat as garage_lat, g.location_lng as garage_lng,
                       u.full_name as customer_name
                FROM orders o
                JOIN part_requests pr ON o.request_id = pr.request_id
                JOIN garages g ON o.garage_id = g.garage_id
                JOIN users u ON o.customer_id = u.user_id
                WHERE o.order_id = $1
            `, [order_id]);

            if (orderResult.rows.length === 0) {
                throw ApiError.notFound('Order not found');
            }

            const order = orderResult.rows[0];

            if (order.order_status !== 'ready_for_pickup') {
                throw ApiError.badRequest(`Order is not ready for collection. Current status: ${order.order_status}`);
            }

            // Check for existing assignment
            const existingAssignment = await client.query(
                `SELECT assignment_id FROM delivery_assignments 
                 WHERE order_id = $1 AND assignment_type = 'collection' AND status = 'assigned'`,
                [order_id]
            );

            if (existingAssignment.rows.length > 0) {
                throw ApiError.badRequest('Collection driver already assigned');
            }

            // Check driver availability
            const driverResult = await client.query(
                `SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate 
                 FROM drivers WHERE driver_id = $1`,
                [driver_id]
            );

            if (driverResult.rows.length === 0) {
                throw ApiError.notFound('Driver not found');
            }

            const driver = driverResult.rows[0];

            if (driver.status !== 'available') {
                throw ApiError.badRequest(`Driver is currently ${driver.status}`);
            }

            // Create assignment
            const assignResult = await client.query(`
                INSERT INTO delivery_assignments 
                    (order_id, driver_id, pickup_address, pickup_lat, pickup_lng, 
                     delivery_address, delivery_lat, delivery_lng,
                     status, assignment_type, created_by_user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'assigned', 'collection', $9)
                RETURNING *
            `, [order_id, driver_id, order.garage_address,
                order.garage_lat, order.garage_lng,
                order.delivery_address, order.delivery_lat, order.delivery_lng,
                assigned_by_user_id]);

            // Update driver status
            await client.query(
                'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
                ['busy', driver_id]
            );

            // Update order with driver reference
            await client.query(
                'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE order_id = $2',
                [driver.user_id, order_id]
            );

            // Log the assignment
            await client.query(`
                INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, $2, $2, $3, 'operations', $4)
            `, [order_id, 'ready_for_pickup', assigned_by_user_id,
                notes || `Collection driver assigned: ${driver.full_name}`]);

            await client.query('COMMIT');

            // Send notifications
            await this.sendCollectionAssignmentNotifications(order, driver, assignResult.rows[0]);

            return {
                success: true,
                assignment: assignResult.rows[0],
                order_number: order.order_number,
                driver: {
                    driver_id: driver.driver_id,
                    full_name: driver.full_name,
                    phone: driver.phone,
                    vehicle_type: driver.vehicle_type,
                    vehicle_plate: driver.vehicle_plate
                }
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Assign delivery driver to deliver collected order to customer
     */
    static async assignDeliveryDriver(params: AssignDeliveryParams): Promise<{
        success: boolean;
        assignment: Assignment;
        order_number: string;
        driver: Partial<Driver>;
    }> {
        const { order_id, driver_id, estimated_pickup, estimated_delivery, assigned_by_user_id } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get order details
            const orderResult = await client.query(`
                SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
                       pr.part_description, g.garage_name, g.address as pickup_address,
                       g.location_lat as garage_lat, g.location_lng as garage_lng,
                       u.full_name as customer_name, o.delivery_address,
                       pr.delivery_lat, pr.delivery_lng
                FROM orders o
                JOIN part_requests pr ON o.request_id = pr.request_id
                JOIN garages g ON o.garage_id = g.garage_id
                JOIN users u ON o.customer_id = u.user_id
                WHERE o.order_id = $1
            `, [order_id]);

            if (orderResult.rows.length === 0) {
                throw ApiError.notFound('Order not found');
            }

            const order = orderResult.rows[0];

            if (order.order_status !== 'collected') {
                throw ApiError.badRequest(`Order must be collected first. Current status: ${order.order_status}`);
            }

            // Check driver
            const driverResult = await client.query(
                'SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
                [driver_id]
            );

            if (driverResult.rows.length === 0) {
                throw ApiError.notFound('Driver not found');
            }

            const driver = driverResult.rows[0];

            if (driver.status !== 'available') {
                throw ApiError.badRequest(`Driver is currently ${driver.status}`);
            }

            // Create/update assignment
            const assignResult = await client.query(`
                INSERT INTO delivery_assignments (
                    order_id, driver_id, 
                    pickup_address, pickup_lat, pickup_lng,
                    delivery_address, delivery_lat, delivery_lng,
                    estimated_pickup, estimated_delivery,
                    assignment_type, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'delivery', 'assigned')
                ON CONFLICT (order_id) DO UPDATE SET
                    driver_id = $2,
                    pickup_lat = $4, pickup_lng = $5,
                    delivery_lat = $7, delivery_lng = $8,
                    estimated_pickup = $9, estimated_delivery = $10,
                    assignment_type = 'delivery', status = 'assigned',
                    updated_at = NOW()
                RETURNING *
            `, [
                order_id, driver_id,
                order.pickup_address, order.garage_lat, order.garage_lng,
                order.delivery_address, order.delivery_lat, order.delivery_lng,
                estimated_pickup || null, estimated_delivery || null
            ]);

            // Update driver status
            await client.query(
                'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
                ['busy', driver_id]
            );

            // Update order status to in_transit
            await client.query(
                'UPDATE orders SET order_status = $1, driver_id = $2, updated_at = NOW() WHERE order_id = $3',
                ['in_transit', driver.user_id, order_id]
            );

            // Log status change
            await client.query(`
                INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, $2, $3, $4, 'operations', $5)
            `, [order_id, 'collected', 'in_transit', assigned_by_user_id,
                `Delivery driver assigned: ${driver.full_name}`]);

            await client.query('COMMIT');

            // Send notifications
            await this.sendDeliveryAssignmentNotifications(order, driver, assignResult.rows[0]);

            return {
                success: true,
                assignment: assignResult.rows[0],
                order_number: order.order_number,
                driver: {
                    driver_id: driver.driver_id,
                    full_name: driver.full_name,
                    phone: driver.phone,
                    vehicle_type: driver.vehicle_type,
                    vehicle_plate: driver.vehicle_plate
                }
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get orders ready for collection (ready_for_pickup status)
     */
    static async getOrdersReadyForCollection(): Promise<unknown[]> {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at,
                   pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name, g.address as pickup_address, gu.phone_number as garage_phone,
                   u.full_name as customer_name
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_status = 'ready_for_pickup'
            ORDER BY o.created_at ASC
        `);
        return result.rows;
    }

    /**
     * Get orders ready for delivery (collected status, no driver)
     */
    static async getOrdersReadyForDelivery(): Promise<unknown[]> {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at, o.delivery_address,
                   pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name,
                   u.full_name as customer_name, u.phone_number as customer_phone
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_status = 'collected' AND o.driver_id IS NULL
            ORDER BY o.created_at ASC
        `);
        return result.rows;
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private static async sendCollectionAssignmentNotifications(
        order: Record<string, unknown>,
        driver: Record<string, unknown>,
        assignment: Record<string, unknown>
    ): Promise<void> {
        // Notify driver
        if (driver.user_id) {
            await createNotification({
                userId: driver.user_id as string,
                type: 'new_assignment',
                title: 'New Collection Assignment 📦',
                message: `Pick up Order #${order.order_number} from ${order.garage_name}`,
                data: { assignment_id: assignment.assignment_id, order_id: order.order_id },
                target_role: 'driver'
            });

            emitToDriver(driver.user_id as string, 'new_assignment', {
                assignment_id: assignment.assignment_id,
                assignment_type: 'collection',
                order_id: order.order_id,
                order_number: order.order_number
            });
        }

        // Notify garage
        await createNotification({
            userId: order.garage_id as string,
            type: 'collection_driver_assigned',
            title: 'Driver En Route 🚚',
            message: `Driver ${driver.full_name} is on the way`,
            data: { order_id: order.order_id },
            target_role: 'garage'
        });

        emitToRoom(`garage_${order.garage_id}`, 'collection_driver_assigned', {
            order_id: order.order_id,
            driver_name: driver.full_name
        });

        // Notify operations
        emitToOperations('collection_driver_assigned', {
            order_id: order.order_id,
            order_number: order.order_number,
            driver_name: driver.full_name
        });
    }

    private static async sendDeliveryAssignmentNotifications(
        order: Record<string, unknown>,
        driver: Record<string, unknown>,
        assignment: Record<string, unknown>
    ): Promise<void> {
        // Notify driver
        if (driver.user_id) {
            await createNotification({
                userId: driver.user_id as string,
                type: 'new_assignment',
                title: 'New Delivery Assignment 🚚',
                message: `Deliver Order #${order.order_number} to ${order.customer_name}`,
                data: { assignment_id: assignment.assignment_id, order_id: order.order_id },
                target_role: 'driver'
            });

            emitToDriver(driver.user_id as string, 'new_assignment', {
                assignment_id: assignment.assignment_id,
                assignment_type: 'delivery',
                order_id: order.order_id
            });
        }

        // Notify customer (in-app + socket)
        await createNotification({
            userId: order.customer_id as string,
            type: 'order_in_transit',
            title: 'Order On The Way! 🚚',
            message: `Driver ${driver.full_name} is delivering your order`,
            data: { order_id: order.order_id, driver_name: driver.full_name },
            target_role: 'customer'
        });

        emitToRoom(`user_${order.customer_id}`, 'order_status_updated', {
            order_id: order.order_id,
            new_status: 'in_transit',
            driver_name: driver.full_name
        });

        // CRITICAL: Send PUSH notification so customer gets notified even with app closed
        try {
            const { pushService } = await import('./push.service');
            await pushService.sendOrderStatusNotification(
                order.customer_id as string,
                order.order_number as string,
                'in_transit',
                order.order_id as string,
                { driverName: driver.full_name as string }
            );
        } catch (pushErr) {
            console.error('[Delivery] Push notification for transit failed:', pushErr);
        }

        // Notify operations
        emitToOperations('order_in_transit', {
            order_id: order.order_id,
            order_number: order.order_number,
            driver_name: driver.full_name
        });
    }
}

export default DeliveryService;
