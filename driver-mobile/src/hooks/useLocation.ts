// QScrap Driver App - Location Tracking Hook
// SMART STRATEGY VERSION - Tiered accuracy for instant lock
// Tier 1: Cached (Instant)
// Tier 2: Low Accuracy (Cell/WiFi) - Fast lock (~1-2s) to unblock UI
// Tier 3: Balanced/High Accuracy - Precision updates in background

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { Platform } from 'react-native';

const LOCATION_CONFIG = {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000,
    distanceInterval: 10,
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
}

export function useLocation(): UseLocationResult {
    const [location, setLocation] = useState<LocationState | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const watcherRef = useRef<Location.LocationSubscription | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        checkPermissions();
        return () => {
            isMountedRef.current = false;
            if (watcherRef.current) {
                watcherRef.current.remove();
                watcherRef.current = null;
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

    const updateLocationState = (loc: Location.LocationObject, source: string) => {
        if (!isMountedRef.current) return;

        const state: LocationState = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
        };
        setLocation(state);
        console.log(`[Location] Updated via ${source}:`, state.latitude, state.longitude);

        // Fire and forget update
        api.updateLocation(
            state.latitude,
            state.longitude,
            {
                accuracy: state.accuracy ?? undefined,
                heading: state.heading ?? undefined,
                speed: state.speed ?? undefined
            }
        ).catch(() => { });
    };

    const startTracking = async (): Promise<boolean> => {
        console.log('[Location] startTracking: Smart Strategy Initiated');
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

            // 2. Enable Services (Android)
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled && Platform.OS === 'android') {
                try {
                    await Location.enableNetworkProviderAsync();
                } catch (e) { console.warn('[Location] Failed to enable services programmatically'); }
            }

            // 3. Stop existing
            if (watcherRef.current) {
                watcherRef.current.remove();
                watcherRef.current = null;
            }

            // --- SMART STRATEGY ---

            // TIER 1: CACHED (Instant)
            try {
                const cached = await Location.getLastKnownPositionAsync();
                if (cached) updateLocationState(cached, 'Cache');
            } catch (e) { /* ignore */ }

            // TIER 2: LOW ACCURACY (Fast Lock/Cell Towers)
            // This is the "Magic Fix" - gets approximate location ~1-2s to unblock UI
            if (!location) {
                console.log('[Location] Tier 2: Attempting Low Accuracy lock...');
                try {
                    const lowAccLoc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Lowest, // Maps to coarse/cell/wifi
                        timeout: 5000 // 5s hard timeout
                    });
                    if (lowAccLoc) updateLocationState(lowAccLoc, 'Tier2-LowAcc');
                } catch (e) {
                    console.log('[Location] Tier 2 failed or timed out, proceeding to Tier 3');
                }
            }

            // TIER 3: WATCHER (High Precision)
            // Start this regardless to refine position over time
            console.log('[Location] Tier 3: Starting Precision Watcher...');
            watcherRef.current = await Location.watchPositionAsync(
                {
                    accuracy: LOCATION_CONFIG.accuracy,
                    timeInterval: LOCATION_CONFIG.timeInterval,
                    distanceInterval: LOCATION_CONFIG.distanceInterval,
                },
                (loc) => updateLocationState(loc, 'Watcher')
            );

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
            if (watcherRef.current) {
                watcherRef.current.remove();
                watcherRef.current = null;
            }
            if (isMountedRef.current) setIsTracking(false);
        } catch (err) { console.error(err); }
    };

    return {
        location,
        isTracking,
        hasPermission,
        error,
        startTracking,
        stopTracking,
        requestPermission
    };
}
