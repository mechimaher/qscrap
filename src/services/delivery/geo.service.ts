/**
 * GeoService - Geographic and Delivery Fee Calculations
 * Handles GPS distance calculations, zone-based delivery fees, and hub locations
 */

import { Pool } from 'pg';

export interface Hub {
    latitude: number;
    longitude: number;
    hub_name: string;
}

export interface Zone {
    zone_id: number;
    zone_name: string;
    min_distance_km: number;
    max_distance_km: number;
    delivery_fee: number;
}

export interface DeliveryFeeResult {
    fee: number;
    zone_id: number | null;
    zone_name: string;
    distance_km: number;
    hub?: Hub;
}

export class GeoService {
    constructor(private pool: Pool) { }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @returns Distance in kilometers
     */
    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    /**
     * Get primary hub location for distance calculations
     */
    async getPrimaryHub(): Promise<Hub> {
        const result = await this.pool.query(`
            SELECT latitude, longitude, hub_name 
            FROM hub_locations 
            WHERE is_primary = true AND is_active = true 
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            // Default to Industrial Area if no hub configured
            return {
                latitude: 25.2348,
                longitude: 51.4839,
                hub_name: 'Industrial Area Hub'
            };
        }

        return result.rows[0];
    }

    /**
     * Get all active delivery zones
     */
    async getDeliveryZones(): Promise<Zone[]> {
        const result = await this.pool.query(`
            SELECT zone_id, zone_name, min_distance_km, max_distance_km, delivery_fee
            FROM delivery_zones 
            WHERE is_active = true 
            ORDER BY min_distance_km ASC
        `);

        return result.rows;
    }

    /**
     * Find delivery zone for a specific distance
     */
    async getZoneForDistance(distanceKm: number): Promise<Zone | null> {
        const result = await this.pool.query(`
            SELECT zone_id, zone_name, delivery_fee, min_distance_km, max_distance_km
            FROM delivery_zones
            WHERE is_active = true 
            AND $1 >= min_distance_km 
            AND $1 < max_distance_km
            ORDER BY min_distance_km ASC 
            LIMIT 1
        `, [distanceKm]);

        if (result.rows.length === 0) {
            // Return highest zone if outside all zones
            const defaultResult = await this.pool.query(`
                SELECT zone_id, zone_name, delivery_fee, min_distance_km, max_distance_km
                FROM delivery_zones 
                WHERE is_active = true
                ORDER BY max_distance_km DESC 
                LIMIT 1
            `);

            if (defaultResult.rows.length === 0) {
                return null;
            }

            return defaultResult.rows[0];
        }

        return result.rows[0];
    }

    /**
     * Calculate delivery fee for GPS coordinates
     */
    async calculateDeliveryFee(lat: number, lng: number, includeHub = false): Promise<DeliveryFeeResult> {
        const hub = await this.getPrimaryHub();
        const distance = this.calculateDistance(hub.latitude, hub.longitude, lat, lng);
        const zone = await this.getZoneForDistance(distance);

        // Default fee if no zone found
        const defaultFee = 50;
        const fee = zone ? zone.delivery_fee : defaultFee;

        const result: DeliveryFeeResult = {
            fee: parseFloat(fee.toString()),
            zone_id: zone?.zone_id || null,
            zone_name: zone?.zone_name || 'Remote Area',
            distance_km: Math.round(distance * 10) / 10
        };

        if (includeHub) {
            result.hub = hub;
        }

        return result;
    }

    /**
     * Update delivery zone fee (Admin operation)
     */
    async updateZoneFee(zoneId: number, newFee: number, changedBy: string, reason?: string): Promise<Zone> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current fee for history
            const currentResult = await client.query(
                'SELECT delivery_fee FROM delivery_zones WHERE zone_id = $1',
                [zoneId]
            );

            if (currentResult.rows.length === 0) {
                throw new Error('Delivery zone not found');
            }

            const oldFee = currentResult.rows[0].delivery_fee;

            // Update zone
            const updateResult = await client.query(`
                UPDATE delivery_zones 
                SET delivery_fee = $1, updated_at = NOW()
                WHERE zone_id = $2 
                RETURNING *
            `, [newFee, zoneId]);

            // Log change
            await client.query(`
                INSERT INTO delivery_zone_history (zone_id, old_fee, new_fee, changed_by, reason)
                VALUES ($1, $2, $3, $4, $5)
            `, [zoneId, oldFee, newFee, changedBy, reason || 'Admin update']);

            await client.query('COMMIT');
            return updateResult.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Calculate ETA based on distance and average speed
     * @param distanceKm Distance in kilometers
     * @param averageSpeedKmh Average speed in km/h (default: 40 km/h for urban Qatar)
     * @returns Estimated arrival time
     */
    calculateETA(distanceKm: number, averageSpeedKmh = 40): Date {
        const hours = distanceKm / averageSpeedKmh;
        const minutes = Math.ceil(hours * 60);
        const eta = new Date();
        eta.setMinutes(eta.getMinutes() + minutes);
        return eta;
    }

    /**
     * Calculate ETA from current location to destination
     */
    async calculateETAFromLocations(
        fromLat: number,
        fromLng: number,
        toLat: number,
        toLng: number,
        averageSpeedKmh = 40
    ): Promise<Date> {
        const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
        return this.calculateETA(distance, averageSpeedKmh);
    }
}

/**
 * Helper function for backward compatibility with order.controller.ts
 * Can be used as a standalone function without instantiating GeoService
 */
export async function getDeliveryFeeForLocation(
    pool: Pool,
    lat: number,
    lng: number
): Promise<DeliveryFeeResult> {
    const geoService = new GeoService(pool);
    return geoService.calculateDeliveryFee(lat, lng);
}
