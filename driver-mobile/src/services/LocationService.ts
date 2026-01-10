import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { offlineQueue } from './OfflineQueue';
import { API_ENDPOINTS } from '../config/api';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task in global scope
// Define the background task in global scope
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[LocationService] Background task error:', error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const location = locations[0];
        if (location) {
            console.log('[LocationService] Background location:', location.coords);
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
        const hasPermissions = await this.requestPermissions();
        if (!hasPermissions) {
            console.warn('[LocationService] Permissions not granted');
            return;
        }

        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) return;

        console.log('[LocationService] Starting background tracking');
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60 * 1000, // 60 seconds
            distanceInterval: 100, // 100 meters
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: "QScrap Driver",
                notificationBody: "Tracking your location for delivery assignments",
                notificationColor: "#800000"
            }
        });
    }

    async stopTracking() {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) {
            console.log('[LocationService] Stopping background tracking');
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
    }
}

export const locationService = new LocationService();
