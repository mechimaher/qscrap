import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Get inspection criteria checklist
export const getInspectionCriteria = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT criteria_id, name, description, category, is_required, sort_order
            FROM inspection_criteria
            WHERE is_active = true
            ORDER BY sort_order ASC
        `);
        res.json({ criteria: result.rows });
    } catch (err: any) {
        console.error('getInspectionCriteria Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get orders ready for collection from garage (ready_for_pickup status)
export const getReadyForCollection = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at, o.updated_at,
                   pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                   g.garage_name, g.address as garage_address, gu.phone_number as garage_phone,
                   u.full_name as customer_name
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_status = 'ready_for_pickup'
            ORDER BY o.updated_at ASC
        `);
        res.json({ orders: result.rows });
    } catch (err: any) {
        console.error('getReadyForCollection Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get orders that have been collected and are pending QC inspection
// Includes orders that previously failed QC and are back for re-inspection
export const getPendingInspections = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.created_at, o.updated_at,
                   pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                   g.garage_name, gu.phone_number as garage_phone,
                   u.full_name as customer_name,
                   qi.inspection_id, qi.status as inspection_status,
                   CASE WHEN qi.status = 'failed' THEN true ELSE false END as is_reinspection
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN quality_inspections qi ON o.order_id = qi.order_id
            WHERE o.order_status = 'collected'
            ORDER BY o.created_at ASC
        `);
        res.json({ orders: result.rows });
    } catch (err: any) {
        console.error('getPendingInspections Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Start an inspection (creates inspection record)
export const startInspection = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const inspector_id = req.user?.userId;

    try {
        // Check if inspection already exists
        const existing = await pool.query(
            'SELECT inspection_id, status FROM quality_inspections WHERE order_id = $1',
            [order_id]
        );

        if (existing.rows.length > 0) {
            // Return existing inspection
            return res.json({
                inspection: existing.rows[0],
                message: 'Inspection already exists'
            });
        }

        // Create new inspection
        const result = await pool.query(`
            INSERT INTO quality_inspections (order_id, inspector_id, status, started_at)
            VALUES ($1, $2, 'in_progress', NOW())
            RETURNING *
        `, [order_id, inspector_id]);

        res.status(201).json({ inspection: result.rows[0] });
    } catch (err: any) {
        console.error('startInspection Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Submit inspection results (pass or fail) - Enhanced with professional fields
export const submitInspection = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const {
        result,
        checklist_results,
        notes,
        failure_reason,
        failure_category,
        photo_urls,
        part_grade,
        condition_assessment,
        item_notes
    } = req.body;
    const inspector_id = req.user?.userId;

    if (!result || !['passed', 'failed'].includes(result)) {
        return res.status(400).json({ error: 'Invalid result. Must be "passed" or "failed"' });
    }

    // Validate failure requirements
    if (result === 'failed') {
        if (!failure_reason || failure_reason.trim().length < 10) {
            return res.status(400).json({ error: 'Failure reason must be at least 10 characters' });
        }
        if (!failure_category) {
            return res.status(400).json({ error: 'Failure category is required when failing a part' });
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get order info for notifications
        const orderInfo = await client.query(`
            SELECT o.order_number, o.customer_id, o.garage_id, o.part_price,
                   pr.part_description, g.garage_name, g.address as garage_address,
                   u.full_name as customer_name
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderInfo.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderInfo.rows[0];

        // Update or create inspection record with enhanced fields
        const inspectionResult = await client.query(`
            INSERT INTO quality_inspections 
                (order_id, inspector_id, status, checklist_results, notes, failure_reason, 
                 failure_category, photo_urls, part_grade, condition_assessment, item_notes, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (order_id) DO UPDATE SET
                inspector_id = $2,
                status = $3,
                checklist_results = $4,
                notes = $5,
                failure_reason = $6,
                failure_category = $7,
                photo_urls = COALESCE(quality_inspections.photo_urls, '{}') || $8,
                part_grade = COALESCE($9, quality_inspections.part_grade),
                condition_assessment = COALESCE($10, quality_inspections.condition_assessment),
                item_notes = COALESCE($11, quality_inspections.item_notes),
                completed_at = NOW()
            RETURNING *
        `, [
            order_id,
            inspector_id,
            result,
            JSON.stringify(checklist_results || []),
            notes || null,
            result === 'failed' ? failure_reason : null,
            result === 'failed' ? failure_category : null,
            photo_urls || [],
            result === 'passed' ? (part_grade || 'B') : 'reject',
            condition_assessment || null,
            item_notes ? JSON.stringify(item_notes) : '{}'
        ]);

        // Set new order status based on result
        const newOrderStatus = result === 'passed' ? 'qc_passed' : 'qc_failed';

        await client.query(
            'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
            [newOrderStatus, order_id]
        );

        // Add to order status history
        await client.query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, changed_by_type, reason)
            VALUES ($1, 'collected', $2, $3, 'operations', $4)
        `, [
            order_id,
            newOrderStatus,
            inspector_id,
            result === 'passed' ? 'QC Inspection Passed' : `QC Failed: ${failure_reason || 'See inspection notes'}`
        ]);

        await client.query('COMMIT');

        // Socket notifications
        const io = (global as any).io;

        if (result === 'passed') {
            // Notify customer - part passed, will be delivered soon
            io.to(`user_${order.customer_id}`).emit('qc_passed', {
                order_id,
                order_number: order.order_number,
                notification: `✅ Your part passed quality inspection! Delivery will be assigned soon.`
            });

            // Notify garage - their part passed
            io.to(`garage_${order.garage_id}`).emit('qc_passed', {
                order_id,
                order_number: order.order_number,
                notification: `✅ Order #${order.order_number} passed QC inspection.`
            });
        } else {
            // QC FAILED - Notify all parties

            // Customer notification
            io.to(`user_${order.customer_id}`).emit('qc_failed', {
                order_id,
                order_number: order.order_number,
                failure_reason: failure_reason,
                notification: `❌ QC Failed: ${failure_reason || 'Part did not meet quality standards'}. Order will be cancelled and refunded.`
            });

            // Garage notification - part rejected, needs return
            io.to(`garage_${order.garage_id}`).emit('qc_failed', {
                order_id,
                order_number: order.order_number,
                failure_reason: failure_reason,
                notification: `⚠️ Order #${order.order_number} failed QC: ${failure_reason}. Part will be returned.`
            });

            // Operations broadcast (for dashboard updates)
            io.emit('qc_failed_alert', {
                order_id,
                order_number: order.order_number,
                part_description: order.part_description,
                garage_name: order.garage_name,
                failure_reason: failure_reason
            });
        }

        res.json({
            inspection: inspectionResult.rows[0],
            order_status: newOrderStatus,
            message: result === 'passed'
                ? 'Part passed QC and is ready for delivery assignment'
                : 'Part failed QC - order will be cancelled'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('submitInspection Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get inspection history
export const getInspectionHistory = async (req: AuthRequest, res: Response) => {
    const { limit = 20 } = req.query;

    try {
        const result = await pool.query(`
            SELECT qi.*, 
                   o.order_number, pr.part_description,
                   g.garage_name,
                   u.full_name as inspector_name
            FROM quality_inspections qi
            JOIN orders o ON qi.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users u ON qi.inspector_id = u.user_id
            WHERE qi.status IN ('passed', 'failed')
            ORDER BY qi.completed_at DESC
            LIMIT $1
        `, [Number(limit)]);

        res.json({ inspections: result.rows });
    } catch (err: any) {
        console.error('getInspectionHistory Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get QC dashboard stats
export const getQCStats = async (req: AuthRequest, res: Response) => {
    try {
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE o.order_status = 'ready_for_pickup') as ready_for_collection,
                COUNT(*) FILTER (WHERE o.order_status = 'collected') as pending_inspection,
                COUNT(*) FILTER (WHERE qi.status = 'passed' AND DATE(qi.completed_at) = CURRENT_DATE) as passed_today,
                COUNT(*) FILTER (WHERE qi.status = 'failed' AND DATE(qi.completed_at) = CURRENT_DATE) as failed_today
            FROM orders o
            LEFT JOIN quality_inspections qi ON o.order_id = qi.order_id
            WHERE o.order_status IN ('ready_for_pickup', 'collected', 'qc_passed', 'qc_failed')
        `);

        // Pass rate for last 7 days
        const rateResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'passed') as passed,
                COUNT(*) as total
            FROM quality_inspections
            WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'
              AND status IN ('passed', 'failed')
        `);

        const passed = parseInt(rateResult.rows[0].passed) || 0;
        const total = parseInt(rateResult.rows[0].total) || 1;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

        res.json({
            stats: {
                ...statsResult.rows[0],
                pass_rate: passRate
            }
        });
    } catch (err: any) {
        console.error('getQCStats Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get orders that passed QC and are ready for driver assignment
export const getQCPassedOrders = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.part_price, o.created_at,
                   pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name, g.address as garage_address,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   qi.part_grade, qi.condition_assessment, qi.completed_at as qc_completed_at
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN quality_inspections qi ON o.order_id = qi.order_id
            WHERE o.order_status = 'qc_passed'
            ORDER BY qi.completed_at ASC
        `);

        res.json({ orders: result.rows });
    } catch (err: any) {
        console.error('getQCPassedOrders Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Create return assignment for QC-failed parts
export const createReturnAssignment = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { driver_id, notes } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get order and garage info
        const orderResult = await client.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.garage_id,
                   g.garage_name, g.address as garage_address,
                   qi.failure_reason, qi.failure_category
            FROM orders o
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN quality_inspections qi ON o.order_id = qi.order_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        if (order.order_status !== 'qc_failed') {
            throw new Error('Can only create return assignment for QC-failed orders');
        }

        // Create return assignment - use 'assigned' status (valid per constraint)
        const assignmentResult = await client.query(`
            INSERT INTO delivery_assignments 
                (order_id, driver_id, assignment_type, pickup_address, delivery_address, return_reason, status)
            VALUES ($1, $2, 'return_to_garage', 'QScrap Inspection Center', $3, $4, 'assigned')
            RETURNING *
        `, [
            order_id,
            driver_id || null,
            order.garage_address,
            `QC Failed: ${order.failure_category} - ${order.failure_reason}`
        ]);

        // Update order status to returning
        await client.query(
            'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2',
            ['returning_to_garage', order_id]
        );

        // Update driver status if assigned
        if (driver_id) {
            await client.query(
                'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
                ['busy', driver_id]
            );
        }

        await client.query('COMMIT');

        // Socket notifications
        const io = (global as any).io;
        io.to(`garage_${order.garage_id}`).emit('return_assignment_created', {
            order_id,
            order_number: order.order_number,
            notification: `📦 Return scheduled for Order #${order.order_number}. Part will be returned to your garage.`
        });

        res.status(201).json({
            assignment: assignmentResult.rows[0],
            message: driver_id
                ? 'Return assignment created and driver assigned'
                : 'Return assignment created - awaiting driver assignment'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('createReturnAssignment Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get detailed inspection report for an order
export const getInspectionReport = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;

    try {
        const result = await pool.query(`
            SELECT qi.*,
                   o.order_number, o.order_status, o.part_price,
                   pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                   g.garage_name,
                   u.full_name as inspector_name
            FROM quality_inspections qi
            JOIN orders o ON qi.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users u ON qi.inspector_id = u.user_id
            WHERE qi.order_id = $1
        `, [order_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inspection not found for this order' });
        }

        res.json({ inspection: result.rows[0] });
    } catch (err: any) {
        console.error('getInspectionReport Error:', err);
        res.status(500).json({ error: err.message });
    }
};
