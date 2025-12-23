import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Get all drivers
export const getDrivers = async (req: AuthRequest, res: Response) => {
    const { status } = req.query;

    try {
        let query = `
            SELECT driver_id, full_name, phone, email, vehicle_type, vehicle_plate, 
                   status, total_deliveries, rating_average, is_active, created_at
            FROM drivers
            WHERE is_active = true
        `;
        const params: any[] = [];

        if (status) {
            query += ` AND status = $1`;
            params.push(status);
        }

        query += ' ORDER BY full_name ASC';

        const result = await pool.query(query, params);
        res.json({ drivers: result.rows });
    } catch (err: any) {
        console.error('getDrivers Error:', err);
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        console.error('getDriverDetails Error:', err);
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        console.error('createDriver Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Update driver
export const updateDriver = async (req: AuthRequest, res: Response) => {
    const { driver_id } = req.params;
    const { full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, is_active } = req.body;

    try {
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
    } catch (err: any) {
        console.error('updateDriver Error:', err);
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        console.error('getOrdersReadyForCollection Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get orders ready for DELIVERY to customers (qc_passed status)
export const getOrdersReadyForDelivery = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at, o.delivery_address,
                   pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   qi.result as qc_result, qi.part_grade, qi.condition_assessment
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN quality_inspections qi ON o.order_id = qi.order_id
            WHERE o.order_status = 'qc_passed'
            ORDER BY o.created_at ASC
        `);

        res.json({ orders: result.rows });
    } catch (err: any) {
        console.error('getOrdersReadyForDelivery Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Mark order as collected from garage (ready_for_pickup -> collected)
export const collectOrder = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { notes, driver_id } = req.body;

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
                'SELECT driver_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
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

            // Update order with driver
            await client.query(
                'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE order_id = $2',
                [driver_id, order_id]
            );

            // Create collection assignment record
            await client.query(`
                INSERT INTO delivery_assignments (order_id, driver_id, pickup_address, status)
                VALUES ($1, $2, $3, 'assigned')
                ON CONFLICT (order_id) DO UPDATE SET
                    driver_id = $2,
                    pickup_address = $3,
                    status = 'assigned',
                    updated_at = NOW()
            `, [order_id, driver_id, order.garage_address]);

            assignedDriver = driver;
        }

        // Update order status to collected
        await client.query(
            'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
            ['collected', order_id]
        );

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

        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `📦 Your part has been collected and is heading to quality inspection!`
        });

        res.json({
            success: true,
            message: 'Order collected successfully',
            order_number: order.order_number,
            driver: assignedDriver ? {
                name: assignedDriver.full_name,
                phone: assignedDriver.phone
            } : null
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('collectOrder Error:', err);
        res.status(500).json({ error: err.message });
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
            WHERE o.order_status IN ('ready_for_pickup', 'collected', 'qc_passed', 'in_transit')
            ORDER BY 
                CASE o.order_status 
                    WHEN 'in_transit' THEN 1
                    WHEN 'qc_passed' THEN 2
                    WHEN 'collected' THEN 3
                    WHEN 'ready_for_pickup' THEN 4
                END,
                o.created_at ASC
        `);

        res.json({ orders: result.rows });
    } catch (err: any) {
        console.error('getOrdersForDelivery Error:', err);
        res.status(500).json({ error: err.message });
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

        // CRITICAL: Enforce QC passed before driver assignment
        if (order.order_status !== 'qc_passed') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Cannot assign driver - order must pass QC inspection first',
                current_status: order.order_status,
                required_status: 'qc_passed'
            });
        }

        // Check driver availability
        const driverResult = await client.query(
            'SELECT driver_id, status, full_name, phone, vehicle_type, vehicle_plate FROM drivers WHERE driver_id = $1',
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
            ['in_transit', driver_id, order_id]
        );

        // Add to status history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, $2, $3, $4, 'operations', $5)
        `, [order_id, 'qc_passed', 'in_transit', req.user?.userId, `Assigned to driver: ${driver.full_name}`]);

        await client.query('COMMIT');

        // Socket notifications
        const io = (global as any).io;

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
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('assignDriver Error:', err);
        res.status(500).json({ error: err.message });
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

        // Get assignment and order info
        const assignResult = await client.query(`
            SELECT da.*, o.order_id, o.order_status, d.driver_id
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
                'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
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

        res.json({
            assignment: updateResult.rows[0],
            message: `Delivery status updated to ${status}`
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('updateDeliveryStatus Error:', err);
        res.status(500).json({ error: err.message });
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

        // Get QC passed count (ready for delivery)
        const qcPassedResult = await pool.query(`
            SELECT COUNT(*) as qc_passed
            FROM orders 
            WHERE order_status = 'qc_passed'
        `);

        res.json({
            stats: {
                ...statsResult.rows[0],
                pending_pickup: parseInt(pendingResult.rows[0].pending_pickup) || 0,
                qc_passed: parseInt(qcPassedResult.rows[0].qc_passed) || 0
            }
        });
    } catch (err: any) {
        console.error('getDeliveryStats Error:', err);
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        console.error('updateDriverLocation Error:', err);
        res.status(500).json({ error: err.message });
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
    } catch (err: any) {
        console.error('getActiveDeliveries Error:', err);
        res.status(500).json({ error: err.message });
    }
};
