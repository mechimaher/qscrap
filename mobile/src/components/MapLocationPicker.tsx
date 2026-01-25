// Premium Map Location Picker - VVIP Qatar Style with Google Places Autocomplete
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    TextInput,
    FlatList,
    Keyboard,
    Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';

interface MapLocationPickerProps {
    onLocationSelect: (location: { latitude: number; longitude: number; address: string }) => void;
    onCancel: () => void;
    initialLocation?: { latitude: number; longitude: number };
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyBtetLMBqtW1TNNsBFWi5Xa4LTy1GEbwYw';

const DOHA_COORDINATES: Region = {
    latitude: 25.2854,
    longitude: 51.5310,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

// Premium Qatar Map Style - Clean, Elegant, VVIP
const QATAR_PREMIUM_MAP_STYLE = [
    // Hide POI labels for cleaner look
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    // Premium color adjustments
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e5' }] },
    { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    // Subtle maroon accents for QScrap branding
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
];

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
    onLocationSelect,
    onCancel,
    initialLocation,
}) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const mapRef = useRef<MapView>(null);
    const searchInputRef = useRef<TextInput>(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [selectedLocation, setSelectedLocation] = useState<Region>(
        initialLocation
            ? { ...initialLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : DOHA_COORDINATES
    );
    const [address, setAddress] = useState(t('home.mapPicker.dragPin'));
    const [isLoading, setIsLoading] = useState(false);
    const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);

    // Animate search results in
    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: showPredictions ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [showPredictions]);

    // Google Places Autocomplete API
    const searchPlaces = async (query: string) => {
        if (query.length < 2) {
            setPredictions([]);
            setShowPredictions(false);
            return;
        }

        setIsSearching(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:qa&language=en&types=geocode|establishment`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.predictions) {
                setPredictions(data.predictions.slice(0, 5)); // Limit to 5 results
                setShowPredictions(true);
            }
        } catch (error) {
            console.log('[Places] Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    // Get Place Details (coordinates from place_id)
    const getPlaceDetails = async (placeId: string) => {
        try {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.result?.geometry?.location) {
                const { lat, lng } = data.result.geometry.location;
                const newRegion: Region = {
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                };

                setSelectedLocation(newRegion);
                setAddress(data.result.formatted_address || data.result.name);
                setSearchQuery('');
                setPredictions([]);
                setShowPredictions(false);
                Keyboard.dismiss();

                // Animate map to new location
                mapRef.current?.animateToRegion(newRegion, 500);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            console.log('[Places] Details failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMapPress = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        Haptics.selectionAsync();
        setSelectedLocation({
            latitude,
            longitude,
            latitudeDelta: selectedLocation.latitudeDelta,
            longitudeDelta: selectedLocation.longitudeDelta
        });
        await reverseGeocode(latitude, longitude);
        setShowPredictions(false);
        Keyboard.dismiss();
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            setIsLoading(true);

            // Use Google Maps Geocoding API for reliable results
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Get the formatted address from Google
                const formattedAddress = data.results[0].formatted_address;
                setAddress(formattedAddress);
                console.log('[Map] Reverse geocoded:', formattedAddress);
            } else {
                // Fallback: try Expo Location
                const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                if (results[0]) {
                    const geocoded = results[0];
                    const area = geocoded.district || geocoded.subregion || geocoded.name || '';
                    const city = geocoded.city || 'Doha';
                    const street = geocoded.street || '';
                    const fullAddress = `${street}, ${area}, ${city}`.replace(/^, /, '').trim();
                    setAddress(fullAddress);
                    console.log('[Map] Expo geocoded:', fullAddress);
                } else {
                    // Last resort: use coordinates
                    setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    console.warn('[Map] Using coordinates as address');
                }
            }
        } catch (error) {
            console.error('[Map] Reverse geocode failed:', error);
            // Use coordinates instead of placeholder text
            setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCurrentLocation = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Keyboard.dismiss();
            setShowPredictions(false);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert(t('home.mapPicker.permissionRequired'));
                return;
            }

            setIsLoading(true);
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const newRegion: Region = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };

            setSelectedLocation(newRegion);
            mapRef.current?.animateToRegion(newRegion, 300);
            await reverseGeocode(location.coords.latitude, location.coords.longitude);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('[Map] Location error:', error);
            alert(t('home.mapPicker.locationError'));
        } finally {
            setIsLoading(false);
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

    const renderPrediction = ({ item }: { item: PlacePrediction }) => (
        <TouchableOpacity
            style={[styles.predictionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => getPlaceDetails(item.place_id)}
            activeOpacity={0.7}
        >
            <Text style={styles.predictionIcon}>📍</Text>
            <View style={{ flex: 1 }}>
                <Text style={[styles.predictionMain, { color: colors.text }]} numberOfLines={1}>
                    {item.structured_formatting.main_text}
                </Text>
                <Text style={[styles.predictionSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                customMapStyle={QATAR_PREMIUM_MAP_STYLE}
                initialRegion={selectedLocation}
                onPress={handleMapPress}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass
                rotateEnabled={false}
                mapType={mapType}
            >
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
                        setSelectedLocation({
                            latitude,
                            longitude,
                            latitudeDelta: selectedLocation.latitudeDelta,
                            longitudeDelta: selectedLocation.longitudeDelta
                        });
                        await reverseGeocode(latitude, longitude);
                    }}
                />
            </MapView>

            {/* Search Bar - Google Places Autocomplete */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        ref={searchInputRef}
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('home.mapPicker.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            searchPlaces(text);
                        }}
                        onFocus={() => searchQuery.length >= 2 && setShowPredictions(true)}
                        returnKeyType="search"
                    />
                    {isSearching && <ActivityIndicator size="small" color={Colors.primary} />}
                    {searchQuery.length > 0 && !isSearching && (
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery('');
                                setPredictions([]);
                                setShowPredictions(false);
                            }}
                        >
                            <Text style={styles.clearIcon}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Predictions */}
                {showPredictions && predictions.length > 0 && (
                    <Animated.View
                        style={[
                            styles.predictionsContainer,
                            {
                                backgroundColor: colors.background,
                                opacity: slideAnim,
                                transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }]
                            }
                        ]}
                    >
                        <FlatList
                            data={predictions}
                            renderItem={renderPrediction}
                            keyExtractor={(item) => item.place_id}
                            keyboardShouldPersistTaps="handled"
                            scrollEnabled={false}
                        />
                    </Animated.View>
                )}
            </View>

            {/* Address Preview Card */}
            <View style={[styles.addressCard, { backgroundColor: colors.background }]}>
                <View style={styles.addressHeader}>
                    <Text style={styles.addressIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>
                            {t('home.mapPicker.selectedLocation')}
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

            {/* Map Type Toggle */}
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
                    {mapType === 'standard' ? t('home.mapPicker.satellite') : t('home.mapPicker.map')}
                </Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={[styles.actionsContainer, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={onCancel}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.cancelText, { color: colors.text }]}>{t('home.mapPicker.cancel')}</Text>
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
                        <Text style={styles.confirmText}>{t('home.mapPicker.confirmLocation')}</Text>
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
    // Search Bar
    searchContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: Spacing.lg,
        right: Spacing.lg,
        zIndex: 10,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.md,
        paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        gap: Spacing.sm,
    },
    searchIcon: {
        fontSize: 18,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSizes.md,
        fontWeight: '500',
    },
    clearIcon: {
        fontSize: 16,
        color: '#9CA3AF',
        padding: 4,
    },
    // Predictions
    predictionsContainer: {
        marginTop: Spacing.xs,
        borderRadius: BorderRadius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        gap: Spacing.sm,
    },
    predictionIcon: {
        fontSize: 18,
    },
    predictionMain: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    predictionSecondary: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    // Address Card
    addressCard: {
        position: 'absolute',
        bottom: 140,
        left: Spacing.lg,
        right: Spacing.lg + 70,
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
        bottom: 210,
        right: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: BorderRadius.lg,
        backgroundColor: '#2D2D2D',
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
        color: '#FFFFFF',
    },
    // Actions
    actionsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? Spacing.xl + 10 : Spacing.lg,
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
