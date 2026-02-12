// QScrap Driver App - Live Map View Component
// GOOGLE MAPS VERSION - VVIP Premium Experience
// "Midnight Chic" Theme

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { Assignment } from '../services/api';
import { VVIP_MIDNIGHT_STYLE, VVIP_LIGHT_STYLE } from '../constants/mapStyle';
import { Ionicons } from '@expo/vector-icons';

interface DriverLocation {
    latitude: number;
    longitude: number;
}

interface LiveMapViewProps {
    driverLocation?: DriverLocation | null;
    activeAssignment?: Assignment | null;
    height?: number;
    showRoute?: boolean;
}

export default function LiveMapView({
    driverLocation,
    activeAssignment,
    height = 200,
    showRoute = true
}: LiveMapViewProps) {
    const { colors } = useTheme();

    // VVIP: Always use Midnight Chic (dark) map style for premium look
    // The Qatar Maroon & Gold theme looks best with dark maps
    const mapStyle = VVIP_MIDNIGHT_STYLE;
    const cameraRef = useRef<any>(null);

    // Google Maps Route State (LatLng objects)
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);

    // Fetch Google Maps route when location or assignment changes
    useEffect(() => {
        const fetchRoute = async () => {
            if (!driverLocation || !activeAssignment) {
                setRouteCoordinates([]);
                setRouteInfo(null);
                return;
            }

            // Determine destination based on assignment status
            let destLat: number | undefined;
            let destLng: number | undefined;

            if (activeAssignment.status === 'assigned' || activeAssignment.status === 'picked_up') {
                destLat = activeAssignment.pickup_lat;
                destLng = activeAssignment.pickup_lng;
            } else if (activeAssignment.status === 'in_transit') {
                destLat = activeAssignment.delivery_lat;
                destLng = activeAssignment.delivery_lng;
            }

            if (!destLat || !destLng) {
                setRouteCoordinates([]);
                return;
            }

            setIsLoadingRoute(true);
            try {
                const { calculateStraightLineDistance, formatDistance, formatDuration } = await import('../services/routing.service');

                // Straight line between driver and destination (no in-app routing engine)
                const coordinates = [
                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    { latitude: destLat, longitude: destLng },
                ];
                setRouteCoordinates(coordinates);

                const distMeters = calculateStraightLineDistance(
                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    { latitude: destLat, longitude: destLng }
                );
                // Rough ETA: assume 30 km/h avg in Doha traffic
                const etaSeconds = (distMeters / 1000 / 30) * 3600;
                setRouteInfo({
                    distance: formatDistance(distMeters),
                    duration: formatDuration(etaSeconds),
                });
            } catch (err) {
                console.error('[LiveMapView] Route error:', err);
                setRouteCoordinates([
                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    { latitude: destLat, longitude: destLng },
                ]);
            } finally {
                setIsLoadingRoute(false);
            }
        };

        fetchRoute();
    }, [driverLocation?.latitude, driverLocation?.longitude, activeAssignment?.status, activeAssignment?.assignment_id]);

    // Camera updates for driver movement logic...
    useEffect(() => {
        if (!cameraRef.current || !driverLocation) return;

        // Use MapView's animateCamera method (adapted for Google Maps)
        // Note: useRef expects MapView type now, need to fix ref usage or standard animateToRegion
        const camera = {
            center: {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
            },
            zoom: 16,
            heading: 0,
            pitch: 0,
        };
        cameraRef.current?.animateCamera(camera, { duration: 1000 });

    }, [driverLocation]);

    // Show loading if no location
    if (!driverLocation) {
        return (
            <View style={[styles.container, { height, backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                    Acquiring GPS...
                </Text>
            </View>
        );
    }

    if (isNaN(driverLocation.latitude) || isNaN(driverLocation.longitude)) {
        return (
            <View style={[styles.container, { height, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.textMuted }}>Invalid GPS Signal</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { height }]}>
            <MapView
                ref={cameraRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={mapStyle}
                showsUserLocation={true} // Enable native blue dot as backup/reference
                showsMyLocationButton={true} // Allow driver to recenter
                loadingEnabled={true} // Show loading spinner while tiles load
                initialRegion={{
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
            >
                {/* Driver Location Marker - Hardened */}
                <Marker
                    coordinate={{
                        latitude: driverLocation.latitude,
                        longitude: driverLocation.longitude
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false} // Optimization checking helps responsiveness
                    zIndex={999}
                >
                    <View style={styles.driverMarker}>
                        <View style={styles.driverMarkerPulse} />
                        <View style={styles.driverMarkerInner}>
                            <Ionicons name="car-sport" size={20} color={Colors.primary} />
                        </View>
                    </View>
                </Marker>

                {/* Pickup Location Marker */}
                {activeAssignment?.pickup_lat && activeAssignment?.pickup_lng && (
                    <Marker
                        coordinate={{
                            latitude: activeAssignment.pickup_lat,
                            longitude: activeAssignment.pickup_lng
                        }}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.warning }]}>
                            <Ionicons name="cube" size={18} color="#fff" />
                        </View>
                    </Marker>
                )}

                {/* Delivery Location Marker */}
                {activeAssignment?.delivery_lat && activeAssignment?.delivery_lng && (
                    <Marker
                        coordinate={{
                            latitude: activeAssignment.delivery_lat,
                            longitude: activeAssignment.delivery_lng
                        }}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.success }]}>
                            <Ionicons name="home" size={18} color="#fff" />
                        </View>
                    </Marker>
                )}

                {/* VVIP Route Polyline */}
                {showRoute && routeCoordinates.length > 1 && (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={Colors.primary}
                        strokeWidth={4}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}
            </MapView>

            {/* Route Info Overlay */}
            {activeAssignment && (
                <View style={styles.statusOverlay}>
                    <View style={[styles.statusBadge, { backgroundColor: colors.surface }]}>
                        {isLoadingRoute ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : routeInfo ? (
                            <Text style={[styles.routeInfoText, { color: Colors.primary }]}>
                                {routeInfo.distance} • {routeInfo.duration}
                            </Text>
                        ) : (
                            <Text style={[styles.statusText, { color: Colors.primary }]}>
                                <Ionicons name="location" size={14} color={Colors.primary} /> Live Tracking
                            </Text>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    driverMarker: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverMarkerPulse: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary,
        opacity: 0.3,
    },
    driverMarkerInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    driverMarkerIcon: {
        fontSize: 20,
    },
    locationMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    markerIcon: {
        fontSize: 18,
    },
    statusOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    routeInfoText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
