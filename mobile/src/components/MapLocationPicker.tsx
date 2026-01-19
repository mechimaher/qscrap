// Premium Map Location Picker - VVIP Qatar Style
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface MapLocationPickerProps {
    onLocationSelect: (location: { latitude: number; longitude: number; address: string }) => void;
    onCancel: () => void;
    initialLocation?: { latitude: number; longitude: number };
}

const DOHA_COORDINATES = {
    latitude: 25.2854,
    longitude: 51.5310,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

const QATAR_MAP_STYLE = [
    {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
    },
];

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
    onLocationSelect,
    onCancel,
    initialLocation,
}) => {
    const { colors } = useTheme();
    const mapRef = useRef<MapView>(null);
    const [selectedLocation, setSelectedLocation] = useState(
        initialLocation || DOHA_COORDINATES
    );
    const [address, setAddress] = useState('Drag pin to select location');
    const [isLoading, setIsLoading] = useState(false);
    const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

    const handleMapPress = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        Haptics.selectionAsync();
        setSelectedLocation({ latitude, longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
        await reverseGeocode(latitude, longitude);
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            setIsLoading(true);
            const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (results[0]) {
                const geocoded = results[0];
                const fullAddress = `${geocoded.street || ''}, ${geocoded.district || geocoded.subregion || ''}, ${geocoded.city || 'Doha'}`.trim();
                setAddress(fullAddress);
            }
        } catch (error) {
            console.error('[Map] Reverse geocode failed:', error);
            setAddress('Location selected');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCurrentLocation = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Location permission required');
                return;
            }

            // Use Balanced accuracy for faster response (still accurate for delivery)
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 5000,  // Max 5 seconds
                distanceInterval: 0,
            });

            const newLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,  // Zoom in more
                longitudeDelta: 0.01,
            };

            setSelectedLocation(newLocation);
            mapRef.current?.animateToRegion(newLocation, 300); // Faster animation
            reverseGeocode(location.coords.latitude, location.coords.longitude); // Non-blocking
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('[Map] Location error:', error);
            alert('Could not get current location');
        }
    };

    const handleConfirm = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onLocationSelect({
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            address,
        });
    };

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                customMapStyle={QATAR_MAP_STYLE}
                initialRegion={selectedLocation}
                onPress={handleMapPress}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass
                rotateEnabled={false}
                mapType={mapType}
            >
                {/* Standard Google-style Marker for smooth dragging */}
                <Marker
                    coordinate={{
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                    }}
                    draggable
                    pinColor={Colors.primary}
                    onDragStart={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onDragEnd={async (e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setSelectedLocation({ latitude, longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
                        await reverseGeocode(latitude, longitude);
                    }}
                />
            </MapView>

            {/* Address Preview Card */}
            <View style={[styles.addressCard, { backgroundColor: colors.background }]}>
                <View style={styles.addressHeader}>
                    <Text style={styles.addressIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>
                            Selected Location
                        </Text>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                                {address}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Current Location Button */}
            <TouchableOpacity
                style={styles.currentLocationBtn}
                onPress={handleCurrentLocation}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    style={styles.currentLocationGradient}
                >
                    <Text style={styles.currentLocationIcon}>🎯</Text>
                </LinearGradient>
            </TouchableOpacity>

            {/* Map Type Toggle - Standard/Satellite */}
            <TouchableOpacity
                style={styles.mapTypeBtn}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMapType(prev => prev === 'standard' ? 'satellite' : 'standard');
                }}
                activeOpacity={0.8}
            >
                <Text style={styles.mapTypeIcon}>
                    {mapType === 'standard' ? '🛰️' : '🗺️'}
                </Text>
                <Text style={styles.mapTypeLabel}>
                    {mapType === 'standard' ? 'Satellite' : 'Standard'}
                </Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={[styles.actionsContainer, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={onCancel}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirm}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={[Colors.primary, '#B31D4A']}
                        style={styles.confirmGradient}
                    >
                        <Text style={styles.confirmText}>Confirm Location</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    // Custom Marker
    markerContainer: {
        alignItems: 'center',
    },
    markerGradient: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    markerIcon: {
        fontSize: 24,
    },
    markerShadow: {
        width: 20,
        height: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        marginTop: 2,
    },
    // Address Card
    addressCard: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: Spacing.lg,
        right: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    addressIcon: {
        fontSize: 24,
    },
    addressLabel: {
        fontSize: FontSizes.xs,
        marginBottom: 4,
    },
    addressText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        lineHeight: 20,
    },
    // Current Location Button
    currentLocationBtn: {
        position: 'absolute',
        bottom: 140,
        right: Spacing.lg,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    currentLocationGradient: {
        width: 56,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    currentLocationIcon: {
        fontSize: 28,
    },
    // Map Type Toggle
    mapTypeBtn: {
        position: 'absolute',
        bottom: 140,
        left: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: BorderRadius.lg,
        backgroundColor: '#2D2D2D', // Dark gray
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
        gap: 6,
    },
    mapTypeIcon: {
        fontSize: 18,
    },
    mapTypeLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#FFFFFF', // White text
    },
    // Actions
    actionsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    confirmBtn: {
        flex: 2,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    confirmGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        fontSize: FontSizes.md,
        fontWeight: '800',
        color: '#fff',
    },
});

export default MapLocationPicker;
