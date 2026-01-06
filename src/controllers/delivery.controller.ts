import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';

// Get all drivers
export const getDrivers = async (req: AuthRequest, res: Response) => {
    const { status } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Build count query
        let countQuery = 'SELECT COUNT(*) FROM drivers WHERE is_active = true';
        const countParams: unknown[] = [];
        if (status) {
            countQuery += ' AND status = $1';
            countParams.push(status);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Build data query
        let query = `
            SELECT driver_id, full_name, phone, email, vehicle_type, vehicle_plate, 
                   status, total_deliveries, rating_average, is_active, created_at
            FROM drivers
            WHERE is_active = true
        `;
        const params: unknown[] = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        query += ' ORDER BY full_name ASC';
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json({
            drivers: result.rows,
            pagination: { page, limit, total, pages: totalPages }
        });
    } catch (err) {
        console.error('getDrivers Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get driver details
export const getDriverDetails = async (req: AuthRequest, res: Response) => {
    const { driver_id } = req.params;

    try {
        const driverResult = await pool.query(
            'SELECT * FROM drivers WHERE driver_id = $1',
            [driver_id]
        );

        if (driverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Get recent assignments
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

        res.json({
            driver: driverResult.rows[0],
            recent_assignments: assignmentsResult.rows
        });
    } catch (err) {
        console.error('getDriverDetails Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Create new driver
export const createDriver = async (req: AuthRequest, res: Response) => {
    const { full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model } = req.body;

    if (!full_name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO drivers (full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [full_name, phone, email || null, vehicle_type || 'motorcycle', vehicle_plate || null, vehicle_model || null]);

        res.status(201).json({ driver: result.rows[0], message: 'Driver created successfully' });
    } catch (err) {
        console.error('createDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Update driver
export const updateDriver = async (req: AuthRequest, res: Response) => {
    const { driver_id } = req.params;
    const { full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, is_active } = req.body;

    try {
        // SAFETY CHECK: Prevent changing status from 'busy' if driver has active deliveries
        if (status === 'available') {
            const activeDelivery = await pool.query(
                `SELECT o.order_id, o.order_number, o.order_status 
                 FROM orders o 
                 WHERE o.driver_id = $1 
                 AND o.order_status = 'in_transit'
                 LIMIT 1`,
                [driver_id]
            );

            if (activeDelivery.rows.length > 0) {
                return res.status(400).json({
                    error: 'Cannot change driver to available - active delivery in progress',
                    active_order: activeDelivery.rows[0].order_number,
                    message: 'Driver will be automatically set to available when customer confirms delivery'
                });
            }
        }

        const result = await pool.query(`
            UPDATE drivers SET
                full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                email = COALESCE($3, email),
                vehicle_type = COALESCE($4, vehicle_type),
                vehicle_plate = COALESCE($5, vehicle_plate),
                vehicle_model = COALESCE($6, vehicle_model),
                status = COALESCE($7, status),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE driver_id = $9
            RETURNING *
        `, [full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, is_active, driver_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ driver: result.rows[0], message: 'Driver updated successfully' });
    } catch (err) {
        console.error('updateDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get orders ready for COLLECTION from garages (ready_for_pickup status)
export const getOrdersReadyForCollection = async (req: AuthRequest, res: Response) => {
    try {
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

        res.json({ orders: result.rows });
    } catch (err) {
        console.error('getOrdersReadyForCollection Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get orders ready for DELIVERY to customers (collected status - ready for driver assignment)
export const getOrdersReadyForDelivery = async (req: AuthRequest, res: Response) => {
    try {
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

        res.json({ orders: result.rows });
    } catch (err) {
        console.error('getOrdersReadyForDelivery Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// ASSIGN COLLECTION DRIVER (NEW FLOW)
// Assigns driver for collection from garage - order stays at ready_for_pickup
// Driver will confirm pickup via their app, which triggers order -> collected
// ============================================================================
export const assignCollectionDriver = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { driver_id, notes } = req.body;

    if (!driver_id) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    console.log('[DELIVERY] assignCollectionDriver called:', { order_id, driver_id, notes });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify order is ready for collection
        const orderResult = await client.query(
            `SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
                    o.delivery_address,
                    pr.part_description, pr.delivery_lat, pr.delivery_lng,
                    g.garage_name, g.address as garage_address,
                    g.location_lat as garage_lat, g.location_lng as garage_lng,
                    u.full_name as customer_name
             FROM orders o
             JOIN part_requests pr ON o.request_id = pr.request_id
             JOIN garages g ON o.garage_id = g.garage_id
             JOIN users u ON o.customer_id = u.user_id
             WHERE o.order_id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        if (order.order_status !== 'ready_for_pickup') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Order is not ready for collection',
                current_status: order.order_status,
                required_status: 'ready_for_pickup'
            });
        }

        // Check if collection assignment already exists
        const existingAssignment = await client.query(
            `SELECT assignment_id, driver_id FROM delivery_assignments 
             WHERE order_id = $1 AND assignment_type = 'collection' AND status = 'assigned'`,
            [order_id]
        );

        if (existingAssignment.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Collection driver already assigned',
                assignment_id: existingAssignment.rows[0].assignment_id
            });
        }

        // Check driver availability
        const driverResult = await client.query(
            `SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate 
             FROM drivers WHERE driver_id = $1`,
            [driver_id]
        );

        if (driverResult.rows.length === 0) {
            throw new Error('Driver not found');
        }

        const driver = driverResult.rows[0];

        if (driver.status !== 'available') {
            throw new Error(`Driver is currently ${driver.status}`);
        }

        // Create collection assignment record with GPS coordinates for driver navigation
        // pickup_lat/lng = garage location (where driver picks up)
        // delivery_lat/lng = customer location (for later delivery phase)
        const assignResult = await client.query(`
            INSERT INTO delivery_assignments 
                (order_id, driver_id, pickup_address, pickup_lat, pickup_lng, 
                 delivery_address, delivery_lat, delivery_lng,
                 status, assignment_type, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'assigned', 'collection', $9)
            RETURNING assignment_id, order_id, status, assignment_type, pickup_lat, pickup_lng
        `, [order_id, driver_id, order.garage_address,
            order.garage_lat, order.garage_lng,
            order.delivery_address, order.delivery_lat, order.delivery_lng,
            req.user?.userId]);

        // Update driver status to busy
        await client.query(
            'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
            ['busy', driver_id]
        );

        // Update order with driver reference (orders.driver_id references users.user_id)
        await client.query(
            'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE order_id = $2',
            [driver.user_id, order_id]
        );

        // Log the assignment (NOT status change - order remains ready_for_pickup)
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, $2, $3, 'operations', $4)
        `, [order_id, 'ready_for_pickup', req.user?.userId,
            notes || `Collection driver assigned: ${driver.full_name}. Awaiting driver pickup confirmation.`]);

        await client.query('COMMIT');

        // Socket notifications
        const io = (global as any).io;

        // Notify driver about new collection assignment with GPS for one-click navigation
        if (driver.user_id) {
            io.to(`driver_${driver.user_id}`).emit('new_assignment', {
                assignment_id: assignResult.rows[0].assignment_id,
                assignment_type: 'collection',
                order_id,
                order_number: order.order_number,
                part_description: order.part_description,
                // Pickup location (garage) - for collection phase
                pickup_address: order.garage_address,
                pickup_lat: order.garage_lat ? parseFloat(order.garage_lat) : null,
                pickup_lng: order.garage_lng ? parseFloat(order.garage_lng) : null,
                // Delivery location (customer) - for delivery phase 
                delivery_address: order.delivery_address,
                delivery_lat: order.delivery_lat ? parseFloat(order.delivery_lat) : null,
                delivery_lng: order.delivery_lng ? parseFloat(order.delivery_lng) : null,
                customer_name: order.customer_name,
                garage_name: order.garage_name,
                // Flag to indicate GPS availability for navigation
                has_pickup_gps: order.garage_lat !== null && order.garage_lng !== null,
                has_delivery_gps: order.delivery_lat !== null && order.delivery_lng !== null,
                notification: `📦 New collection: Order #${order.order_number} - Pick up from ${order.garage_name}`
            });
        }

        // Notify garage that driver is on the way
        io.to(`garage_${order.garage_id}`).emit('collection_driver_assigned', {
            order_id,
            order_number: order.order_number,
            driver_name: driver.full_name,
            driver_phone: driver.phone,
            vehicle: `${driver.vehicle_type} - ${driver.vehicle_plate}`,
            notification: `🚚 Driver ${driver.full_name} is on the way to collect Order #${order.order_number}`
        });

        // Notify operations
        io.to('operations').emit('collection_driver_assigned', {
            order_id,
            order_number: order.order_number,
            driver_name: driver.full_name,
            notification: `✅ Collection driver assigned: ${driver.full_name} for #${order.order_number}`
        });

        res.status(201).json({
            success: true,
            message: `Collection driver assigned. Awaiting driver pickup confirmation.`,
            assignment: assignResult.rows[0],
            order_number: order.order_number,
            driver: {
                id: driver.driver_id,
                name: driver.full_name,
                phone: driver.phone,
                vehicle: `${driver.vehicle_type} - ${driver.vehicle_plate}`
            },
            next_step: 'Driver will confirm pickup via their app'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('assignCollectionDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Mark order as collected from garage (ready_for_pickup -> collected)
// DEPRECATED: Use assignCollectionDriver + driver pickup confirmation instead
export const collectOrder = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { notes, driver_id } = req.body;

    console.log('[DELIVERY] collectOrder called:', { order_id, driver_id, notes });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify order is ready for collection
        const orderResult = await client.query(
            `SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
                    pr.part_description, g.garage_name, g.address as garage_address
             FROM orders o
             JOIN part_requests pr ON o.request_id = pr.request_id
             JOIN garages g ON o.garage_id = g.garage_id
             WHERE o.order_id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        if (order.order_status !== 'ready_for_pickup') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Order is not ready for collection',
                current_status: order.order_status,
                required_status: 'ready_for_pickup'
            });
        }

        // If driver_id provided, assign driver and set status to busy
        let assignedDriver = null;
        if (driver_id) {
            // Check driver availability
            const driverResult = await client.query(
                'SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
                [driver_id]
            );

            if (driverResult.rows.length === 0) {
                throw new Error('Driver not found');
            }

            const driver = driverResult.rows[0];

            if (driver.status !== 'available') {
                throw new Error(`Driver is currently ${driver.status}`);
            }

            // Update driver status to busy
            await client.query(
                'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
                ['busy', driver_id]
            );

            // Update order with driver (orders.driver_id references users.user_id)
            await client.query(
                'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE order_id = $2',
                [driver.user_id, order_id]
            );

            // Create collection assignment record
            await client.query(`
                INSERT INTO delivery_assignments (order_id, driver_id, pickup_address, status, assignment_type)
                VALUES ($1, $2, $3, 'assigned', 'collection')
                ON CONFLICT (order_id) DO UPDATE SET
                    driver_id = $2,
                    pickup_address = $3,
                    status = 'assigned',
                    assignment_type = 'collection',
                    updated_at = NOW()
            `, [order_id, driver_id, order.garage_address]);

            assignedDriver = driver;
        }

        // Update order status to collected
        await client.query(
            'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
            ['collected', order_id]
        );

        // If driver was assigned, mark them as available again (collection task complete)
        // Option B workflow: Collection and delivery are separate assignments
        if (driver_id && assignedDriver) {
            await client.query(
                'UPDATE drivers SET status = $1, total_deliveries = total_deliveries + 1, updated_at = NOW() WHERE driver_id = $2',
                ['available', driver_id]
            );

            // Update collection assignment status to 'delivered' (task complete)
            await client.query(`
                UPDATE delivery_assignments 
                SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
                WHERE order_id = $1 AND assignment_type = 'collection'
            `, [order_id]);
        }

        // Log status change
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, $3, $4, 'operations', $5)
        `, [order_id, 'ready_for_pickup', 'collected', req.user?.userId, notes || `Part collected from garage${assignedDriver ? ` by ${assignedDriver.full_name}` : ''}`]);

        await client.query('COMMIT');

        // Notify garage and customer
        const io = (global as any).io;

        io.to(`garage_${order.garage_id}`).emit('order_collected', {
            order_id,
            order_number: order.order_number,
            driver_name: assignedDriver?.full_name,
            notification: `📦 Order #${order.order_number} has been collected for QC inspection`
        });

        // Notify operations dashboard to update Quality badge
        io.to('operations').emit('order_collected', {
            order_id,
            order_number: order.order_number,
            driver_name: assignedDriver?.full_name,
            notification: `📦 Order #${order.order_number} collected - ready for QC!`
        });

        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `📦 Your part has been collected and is heading to quality inspection!`
        });

        // Notify operations that driver is now available (Option B workflow)
        if (assignedDriver) {
            io.to('operations').emit('driver_status_changed', {
                driver_id,
                driver_name: assignedDriver.full_name,
                new_status: 'available',
                order_number: order.order_number,
                notification: `✅ Driver ${assignedDriver.full_name} completed collection for #${order.order_number} - now available`
            });
        }

        res.json({
            success: true,
            message: 'Order collected successfully',
            order_number: order.order_number,
            driver: assignedDriver ? {
                name: assignedDriver.full_name,
                phone: assignedDriver.phone
            } : null
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('collectOrder Error:', err);
        console.log('[DELIVERY] collectOrder failed:', getErrorMessage(err));
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get all orders for delivery section (legacy - combines both collection and delivery)
export const getOrdersForDelivery = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at,
                   pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name, g.address as pickup_address,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   ca.address_line1 as delivery_address,
                   da.assignment_id, da.status as delivery_status, d.full_name as driver_name
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN customer_addresses ca ON o.customer_id = ca.customer_id AND ca.is_default = true
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE o.order_status IN ('ready_for_pickup', 'collected', 'in_transit')
            ORDER BY 
                CASE o.order_status 
                    WHEN 'in_transit' THEN 1
                    WHEN 'collected' THEN 2
                    WHEN 'ready_for_pickup' THEN 3
                END,
                o.created_at ASC
        `);

        res.json({ orders: result.rows });
    } catch (err) {
        console.error('getOrdersForDelivery Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Assign driver to order
export const assignDriver = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { driver_id, estimated_pickup, estimated_delivery } = req.body;

    if (!driver_id) {
        return res.status(400).json({ error: 'Driver ID is required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get order with customer info for notifications
        const orderResult = await client.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.customer_id, o.garage_id,
                   pr.part_description, g.garage_name, g.address as pickup_address,
                   u.full_name as customer_name, o.delivery_address
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        // Driver can be assigned after order is collected from garage
        if (order.order_status !== 'collected') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Cannot assign driver - order must be collected first',
                current_status: order.order_status,
                required_status: 'collected'
            });
        }

        // Check driver availability
        const driverResult = await client.query(
            'SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
            [driver_id]
        );

        if (driverResult.rows.length === 0) {
            throw new Error('Driver not found');
        }

        const driver = driverResult.rows[0];

        if (driver.status !== 'available') {
            throw new Error(`Driver is currently ${driver.status}`);
        }

        // Create assignment with pickup/delivery addresses
        const assignResult = await client.query(`
            INSERT INTO delivery_assignments (order_id, driver_id, pickup_address, delivery_address, estimated_pickup, estimated_delivery)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (order_id) DO UPDATE SET
                driver_id = $2,
                pickup_address = $3,
                delivery_address = $4,
                estimated_pickup = $5,
                estimated_delivery = $6,
                status = 'assigned',
                updated_at = NOW()
            RETURNING *
        `, [order_id, driver_id, order.pickup_address, order.delivery_address, estimated_pickup || null, estimated_delivery || null]);

        // Update driver status to busy
        await client.query(
            'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
            ['busy', driver_id]
        );

        // Update order status to in_transit
        await client.query(
            'UPDATE orders SET order_status = $1, driver_id = $2, updated_at = NOW() WHERE order_id = $3',
            ['in_transit', driver.user_id, order_id]
        );

        // Add to status history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, $3, $4, 'operations', $5)
        `, [order_id, 'collected', 'in_transit', req.user?.userId, `Assigned to driver: ${driver.full_name}`]);

        await client.query('COMMIT');

        // Socket notifications
        const io = (global as any).io;

        // Notify the DRIVER about new assignment
        if (driver.user_id) {
            io.to(`driver_${driver.user_id}`).emit('new_assignment', {
                assignment_id: assignResult.rows[0].assignment_id,
                order_id,
                order_number: order.order_number,
                part_description: order.part_description,
                pickup_address: order.pickup_address,
                delivery_address: order.delivery_address,
                customer_name: order.customer_name,
                garage_name: order.garage_name,
                estimated_delivery: estimated_delivery,
                notification: `📦 New assignment: Order #${order.order_number}`
            });
        }

        // Notify customer with driver info
        io.to(`user_${order.customer_id}`).emit('driver_assigned', {
            order_id,
            order_number: order.order_number,
            driver: {
                name: driver.full_name,
                phone: driver.phone,
                vehicle_type: driver.vehicle_type,
                vehicle_plate: driver.vehicle_plate
            },
            estimated_delivery: estimated_delivery,
            notification: `🚚 Driver ${driver.full_name} is on the way with your part!`
        });

        // Also emit order_status_updated for mobile app real-time updates
        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'collected',
            new_status: 'in_transit',
            notification: `🚚 Your order is on the way!`
        });

        // Notify garage that delivery started
        io.to(`garage_${order.garage_id}`).emit('delivery_started', {
            order_id,
            order_number: order.order_number,
            driver_name: driver.full_name,
            notification: `📦 Order #${order.order_number} is now in transit.`
        });

        res.status(201).json({
            assignment: assignResult.rows[0],
            driver: {
                name: driver.full_name,
                phone: driver.phone,
                vehicle: `${driver.vehicle_type} - ${driver.vehicle_plate}`
            },
            message: `Order assigned to ${driver.full_name}`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('assignDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Reassign driver mid-delivery (emergency reassignment)
export const reassignDriver = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { new_driver_id, reason } = req.body;
    const reassignedBy = req.user!.userId;

    if (!new_driver_id) {
        return res.status(400).json({ error: 'New driver ID is required' });
    }

    if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: 'Reassignment reason is required (minimum 5 characters)' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get current assignment with all related info
        const assignResult = await client.query(`
            SELECT da.*, o.order_id, o.order_number, o.customer_id, o.garage_id,
                   pr.part_description, g.garage_name,
                   d.driver_id as old_driver_id, d.user_id as old_driver_user_id, d.full_name as old_driver_name
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_id = $1
        `, [assignment_id]);

        if (assignResult.rows.length === 0) {
            throw new Error('Assignment not found');
        }

        const assignment = assignResult.rows[0];

        // Check assignment is active (not delivered/failed)
        if (['delivered', 'failed'].includes(assignment.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Cannot reassign - delivery already completed',
                current_status: assignment.status
            });
        }

        // Check new driver exists and is available
        const newDriverResult = await client.query(
            'SELECT driver_id, user_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
            [new_driver_id]
        );

        if (newDriverResult.rows.length === 0) {
            throw new Error('New driver not found');
        }

        const newDriver = newDriverResult.rows[0];

        if (newDriver.status !== 'available') {
            throw new Error(`New driver is currently ${newDriver.status}`);
        }

        // Prevent reassigning to same driver
        if (assignment.old_driver_id === new_driver_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot reassign to the same driver' });
        }

        // Update assignment with new driver and track previous
        await client.query(`
            UPDATE delivery_assignments SET
                driver_id = $1,
                previous_driver_id = $2,
                reassignment_reason = $3,
                reassigned_at = NOW(),
                reassigned_by = $4,
                updated_at = NOW()
            WHERE assignment_id = $5
        `, [new_driver_id, assignment.old_driver_id, reason, reassignedBy, assignment_id]);

        // Update orders table driver reference
        await client.query(
            'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE order_id = $2',
            [newDriver.user_id, assignment.order_id]
        );

        // Set OLD driver status back to available
        if (assignment.old_driver_id) {
            await client.query(
                'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
                ['available', assignment.old_driver_id]
            );
        }

        // Set NEW driver status to busy
        await client.query(
            'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
            ['busy', new_driver_id]
        );

        // Log to status history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, $2, $3, 'operations', $4)
        `, [assignment.order_id, 'in_transit', reassignedBy, `Driver reassigned: ${assignment.old_driver_name} → ${newDriver.full_name}. Reason: ${reason}`]);

        await client.query('COMMIT');

        // Socket.IO notifications to all parties
        const io = (global as any).io;

        // 1. Notify OLD driver - assignment removed/cancelled
        if (assignment.old_driver_user_id) {
            io.to(`driver_${assignment.old_driver_user_id}`).emit('assignment_removed', {
                assignment_id,
                order_number: assignment.order_number,
                reason: reason,
                notification: `⚠️ Order #${assignment.order_number} has been reassigned. Reason: ${reason}`
            });
            // Also emit assignment_cancelled for driver app compatibility
            io.to(`driver_${assignment.old_driver_user_id}`).emit('assignment_cancelled', {
                assignment_id,
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                reason: reason,
                message: `Assignment cancelled: ${reason}`
            });
        }

        // 2. Notify NEW driver - new assignment
        if (newDriver.user_id) {
            io.to(`driver_${newDriver.user_id}`).emit('new_assignment', {
                assignment_id,
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                part_description: assignment.part_description,
                pickup_address: assignment.pickup_address,
                delivery_address: assignment.delivery_address,
                garage_name: assignment.garage_name,
                is_reassignment: true,
                notification: `📦 Urgent assignment: Order #${assignment.order_number} (reassigned)`
            });
        }

        // 3. Notify CUSTOMER - driver changed
        io.to(`user_${assignment.customer_id}`).emit('driver_changed', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_driver: {
                name: newDriver.full_name,
                phone: newDriver.phone,
                vehicle_type: newDriver.vehicle_type,
                vehicle_plate: newDriver.vehicle_plate
            },
            reason: 'Driver reassigned for your delivery',
            notification: `🔄 Your delivery driver has been changed. New driver: ${newDriver.full_name}`
        });

        // 4. Notify GARAGE - driver changed
        io.to(`garage_${assignment.garage_id}`).emit('driver_changed', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_driver_name: newDriver.full_name,
            notification: `🔄 Driver changed for Order #${assignment.order_number}`
        });

        // 5. Notify Operations room
        io.to('operations').emit('driver_reassigned', {
            assignment_id,
            order_number: assignment.order_number,
            old_driver: assignment.old_driver_name,
            new_driver: newDriver.full_name,
            reason
        });

        res.json({
            success: true,
            message: `Driver reassigned from ${assignment.old_driver_name} to ${newDriver.full_name}`,
            assignment_id,
            order_number: assignment.order_number,
            new_driver: {
                id: newDriver.driver_id,
                name: newDriver.full_name,
                phone: newDriver.phone,
                vehicle: `${newDriver.vehicle_type} - ${newDriver.vehicle_plate}`
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('reassignDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Update delivery status
export const updateDeliveryStatus = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { status, driver_notes, recipient_name, delivery_photo_url, signature_url, failure_reason } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get assignment and order info WITH customer_id and order_number for socket notification
        const assignResult = await client.query(`
            SELECT da.*, o.order_id, o.order_status, o.customer_id, o.order_number, o.garage_id,
                   d.driver_id, d.full_name as driver_name
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_id = $1
        `, [assignment_id]);

        if (assignResult.rows.length === 0) {
            throw new Error('Assignment not found');
        }

        const assignment = assignResult.rows[0];

        // Update assignment
        const updateResult = await client.query(`
            UPDATE delivery_assignments SET
                status = $1,
                driver_notes = COALESCE($2, driver_notes),
                recipient_name = COALESCE($3, recipient_name),
                delivery_photo_url = COALESCE($4, delivery_photo_url),
                signature_url = COALESCE($5, signature_url),
                failure_reason = COALESCE($6, failure_reason),
                ${status === 'picked_up' ? 'pickup_at = NOW(),' : ''}
                ${status === 'delivered' ? 'delivered_at = NOW(),' : ''}
                updated_at = NOW()
            WHERE assignment_id = $7
            RETURNING *
        `, [status, driver_notes, recipient_name, delivery_photo_url, signature_url, failure_reason, assignment_id]);

        // Update order status if delivered
        if (status === 'delivered') {
            await client.query(
                'UPDATE orders SET order_status = $1, delivered_at = NOW(), updated_at = NOW() WHERE order_id = $2',
                ['delivered', assignment.order_id]
            );

            // Add to status history
            await client.query(`
                INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, $2, 'delivered', $3, 'operations', 'Delivery completed')
            `, [assignment.order_id, assignment.order_status, req.user?.userId]);

            // Free up driver
            await client.query(
                'UPDATE drivers SET status = $1, total_deliveries = total_deliveries + 1, updated_at = NOW() WHERE driver_id = $2',
                ['available', assignment.driver_id]
            );
        }

        await client.query('COMMIT');

        // CRITICAL: Emit socket notification to customer for real-time update
        const io = (global as any).io;
        if (io && status === 'delivered') {
            // Notify customer - delivery completed, please confirm
            io.to(`user_${assignment.customer_id}`).emit('order_status_updated', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                old_status: assignment.order_status,
                new_status: 'delivered',
                driver_name: assignment.driver_name,
                notification: `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
            });

            // Also emit delivery_completed event for specific handling
            io.to(`user_${assignment.customer_id}`).emit('delivery_completed', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                notification: `Your part has arrived! Please confirm delivery to complete the order.`
            });

            // Notify garage
            io.to(`garage_${assignment.garage_id}`).emit('order_status_updated', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                new_status: 'delivered',
                notification: `Order #${assignment.order_number} has been delivered to customer.`
            });
        }

        res.json({
            assignment: updateResult.rows[0],
            message: `Delivery status updated to ${status}`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('updateDeliveryStatus Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get delivery stats
export const getDeliveryStats = async (req: AuthRequest, res: Response) => {
    try {
        const statsResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT d.driver_id) FILTER (WHERE d.status = 'available') as available_drivers,
                COUNT(DISTINCT d.driver_id) FILTER (WHERE d.status = 'busy') as busy_drivers,
                COUNT(*) FILTER (WHERE da.status = 'in_transit') as in_transit,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND DATE(da.delivered_at) = CURRENT_DATE) as delivered_today
            FROM drivers d
            LEFT JOIN delivery_assignments da ON d.driver_id = da.driver_id
            WHERE d.is_active = true
        `);

        // Get pending collection count
        const pendingResult = await pool.query(`
            SELECT COUNT(*) as pending_pickup
            FROM orders 
            WHERE order_status = 'ready_for_pickup'
        `);

        // Get collected count (ready for driver assignment)
        const collectedResult = await pool.query(`
            SELECT COUNT(*) as ready_for_delivery
            FROM orders 
            WHERE order_status = 'collected'
        `);

        res.json({
            stats: {
                ...statsResult.rows[0],
                pending_pickup: parseInt(pendingResult.rows[0].pending_pickup) || 0,
                ready_for_delivery: parseInt(collectedResult.rows[0].ready_for_delivery) || 0
            }
        });
    } catch (err) {
        console.error('getDeliveryStats Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Update driver location (for real-time tracking)
export const updateDriverLocation = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    try {
        // Get assignment with order and customer info
        const result = await pool.query(`
            UPDATE delivery_assignments 
            SET current_lat = $1, current_lng = $2, last_location_update = NOW(), updated_at = NOW()
            WHERE assignment_id = $3
            RETURNING assignment_id, order_id, driver_id, current_lat, current_lng
        `, [lat, lng, assignment_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        const assignment = result.rows[0];

        // Get customer_id for socket notification
        const orderResult = await pool.query(
            'SELECT customer_id, order_number FROM orders WHERE order_id = $1',
            [assignment.order_id]
        );

        if (orderResult.rows.length > 0) {
            const order = orderResult.rows[0];
            const io = (global as any).io;

            // Real-time location broadcast to customer
            io.to(`user_${order.customer_id}`).emit('driver_location_update', {
                order_id: assignment.order_id,
                order_number: order.order_number,
                location: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng)
                },
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            location: {
                lat: assignment.current_lat,
                lng: assignment.current_lng
            },
            message: 'Location updated'
        });
    } catch (err) {
        console.error('updateDriverLocation Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get active deliveries with live positions (for operations dashboard map)
export const getActiveDeliveries = async (req: AuthRequest, res: Response) => {
    try {
        // Query includes both:
        // 1. Orders with active delivery assignments
        // 2. Orders marked as in_transit even without proper assignments (fallback)
        const result = await pool.query(`
            SELECT da.assignment_id, da.order_id, da.status as assignment_status,
                   da.current_lat, da.current_lng, da.last_location_update,
                   da.pickup_address, da.delivery_address,
                   da.estimated_delivery, da.created_at as assignment_created,
                   d.full_name as driver_name, d.phone as driver_phone,
                   d.vehicle_type, d.vehicle_plate,
                   o.order_number, o.customer_id, o.order_status,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   pr.part_description
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            WHERE o.order_status = 'in_transit'
               OR da.status IN ('assigned', 'picked_up', 'in_transit')
            ORDER BY COALESCE(da.created_at, o.updated_at) DESC
        `);

        res.json({ deliveries: result.rows });
    } catch (err) {
        console.error('getActiveDeliveries Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ZONE-BASED DELIVERY FEES
// ============================================

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Get primary hub location
async function getPrimaryHub(): Promise<{ latitude: number; longitude: number; hub_name: string }> {
    const result = await pool.query(`
        SELECT latitude, longitude, hub_name 
        FROM hub_locations 
        WHERE is_primary = true AND is_active = true 
        LIMIT 1
    `);

    if (result.rows.length === 0) {
        // Default to Industrial Area if no hub configured
        return { latitude: 25.2348, longitude: 51.4839, hub_name: 'Industrial Area Hub' };
    }

    return result.rows[0];
}

// Calculate delivery fee based on GPS coordinates
export const calculateDeliveryFee = async (req: AuthRequest, res: Response) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    try {
        const hub = await getPrimaryHub();
        const distance = calculateDistance(
            hub.latitude, hub.longitude,
            parseFloat(latitude), parseFloat(longitude)
        );

        // Find matching zone based on distance
        const zoneResult = await pool.query(`
            SELECT zone_id, zone_name, delivery_fee, min_distance_km, max_distance_km
            FROM delivery_zones
            WHERE is_active = true AND $1 >= min_distance_km AND $1 < max_distance_km
            ORDER BY min_distance_km ASC LIMIT 1
        `, [distance]);

        let zone;
        if (zoneResult.rows.length === 0) {
            // Default to highest zone if outside all zones
            const defaultZone = await pool.query(`
                SELECT zone_id, zone_name, delivery_fee, min_distance_km, max_distance_km
                FROM delivery_zones WHERE is_active = true
                ORDER BY max_distance_km DESC LIMIT 1
            `);
            zone = defaultZone.rows[0] || { zone_id: null, zone_name: 'Remote', delivery_fee: 50 };
        } else {
            zone = zoneResult.rows[0];
        }

        res.json({
            success: true,
            delivery_fee: parseFloat(zone.delivery_fee),
            zone: {
                zone_id: zone.zone_id,
                zone_name: zone.zone_name,
                min_km: zone.min_distance_km,
                max_km: zone.max_distance_km
            },
            distance_km: Math.round(distance * 10) / 10,
            hub: { name: hub.hub_name, latitude: hub.latitude, longitude: hub.longitude }
        });
    } catch (err) {
        console.error('[DELIVERY] calculateDeliveryFee error:', err);
        res.status(500).json({ error: 'Failed to calculate delivery fee' });
    }
};

// Get all active delivery zones
export const getDeliveryZones = async (_req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT zone_id, zone_name, min_distance_km, max_distance_km, delivery_fee
            FROM delivery_zones WHERE is_active = true ORDER BY min_distance_km ASC
        `);
        const hub = await getPrimaryHub();
        res.json({ zones: result.rows, hub });
    } catch (err) {
        console.error('[DELIVERY] getDeliveryZones error:', err);
        res.status(500).json({ error: 'Failed to fetch delivery zones' });
    }
};

// Admin: Update zone fee
export const updateZoneFee = async (req: AuthRequest, res: Response) => {
    const { zone_id } = req.params;
    const { delivery_fee, reason } = req.body;
    const adminId = req.user!.userId;

    if (!delivery_fee || delivery_fee < 0) {
        return res.status(400).json({ error: 'Valid delivery fee is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentResult = await client.query(
            'SELECT delivery_fee FROM delivery_zones WHERE zone_id = $1', [zone_id]
        );
        if (currentResult.rows.length === 0) throw new Error('Zone not found');
        const oldFee = currentResult.rows[0].delivery_fee;

        const updateResult = await client.query(`
            UPDATE delivery_zones SET delivery_fee = $1, updated_at = NOW()
            WHERE zone_id = $2 RETURNING *
        `, [delivery_fee, zone_id]);

        await client.query(`
            INSERT INTO delivery_zone_history (zone_id, old_fee, new_fee, changed_by, reason)
            VALUES ($1, $2, $3, $4, $5)
        `, [zone_id, oldFee, delivery_fee, adminId, reason || 'Admin update']);

        await client.query('COMMIT');
        res.json({ message: 'Zone fee updated successfully', zone: updateResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DELIVERY] updateZoneFee error:', err);
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get delivery fee for an order (internal use - called from order.controller.ts)
export async function getDeliveryFeeForLocation(lat: number, lng: number): Promise<{
    fee: number; zone_id: number | null; zone_name: string; distance_km: number;
}> {
    const hub = await getPrimaryHub();
    const distance = calculateDistance(hub.latitude, hub.longitude, lat, lng);

    const zoneResult = await pool.query(`
        SELECT zone_id, zone_name, delivery_fee FROM delivery_zones
        WHERE is_active = true AND $1 >= min_distance_km AND $1 < max_distance_km
        ORDER BY min_distance_km ASC LIMIT 1
    `, [distance]);

    if (zoneResult.rows.length === 0) {
        const defaultZone = await pool.query(`
            SELECT zone_id, zone_name, delivery_fee FROM delivery_zones
            WHERE is_active = true ORDER BY max_distance_km DESC LIMIT 1
        `);
        const zone = defaultZone.rows[0] || { zone_id: null, zone_name: 'Remote', delivery_fee: 50 };
        return { fee: parseFloat(zone.delivery_fee), zone_id: zone.zone_id, zone_name: zone.zone_name, distance_km: Math.round(distance * 10) / 10 };
    }

    const zone = zoneResult.rows[0];
    return { fee: parseFloat(zone.delivery_fee), zone_id: zone.zone_id, zone_name: zone.zone_name, distance_km: Math.round(distance * 10) / 10 };
}
