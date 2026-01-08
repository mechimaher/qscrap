// QScrap Driver App - OSRM Routing Service
// Self-hosted routing using GCC OpenStreetMap data (Qatar, UAE, etc.)
// Production-grade, no API limits

import { Assignment } from './api';

// Self-hosted OSRM on QScrap VPS - GCC region map data
// Includes: Qatar, UAE, Bahrain, Kuwait, Oman, Saudi Arabia
const OSRM_API = 'http://147.93.89.153:5100';

export interface LatLng {
    latitude: number;
    longitude: number;
}

export interface RouteStep {
    instruction: string;
    distance: number; // meters
    duration: number; // seconds
    maneuver: {
        type: string;
        modifier?: string;
        bearing_before?: number;
        bearing_after?: number;
    };
    name: string;
}

export interface Route {
    coordinates: LatLng[];
    distance: number; // Total distance in meters
    duration: number; // Total duration in seconds
    steps: RouteStep[];
    summary: string;
}

export interface RouteResult {
    success: boolean;
    route?: Route;
    error?: string;
}

/**
 * Decode OSRM polyline to coordinates array
 * OSRM uses polyline6 encoding (precision 6)
 */
function decodePolyline(encoded: string, precision: number = 6): LatLng[] {
    const coordinates: LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const factor = Math.pow(10, precision);

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte: number;

        // Decode latitude
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        // Decode longitude
        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);

        coordinates.push({
            latitude: lat / factor,
            longitude: lng / factor,
        });
    }

    return coordinates;
}

/**
 * Get driving route between two points using OSRM
 */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
    try {
        const url = `${OSRM_API}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline6&steps=true`;

        console.log('[OSRM] Fetching route:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            return {
                success: false,
                error: data.message || 'No route found',
            };
        }

        const osrmRoute = data.routes[0];
        const coordinates = decodePolyline(osrmRoute.geometry);

        // Parse steps from OSRM response
        const steps: RouteStep[] = [];
        if (osrmRoute.legs && osrmRoute.legs[0] && osrmRoute.legs[0].steps) {
            for (const step of osrmRoute.legs[0].steps) {
                steps.push({
                    instruction: step.maneuver?.instruction || step.name || '',
                    distance: step.distance,
                    duration: step.duration,
                    maneuver: {
                        type: step.maneuver?.type || 'straight',
                        modifier: step.maneuver?.modifier,
                        bearing_before: step.maneuver?.bearing_before,
                        bearing_after: step.maneuver?.bearing_after,
                    },
                    name: step.name || '',
                });
            }
        }

        return {
            success: true,
            route: {
                coordinates,
                distance: osrmRoute.distance,
                duration: osrmRoute.duration,
                steps,
                summary: osrmRoute.legs?.[0]?.summary || '',
            },
        };
    } catch (error) {
        console.error('[OSRM] Route error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get route',
        };
    }
}

/**
 * Get route for an assignment (driver → pickup → delivery)
 */
export async function getAssignmentRoute(
    driverLocation: LatLng,
    assignment: Assignment
): Promise<{
    toPickup?: Route;
    toDelivery?: Route;
    totalDistance: number;
    totalDuration: number;
}> {
    const result = {
        toPickup: undefined as Route | undefined,
        toDelivery: undefined as Route | undefined,
        totalDistance: 0,
        totalDuration: 0,
    };

    // Route to pickup (garage)
    if (assignment.pickup_lat && assignment.pickup_lng) {
        const pickupRoute = await getRoute(driverLocation, {
            latitude: assignment.pickup_lat,
            longitude: assignment.pickup_lng,
        });
        if (pickupRoute.success && pickupRoute.route) {
            result.toPickup = pickupRoute.route;
            result.totalDistance += pickupRoute.route.distance;
            result.totalDuration += pickupRoute.route.duration;
        }
    }

    // Route from pickup to delivery (customer)
    if (assignment.pickup_lat && assignment.pickup_lng &&
        assignment.delivery_lat && assignment.delivery_lng) {
        const deliveryRoute = await getRoute(
            { latitude: assignment.pickup_lat, longitude: assignment.pickup_lng },
            { latitude: assignment.delivery_lat, longitude: assignment.delivery_lng }
        );
        if (deliveryRoute.success && deliveryRoute.route) {
            result.toDelivery = deliveryRoute.route;
            result.totalDistance += deliveryRoute.route.distance;
            result.totalDuration += deliveryRoute.route.duration;
        }
    }

    return result;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

/**
 * Get turn-by-turn instruction icon
 */
export function getManeuverIcon(type: string, modifier?: string): string {
    const icons: Record<string, string> = {
        'turn-left': '↰',
        'turn-right': '↱',
        'turn-slight-left': '↖',
        'turn-slight-right': '↗',
        'turn-sharp-left': '⤺',
        'turn-sharp-right': '⤻',
        'straight': '↑',
        'depart': '🚗',
        'arrive': '🏁',
        'roundabout': '↻',
        'rotary': '↻',
        'merge': '↗',
        'fork-left': '↖',
        'fork-right': '↗',
        'off-ramp-left': '↙',
        'off-ramp-right': '↘',
        'u-turn': '↩',
    };

    const key = modifier ? `${type}-${modifier}` : type;
    return icons[key] || icons[type] || '→';
}
