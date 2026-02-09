// QScrap Driver App - Routing Service (Simplified)
// External map navigation only. No in-app turn-by-turn.

import { Platform, Linking } from 'react-native';

export interface LatLng {
    latitude: number;
    longitude: number;
}

/**
 * Open external map app (Google Maps / Waze) with destination
 * This is the ONLY navigation method. We don't build our own nav.
 */
export function openExternalMap(lat: number, lng: number, label: string = 'Destination') {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
    });

    if (url) {
        Linking.openURL(url).catch(err => console.error('Could not open maps', err));
    }
}

/**
 * Straight-line distance between two coordinates (Haversine)
 * Used for ETA estimates and display only
 */
export function calculateStraightLineDistance(from: LatLng, to: LatLng): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (to.latitude - from.latitude) * Math.PI / 180;
    const dLng = (to.longitude - from.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(from.latitude * Math.PI / 180) *
        Math.cos(to.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
