/**
 * Delivery Controller - Refactored to use Service Layer
 * Delegates to DeliveryService, GeoService, and TrackingService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import DeliveryService from '../services/delivery.service';
import { GeoService, TrackingService } from '../services/delivery';

// Initialize services
const geoService = new GeoService(pool);
const trackingService = new TrackingService(pool);

// ============================================
// DRIVER MANAGEMENT
// ============================================

export const getDrivers = async (req: AuthRequest, res: Response) => {
    try {
        const { status, page, limit } = req.query;
        const result = await DeliveryService.getDrivers({
            status: status as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
    } catch (err) {
        console.error('getDrivers Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDriverDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { driver_id } = req.params;
        const result = await DeliveryService.getDriverDetails(driver_id);
        res.json(result);
    } catch (err) {
        console.error('getDriverDetails Error:', err);
        const status = (err as any).statusCode || 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const createDriver = async (req: AuthRequest, res: Response) => {
    const { full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model } = req.body;

    if (!full_name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO drivers (full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, 'available', true)
             RETURNING *`,
            [full_name, phone, email || null, vehicle_type, vehicle_plate, vehicle_model || null]
        );

        await client.query('COMMIT');
        res.status(201).json({ driver: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('createDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

export const updateDriver = async (req: AuthRequest, res: Response) => {
    const { driver_id } = req.params;
    const { full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status } = req.body;

    try {
        const result = await pool.query(
            `UPDATE drivers
             SET full_name = COALESCE($1, full_name),
                 phone = COALESCE($2, phone),
                 email = COALESCE($3, email),
                 vehicle_type = COALESCE($4, vehicle_type),
                 vehicle_plate = COALESCE($5, vehicle_plate),
                 vehicle_model = COALESCE($6, vehicle_model),
                 status = COALESCE($7, status),
                 updated_at = NOW()
             WHERE driver_id = $8
             RETURNING *`,
            [full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, driver_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ driver: result.rows[0] });
    } catch (err) {
        console.error('updateDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DELIVERY ASSIGNMENTS
// ============================================

export const getOrdersReadyForCollection = async (req: AuthRequest, res: Response) => {
    try {
        const orders = await DeliveryService.getOrdersReadyForCollection();
        res.json({ orders });
    } catch (err) {
        console.error('getOrdersReadyForCollection Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getOrdersReadyForDelivery = async (req: AuthRequest, res: Response) => {
    try {
        const orders = await DeliveryService.getOrdersReadyForDelivery();
        res.json({ orders });
    } catch (err) {
        console.error('getOrdersReadyForDelivery Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const assignCollectionDriver = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const { driver_id, notes } = req.body;

        if (!driver_id) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }

        const result = await DeliveryService.assignCollectionDriver({
            order_id,
            driver_id,
            notes,
            assigned_by_user_id: req.user!.userId
        });

        res.json(result);
    } catch (err) {
        console.error('assignCollectionDriver Error:', err);
        const status = (err as any).statusCode || 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const assignDriver = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const { driver_id, estimated_pickup, estimated_delivery } = req.body;

        if (!driver_id) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }

        const result = await DeliveryService.assignDeliveryDriver({
            order_id,
            driver_id,
            estimated_pickup,
            estimated_delivery,
            assigned_by_user_id: req.user!.userId
        });

        res.json(result);
    } catch (err) {
        console.error('assignDriver Error:', err);
        const status = (err as any).statusCode || 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

// Legacy endpoints - keeping for backward compatibility
export const collectOrder = async (req: AuthRequest, res: Response) => {
    res.status(410).json({
        error: 'This endpoint is deprecated. Use assignCollectionDriver + driver pickup confirmation instead.',
        migration_guide: 'Use POST /delivery/orders/:order_id/assign-collection-driver'
    });
};

export const getOrdersForDelivery = async (req: AuthRequest, res: Response) => {
    try {
        const [collection, delivery] = await Promise.all([
            DeliveryService.getOrdersReadyForCollection(),
            DeliveryService.getOrdersReadyForDelivery()
        ]);

        res.json({
            ready_for_collection: collection,
            ready_for_delivery: delivery
        });
    } catch (err) {
        console.error('getOrdersForDelivery Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const reassignDriver = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { new_driver_id, reason } = req.body;

    if (!new_driver_id) {
        return res.status(400).json({ error: 'New driver ID is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current assignment
        const currentResult = await client.query(
            `SELECT da.*, d.full_name as old_driver_name
             FROM delivery_assignments da
             JOIN drivers d ON da.driver_id = d.driver_id
             WHERE da.order_id = $1 AND da.status IN ('assigned', 'picked_up', 'in_transit')`,
            [order_id]
        );

        if (currentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No active assignment found for this order' });
        }

        const oldAssignment = currentResult.rows[0];

        // Get new driver
        const newDriverResult = await client.query(
            'SELECT driver_id, user_id, full_name, status FROM drivers WHERE driver_id = $1',
            [new_driver_id]
        );

        if (newDriverResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'New driver not found' });
        }

        const newDriver = newDriverResult.rows[0];

        // Update old driver to available
        await client.query(
            'UPDATE drivers SET status = $1 WHERE driver_id = $2',
            ['available', oldAssignment.driver_id]
        );

        // Update assignment
        await client.query(
            `UPDATE delivery_assignments
             SET driver_id = $1, reassigned_at = NOW(), reassignment_reason = $2, updated_at = NOW()
             WHERE assignment_id = $3`,
            [new_driver_id, reason || 'Emergency reassignment', oldAssignment.assignment_id]
        );

        // Update new driver to busy
        await client.query(
            'UPDATE drivers SET status = $1 WHERE driver_id = $2',
            ['busy', new_driver_id]
        );

        // Update order
        await client.query(
            'UPDATE orders SET driver_id = $1 WHERE order_id = $2',
            [newDriver.user_id, order_id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Driver reassigned from ${oldAssignment.old_driver_name} to ${newDriver.full_name}`,
            new_driver: newDriver
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('reassignDriver Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

export const updateDeliveryStatus = async (req: AuthRequest, res: Response) => {
    const { assignment_id } = req.params;
    const { status, notes, proof_of_delivery_url } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE delivery_assignments
             SET status = $1,
                 ${status === 'delivered' ? 'delivered_at = NOW(),' : ''}
                 ${status === 'picked_up' ? 'picked_up_at = NOW(),' : ''}
                 proof_of_delivery_url = COALESCE($2, proof_of_delivery_url),
                 notes = COALESCE($3, notes),
                 updated_at = NOW()
             WHERE assignment_id = $4
             RETURNING *`,
            [status, proof_of_delivery_url, notes, assignment_id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment not found' });
        }

        const assignment = result.rows[0];

        // Update order status if delivered
        if (status === 'delivered') {
            await client.query(
                'UPDATE orders SET order_status = $1 WHERE order_id = $2',
                ['delivered', assignment.order_id]
            );

            // Update driver to available
            await client.query(
                'UPDATE drivers SET status = $1 WHERE driver_id = $2',
                ['available', assignment.driver_id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, assignment: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('updateDeliveryStatus Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// ============================================
// TRACKING & STATS
// ============================================

export const getDeliveryStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await trackingService.getDeliveryStats();
        res.json({ stats });
    } catch (err) {
        console.error('getDeliveryStats Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateDriverLocation = async (req: AuthRequest, res: Response) => {
    try {
        const { driver_id } = req.params;
        const { latitude, longitude, accuracy, heading, speed } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        await trackingService.updateDriverLocation(
            driver_id,
            parseFloat(latitude),
            parseFloat(longitude),
            accuracy ? parseFloat(accuracy) : undefined,
            heading ? parseFloat(heading) : undefined,
            speed ? parseFloat(speed) : undefined
        );

        res.json({
            success: true,
            message: 'Location updated',
            location: { latitude, longitude }
        });
    } catch (err) {
        console.error('updateDriverLocation Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Complete delivery with Proof of Delivery (POD)
 * Driver uploads photo and confirms delivery
 */
export const completeWithPOD = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id, pod_photo_url } = req.body;
        const driverId = req.user!.userId;

        if (!order_id || !pod_photo_url) {
            return res.status(400).json({ error: 'Order ID and POD photo URL are required' });
        }

        const { OrderLifecycleService } = await import('../services/order/lifecycle.service');
        const { getWritePool } = await import('../config/db');
        const lifecycleService = new OrderLifecycleService(getWritePool());

        await lifecycleService.completeOrderByDriver(order_id, driverId, pod_photo_url);

        res.json({
            success: true,
            message: 'Order completed successfully with POD',
            order_id,
            pod_photo_url
        });
    } catch (err) {
        console.error('completeWithPOD Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getActiveDeliveries = async (req: AuthRequest, res: Response) => {
    try {
        const deliveries = await trackingService.getActiveDeliveries();
        res.json({ deliveries });
    } catch (err) {
        console.error('getActiveDeliveries Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GEO & DELIVERY FEES
// ============================================

export const calculateDeliveryFee = async (req: AuthRequest, res: Response) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const result = await geoService.calculateDeliveryFee(
            parseFloat(latitude),
            parseFloat(longitude),
            true // include hub info
        );

        res.json({
            success: true,
            delivery_fee: result.fee,
            zone: {
                zone_id: result.zone_id,
                zone_name: result.zone_name
            },
            distance_km: result.distance_km,
            hub: result.hub
        });
    } catch (err) {
        console.error('calculateDeliveryFee Error:', err);
        res.status(500).json({ error: 'Failed to calculate delivery fee' });
    }
};

export const getDeliveryZones = async (_req: AuthRequest, res: Response) => {
    try {
        const zones = await geoService.getDeliveryZones();
        const hub = await geoService.getPrimaryHub();
        res.json({ zones, hub });
    } catch (err) {
        console.error('getDeliveryZones Error:', err);
        res.status(500).json({ error: 'Failed to fetch delivery zones' });
    }
};

export const updateZoneFee = async (req: AuthRequest, res: Response) => {
    try {
        const { zone_id } = req.params;
        const { delivery_fee, reason } = req.body;
        const adminId = req.user!.userId;

        if (!delivery_fee || delivery_fee < 0) {
            return res.status(400).json({ error: 'Valid delivery fee is required' });
        }

        const zone = await geoService.updateZoneFee(
            parseInt(zone_id),
            parseFloat(delivery_fee),
            adminId,
            reason
        );

        res.json({
            message: 'Zone fee updated successfully',
            zone
        });
    } catch (err) {
        console.error('updateZoneFee Error:', err);
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// EXPORTED HELPER (for order.controller.ts)
// ============================================

export async function getDeliveryFeeForLocation(lat: number, lng: number): Promise<{
    fee: number;
    zone_id: number | null;
    zone_name: string;
    distance_km: number;
}> {
    return geoService.calculateDeliveryFee(lat, lng);
}
