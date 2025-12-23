import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// ============================================================================
// GPS VALIDATION UTILITIES
// ============================================================================

const isValidLatitude = (lat: any): boolean => {
    const n = parseFloat(lat);
    return !isNaN(n) && n >= -90 && n <= 90;
};

const isValidLongitude = (lng: any): boolean => {
    const n = parseFloat(lng);
    return !isNaN(n) && n >= -180 && n <= 180;
};

// Qatar bounds check (optional - for extra validation)
const isInQatarRegion = (lat: number, lng: number): boolean => {
    // Extended Qatar region (includes nearby areas)
    return lat >= 24.0 && lat <= 27.0 && lng >= 50.0 && lng <= 52.5;
};

// ============================================================================
// DRIVER PROFILE
// ============================================================================

/**
 * Get driver's own profile (linked via user_id)
 */
export const getMyProfile = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const result = await pool.query(`
            SELECT 
                d.driver_id, d.full_name, d.phone, d.email,
                d.vehicle_type, d.vehicle_plate, d.vehicle_model,
                d.status, d.total_deliveries, d.rating_average, d.rating_count,
                d.current_lat, d.current_lng, d.last_location_update,
                d.is_active, d.created_at,
                u.phone_number as login_phone
            FROM drivers d 
            JOIN users u ON d.user_id = u.user_id 
            WHERE d.user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        res.json({ driver: result.rows[0] });
    } catch (err: any) {
        console.error('getMyProfile Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ASSIGNMENTS
// ============================================================================

/**
 * Get driver's active assignments
 */
export const getMyAssignments = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { status } = req.query; // 'active' | 'completed' | 'all'

    try {
        let statusFilter = "da.status IN ('assigned', 'picked_up', 'in_transit')";
        if (status === 'completed') {
            statusFilter = "da.status IN ('delivered', 'failed')";
        } else if (status === 'all') {
            statusFilter = '1=1';
        }

        const result = await pool.query(`
            SELECT 
                da.assignment_id, da.order_id, da.status, da.status as assignment_status,
                da.pickup_address, da.delivery_address,
                da.pickup_lat, da.pickup_lng, da.delivery_lat, da.delivery_lng,
                da.current_lat, da.current_lng,
                da.estimated_delivery, da.pickup_at, da.delivered_at,
                da.delivery_photo_url, da.driver_notes as delivery_notes,
                da.created_at as assigned_at,
                o.order_number, o.order_status, o.total_amount,
                pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                u.full_name as customer_name, u.phone_number as customer_phone,
                g.garage_name, g.address as garage_address,
                gu.phone_number as garage_phone
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON gu.user_id = g.garage_id AND gu.user_type = 'garage'
            WHERE d.user_id = $1 AND ${statusFilter}
            ORDER BY 
                CASE da.status 
                    WHEN 'in_transit' THEN 1 
                    WHEN 'picked_up' THEN 2 
                    WHEN 'assigned' THEN 3 
                    ELSE 4 
                END,
                da.created_at DESC
            LIMIT 50
        `, [userId]);

        res.json({
            assignments: result.rows,
            count: result.rows.length
        });
    } catch (err: any) {
        console.error('getMyAssignments Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get single assignment details
 */
export const getAssignmentDetails = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { assignment_id } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                da.*,
                o.order_number, o.order_status, o.total_amount, o.created_at as order_created,
                pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                pr.condition_required,
                u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                g.garage_name, g.address as garage_address,
                gu.phone_number as garage_phone
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON gu.user_id = g.garage_id AND gu.user_type = 'garage'
            WHERE da.assignment_id = $1 AND d.user_id = $2
        `, [assignment_id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }

        res.json({ assignment: result.rows[0] });
    } catch (err: any) {
        console.error('getAssignmentDetails Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// LOCATION TRACKING
// ============================================================================

/**
 * Update driver's current location
 * Rate limited: 1 request per 5 seconds
 */
export const updateMyLocation = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { lat, lng, accuracy, heading, speed } = req.body;

    // Validate coordinates
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
        return res.status(400).json({
            error: 'Invalid GPS coordinates',
            details: 'Latitude must be -90 to 90, Longitude must be -180 to 180'
        });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    try {
        // Get driver_id from user_id
        const driverResult = await pool.query(
            'SELECT driver_id, status FROM drivers WHERE user_id = $1',
            [userId]
        );

        if (driverResult.rows.length === 0) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }

        const driverId = driverResult.rows[0].driver_id;

        // Update driver's location in drivers table
        await pool.query(`
            UPDATE drivers SET 
                current_lat = $1, 
                current_lng = $2, 
                last_location_update = NOW(),
                updated_at = NOW()
            WHERE driver_id = $3
        `, [latitude, longitude, driverId]);

        // Update all active assignments and get order info for notifications
        const assignments = await pool.query(`
            UPDATE delivery_assignments SET
                current_lat = $1,
                current_lng = $2,
                last_location_update = NOW(),
                updated_at = NOW()
            WHERE driver_id = $3
            AND status IN ('assigned', 'picked_up', 'in_transit')
            RETURNING assignment_id, order_id
        `, [latitude, longitude, driverId]);

        // Broadcast to customers via Socket.IO
        const io = (global as any).io;
        let notifiedCustomers = 0;

        for (const assignment of assignments.rows) {
            const orderResult = await pool.query(
                'SELECT customer_id, order_number FROM orders WHERE order_id = $1',
                [assignment.order_id]
            );

            if (orderResult.rows.length > 0) {
                const order = orderResult.rows[0];
                io.to(`user_${order.customer_id}`).emit('driver_location_update', {
                    order_id: assignment.order_id,
                    order_number: order.order_number,
                    location: {
                        lat: latitude,
                        lng: longitude,
                        accuracy: accuracy ? parseFloat(accuracy) : null,
                        heading: heading ? parseFloat(heading) : null,
                        speed: speed ? parseFloat(speed) : null
                    },
                    timestamp: new Date().toISOString()
                });
                notifiedCustomers++;
            }
        }

        res.json({
            success: true,
            location: { lat: latitude, lng: longitude },
            activeAssignments: assignments.rows.length,
            notifiedCustomers,
            updateInterval: 5  // Tell client to update every 5 seconds
        });
    } catch (err: any) {
        console.error('updateMyLocation Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// STATUS UPDATES
// ============================================================================

// Valid status transitions (SIMPLIFIED: assigned can go directly to in_transit)
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    'assigned': ['picked_up', 'in_transit'],  // Can skip picked_up
    'picked_up': ['in_transit'],
    'in_transit': ['delivered', 'failed']
};

/**
 * Update assignment status (picked_up, in_transit, delivered, failed)
 */
export const updateAssignmentStatus = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { assignment_id } = req.params;
    const { status, notes, failure_reason } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get assignment with ownership check
        const assignmentResult = await client.query(`
            SELECT da.*, d.driver_id, o.customer_id, o.garage_id, o.order_number, o.order_status
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            WHERE da.assignment_id = $1 AND d.user_id = $2
            FOR UPDATE
        `, [assignment_id, userId]);

        if (assignmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }

        const assignment = assignmentResult.rows[0];
        const currentStatus = assignment.status;

        // Validate transition
        const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedTransitions.includes(status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Cannot transition from '${currentStatus}' to '${status}'`,
                allowedTransitions
            });
        }

        // Build update query based on new status
        let updateQuery = `
            UPDATE delivery_assignments SET
                status = $1,
                driver_notes = COALESCE($2, driver_notes),
                updated_at = NOW()
        `;
        const params: any[] = [status, notes];
        let paramIndex = 3;

        if (status === 'picked_up') {
            updateQuery += `, pickup_at = NOW()`;
        } else if (status === 'delivered') {
            updateQuery += `, delivered_at = NOW()`;
        } else if (status === 'failed') {
            updateQuery += `, failure_reason = $${paramIndex}`;
            params.push(failure_reason || 'Unknown reason');
            paramIndex++;
        }

        updateQuery += ` WHERE assignment_id = $${paramIndex} RETURNING *`;
        params.push(assignment_id);

        const updateResult = await client.query(updateQuery, params);

        // Update order status if needed - differentiate by assignment type
        // Note: 'collection' is used for regular deliveries (driver collects from garage and delivers to customer)
        // 'delivery' and 'collection' both represent forward deliveries
        let newOrderStatus = null;
        if (assignment.assignment_type === 'delivery' || assignment.assignment_type === 'collection' || !assignment.assignment_type) {
            if (status === 'in_transit') {
                newOrderStatus = 'in_transit';
            } else if (status === 'delivered') {
                newOrderStatus = 'delivered';
            } else if (status === 'failed') {
                // If delivery failed (customer rejected), mark as disputed so Operations sees it
                newOrderStatus = 'disputed';
            }
        } else if (assignment.assignment_type === 'return_to_garage') {
            if (status === 'delivered') {
                newOrderStatus = 'returning_to_garage';
            }
        }

        if (newOrderStatus) {
            await client.query(`
                UPDATE orders SET 
                    order_status = $1, 
                    updated_at = NOW()
                WHERE order_id = $2
            `, [newOrderStatus, assignment.order_id]);

            // Record in status history
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by_type, changed_by, reason)
                VALUES ($1, $2, $3, 'driver', $4, $5)
            `, [
                assignment.order_id,
                assignment.order_status,
                newOrderStatus,
                userId,  // Use user_id from auth, not driver_id
                `Driver: ${status} - ${failure_reason || notes || ''}`
            ]);
        }

        // Handle Failed Delivery -> Create Dispute Record
        if (status === 'failed') {
            const disputeReason = 'delivery_issue';

            await client.query(`
                INSERT INTO disputes 
                (order_id, customer_id, garage_id, reason, description, photo_urls, refund_amount, restocking_fee, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            `, [
                assignment.order_id,
                assignment.customer_id,
                assignment.garage_id,
                disputeReason,
                `Driver reported delivery failure: ${failure_reason || notes || 'Customer refused delivery'}`,
                JSON.stringify([]), // No photos
                0, // Amount to be determined by Ops
                0
            ]);
        }

        // Update driver status
        if (status === 'delivered' || status === 'failed') {
            // Check if driver has other active assignments
            const otherActive = await client.query(`
                SELECT COUNT(*) FROM delivery_assignments 
                WHERE driver_id = $1 AND status IN ('assigned', 'picked_up', 'in_transit')
                AND assignment_id != $2
            `, [assignment.driver_id, assignment_id]);

            if (parseInt(otherActive.rows[0].count) === 0) {
                await client.query(
                    `UPDATE drivers SET status = 'available', updated_at = NOW() WHERE driver_id = $1`,
                    [assignment.driver_id]
                );
            }

            // Increment delivery count
            await client.query(`
                UPDATE drivers SET 
                    total_deliveries = total_deliveries + 1,
                    updated_at = NOW()
                WHERE driver_id = $1
            `, [assignment.driver_id]);

            // === CREATE DRIVER PAYOUT ===
            if (status === 'delivered') {
                // Get order total for payout calculation
                const orderResult = await client.query(
                    'SELECT total_amount, order_number FROM orders WHERE order_id = $1',
                    [assignment.order_id]
                );
                const orderTotal = parseFloat(orderResult.rows[0]?.total_amount) || 0;
                const orderNumber = orderResult.rows[0]?.order_number || '';

                // Calculate payout: 15% of order OR minimum QAR 20
                const payoutAmount = Math.max(20, orderTotal * 0.15);

                // Create payout record
                await client.query(`
                    INSERT INTO driver_payouts 
                        (driver_id, assignment_id, order_id, order_number, amount, status)
                    VALUES ($1, $2, $3, $4, $5, 'pending')
                `, [assignment.driver_id, assignment_id, assignment.order_id, orderNumber, payoutAmount.toFixed(2)]);

                // Update driver total earnings
                await client.query(`
                    UPDATE drivers SET 
                        total_earnings = COALESCE(total_earnings, 0) + $1,
                        updated_at = NOW()
                    WHERE driver_id = $2
                `, [payoutAmount.toFixed(2), assignment.driver_id]);
            }
        }

        await client.query('COMMIT');

        // Send Socket.IO notifications
        const io = (global as any).io;

        // Notify customer - EMIT SAME EVENTS AS OPERATIONS CONTROLLER
        // This ensures customer dashboard shows confirmation button regardless of who confirms
        io.to(`user_${assignment.customer_id}`).emit('delivery_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: status,
            notification: status === 'delivered'
                ? `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
                : `Delivery update: ${status.replace('_', ' ')}`
        });

        // CRITICAL: Also emit order_status_updated (same as operations controller)
        io.to(`user_${assignment.customer_id}`).emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
            new_status: status === 'delivered' ? 'delivered' : status,
            notification: status === 'delivered'
                ? `Your order #${assignment.order_number} has been delivered! Please confirm receipt.`
                : `Delivery update: ${status.replace('_', ' ')}`
        });

        // CRITICAL: Also emit delivery_completed for delivered status (same as operations controller)
        if (status === 'delivered') {
            io.to(`user_${assignment.customer_id}`).emit('delivery_completed', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                notification: `Your part has arrived! Please confirm delivery to complete the order.`
            });
        }

        // Notify garage - send the actual ORDER status, not assignment status
        io.to(`garage_${assignment.garage_id}`).emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: newOrderStatus || status  // Use order status (disputed) not assignment status (failed)
        });

        // Notify operations of Dispute if Failed
        if (status === 'failed') {
            io.to('operations').emit('dispute_created', {
                order_id: assignment.order_id,
                order_number: assignment.order_number,
                reason: 'Delivery Failed',
                notification: `⚠️ Delivery Failed for Order #${assignment.order_number}`
            });
        }

        // Notify operations - emit both events for compatibility
        io.to('operations').emit('delivery_status_updated', {
            assignment_id,
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            new_status: status
        });

        // Also emit order_status_updated to operations room - use actual ORDER status
        io.to('operations').emit('order_status_updated', {
            order_id: assignment.order_id,
            order_number: assignment.order_number,
            old_status: assignment.order_status,
            new_status: newOrderStatus || status  // Use 'disputed' not 'failed'
        });

        res.json({
            success: true,
            assignment: updateResult.rows[0],
            message: `Status updated to ${status}`
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('updateAssignmentStatus Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Upload proof of delivery photo
 */
export const uploadDeliveryProof = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { assignment_id } = req.params;

    // Handle file upload (base64 in body for simplicity, or multipart)
    const { photo_base64, signature_base64, notes } = req.body;

    if (!photo_base64) {
        return res.status(400).json({ error: 'Photo is required' });
    }

    try {
        // Verify ownership
        const checkResult = await pool.query(`
            SELECT da.assignment_id, da.status
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            WHERE da.assignment_id = $1 AND d.user_id = $2
        `, [assignment_id, userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }

        // In production, save to cloud storage. For now, store base64 reference
        const photoUrl = `data:image/jpeg;base64,${photo_base64.substring(0, 50)}...`; // Truncated for storage

        const result = await pool.query(`
            UPDATE delivery_assignments SET
                proof_of_delivery_photo = $1,
                signature_image = $2,
                delivery_notes = COALESCE($3, delivery_notes),
                updated_at = NOW()
            WHERE assignment_id = $4
            RETURNING *
        `, [photo_base64, signature_base64 || null, notes, assignment_id]);

        res.json({
            success: true,
            message: 'Proof of delivery uploaded',
            assignment: result.rows[0]
        });
    } catch (err: any) {
        console.error('uploadDeliveryProof Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// DRIVER STATS
// ============================================================================

/**
 * Get driver's delivery statistics
 */
export const getMyStats = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const statsResult = await pool.query(`
            SELECT 
                d.total_deliveries,
                d.rating_average,
                d.rating_count,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND DATE(da.delivered_at) = CURRENT_DATE) as today_deliveries,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND da.delivered_at >= CURRENT_DATE - INTERVAL '7 days') as week_deliveries,
                COUNT(*) FILTER (WHERE da.status IN ('assigned', 'picked_up', 'in_transit')) as active_assignments
            FROM drivers d
            LEFT JOIN delivery_assignments da ON d.driver_id = da.driver_id
            WHERE d.user_id = $1
            GROUP BY d.driver_id, d.total_deliveries, d.rating_average, d.rating_count
        `, [userId]);

        if (statsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ stats: statsResult.rows[0] });
    } catch (err: any) {
        console.error('getMyStats Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Toggle driver availability status
 */
export const toggleAvailability = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { status } = req.body; // 'available' | 'offline'

    if (!['available', 'offline'].includes(status)) {
        return res.status(400).json({ error: 'Status must be "available" or "offline"' });
    }

    try {
        // Check for active deliveries before going offline
        if (status === 'offline') {
            const activeCheck = await pool.query(`
                SELECT COUNT(*) FROM delivery_assignments da
                JOIN drivers d ON da.driver_id = d.driver_id
                WHERE d.user_id = $1 AND da.status IN ('assigned', 'picked_up', 'in_transit')
            `, [userId]);

            if (parseInt(activeCheck.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'Cannot go offline with active deliveries',
                    activeCount: parseInt(activeCheck.rows[0].count)
                });
            }
        }

        const result = await pool.query(`
            UPDATE drivers SET 
                status = $1,
                updated_at = NOW()
            WHERE user_id = $2
            RETURNING driver_id, status
        `, [status, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        // Notify operations
        const io = (global as any).io;
        io.to('operations').emit('driver_status_changed', {
            driver_id: result.rows[0].driver_id,
            new_status: status
        });

        res.json({
            success: true,
            status: result.rows[0].status,
            message: `You are now ${status}`
        });
    } catch (err: any) {
        console.error('toggleAvailability Error:', err);
        res.status(500).json({ error: err.message });
    }
};
