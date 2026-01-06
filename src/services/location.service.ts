/**
 * Location Service - Centralized geospatial operations for QScrap platform
 * 
 * Handles all location-related operations including:
 * - Garage location management
 * - Pickup/delivery coordinate retrieval
 * - Distance calculations (Haversine)
 * - Future: Nearby garage search, route optimization
 */

import pool from '../config/db';
import logger from '../utils/logger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface GarageLocation extends Coordinates {
    garage_id: string;
    garage_name: string;
    address: string | null;
    verified: boolean;
}

export interface PickupInfo {
    coordinates: Coordinates | null;
    garage: GarageLocation;
    has_coordinates: boolean;
}

export interface DeliveryInfo {
    coordinates: Coordinates | null;
    address: string | null;
    has_coordinates: boolean;
}

// ============================================
// DISTANCE CALCULATIONS
// ============================================

/**
 * Haversine formula to calculate distance between two GPS coordinates
 * @returns Distance in kilometers
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Validate GPS coordinates are within valid ranges
 */
export function isValidCoordinates(coords: Coordinates): boolean {
    return (
        typeof coords.lat === 'number' &&
        typeof coords.lng === 'number' &&
        coords.lat >= -90 && coords.lat <= 90 &&
        coords.lng >= -180 && coords.lng <= 180 &&
        !isNaN(coords.lat) && !isNaN(coords.lng)
    );
}

/**
 * Validate coordinates are within Qatar's approximate bounding box
 * Qatar: Lat 24.4-26.2, Lng 50.7-51.7
 */
export function isWithinQatar(coords: Coordinates): boolean {
    return (
        coords.lat >= 24.4 && coords.lat <= 26.2 &&
        coords.lng >= 50.7 && coords.lng <= 51.7
    );
}

// ============================================
// GARAGE LOCATION OPERATIONS
// ============================================

/**
 * Set or update a garage's GPS location
 */
export async function setGarageLocation(
    garageId: string,
    coords: Coordinates,
    address?: string
): Promise<boolean> {
    if (!isValidCoordinates(coords)) {
        logger.warn('Invalid coordinates provided for garage location', { garageId, coords });
        return false;
    }

    if (!isWithinQatar(coords)) {
        logger.warn('Coordinates outside Qatar boundary', { garageId, coords });
        // Not blocking - garage might be near border
    }

    try {
        const updateFields = ['location_lat = $2', 'location_lng = $3', 'updated_at = NOW()'];
        const params: (string | number)[] = [garageId, coords.lat, coords.lng];

        if (address) {
            updateFields.push(`address = $${params.length + 1}`);
            params.push(address);
        }

        const result = await pool.query(
            `UPDATE garages SET ${updateFields.join(', ')} WHERE garage_id = $1`,
            params
        );

        if (result.rowCount === 0) {
            logger.error('Garage not found when setting location', { garageId });
            return false;
        }

        logger.info('Garage location updated', { garageId, lat: coords.lat, lng: coords.lng });
        return true;
    } catch (error) {
        logger.error('Failed to set garage location', { garageId, error });
        throw error;
    }
}

/**
 * Get a garage's location by ID
 */
export async function getGarageLocation(garageId: string): Promise<GarageLocation | null> {
    try {
        const result = await pool.query(
            `SELECT garage_id, garage_name, address, location_lat, location_lng, is_verified
             FROM garages 
             WHERE garage_id = $1 AND deleted_at IS NULL`,
            [garageId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            garage_id: row.garage_id,
            garage_name: row.garage_name,
            address: row.address,
            lat: row.location_lat ? parseFloat(row.location_lat) : 0,
            lng: row.location_lng ? parseFloat(row.location_lng) : 0,
            verified: row.is_verified || false
        };
    } catch (error) {
        logger.error('Failed to get garage location', { garageId, error });
        throw error;
    }
}

/**
 * Check if garage has valid GPS coordinates
 */
export async function hasGarageLocation(garageId: string): Promise<boolean> {
    const location = await getGarageLocation(garageId);
    return location !== null && location.lat !== 0 && location.lng !== 0;
}

// ============================================
// ORDER/DELIVERY COORDINATES
// ============================================

/**
 * Get pickup coordinates for an order (from garage location)
 */
export async function getPickupCoordinates(orderId: string): Promise<PickupInfo | null> {
    try {
        const result = await pool.query(
            `SELECT o.order_id, g.garage_id, g.garage_name, g.address,
                    g.location_lat, g.location_lng, g.is_verified
             FROM orders o
             JOIN garages g ON o.garage_id = g.garage_id
             WHERE o.order_id = $1`,
            [orderId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        const hasCoords = row.location_lat !== null && row.location_lng !== null;

        return {
            coordinates: hasCoords ? {
                lat: parseFloat(row.location_lat),
                lng: parseFloat(row.location_lng)
            } : null,
            garage: {
                garage_id: row.garage_id,
                garage_name: row.garage_name,
                address: row.address,
                lat: hasCoords ? parseFloat(row.location_lat) : 0,
                lng: hasCoords ? parseFloat(row.location_lng) : 0,
                verified: row.is_verified || false
            },
            has_coordinates: hasCoords
        };
    } catch (error) {
        logger.error('Failed to get pickup coordinates', { orderId, error });
        throw error;
    }
}

/**
 * Get delivery coordinates for an order (from customer's delivery address)
 */
export async function getDeliveryCoordinates(orderId: string): Promise<DeliveryInfo | null> {
    try {
        const result = await pool.query(
            `SELECT o.order_id, o.delivery_address,
                    pr.delivery_lat, pr.delivery_lng
             FROM orders o
             LEFT JOIN part_requests pr ON o.request_id = pr.request_id
             WHERE o.order_id = $1`,
            [orderId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        const hasCoords = row.delivery_lat !== null && row.delivery_lng !== null;

        return {
            coordinates: hasCoords ? {
                lat: parseFloat(row.delivery_lat),
                lng: parseFloat(row.delivery_lng)
            } : null,
            address: row.delivery_address,
            has_coordinates: hasCoords
        };
    } catch (error) {
        logger.error('Failed to get delivery coordinates', { orderId, error });
        throw error;
    }
}

// ============================================
// FUTURE EXTENSIONS
// ============================================

/**
 * Find garages within a radius of given coordinates
 * @param coords Center point
 * @param radiusKm Search radius in kilometers
 * @returns Array of garages with distance
 */
export async function findNearbyGarages(
    coords: Coordinates,
    radiusKm: number = 50
): Promise<(GarageLocation & { distance_km: number })[]> {
    try {
        // Using PostGIS-like calculation in SQL
        // For better performance, consider adding PostGIS extension
        const result = await pool.query(
            `SELECT garage_id, garage_name, address, location_lat, location_lng, is_verified,
                    (6371 * acos(cos(radians($1)) * cos(radians(location_lat)) 
                    * cos(radians(location_lng) - radians($2)) 
                    + sin(radians($1)) * sin(radians(location_lat)))) AS distance_km
             FROM garages
             WHERE location_lat IS NOT NULL 
               AND location_lng IS NOT NULL
               AND deleted_at IS NULL
               AND approval_status IN ('approved', 'demo')
             HAVING (6371 * acos(cos(radians($1)) * cos(radians(location_lat)) 
                    * cos(radians(location_lng) - radians($2)) 
                    + sin(radians($1)) * sin(radians(location_lat)))) <= $3
             ORDER BY distance_km`,
            [coords.lat, coords.lng, radiusKm]
        );

        return result.rows.map(row => ({
            garage_id: row.garage_id,
            garage_name: row.garage_name,
            address: row.address,
            lat: parseFloat(row.location_lat),
            lng: parseFloat(row.location_lng),
            verified: row.is_verified || false,
            distance_km: parseFloat(row.distance_km)
        }));
    } catch (error) {
        logger.error('Failed to find nearby garages', { coords, radiusKm, error });
        throw error;
    }
}

// Default export for convenience
export default {
    calculateDistance,
    isValidCoordinates,
    isWithinQatar,
    setGarageLocation,
    getGarageLocation,
    hasGarageLocation,
    getPickupCoordinates,
    getDeliveryCoordinates,
    findNearbyGarages
};
