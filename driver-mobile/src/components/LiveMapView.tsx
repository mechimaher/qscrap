// QScrap Driver App - Live Map View Component
// MAPLIBRE VERSION - Completely KEYLESS using OpenStreetMap
// Production-grade, free, unlimited usage

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { Assignment } from '../services/api';

// Initialize MapLibre with NO access token (completely free)
MapLibreGL.setAccessToken(null);

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

// OpenStreetMap tile style (FREE, no API key)
const OSM_STYLE_URL = 'https://demotiles.maplibre.org/style.json';



export default function LiveMapView({
    driverLocation,
    activeAssignment,
    height = 200,
    showRoute = true
}: LiveMapViewProps) {
    const { colors } = useTheme();
    const cameraRef = useRef<any>(null);

    // OSRM Route State
    const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);

    // Fetch OSRM route when location or assignment changes
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
                const { getRoute, formatDistance, formatDuration } = await import('../services/routing.service');
                const result = await getRoute(
                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    { latitude: destLat, longitude: destLng }
                );

                if (result.success && result.route) {
                    // Convert to [lng, lat] format for MapLibre
                    const coords: [number, number][] = result.route.coordinates.map(
                        (c: { latitude: number; longitude: number }) => [c.longitude, c.latitude]
                    );
                    setRouteCoordinates(coords);
                    setRouteInfo({
                        distance: formatDistance(result.route.distance),
                        duration: formatDuration(result.route.duration),
                    });
                } else {
                    // Fallback to straight line
                    setRouteCoordinates([
                        [driverLocation.longitude, driverLocation.latitude],
                        [destLng, destLat],
                    ]);
                    setRouteInfo(null);
                }
            } catch (err) {
                console.error('[LiveMapView] OSRM error:', err);
                setRouteCoordinates([
                    [driverLocation.longitude, driverLocation.latitude],
                    [destLng, destLat],
                ]);
            } finally {
                setIsLoadingRoute(false);
            }
        };

        fetchRoute();
    }, [driverLocation?.latitude, driverLocation?.longitude, activeAssignment?.status, activeAssignment?.assignment_id]);

    // Camera follows driver
    useEffect(() => {
        if (!cameraRef.current || !driverLocation) return;

        cameraRef.current.setCamera({
            centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
            zoomLevel: 16,
            animationDuration: 800,
        });
    }, [driverLocation]);

    // Show loading if no location yet
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

    return (
        <View style={[styles.container, { height }]}>
            <MapLibreGL.MapView
                style={styles.map}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                logoEnabled={false}
                attributionEnabled={false}
            >
                <MapLibreGL.Camera
                    ref={cameraRef}
                    zoomLevel={16}
                    centerCoordinate={[driverLocation.longitude, driverLocation.latitude]}
                    animationMode="flyTo"
                    animationDuration={1000}
                />

                {/* Driver Location Marker */}
                <MapLibreGL.PointAnnotation
                    id="driver-location"
                    coordinate={[driverLocation.longitude, driverLocation.latitude]}
                >
                    <View style={styles.driverMarker}>
                        <View style={styles.driverMarkerPulse} />
                        <View style={styles.driverMarkerInner}>
                            <Text style={styles.driverMarkerIcon}>🚗</Text>
                        </View>
                    </View>
                </MapLibreGL.PointAnnotation>

                {/* Pickup Location Marker */}
                {activeAssignment?.pickup_lat && activeAssignment?.pickup_lng && (
                    <MapLibreGL.PointAnnotation
                        id="pickup-location"
                        coordinate={[activeAssignment.pickup_lng, activeAssignment.pickup_lat]}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.warning }]}>
                            <Text style={styles.markerIcon}>📦</Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                )}

                {/* Delivery Location Marker */}
                {activeAssignment?.delivery_lat && activeAssignment?.delivery_lng && (
                    <MapLibreGL.PointAnnotation
                        id="delivery-location"
                        coordinate={[activeAssignment.delivery_lng, activeAssignment.delivery_lat]}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.success }]}>
                            <Text style={styles.markerIcon}>🏠</Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                )}

                {/* Route Polyline */}
                {showRoute && routeCoordinates.length > 1 && (
                    <MapLibreGL.ShapeSource
                        id="route-source"
                        shape={{
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'LineString',
                                coordinates: routeCoordinates,
                            },
                        }}
                    >
                        <MapLibreGL.LineLayer
                            id="route-line"
                            style={{
                                lineColor: Colors.primary,
                                lineWidth: 5,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    </MapLibreGL.ShapeSource>
                )}
            </MapLibreGL.MapView>

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
                                📍 Live Tracking
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
