// QScrap Driver App - Location Tracking Hook
// REFACTORED VERSION - Polling-based for reliability
// Works seamlessly with background LocationService by reading getLastKnownPosition

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { offlineQueue } from '../services/OfflineQueue';
import { API_ENDPOINTS } from '../config/api';
import { analyzeLocation, getSpoofingAlertLevel } from '../utils/spoofDetector';

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
    spoofingAlert: 'none' | 'low' | 'medium' | 'high'; // P2: Spoofing detection
    startTracking: () => Promise<boolean>;
    stopTracking: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
}

const POLL_INTERVAL = 3000; // Poll every 3 seconds

export function useLocation(): UseLocationResult {
    const [location, setLocation] = useState<LocationState | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [spoofingAlert, setSpoofingAlert] = useState<'none' | 'low' | 'medium' | 'high'>('none');

    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef = useRef(true);
    const locationRef = useRef<LocationState | null>(null); // Ref to avoid stale closure

    // Keep ref in sync with state
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        isMountedRef.current = true;
        checkPermissions();
        return () => {
            isMountedRef.current = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, []);

    const checkPermissions = async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (isMountedRef.current) setHasPermission(status === 'granted');
        } catch (err) {
            console.error('[Location] Permission check error:', err);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        try {
            setError(null);
            const { status } = await Location.requestForegroundPermissionsAsync();
            const granted = status === 'granted';
            if (isMountedRef.current) {
                setHasPermission(granted);
                if (!granted) setError('Location permission denied');
            }
            return granted;
        } catch (err: any) {
            if (isMountedRef.current) setError(err.message || 'Failed to request permission');
            return false;
        }
    };

    // P0 IMPROVEMENT: GPS accuracy threshold to filter unreliable updates
    // Positions with >100m accuracy are likely GPS drift and should be skipped
    const GPS_ACCURACY_THRESHOLD = 100; // meters

    const updateLocation = useCallback((loc: Location.LocationObject, source: string) => {
        if (!isMountedRef.current) return;

        const state: LocationState = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
        };

        // P0: Filter out low-accuracy GPS readings (drift prevention)
        if (state.accuracy && state.accuracy > GPS_ACCURACY_THRESHOLD) {
            console.log(`[Location] Skipping low accuracy update (${state.accuracy?.toFixed(0)}m > ${GPS_ACCURACY_THRESHOLD}m threshold)`);
            return;
        }

        // P2: GPS Spoofing Detection
        const spoofResult = analyzeLocation(state.latitude, state.longitude, state.accuracy ?? undefined);
        if (spoofResult.isSuspicious) {
            console.warn(`[Location] 🚨 Spoofing detected: ${spoofResult.reason} (${spoofResult.confidence}% confidence)`);
            // Update alert level
            setSpoofingAlert(getSpoofingAlertLevel());
            // Still allow the update but flag it - the backend can decide to reject
        } else {
            // Update alert level (may decrease over time)
            setSpoofingAlert(getSpoofingAlertLevel());
        }

        // Only update if coordinates actually changed (avoid unnecessary re-renders)
        const prev = locationRef.current;
        if (prev && prev.latitude === state.latitude && prev.longitude === state.longitude) {
            return; // No change, skip update
        }

        setLocation(state);
        const accuracyStr = state.accuracy ? ` (±${state.accuracy.toFixed(0)}m)` : '';
        console.log(`[Location] Updated via ${source}:`, state.latitude.toFixed(6), state.longitude.toFixed(6), accuracyStr);

        // Also send to API (fire and forget)
        // Send to OfflineQueue (guaranteed delivery)
        offlineQueue.enqueue(
            API_ENDPOINTS.UPDATE_LOCATION,
            'POST',
            {
                lat: state.latitude,
                lng: state.longitude,
                accuracy: state.accuracy ?? undefined,
                heading: state.heading ?? undefined,
                speed: state.speed ?? undefined,
                timestamp: state.timestamp,
                spoofing_alert: getSpoofingAlertLevel(), // P2: Send spoofing alert to backend
            }
        ).catch((err) => console.log('[Location] Queue failed:', err));
    }, []);

    const pollLocation = useCallback(async () => {
        if (!isMountedRef.current) return;

        try {
            // getLastKnownPositionAsync picks up locations from background service
            const pos = await Location.getLastKnownPositionAsync();
            if (pos) {
                updateLocation(pos, 'Poll');
            }
        } catch (e) {
            // Fallback to getCurrentPosition if getLastKnown fails
            try {
                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (pos) {
                    updateLocation(pos, 'Current');
                }
            } catch (e2) {
                console.warn('[Location] Poll failed:', e2);
            }
        }
    }, [updateLocation]);

    const startTracking = async (): Promise<boolean> => {
        console.log('[Location] startTracking: Polling Strategy');
        try {
            setError(null);

            // 1. Permission Check
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                if (newStatus !== 'granted') {
                    if (isMountedRef.current) setError('Permission denied');
                    return false;
                }
            }
            if (isMountedRef.current) setHasPermission(true);

            // 2. Stop existing polling
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }

            // 3. Get immediate position (cached or current)
            try {
                const cached = await Location.getLastKnownPositionAsync();
                if (cached) {
                    updateLocation(cached, 'Initial-Cached');
                } else {
                    // No cached, try to get current
                    const current = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    if (current) {
                        updateLocation(current, 'Initial-Current');
                    }
                }
            } catch (e) {
                console.warn('[Location] Initial position fetch failed:', e);
            }

            // 4. Start polling
            pollIntervalRef.current = setInterval(pollLocation, POLL_INTERVAL);
            console.log('[Location] Polling started (every 3s)');

            if (isMountedRef.current) setIsTracking(true);
            return true;

        } catch (err: any) {
            console.error('[Location] startTracking failed:', err);
            if (isMountedRef.current) {
                setError(err.message || 'Failed to start tracking');
                setIsTracking(false);
            }
            return false;
        }
    };

    const stopTracking = async (): Promise<void> => {
        try {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            if (isMountedRef.current) setIsTracking(false);
            console.log('[Location] Polling stopped');
        } catch (err) {
            console.error(err);
        }
    };

    return {
        location,
        isTracking,
        hasPermission,
        error,
        spoofingAlert, // P2: GPS spoofing alert level
        startTracking,
        stopTracking,
        requestPermission
    };
}
