// QScrap Driver App - GPS Spoofing Detection Utility
// P2 Enhancement: Detects suspicious location patterns that may indicate spoofing
// Protects against:
// - Impossible speed (teleportation)
// - Location mocking apps
// - Coordinates outside service area

import * as Location from 'expo-location';

interface LocationPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
}

interface SpoofingResult {
    isSuspicious: boolean;
    reason?: string;
    confidence: number; // 0-100
}

// Qatar service area bounding box
const QATAR_BOUNDS = {
    minLat: 24.4,
    maxLat: 26.3,
    minLng: 50.7,
    maxLng: 51.7,
};

// Maximum realistic speed in km/h (140 km/h for highway driving)
const MAX_REALISTIC_SPEED_KMH = 140;

// Minimum GPS accuracy threshold (meters)
const MIN_ACCURACY_THRESHOLD = 500;

// Store recent location points for analysis
let locationHistory: LocationPoint[] = [];
const MAX_HISTORY_SIZE = 20;

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Check if coordinates are within Qatar service area
 */
function isWithinQatar(lat: number, lng: number): boolean {
    return (
        lat >= QATAR_BOUNDS.minLat &&
        lat <= QATAR_BOUNDS.maxLat &&
        lng >= QATAR_BOUNDS.minLng &&
        lng <= QATAR_BOUNDS.maxLng
    );
}

/**
 * Analyze a new location point for spoofing indicators
 */
export function analyzeLocation(
    latitude: number,
    longitude: number,
    accuracy?: number
): SpoofingResult {
    const now = Date.now();
    const newPoint: LocationPoint = {
        latitude,
        longitude,
        timestamp: now,
        accuracy,
    };

    // Check 1: Is location within Qatar?
    if (!isWithinQatar(latitude, longitude)) {
        console.warn('[SpoofDetector] Location outside Qatar:', latitude, longitude);
        return {
            isSuspicious: true,
            reason: 'Location outside service area',
            confidence: 95,
        };
    }

    // Check 2: Is GPS accuracy too low?
    if (accuracy && accuracy > MIN_ACCURACY_THRESHOLD) {
        console.warn('[SpoofDetector] Poor GPS accuracy:', accuracy);
        return {
            isSuspicious: true,
            reason: 'GPS accuracy too low',
            confidence: 60,
        };
    }

    // Check 3: Impossible speed (teleportation)
    if (locationHistory.length > 0) {
        const lastPoint = locationHistory[locationHistory.length - 1];
        const distanceKm = calculateDistance(
            lastPoint.latitude,
            lastPoint.longitude,
            latitude,
            longitude
        );
        const timeDiffHours = (now - lastPoint.timestamp) / (1000 * 60 * 60);

        if (timeDiffHours > 0) {
            const speedKmh = distanceKm / timeDiffHours;

            if (speedKmh > MAX_REALISTIC_SPEED_KMH) {
                console.warn('[SpoofDetector] Impossible speed detected:', speedKmh, 'km/h');
                return {
                    isSuspicious: true,
                    reason: `Impossible movement speed (${Math.round(speedKmh)} km/h)`,
                    confidence: Math.min(95, 50 + (speedKmh / MAX_REALISTIC_SPEED_KMH) * 30),
                };
            }
        }
    }

    // Check 4: Check for mock location (Android only - requires native module)
    // Note: Full mock detection requires native implementation
    // This is a placeholder for the pattern

    // Update history
    locationHistory.push(newPoint);
    if (locationHistory.length > MAX_HISTORY_SIZE) {
        locationHistory.shift();
    }

    return {
        isSuspicious: false,
        confidence: 0,
    };
}

/**
 * Check if device has mock location enabled (best effort)
 * Note: Full implementation requires native module access
 */
export async function checkMockLocationStatus(): Promise<boolean> {
    try {
        // expo-location provides some info about location provider
        const providerStatus = await Location.getProviderStatusAsync();

        // On Android, gpsAvailable being false with location working could indicate mocking
        // This is a heuristic, not definitive
        if (!providerStatus.gpsAvailable && providerStatus.locationServicesEnabled) {
            console.warn('[SpoofDetector] GPS not available but location enabled - possible mock');
            return true;
        }

        return false;
    } catch (err) {
        console.log('[SpoofDetector] Could not check mock status:', err);
        return false;
    }
}

/**
 * Clear location history (call on logout or when needed)
 */
export function clearLocationHistory(): void {
    locationHistory = [];
}

/**
 * Get current spoofing alert level based on recent history
 */
export function getSpoofingAlertLevel(): 'none' | 'low' | 'medium' | 'high' {
    if (locationHistory.length < 3) return 'none';

    // Analyze recent patterns
    let suspiciousCount = 0;
    for (let i = 1; i < locationHistory.length; i++) {
        const prev = locationHistory[i - 1];
        const curr = locationHistory[i];

        const distanceKm = calculateDistance(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude
        );
        const timeDiffHours = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60);

        if (timeDiffHours > 0) {
            const speedKmh = distanceKm / timeDiffHours;
            if (speedKmh > MAX_REALISTIC_SPEED_KMH * 0.8) {
                suspiciousCount++;
            }
        }
    }

    const suspiciousRatio = suspiciousCount / (locationHistory.length - 1);

    if (suspiciousRatio >= 0.5) return 'high';
    if (suspiciousRatio >= 0.25) return 'medium';
    if (suspiciousRatio > 0) return 'low';
    return 'none';
}

export default {
    analyzeLocation,
    checkMockLocationStatus,
    clearLocationHistory,
    getSpoofingAlertLevel,
};
