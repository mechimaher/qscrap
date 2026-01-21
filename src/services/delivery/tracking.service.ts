/**
 * TrackingService - Real-time GPS Tracking and Delivery Stats
 * Handles driver location updates, active delivery monitoring, and statistics
 */

import { Pool } from 'pg';
import { emitToOperations, emitToDriver } from '../../utils/socketIO';

export interface DriverLocation {
    driver_id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    timestamp: Date;
}

export interface ActiveDelivery {
    assignment_id: string;
    order_id: string;
    order_number: string;
    driver_id: string;
    driver_name: string;
    driver_lat: number | null;
    driver_lng: number | null;
    last_location_update: Date | null;
    pickup_address: string;
    delivery_address: string;
    destination_lat: number;
    destination_lng: number;
    status: string;
    assignment_type: string;
}

export interface DeliveryStats {
    total_deliveries_today: number;
    in_transit: number;
    delivered_today: number;
    active_drivers: number;
    pending_collections: number;
    pending_deliveries: number;
    average_delivery_time_minutes: number;
}

export class TrackingService {
    constructor(private pool: Pool) { }

    /**
     * Update driver's current GPS location
     */
    async updateDriverLocation(
        driverId: string,
        latitude: number,
        longitude: number,
        accuracy?: number,
        heading?: number,
        speed?: number
    ): Promise<void> {
        await this.pool.query(`
            UPDATE drivers 
            SET current_lat = $1,
                current_lng = $2,
                location_accuracy = $3,
                heading = $4,
                speed = $5,
                last_location_update = NOW(),
                updated_at = NOW()
            WHERE driver_id = $6
        `, [latitude, longitude, accuracy, heading, speed, driverId]);

        // Emit real-time location to tracking systems
        emitToOperations('driver_location_update', {
            driver_id: driverId,
            latitude,
            longitude,
            timestamp: new Date()
        });

        // Also emit to the driver themselves (for app confirmation)
        emitToDriver(driverId, 'location_updated', {
            latitude,
            longitude,
            timestamp: new Date()
        });
    }

    /**
     * Get all active deliveries with live driver positions
     * Used for operations dashboard real-time map
     */
    async getActiveDeliveries(): Promise<ActiveDelivery[]> {
        const result = await this.pool.query(`
            SELECT 
                da.assignment_id,
                da.order_id,
                da.driver_id,
                da.assignment_type,
                da.status as assignment_status,
                da.assigned_at,
                da.current_lat,
                da.current_lng,
                da.last_location_update,
                o.order_number,
                o.status as order_status,
                d.full_name as driver_name,
                d.phone as driver_phone,
                d.vehicle_type,
                d.vehicle_plate,
                c.full_name as customer_name,
                c.phone as customer_phone
            FROM driver_assignments da
            INNER JOIN orders o ON da.order_id = o.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id  
            WHERE da.status IN ('assigned', 'in_transit', 'arrived')
            ORDER BY da.assigned_at DESC
        `);
        return result.rows;
    }

    /**
     * Get delivery statistics for dashboard
     */
    async getDeliveryStats(): Promise<DeliveryStats> {
        const statsResult = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE DATE(da.created_at) = CURRENT_DATE) as total_deliveries_today,
                COUNT(*) FILTER (WHERE da.status = 'in_transit') as in_transit,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND DATE(da.delivered_at) = CURRENT_DATE) as delivered_today,
                COUNT(DISTINCT da.driver_id) FILTER (WHERE da.status IN ('assigned', 'picked_up', 'in_transit')) as active_drivers
            FROM delivery_assignments da
        `);

        const pendingResult = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE o.order_status = 'ready_for_pickup') as pending_collections,
                COUNT(*) FILTER (WHERE o.order_status = 'collected' AND o.driver_id IS NULL) as pending_deliveries
            FROM orders o
        `);

        const avgTimeResult = await this.pool.query(`
            SELECT 
                COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60), 0) as avg_minutes
            FROM delivery_assignments
            WHERE status = 'delivered' 
            AND DATE(delivered_at) = CURRENT_DATE
        `);

        return {
            total_deliveries_today: parseInt(statsResult.rows[0].total_deliveries_today) || 0,
            in_transit: parseInt(statsResult.rows[0].in_transit) || 0,
            delivered_today: parseInt(statsResult.rows[0].delivered_today) || 0,
            active_drivers: parseInt(statsResult.rows[0].active_drivers) || 0,
            pending_collections: parseInt(pendingResult.rows[0].pending_collections) || 0,
            pending_deliveries: parseInt(pendingResult.rows[0].pending_deliveries) || 0,
            average_delivery_time_minutes: Math.round(parseFloat(avgTimeResult.rows[0].avg_minutes) || 0)
        };
    }

    /**
     * Get driver's current location
     */
    async getDriverCurrentLocation(driverId: string): Promise<DriverLocation | null> {
        const result = await this.pool.query(`
            SELECT 
                driver_id,
                current_lat as latitude,
                current_lng as longitude,
                location_accuracy as accuracy,
                heading,
                speed,
                last_location_update as timestamp
            FROM drivers
            WHERE driver_id = $1
        `, [driverId]);

        if (result.rows.length === 0 || !result.rows[0].latitude) {
            return null;
        }

        return result.rows[0];
    }
}
