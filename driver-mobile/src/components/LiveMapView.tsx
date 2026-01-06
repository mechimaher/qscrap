// QScrap Driver App - Live Map View Component
// Premium real-time map with driver location, assignment route, and animated markers
// VVIP cutting-edge feature inspired by Uber/Talabat

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { Assignment } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LiveMapViewProps {
    activeAssignment?: Assignment | null;
    height?: number;
    showRoute?: boolean;
}

// Qatar default center
const QATAR_CENTER = {
    latitude: 25.2854,
    longitude: 51.5310,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
};

export default function LiveMapView({
    activeAssignment,
    height = 200,
    showRoute = true
}: LiveMapViewProps) {
    const { colors, isDarkMode } = useTheme();
    const mapRef = useRef<MapView>(null);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Get current location
    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Location permission required');
                setLoading(false);
                return;
            }

            // Get initial location
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setLocation(currentLocation);
            setLoading(false);

            // Subscribe to location updates
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000, // Update every 5 seconds
                    distanceInterval: 10, // Or every 10 meters
                },
                (newLocation) => {
                    setLocation(newLocation);
                }
            );
        })();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, []);

    // Fit map to show all points when assignment changes
    useEffect(() => {
        if (mapRef.current && location && activeAssignment) {
            const points = [
                { latitude: location.coords.latitude, longitude: location.coords.longitude },
            ];

            // Add pickup location
            if (activeAssignment.pickup_lat && activeAssignment.pickup_lng) {
                points.push({
                    latitude: activeAssignment.pickup_lat,
                    longitude: activeAssignment.pickup_lng,
                });
            }

            // Add delivery location
            if (activeAssignment.delivery_lat && activeAssignment.delivery_lng) {
                points.push({
                    latitude: activeAssignment.delivery_lat,
                    longitude: activeAssignment.delivery_lng,
                });
            }

            if (points.length > 1) {
                mapRef.current.fitToCoordinates(points, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }
        }
    }, [location, activeAssignment]);

    // Dark mode map style
    const darkMapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
    ];

    if (loading) {
        return (
            <View style={[styles.container, { height, backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                    Getting your location...
                </Text>
            </View>
        );
    }

    if (errorMsg) {
        return (
            <View style={[styles.container, { height, backgroundColor: colors.surface }]}>
                <Text style={[styles.errorText, { color: Colors.danger }]}>
                    📍 {errorMsg}
                </Text>
            </View>
        );
    }

    const initialRegion: Region = location
        ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }
        : QATAR_CENTER;

    // Build route polyline
    const routeCoordinates: { latitude: number; longitude: number }[] = [];
    if (location && activeAssignment) {
        routeCoordinates.push({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });
        if (activeAssignment.pickup_lat && activeAssignment.pickup_lng) {
            routeCoordinates.push({
                latitude: activeAssignment.pickup_lat,
                longitude: activeAssignment.pickup_lng,
            });
        }
        if (activeAssignment.delivery_lat && activeAssignment.delivery_lng) {
            routeCoordinates.push({
                latitude: activeAssignment.delivery_lat,
                longitude: activeAssignment.delivery_lng,
            });
        }
    }

    return (
        <View style={[styles.container, { height }]}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={false} // We'll use custom marker
                showsMyLocationButton={false}
                customMapStyle={isDarkMode ? darkMapStyle : []}
                rotateEnabled={false}
                pitchEnabled={false}
            >
                {/* Driver Location Marker - VVIP animated */}
                {location && (
                    <Marker
                        coordinate={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.driverMarker}>
                            <View style={styles.driverMarkerPulse} />
                            <View style={styles.driverMarkerInner}>
                                <Text style={styles.driverMarkerIcon}>🚗</Text>
                            </View>
                        </View>
                    </Marker>
                )}

                {/* Pickup Location Marker */}
                {activeAssignment?.pickup_lat && activeAssignment?.pickup_lng && (
                    <Marker
                        coordinate={{
                            latitude: activeAssignment.pickup_lat,
                            longitude: activeAssignment.pickup_lng,
                        }}
                        title="Pickup"
                        description={activeAssignment.pickup_address}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.warning }]}>
                            <Text style={styles.markerIcon}>📦</Text>
                        </View>
                    </Marker>
                )}

                {/* Delivery Location Marker */}
                {activeAssignment?.delivery_lat && activeAssignment?.delivery_lng && (
                    <Marker
                        coordinate={{
                            latitude: activeAssignment.delivery_lat,
                            longitude: activeAssignment.delivery_lng,
                        }}
                        title="Delivery"
                        description={activeAssignment.delivery_address}
                    >
                        <View style={[styles.locationMarker, { backgroundColor: Colors.success }]}>
                            <Text style={styles.markerIcon}>🏠</Text>
                        </View>
                    </Marker>
                )}

                {/* Route Polyline */}
                {showRoute && routeCoordinates.length > 1 && (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={Colors.primary}
                        strokeWidth={4}
                        lineDashPattern={[10, 5]}
                    />
                )}
            </MapView>

            {/* Map Overlay - Status Badge */}
            {activeAssignment && (
                <View style={styles.statusOverlay}>
                    <View style={[styles.statusBadge, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.statusText, { color: Colors.primary }]}>
                            📍 Live Tracking
                        </Text>
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
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
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
});
