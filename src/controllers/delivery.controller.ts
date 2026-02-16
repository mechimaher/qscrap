/**
 * Delivery Controller - Refactored to use Service Layer
 * Delegates to DeliveryService, GeoService, and TrackingService
 */

import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { GeoService, TrackingService } from '../services/delivery';
import DeliveryService from '../services/delivery.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';

// Initialize services
const geoService = new GeoService(pool);
const trackingService = new TrackingService(pool);

interface OrderParams {
    order_id: string;
}

interface DriverParams {
    driver_id: string;
}

interface AssignmentParams {
    assignment_id: string;
}

interface ZoneParams {
    zone_id: string;
}

interface CreateDriverBody {
    full_name?: string;
    phone?: string;
    email?: string;
    vehicle_type?: string;
    vehicle_plate?: string;
    vehicle_model?: string;
}

interface UpdateDriverBody extends CreateDriverBody {
    status?: string;
}

interface AssignCollectionBody {
    driver_id?: string;
    notes?: string;
}

interface AssignDeliveryBody {
    driver_id?: string;
    estimated_pickup?: string;
    estimated_delivery?: string;
}

interface ReassignDriverBody {
    new_driver_id?: string;
    reason?: string;
}

interface UpdateDeliveryStatusBody {
    status?: string;
    notes?: string;
    proof_of_delivery_url?: string;
}

interface UpdateDriverLocationBody {
    latitude?: number | string;
    longitude?: number | string;
    accuracy?: number | string;
    heading?: number | string;
    speed?: number | string;
}

interface CompleteWithPODBody {
    order_id?: string;
    pod_photo_url?: string;
}

interface CalculateDeliveryFeeBody {
    latitude?: number | string;
    longitude?: number | string;
    order_total?: number | string;
}

interface UpdateZoneFeeBody {
    delivery_fee?: number | string;
    reason?: string;
}

interface DriverRow extends Record<string, unknown> {
    driver_id: string;
    user_id: string | null;
    full_name: string;
    phone: string;
    vehicle_type: string | null;
    vehicle_plate: string | null;
    status: string;
}

interface CurrentAssignmentRow {
    assignment_id: string;
    order_id: string;
    driver_id: string;
    old_driver_name: string;
}

interface NewDriverRow {
    driver_id: string;
    user_id: string;
    full_name: string;
    status: string;
}

interface DeliveryAssignmentRow extends Record<string, unknown> {
    assignment_id: string;
    order_id: string;
    driver_id: string;
}

interface ErrorWithStatusCode {
    statusCode?: unknown;
}

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const getErrorStatusCode = (error: unknown, fallback = 500): number => {
    if (typeof error !== 'object' || error === null) {
        return fallback;
    }
    const maybeError = error as ErrorWithStatusCode;
    return typeof maybeError.statusCode === 'number' ? maybeError.statusCode : fallback;
};

const logDeliveryError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

// ============================================
// DRIVER MANAGEMENT
// ============================================

export const getDrivers = async (req: AuthRequest, res: Response) => {
    try {
        const result = await DeliveryService.getDrivers({
            status: toQueryString(req.query.status),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        });
        res.json(result);
    } catch (error) {
        logDeliveryError('getDrivers Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

/**
 * Get drivers ranked by proximity to order's garage
 * Returns drivers sorted by distance with distance_km field
 */
export const getRankedDriversForOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;
        const result = await DeliveryService.getRankedDriversForOrder(orderId);
        res.json(result);
    } catch (error) {
        logDeliveryError('getRankedDriversForOrder Error', error);
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
};

export const getDriverDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { driver_id: driverId } = req.params as unknown as DriverParams;
        const result = await DeliveryService.getDriverDetails(driverId);
        res.json(result);
    } catch (error) {
        logDeliveryError('getDriverDetails Error', error);
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
};

export const createDriver = async (req: AuthRequest, res: Response) => {
    const body = req.body as unknown as CreateDriverBody;
    const fullName = toQueryString(body.full_name);
    const phone = toQueryString(body.phone);
    const email = toQueryString(body.email);
    const vehicleType = toQueryString(body.vehicle_type);
    const vehiclePlate = toQueryString(body.vehicle_plate);
    const vehicleModel = toQueryString(body.vehicle_model);

    if (!fullName || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query<DriverRow>(
            `INSERT INTO drivers (full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, 'available', true)
             RETURNING *`,
            [
                fullName,
                phone,
                email ?? null,
                vehicleType ?? null,
                vehiclePlate ?? null,
                vehicleModel ?? null
            ]
        );

        const driver = result.rows[0];
        if (!driver) {
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Failed to create driver' });
        }

        await client.query('COMMIT');
        res.status(201).json({ driver });
    } catch (error) {
        await client.query('ROLLBACK');
        logDeliveryError('createDriver Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    } finally {
        client.release();
    }
};

export const updateDriver = async (req: AuthRequest, res: Response) => {
    const { driver_id: driverId } = req.params as unknown as DriverParams;
    const body = req.body as unknown as UpdateDriverBody;
    const fullName = toQueryString(body.full_name);
    const phone = toQueryString(body.phone);
    const email = toQueryString(body.email);
    const vehicleType = toQueryString(body.vehicle_type);
    const vehiclePlate = toQueryString(body.vehicle_plate);
    const vehicleModel = toQueryString(body.vehicle_model);
    const status = toQueryString(body.status);

    try {
        const result = await pool.query<DriverRow>(
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
            [
                fullName ?? null,
                phone ?? null,
                email ?? null,
                vehicleType ?? null,
                vehiclePlate ?? null,
                vehicleModel ?? null,
                status ?? null,
                driverId
            ]
        );

        const driver = result.rows[0];
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ driver });
    } catch (error) {
        logDeliveryError('updateDriver Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

// ============================================
// DELIVERY ASSIGNMENTS
// ============================================

export const getOrdersReadyForCollection = async (_req: AuthRequest, res: Response) => {
    try {
        const orders = await DeliveryService.getOrdersReadyForCollection();
        res.json({ orders });
    } catch (error) {
        logDeliveryError('getOrdersReadyForCollection Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const getOrdersReadyForDelivery = async (_req: AuthRequest, res: Response) => {
    try {
        const orders = await DeliveryService.getOrdersReadyForDelivery();
        res.json({ orders });
    } catch (error) {
        logDeliveryError('getOrdersReadyForDelivery Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const assignCollectionDriver = async (req: AuthRequest, res: Response) => {
    const assignedByUserId = getUserId(req);
    if (!assignedByUserId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;
        const body = req.body as unknown as AssignCollectionBody;
        const driverId = toQueryString(body.driver_id);
        const notes = toQueryString(body.notes);

        if (!driverId) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }

        const result = await DeliveryService.assignCollectionDriver({
            order_id: orderId,
            driver_id: driverId,
            notes,
            assigned_by_user_id: assignedByUserId
        });

        res.json(result);
    } catch (error) {
        logDeliveryError('assignCollectionDriver Error', error);
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
};

export const assignDriver = async (req: AuthRequest, res: Response) => {
    const assignedByUserId = getUserId(req);
    if (!assignedByUserId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id: orderId } = req.params as unknown as OrderParams;
        const body = req.body as unknown as AssignDeliveryBody;
        const driverId = toQueryString(body.driver_id);
        const estimatedPickup = toQueryString(body.estimated_pickup);
        const estimatedDelivery = toQueryString(body.estimated_delivery);

        if (!driverId) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }

        const result = await DeliveryService.assignDeliveryDriver({
            order_id: orderId,
            driver_id: driverId,
            estimated_pickup: estimatedPickup,
            estimated_delivery: estimatedDelivery,
            assigned_by_user_id: assignedByUserId
        });

        res.json(result);
    } catch (error) {
        logDeliveryError('assignDriver Error', error);
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
};

// Legacy endpoints - keeping for backward compatibility
export const collectOrder = (_req: AuthRequest, res: Response) => {
    res.status(410).json({
        error: 'This endpoint is deprecated. Use assignCollectionDriver + driver pickup confirmation instead.',
        migration_guide: 'Use POST /delivery/orders/:order_id/assign-collection-driver'
    });
};

export const getOrdersForDelivery = async (_req: AuthRequest, res: Response) => {
    try {
        const [collection, delivery] = await Promise.all([
            DeliveryService.getOrdersReadyForCollection(),
            DeliveryService.getOrdersReadyForDelivery()
        ]);

        res.json({
            ready_for_collection: collection,
            ready_for_delivery: delivery
        });
    } catch (error) {
        logDeliveryError('getOrdersForDelivery Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const reassignDriver = async (req: AuthRequest, res: Response) => {
    const { assignment_id: assignmentId } = req.params as unknown as AssignmentParams;
    const body = req.body as unknown as ReassignDriverBody;
    const newDriverId = toQueryString(body.new_driver_id);
    const reason = toQueryString(body.reason);

    if (!newDriverId) {
        return res.status(400).json({ error: 'New driver ID is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current assignment by assignment_id
        const currentResult = await client.query<CurrentAssignmentRow>(
            `SELECT da.*, d.full_name as old_driver_name, o.order_id, o.order_number
             FROM delivery_assignments da
             JOIN drivers d ON da.driver_id = d.driver_id
             JOIN orders o ON da.order_id = o.order_id
             WHERE da.assignment_id = $1 AND da.status IN ('assigned', 'picked_up', 'in_transit')`,
            [assignmentId]
        );

        const oldAssignment = currentResult.rows[0];
        if (!oldAssignment) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No active assignment found for this order' });
        }

        // Get new driver
        const newDriverResult = await client.query<NewDriverRow>(
            'SELECT driver_id, user_id, full_name, status FROM drivers WHERE driver_id = $1',
            [newDriverId]
        );

        const newDriver = newDriverResult.rows[0];
        if (!newDriver) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'New driver not found' });
        }

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
            [newDriverId, reason || 'Emergency reassignment', oldAssignment.assignment_id]
        );

        // Update new driver to busy
        await client.query(
            'UPDATE drivers SET status = $1 WHERE driver_id = $2',
            ['busy', newDriverId]
        );

        // Update order
        await client.query(
            'UPDATE orders SET driver_id = $1 WHERE order_id = $2',
            [newDriver.user_id, oldAssignment.order_id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Driver reassigned from ${oldAssignment.old_driver_name} to ${newDriver.full_name}`,
            new_driver: newDriver
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logDeliveryError('reassignDriver Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    } finally {
        client.release();
    }
};

export const updateDeliveryStatus = async (req: AuthRequest, res: Response) => {
    const { assignment_id: assignmentId } = req.params as unknown as AssignmentParams;
    const body = req.body as unknown as UpdateDeliveryStatusBody;
    const status = toQueryString(body.status);
    const notes = toQueryString(body.notes);
    const proofOfDeliveryUrl = toQueryString(body.proof_of_delivery_url);

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
            [status, proofOfDeliveryUrl ?? null, notes ?? null, assignmentId]
        );

        const assignment = result.rows[0] as DeliveryAssignmentRow | undefined;
        if (!assignment) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment not found' });
        }

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
        res.json({ success: true, assignment });
    } catch (error) {
        await client.query('ROLLBACK');
        logDeliveryError('updateDeliveryStatus Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    } finally {
        client.release();
    }
};

// ============================================
// TRACKING & STATS
// ============================================

export const getDeliveryStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await trackingService.getDeliveryStats();
        res.json({ stats });
    } catch (error) {
        logDeliveryError('getDeliveryStats Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const updateDriverLocation = async (req: AuthRequest, res: Response) => {
    try {
        const { driver_id: driverId } = req.params as unknown as DriverParams;
        const body = req.body as unknown as UpdateDriverLocationBody;
        const latitude = toOptionalNumber(body.latitude);
        const longitude = toOptionalNumber(body.longitude);
        const accuracy = toOptionalNumber(body.accuracy);
        const heading = toOptionalNumber(body.heading);
        const speed = toOptionalNumber(body.speed);

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        await trackingService.updateDriverLocation(
            driverId,
            latitude,
            longitude,
            accuracy,
            heading,
            speed
        );

        res.json({
            success: true,
            message: 'Location updated',
            location: { latitude, longitude }
        });
    } catch (error) {
        logDeliveryError('updateDriverLocation Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

/**
 * Complete delivery with Proof of Delivery (POD)
 * Driver uploads photo and confirms delivery
 */
export const completeWithPOD = async (req: AuthRequest, res: Response) => {
    const driverId = getUserId(req);
    if (!driverId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as CompleteWithPODBody;
        const orderId = toQueryString(body.order_id);
        const podPhotoUrl = toQueryString(body.pod_photo_url);

        if (!orderId || !podPhotoUrl) {
            return res.status(400).json({ error: 'Order ID and POD photo URL are required' });
        }

        const { OrderLifecycleService } = await import('../services/order/lifecycle.service');
        const { getWritePool } = await import('../config/db');
        const lifecycleService = new OrderLifecycleService(getWritePool());

        await lifecycleService.completeOrderByDriver(orderId, driverId, podPhotoUrl);

        res.json({
            success: true,
            message: 'Order completed successfully with POD',
            order_id: orderId,
            pod_photo_url: podPhotoUrl
        });
    } catch (error) {
        logDeliveryError('completeWithPOD Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

export const getActiveDeliveries = async (_req: AuthRequest, res: Response) => {
    try {
        const deliveries = await trackingService.getActiveDeliveries();
        res.json({ deliveries });
    } catch (error) {
        logDeliveryError('getActiveDeliveries Error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

// ============================================
// GEO & DELIVERY FEES
// ============================================

export const calculateDeliveryFee = async (req: AuthRequest, res: Response) => {
    try {
        const body = req.body as unknown as CalculateDeliveryFeeBody;
        const latitude = toOptionalNumber(body.latitude);
        const longitude = toOptionalNumber(body.longitude);
        const orderTotal = toOptionalNumber(body.order_total);

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // If order_total provided, use DeliveryFeeService for tier discounts
        if (orderTotal !== undefined) {
            const { DeliveryFeeService } = await import('../services/delivery/delivery-fee.service');
            const feeService = new DeliveryFeeService(pool);

            const result = await feeService.calculateFee(
                latitude,
                longitude,
                orderTotal
            );

            return res.json({
                success: true,
                base_fee: result.base_fee,
                discount_percent: result.discount_percent,
                discount_amount: result.discount_amount,
                delivery_fee: result.final_fee,
                zone: {
                    zone_id: result.zone_id,
                    zone_name: result.zone_name
                },
                distance_km: result.distance_km,
                is_free_delivery: result.is_free_delivery,
                message: result.message
            });
        }

        // Fallback to basic geo-based fee (no discount)
        const result = await geoService.calculateDeliveryFee(
            latitude,
            longitude,
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
    } catch (error) {
        logDeliveryError('calculateDeliveryFee Error', error);
        res.status(500).json({ error: 'Failed to calculate delivery fee' });
    }
};

export const getDeliveryZones = async (_req: AuthRequest, res: Response) => {
    try {
        const zones = await geoService.getDeliveryZones();
        const hub = await geoService.getPrimaryHub();
        res.json({ zones, hub });
    } catch (error) {
        logDeliveryError('getDeliveryZones Error', error);
        res.status(500).json({ error: 'Failed to fetch delivery zones' });
    }
};

export const updateZoneFee = async (req: AuthRequest, res: Response) => {
    const adminId = getUserId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { zone_id: zoneIdRaw } = req.params as unknown as ZoneParams;
        const body = req.body as unknown as UpdateZoneFeeBody;
        const zoneId = toOptionalInt(zoneIdRaw);
        const deliveryFee = toOptionalNumber(body.delivery_fee);
        const reason = toQueryString(body.reason);

        if (zoneId === undefined) {
            return res.status(400).json({ error: 'Valid zone_id is required' });
        }

        if (deliveryFee === undefined || deliveryFee < 0) {
            return res.status(400).json({ error: 'Valid delivery fee is required' });
        }

        const zone = await geoService.updateZoneFee(
            zoneId,
            deliveryFee,
            adminId,
            reason
        );

        res.json({
            message: 'Zone fee updated successfully',
            zone
        });
    } catch (error) {
        logDeliveryError('updateZoneFee Error', error);
        res.status(400).json({ error: getErrorMessage(error) });
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
