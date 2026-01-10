// QScrap Driver App - Navigation Screen (MapLibre Edition)
// VVIP Full-screen turn-by-turn navigation with voice guidance
// Uses OpenStreetMap via MapLibre - No Google Maps API Key required

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { getRoute, formatDistance, formatDuration, getManeuverIcon, LatLng, Route } from '../services/routing.service';

// Initialize MapLibre with NO access token
MapLibreGL.setAccessToken(null);

interface NavigationScreenParams {
    pickupLat?: number;
    pickupLng?: number;
    deliveryLat?: number;
    deliveryLng?: number;
    destinationType: 'pickup' | 'delivery';
    destinationName: string;
    destinationAddress: string;
}



export default function NavigationScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const params: NavigationScreenParams = route.params || {};

    const cameraRef = useRef<MapLibreGL.Camera>(null);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [routeData, setRouteData] = useState<Route | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [voiceEnabled, setVoiceEnabled] = useState(true);

    // Defensive parsing of coordinates
    const pickupLat = params.pickupLat ? Number(params.pickupLat) : null;
    const pickupLng = params.pickupLng ? Number(params.pickupLng) : null;
    const deliveryLat = params.deliveryLat ? Number(params.deliveryLat) : null;
    const deliveryLng = params.deliveryLng ? Number(params.deliveryLng) : null;

    const destination: LatLng | null = params.destinationType === 'pickup'
        ? pickupLat && pickupLng
            ? { latitude: pickupLat, longitude: pickupLng }
            : null
        : deliveryLat && deliveryLng
            ? { latitude: deliveryLat, longitude: deliveryLng }
            : null;

    // Start location tracking
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;
        let isMounted = true;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Error', 'Location permission required for navigation');
                navigation.goBack();
                return;
            }

            // Get initial location
            let currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.BestForNavigation,
            });

            if (isMounted) {
                setLocation(currentLocation);
                // Initial Route Fetch
                if (destination) {
                    fetchRoute({
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude
                    });
                }
            }

            // Subscribe to updates
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 5,
                },
                (newLocation) => {
                    if (!isMounted) return;
                    setLocation(newLocation);
                    updateNavigationProgress(newLocation);
                }
            );
        })();

        return () => {
            isMounted = false;
            subscription?.remove();
            Speech.stop();
        };
    }, []);

    // Camera follow effect
    useEffect(() => {
        if (cameraRef.current && location) {
            cameraRef.current.setCamera({
                centerCoordinate: [location.coords.longitude, location.coords.latitude],
                zoomLevel: 17,
                pitch: 45, // 3D effect for navigation
                heading: location.coords.heading || 0,
                animationDuration: 1000,
                animationMode: 'flyTo',
            });
        }
    }, [location]);

    const fetchRoute = async (from: LatLng) => {
        if (!destination) return;

        const result = await getRoute(from, destination);
        if (result.success && result.route) {
            setRouteData(result.route);
            if (result.route.steps.length > 0 && voiceEnabled) {
                speakInstruction(result.route.steps[0].instruction);
            }
        }
    };

    const updateNavigationProgress = (newLocation: Location.LocationObject) => {
        if (!routeData || !destination) return;

        // Arrival Check
        const distToDest = calculateDistance(
            { latitude: newLocation.coords.latitude, longitude: newLocation.coords.longitude },
            destination
        );

        if (distToDest < 50) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            speakInstruction('You have arrived at your destination');
        }

        // Simple step progress logic can be added here
    };

    const speakInstruction = (text: string) => {
        if (!voiceEnabled) return;
        Speech.speak(text, { language: 'en', pitch: 1.0, rate: 0.9 });
    };

    const calculateDistance = (from: LatLng, to: LatLng): number => {
        const R = 6371000;
        const dLat = (to.latitude - from.latitude) * Math.PI / 180;
        const dLng = (to.longitude - from.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(from.latitude * Math.PI / 180) *
            Math.cos(to.latitude * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const toggleVoice = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVoiceEnabled(!voiceEnabled);
        if (voiceEnabled) Speech.stop();
    };

    const recenterMap = () => {
        if (cameraRef.current && location) {
            cameraRef.current.setCamera({
                centerCoordinate: [location.coords.longitude, location.coords.latitude],
                zoomLevel: 17,
                pitch: 45,
                heading: location.coords.heading || 0,
                animationDuration: 500,
            });
        }
    };

    const currentStep = routeData?.steps[currentStepIndex];

    // Convert route coordinates for MapLibre [lng, lat]
    const routeLineCoordinates = routeData?.coordinates.map(c => [c.longitude, c.latitude]) || [];

    return (
        <View style={styles.container}>
            <MapLibreGL.MapView
                style={styles.map}
                styleURL="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                logoEnabled={false}
                attributionEnabled={false}
                compassEnabled={false}
                onMapLoadingError={(event) => console.error("Map Load Error:", event)}
            >
                <MapLibreGL.Camera
                    ref={cameraRef}
                    zoomLevel={15}
                    animationMode="flyTo"
                    animationDuration={0}
                />

                {/* Driver Location */}
                {location && (
                    <MapLibreGL.PointAnnotation
                        id="driver"
                        coordinate={[location.coords.longitude, location.coords.latitude]}
                    >
                        <View style={styles.driverMarker}>
                            <Text style={styles.driverIcon}>🚗</Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                )}

                {/* Destination Marker */}
                {destination && (
                    <MapLibreGL.PointAnnotation
                        id="destination"
                        coordinate={[destination.longitude, destination.latitude]}
                    >
                        <View style={[styles.destMarker, {
                            backgroundColor: params.destinationType === 'pickup' ? Colors.warning : Colors.success
                        }]}>
                            <Text style={styles.destIcon}>
                                {params.destinationType === 'pickup' ? '📦' : '🏠'}
                            </Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                )}

                {/* VVIP 3D Buildings Layer */}
                <MapLibreGL.FillExtrusionLayer
                    id="3d-buildings"
                    sourceID="composite"
                    sourceLayerID="building"
                    filter={['==', 'extrude', 'true']}
                    minZoomLevel={15}
                    style={{
                        fillExtrusionColor: '#aaa',
                        fillExtrusionOpacity: 0.6,
                        fillExtrusionHeight: ['get', 'height'],
                        fillExtrusionBase: ['get', 'min_height'],
                    }}
                />

                {/* VVIP Traffic Layer Simulation (Overlay on route) */}
                {routeLineCoordinates.length > 1 && (
                    <>
                        {/* Traffic Glow */}
                        <MapLibreGL.ShapeSource
                            id="trafficSource"
                            shape={{
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: routeLineCoordinates as any
                                }
                            }}
                        >
                            <MapLibreGL.LineLayer
                                id="trafficGlow"
                                style={{
                                    lineColor: Colors.success,
                                    lineWidth: 10,
                                    lineBlur: 2,
                                    lineOpacity: 0.4,
                                }}
                            />
                        </MapLibreGL.ShapeSource>

                        <MapLibreGL.ShapeSource
                            id="routeSource"
                            shape={{
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: routeLineCoordinates as any
                                }
                            }}
                        >
                            <MapLibreGL.LineLayer
                                id="routeLine"
                                style={{
                                    lineColor: Colors.primary,
                                    lineWidth: 6,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                    lineOpacity: 0.9,
                                }}
                            />
                        </MapLibreGL.ShapeSource>
                    </>
                )}
            </MapLibreGL.MapView>

            {/* Top Navigation Overlay */}
            <SafeAreaView style={styles.topOverlay} edges={['top']}>
                <View style={[styles.navCard, { backgroundColor: colors.surface }]}>
                    {currentStep ? (
                        <>
                            <View style={styles.navIconContainer}>
                                <Text style={styles.navIcon}>
                                    {getManeuverIcon(currentStep.maneuver.type, currentStep.maneuver.modifier)}
                                </Text>
                            </View>
                            <View style={styles.navInfo}>
                                <Text style={[styles.navDistance, { color: Colors.primary }]}>
                                    {formatDistance(currentStep.distance)}
                                </Text>
                                <Text style={[styles.navStreet, { color: colors.text }]} numberOfLines={1}>
                                    {currentStep.name || 'Continue straight'}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <Text style={[styles.navLoading, { color: colors.textMuted }]}>
                            Calculating route...
                        </Text>
                    )}
                </View>
            </SafeAreaView>

            {/* Bottom Controls */}
            <SafeAreaView style={styles.bottomOverlay} edges={['bottom']}>
                <View style={[styles.bottomBar, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>

                    <View style={styles.etaContainer}>
                        {routeData && (
                            <>
                                <Text style={[styles.etaTime, { color: Colors.primary }]}>
                                    {formatDuration(routeData.duration)}
                                </Text>
                                <Text style={[styles.etaDistance, { color: colors.textSecondary }]}>
                                    {formatDistance(routeData.distance)}
                                </Text>
                            </>
                        )}
                    </View>

                    <View style={styles.controlButtons}>
                        <TouchableOpacity
                            style={[styles.controlButton, !voiceEnabled && styles.controlButtonOff]}
                            onPress={toggleVoice}
                        >
                            <Text style={styles.controlIcon}>{voiceEnabled ? '🔊' : '🔇'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlButton} onPress={recenterMap}>
                            <Text style={styles.controlIcon}>📍</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Destination Info */}
                <View style={[styles.destInfo, { backgroundColor: colors.background }]}>
                    <Text style={[styles.destLabel, { color: colors.textMuted }]}>
                        {params.destinationType === 'pickup' ? 'PICKUP FROM' : 'DELIVER TO'}
                    </Text>
                    <Text style={[styles.destName, { color: colors.text }]} numberOfLines={1}>
                        {params.destinationName}
                    </Text>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },

    // Markers
    driverMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    driverIcon: { fontSize: 24 },
    destMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    destIcon: { fontSize: 20 },

    // Overlays
    topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
    navCard: {
        margin: 16,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
        // Glassmorphism
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    navIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    navIcon: { fontSize: 28 },
    navInfo: { flex: 1 },
    navDistance: { fontSize: 24, fontWeight: '800' },
    navStreet: { fontSize: 16, marginTop: 2 },
    navLoading: { fontSize: 16, flex: 1, textAlign: 'center' },

    bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    bottomBar: {
        margin: 16,
        marginBottom: 8,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: { fontSize: 18, color: '#666' },
    etaContainer: { flex: 1, alignItems: 'center' },
    etaTime: { fontSize: 28, fontWeight: '800' },
    etaDistance: { fontSize: 14 },
    controlButtons: { flexDirection: 'row', gap: 8 },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonOff: { backgroundColor: '#e8e8e8' },
    controlIcon: { fontSize: 20 },
    destInfo: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
    },
    destLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
    destName: { fontSize: 15, fontWeight: '600', marginTop: 2 },
});
