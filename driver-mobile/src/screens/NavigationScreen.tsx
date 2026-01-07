// QScrap Driver App - Navigation Screen
// VVIP Full-screen turn-by-turn navigation with voice guidance
// Premium feature inspired by Uber/Talabat navigation

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Alert,
    Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { getRoute, formatDistance, formatDuration, getManeuverIcon, LatLng, Route } from '../services/routing.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    const { colors, isDarkMode } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const params: NavigationScreenParams = route.params || {};

    const mapRef = useRef<MapView>(null);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [routeData, setRouteData] = useState<Route | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isNavigating, setIsNavigating] = useState(true);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [lastSpokenStep, setLastSpokenStep] = useState(-1);

    // Determine destination
    const destination: LatLng | null = params.destinationType === 'pickup'
        ? params.pickupLat && params.pickupLng
            ? { latitude: params.pickupLat, longitude: params.pickupLng }
            : null
        : params.deliveryLat && params.deliveryLng
            ? { latitude: params.deliveryLat, longitude: params.deliveryLng }
            : null;

    // Dark mode map style
    const darkMapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    ];

    // Start location tracking
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Error', 'Location permission required for navigation');
                navigation.goBack();
                return;
            }

            // Get initial location with robust error handling
            let currentLocation: Location.LocationObject | null = null;
            try {
                currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.BestForNavigation,
                });
                setLocation(currentLocation);
            } catch (err) {
                console.warn('[Navigation] High accuracy location failed, trying lower accuracy:', err);
                try {
                    // Fallback to lower accuracy for faster lock
                    currentLocation = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    setLocation(currentLocation);
                } catch (fallbackErr) {
                    console.error('[Navigation] All location methods failed:', fallbackErr);
                    Alert.alert(
                        'GPS Error',
                        'Could not get your location. Please ensure GPS is enabled and try again.',
                        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
                    );
                    return;
                }
            }

            // Fetch route
            if (destination && currentLocation) {
                fetchRoute({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude
                });
            }

            // Subscribe to high-accuracy updates
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 5,
                },
                (newLocation) => {
                    setLocation(newLocation);
                    updateNavigationProgress(newLocation);
                }
            );
        })();

        return () => {
            subscription?.remove();
            Speech.stop();
        };
    }, []);

    const fetchRoute = async (from: LatLng) => {
        if (!destination) return;

        const result = await getRoute(from, destination);
        if (result.success && result.route) {
            setRouteData(result.route);

            // Speak first instruction
            if (result.route.steps.length > 0 && voiceEnabled) {
                speakInstruction(result.route.steps[0].instruction);
            }
        }
    };

    const updateNavigationProgress = (newLocation: Location.LocationObject) => {
        if (!routeData || !destination) return;

        const currentPos = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
        };

        // Check if arrived at destination (within 50 meters)
        const distToDest = calculateDistance(currentPos, destination);
        if (distToDest < 50) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            speakInstruction('You have arrived at your destination');
            setIsNavigating(false);
            return;
        }

        // Update current step based on proximity to step waypoints
        // (Simplified: advance when close to next step waypoint)
        // Full implementation would use step geometries
    };

    const speakInstruction = (text: string) => {
        if (!voiceEnabled) return;
        Speech.speak(text, {
            language: 'en',
            pitch: 1.0,
            rate: 0.9,
        });
    };

    const calculateDistance = (from: LatLng, to: LatLng): number => {
        const R = 6371000; // Earth radius in meters
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
        if (voiceEnabled) {
            Speech.stop();
        }
    };

    const recenterMap = () => {
        if (mapRef.current && location) {
            mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
    };

    const currentStep = routeData?.steps[currentStepIndex];
    const nextStep = routeData?.steps[currentStepIndex + 1];

    return (
        <View style={styles.container}>
            {/* Full-screen Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={location ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                } : undefined}
                customMapStyle={isDarkMode ? darkMapStyle : []}
                showsUserLocation={false}
                showsCompass={false}
                rotateEnabled={true}
                pitchEnabled={true}
            >
                {/* Driver Marker */}
                {location && (
                    <Marker
                        coordinate={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true}
                        rotation={location.coords.heading || 0}
                    >
                        <View style={styles.driverMarker}>
                            <Text style={styles.driverIcon}>🚗</Text>
                        </View>
                    </Marker>
                )}

                {/* Destination Marker */}
                {destination && (
                    <Marker coordinate={destination}>
                        <View style={[styles.destMarker, {
                            backgroundColor: params.destinationType === 'pickup' ? Colors.warning : Colors.success
                        }]}>
                            <Text style={styles.destIcon}>
                                {params.destinationType === 'pickup' ? '📦' : '🏠'}
                            </Text>
                        </View>
                    </Marker>
                )}

                {/* Route Polyline */}
                {routeData && (
                    <Polyline
                        coordinates={routeData.coordinates}
                        strokeColor={Colors.primary}
                        strokeWidth={6}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}
            </MapView>

            {/* Top Navigation Card */}
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

            {/* Bottom Info Bar */}
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
    map: { ...StyleSheet.absoluteFillObject },

    // Driver marker
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

    // Destination marker
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

    // Top overlay
    topOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    navCard: {
        margin: 16,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
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

    // Bottom overlay
    bottomOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
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

    // Destination info
    destInfo: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
    },
    destLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
    destName: { fontSize: 15, fontWeight: '600', marginTop: 2 },
});
