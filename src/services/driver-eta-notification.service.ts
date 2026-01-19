/**
 * Driver ETA Notification Service
 * Sends push notifications when driver is 15, 10, and 5 minutes away
 */

import pool from '../config/db';
import { createNotification } from './notification.service';
import { logger } from '../utils/logger';

interface DriverLocation {
    driver_id: string;
    order_id: string;
    customer_id: string;
    delivery_address: string;
    current_lat: number;
    current_lng: number;
    destination_lat: number;
    destination_lng: number;
    eta_minutes: number;
}

// Track which notifications have been sent to avoid duplicates
const sentNotifications = new Set<string>();

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Estimate ETA based on distance (assumes average speed of 30 km/h in city)
 */
function estimateETA(distanceKm: number): number {
    const averageSpeedKmh = 30;
    return Math.round((distanceKm / averageSpeedKmh) * 60); // minutes
}

/**
 * Check active deliveries and send ETA notifications
 * Should be called regularly (every 1-2 minutes) by a cron job
 */
export const checkDriverETANotifications = async (): Promise<number> => {
    try {
        // Get all orders in transit with driver location data
        const result = await pool.query(`
            SELECT 
                o.order_id,
                o.customer_id,
                o.driver_id,
                o.delivery_address,
                dl.latitude as current_lat,
                dl.longitude as current_lng,
                o.delivery_lat as destination_lat,
                o.delivery_lng as destination_lng
            FROM orders o
            LEFT JOIN driver_locations dl ON o.driver_id = dl.driver_id
            WHERE o.order_status = 'in_transit'
            AND o.driver_id IS NOT NULL
            AND dl.latitude IS NOT NULL
            AND dl.longitude IS NOT NULL
            AND o.delivery_lat IS NOT NULL
            AND o.delivery_lng IS NOT NULL
            AND dl.updated_at > NOW() - INTERVAL '5 minutes'
        `);

        let notificationsSent = 0;

        for (const row of result.rows) {
            const distance = calculateDistance(
                row.current_lat,
                row.current_lng,
                row.destination_lat,
                row.destination_lng
            );
            const etaMinutes = estimateETA(distance);

            // Send notifications at 15, 10, and 5 minute marks
            const thresholds = [15, 10, 5];

            for (const threshold of thresholds) {
                const notificationKey = `${row.order_id}-${threshold}`;

                // Check if we're within 1 minute of threshold and haven't sent this notification
                if (etaMinutes <= threshold && etaMinutes > (threshold - 2) && !sentNotifications.has(notificationKey)) {
                    await createNotification({
                        userId: row.customer_id,
                        type: 'driver_eta',
                        title: `🚗 Driver Arriving Soon!`,
                        message: `Your driver will arrive in approximately ${threshold} minutes`,
                        data: {
                            order_id: row.order_id,
                            driver_id: row.driver_id,
                            eta_minutes: threshold,
                            distance_km: distance.toFixed(1)
                        },
                        target_role: 'customer'
                    });

                    sentNotifications.add(notificationKey);
                    notificationsSent++;

                    logger.info('[DriverETA] Sent notification', {
                        order_id: row.order_id,
                        threshold,
                        actual_eta: etaMinutes
                    });
                }
            }
        }

        // Clean up old notification keys (older than 1 hour)
        if (sentNotifications.size > 1000) {
            sentNotifications.clear();
        }

        return notificationsSent;
    } catch (error) {
        logger.error('[DriverETA] Error checking notifications:', { error });
        return 0;
    }
};

// Export for cron job integration
export default { checkDriverETANotifications };
