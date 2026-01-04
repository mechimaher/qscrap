// QScrap Driver App - Location Tracking Hook
// Efficient, accurate GPS tracking with background support

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from '../services/api';
import { Platform, AppState, AppStateStatus } from 'react-native';

const LOCATION_TASK_NAME = 'qscrap-driver-location';

// Location tracking configuration
const LOCATION_CONFIG = {
    // High accuracy for delivery tracking
    accuracy: Location.Accuracy.High,

    // Update every 5 seconds when actively tracking
    timeInterval: 5000,

    // Update if moved 10 meters
    distanceInterval: 10,

    // Foreground settings for active deliveries
    foreground: {
        title: 'QScrap Driver',
        subtitle: 'Tracking your location for deliveries',
        icon: '🚚',
    },
};

interface LocationState {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}

interface UseLocationResult {
    location: LocationState | null;
    isTracking: boolean;
    hasPermission: boolean;
    error: string | null;
    startTracking: () => Promise<boolean>;
    stopTracking: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
    getCurrentLocation: () => Promise<LocationState | null>;
}

// Register background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[Location Task] Error:', error);
        return;
    }

    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const location = locations[0];

        if (location) {
            try {
                await api.updateLocation(
                    location.coords.latitude,
                    location.coords.longitude,
                    {
                        accuracy: location.coords.accuracy ?? undefined,
                        heading: location.coords.heading ?? undefined,
                        speed: location.coords.speed ?? undefined,
                    }
                );
                console.log('[Location Task] Updated:', location.coords.latitude, location.coords.longitude);
            } catch (err) {
                console.error('[Location Task] API error:', err);
            }
        }
    }
});

export function useLocation(): UseLocationResult {
    const [location, setLocation] = useState<LocationState | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const watcherRef = useRef<Location.LocationSubscription | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    // Check permissions on mount
    useEffect(() => {
        checkPermissions();

        // Handle app state changes for background/foreground transitions
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
            stopWatcher();
        };
    }, []);

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (appStateRef.current === 'background' && nextAppState === 'active') {
            // App came to foreground - restart watcher if was tracking
            if (isTracking) {
                await startWatcher();
            }
        }
        appStateRef.current = nextAppState;
    };

    const checkPermissions = async () => {
        try {
            const { status: foreground } = await Location.getForegroundPermissionsAsync();
            const { status: background } = await Location.getBackgroundPermissionsAsync();

            setHasPermission(foreground === 'granted');
            console.log('[Location] Permissions:', { foreground, background });
        } catch (err) {
            console.error('[Location] Permission check error:', err);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        try {
            setError(null);

            // Request foreground first
            const { status: foreground } = await Location.requestForegroundPermissionsAsync();
            if (foreground !== 'granted') {
                setError('Location permission denied. Please enable in settings.');
                setHasPermission(false);
                return false;
            }

            // Then request background for continuous tracking during deliveries
            if (Platform.OS === 'android') {
                const { status: background } = await Location.requestBackgroundPermissionsAsync();
                console.log('[Location] Background permission:', background);
            }

            setHasPermission(true);
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to request location permission');
            return false;
        }
    };

    const getCurrentLocation = async (): Promise<LocationState | null> => {
        try {
            if (!hasPermission) {
                const granted = await requestPermission();
                if (!granted) return null;
            }

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const state: LocationState = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: loc.coords.accuracy,
                heading: loc.coords.heading,
                speed: loc.coords.speed,
                timestamp: loc.timestamp,
            };

            setLocation(state);
            return state;
        } catch (err: any) {
            setError(err.message || 'Failed to get location');
            return null;
        }
    };

    const startWatcher = async () => {
        try {
            // Stop existing watcher
            await stopWatcher();

            watcherRef.current = await Location.watchPositionAsync(
                {
                    accuracy: LOCATION_CONFIG.accuracy,
                    timeInterval: LOCATION_CONFIG.timeInterval,
                    distanceInterval: LOCATION_CONFIG.distanceInterval,
                },
                async (loc) => {
                    const state: LocationState = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        accuracy: loc.coords.accuracy,
                        heading: loc.coords.heading,
                        speed: loc.coords.speed,
                        timestamp: loc.timestamp,
                    };

                    setLocation(state);

                    // Send to backend
                    try {
                        await api.updateLocation(
                            state.latitude,
                            state.longitude,
                            {
                                accuracy: state.accuracy ?? undefined,
                                heading: state.heading ?? undefined,
                                speed: state.speed ?? undefined,
                            }
                        );
                    } catch (err) {
                        console.error('[Location] API update error:', err);
                    }
                }
            );

            console.log('[Location] Watcher started');
        } catch (err: any) {
            console.error('[Location] Watcher start error:', err);
            setError(err.message);
        }
    };

    const stopWatcher = async () => {
        if (watcherRef.current) {
            watcherRef.current.remove();
            watcherRef.current = null;
        }
    };

    const startTracking = async (): Promise<boolean> => {
        try {
            setError(null);

            // Ensure permissions
            if (!hasPermission) {
                const granted = await requestPermission();
                if (!granted) return false;
            }

            // Start foreground watcher
            await startWatcher();

            // Start background tracking for Android
            if (Platform.OS === 'android') {
                const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
                if (!isRegistered) {
                    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                        accuracy: LOCATION_CONFIG.accuracy,
                        timeInterval: LOCATION_CONFIG.timeInterval,
                        distanceInterval: LOCATION_CONFIG.distanceInterval,
                        foregroundService: {
                            notificationTitle: LOCATION_CONFIG.foreground.title,
                            notificationBody: LOCATION_CONFIG.foreground.subtitle,
                        },
                        pausesUpdatesAutomatically: false,
                        showsBackgroundLocationIndicator: true,
                    });
                    console.log('[Location] Background tracking started');
                }
            }

            setIsTracking(true);
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to start tracking');
            return false;
        }
    };

    const stopTracking = async (): Promise<void> => {
        try {
            // Stop foreground watcher
            await stopWatcher();

            // Stop background tracking
            const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
            if (isRegistered) {
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
                console.log('[Location] Background tracking stopped');
            }

            setIsTracking(false);
        } catch (err: any) {
            console.error('[Location] Stop tracking error:', err);
        }
    };

    return {
        location,
        isTracking,
        hasPermission,
        error,
        startTracking,
        stopTracking,
        requestPermission,
        getCurrentLocation,
    };
}
