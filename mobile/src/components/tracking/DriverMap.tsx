import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { VVIP_MIDNIGHT_STYLE } from '../../constants/mapStyle';

const ASPECT_RATIO = 9 / 16;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const LIGHT_MAP_STYLE = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
];

export interface DriverLocation {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    updated_at: string;
}

export interface RouteCoordinate {
    latitude: number;
    longitude: number;
}

interface DriverMapProps {
    mapRef: React.RefObject<MapView>;
    isDark: boolean;
    canShowDriver: boolean;
    driverLocation: DriverLocation | null;
    customerLocation: { latitude: number; longitude: number } | null;
    routeCoordinates: RouteCoordinate[];
    pulseAnim: Animated.Value;
}

export default function DriverMap({
    mapRef,
    isDark,
    canShowDriver,
    driverLocation,
    customerLocation,
    routeCoordinates,
    pulseAnim,
}: DriverMapProps) {
    const defaultRegion = {
        latitude: 25.2854,
        longitude: 51.5310,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1 * ASPECT_RATIO,
    };

    return (
        <MapView
            ref={mapRef as any}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={isDark ? VVIP_MIDNIGHT_STYLE : LIGHT_MAP_STYLE}
            showsUserLocation
            showsMyLocationButton={false}
            loadingEnabled={true}
            initialRegion={defaultRegion}
        >
            {canShowDriver && driverLocation && (
                <Marker
                    coordinate={{
                        latitude: driverLocation.latitude,
                        longitude: driverLocation.longitude
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={999}
                >
                    <Animated.View style={[styles.driverMarker, { transform: [{ scale: pulseAnim }] }]}>
                        <View style={styles.driverMarkerPulse} />
                        <View style={styles.driverMarkerInner}>
                            <Ionicons name="car-sport" size={24} color="#fff" />
                        </View>
                    </Animated.View>
                </Marker>
            )}

            {customerLocation && (
                <Marker
                    coordinate={{
                        latitude: customerLocation.latitude,
                        longitude: customerLocation.longitude
                    }}
                >
                    <View style={[styles.locationMarker, { backgroundColor: Colors.success }]}>
                        <Ionicons name="home" size={20} color="#fff" />
                    </View>
                </Marker>
            )}

            {canShowDriver && routeCoordinates.length > 0 && (
                <Polyline
                    coordinates={routeCoordinates}
                    strokeColor={Colors.primary}
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                />
            )}

            {canShowDriver && routeCoordinates.length === 0 && driverLocation && customerLocation && (
                <Polyline
                    coordinates={[
                        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                        { latitude: customerLocation.latitude, longitude: customerLocation.longitude }
                    ]}
                    strokeColor={Colors.primary}
                    strokeWidth={3}
                    lineDashPattern={[10, 5]}
                    lineCap="round"
                />
            )}
        </MapView>
    );
}

const styles = StyleSheet.create({
    driverMarker: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverMarkerPulse: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(59, 130, 246, 0.4)',
    },
    driverMarkerInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    locationMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
});
