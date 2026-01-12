// QScrap Driver App - Google Maps Routing Service
// "First Class" Premium Routing with Live Traffic & High Accuracy
// Replaces legacy OSRM implementation

import { Assignment } from './api';
import { Platform, Linking } from 'react-native';

const GOOGLE_DIRECTIONS_API = 'https://maps.googleapis.com/maps/api/directions/json';
// VVIP Premium Key
const GOOGLE_API_KEY = 'AIzaSyBtetLMBqtW1TNNsBFWi5Xa4LTy1GEbwYw';

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
    };
    html_instructions?: string;
}

export interface Route {
    coordinates: LatLng[];
    distance: number; // Total distance in meters
    duration: number; // Total duration in seconds
    steps: RouteStep[];
    summary: string;
    traffic_duration?: number; // Duration in traffic
}

export interface RouteResult {
    success: boolean;
    route?: Route;
    error?: string;
}

/**
 * Decode Google Polyline (Precision 5)
 * Google Standard Encoding
 */
function decodePolyline(encoded: string): LatLng[] {
    if (!encoded) return [];
    const poly: LatLng[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        const p = {
            latitude: lat / 100000.0,
            longitude: lng / 100000.0,
        };
        poly.push(p);
    }
    return poly;
}

/**
 * Get driving route between two points using Google Directions API
 * Includes Traffic Models (Best Guess)
 */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
    try {
        const origin = `${from.latitude},${from.longitude}`;
        const destination = `${to.latitude},${to.longitude}`;

        const params = new URLSearchParams({
            origin: origin,
            destination: destination,
            mode: 'driving',
            traffic_model: 'best_guess',
            departure_time: 'now', // Required for traffic info
            key: GOOGLE_API_KEY
        });

        const url = `${GOOGLE_DIRECTIONS_API}?${params.toString()}`;
        console.log('[GoogleMaps] Fetching route...');

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            const errorMsg = data.error_message || data.status;
            console.error('[GoogleMaps] API Error:', errorMsg);

            // Fallback for "OVER_QUERY_LIMIT" or empty key -> Standard OSRM failover? 
            // For now, return error to prompt user to check key.
            return {
                success: false,
                error: `Google Maps Error: ${errorMsg}`
            };
        }

        const routeData = data.routes[0];
        const leg = routeData.legs[0];
        const overviewPolyline = routeData.overview_polyline.points;
        const coordinates = decodePolyline(overviewPolyline);

        // Parse steps
        const steps: RouteStep[] = leg.steps.map((step: any) => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML
            html_instructions: step.html_instructions,
            distance: step.distance.value,
            duration: step.duration.value,
            maneuver: {
                type: step.maneuver || 'straight',
                modifier: undefined // Google maneuvers are simpler strings
            }
        }));

        return {
            success: true,
            route: {
                coordinates,
                distance: leg.distance.value,
                duration: leg.duration.value,
                traffic_duration: leg.duration_in_traffic?.value,
                steps,
                summary: routeData.summary || leg.start_address,
            }
        };

    } catch (error) {
        console.error('[GoogleMaps] Network error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to connect to Google Maps'
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

    // Route to pickup
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

    // Route to delivery
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
 * Open External Map App (Google Maps / Waze / Apple Maps)
 * "Deep Linking" for VVIP native experience
 */
export function openExternalMap(lat: number, lng: number, label: string = 'Destination') {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
    });

    if (url) {
        Linking.openURL(url).catch(err => console.error('An error occurred', err));
    }
}

// Helpers
export function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

export function getManeuverIcon(type: string, modifier?: string): string {
    // Basic mapping for Google maneuvers
    if (type.includes('left')) return '↰';
    if (type.includes('right')) return '↱';
    if (type.includes('uturn')) return '↩';
    if (type.includes('straight')) return '↑';
    if (type.includes('merge')) return '↗';
    return '↑';
}
