import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { offlineQueue } from './OfflineQueue';
import { API_ENDPOINTS } from '../config/api';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task in global scope
// Define the background task in global scope
// Define the background task in global scope
let lastUpdateTimestamp = 0;
const MIN_UPDATE_INTERVAL = 30 * 1000; // 30 seconds

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[LocationService] Background task error:', error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const location = locations[0];
        if (location) {
            // THROTTLING: Ignore updates if too frequent
            const now = Date.now();
            if (now - lastUpdateTimestamp < MIN_UPDATE_INTERVAL) {
                // Too soon, skip this update
                return;
            }
            lastUpdateTimestamp = now;

            try {
                // Use offline queue for guaranteed delivery
                await offlineQueue.enqueue(
                    API_ENDPOINTS.UPDATE_LOCATION,
                    'POST',
                    {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        accuracy: location.coords.accuracy || 0,
                        heading: location.coords.heading || 0,
                        speed: location.coords.speed || 0,
                        timestamp: location.timestamp
                    }
                );
            } catch (err) {
                console.error('[LocationService] Failed to queue location:', err);
            }
        }
    }
});

class LocationService {
    async requestPermissions() {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            return false;
        }
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        return bgStatus === 'granted';
    }

    async startTracking() {
        try {
            const hasPermissions = await this.requestPermissions();
            if (!hasPermissions) {
                console.warn('[LocationService] Permissions not granted');
                return;
            }

            const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (isStarted) return;

            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 60 * 1000,
                distanceInterval: 100,
                showsBackgroundLocationIndicator: true,
                foregroundService: {
                    notificationTitle: "QScrap Driver",
                    notificationBody: "Tracking your location for delivery assignments",
                    notificationColor: "#800000"
                }
            });
        } catch (error) {
            console.error('[LocationService] Failed to start tracking:', error);
        }
    }

    async stopTracking() {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('[LocationService] Stopped location tracking');
        }
    }

    /**
     * Complete cleanup - use on logout to prevent battery drain
     * Stops tracking AND unregisters the background task
     */
    async cleanup() {
        // First stop tracking
        await this.stopTracking();

        // Then unregister the task completely
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
            await TaskManager.unregisterTaskAsync(LOCATION_TASK_NAME);
            console.log('[LocationService] Unregistered background task');
        }
    }
}

export const locationService = new LocationService();
