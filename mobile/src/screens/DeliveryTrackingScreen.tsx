// Premium Delivery Tracking Screen - VVIP Qatar Style with Google Maps Features
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { useToast } from '../components/Toast';
import { api } from '../services';
import { useSocketContext } from '../hooks/useSocket';
import { Colors, Spacing, BorderRadius, FontSize, Shadows, ORDER_STATUS } from '../constants';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = 'AIzaSyBtetLMBqtW1TNNsBFWi5Xa4LTy1GEbwYw';

// Premium Qatar Map Styles
const QATAR_LIGHT_MAP_STYLE = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
];

const QATAR_DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8D1B3D' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0d1a' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

interface RouteCoordinate {
    latitude: number;
    longitude: number;
}

const DeliveryTrackingScreen: React.FC = () => {
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
    const [eta, setEta] = useState<string | null>(null);
    const [distance, setDistance] = useState<string | null>(null);

    // Animated driver marker
    const driverAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation for driver marker
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    useEffect(() => {
        loadOrderDetails();

        // Poll for updates every 15 seconds
        const pollInterval = setInterval(loadOrderDetails, 15000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [orderId, order?.delivery_lat, order?.delivery_lng]);

    const loadOrderDetails = async () => {
        try {
            const response = await api.getOrderDetails(orderId);
            const orderData = response.order;
            setOrder(orderData);

            if (orderData.driver_lat && orderData.driver_lng) {
                const driverLoc = {
                    lat: parseFloat(orderData.driver_lat),
                    lng: parseFloat(orderData.driver_lng),
                };
                setDriverLocation(driverLoc);

                // Fetch route if we have both points
                if (orderData.delivery_lat && orderData.delivery_lng) {
                    fetchRoute(driverLoc, {
                        lat: parseFloat(orderData.delivery_lat),
                        lng: parseFloat(orderData.delivery_lng),
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load order:', error);
            toast.error(t('common.error'), t('tracking.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Fetch route from Google Directions API
    const fetchRoute = useCallback(async (
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number }
    ) => {
        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const leg = route.legs[0];

                // Update ETA and distance
                setEta(leg.duration?.text || null);
                setDistance(leg.distance?.text || null);

                // Decode polyline
                const points = decodePolyline(route.overview_polyline.points);
                setRouteCoordinates(points);
            }
        } catch (error) {
            console.log('Route fetch failed:', error);
        }
    }, []);

    // Decode Google polyline
    const decodePolyline = (encoded: string): RouteCoordinate[] => {
        const points: RouteCoordinate[] = [];
        let index = 0, lat = 0, lng = 0;

        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
            lng += dlng;

            points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
        }
        return points;
    };

    const handleCallDriver = () => {
        if (order?.driver_phone) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(`tel:${order.driver_phone}`);
        }
    };

    const handleOpenChat = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('Chat', {
            orderId: order.order_id,
            orderNumber: order.order_number,
            recipientName: order.driver_name || 'Driver',
            recipientType: 'driver',
        });
    };

    const getStatusInfo = (status: string) => {
        return ORDER_STATUS[status as keyof typeof ORDER_STATUS] || {
            label: status,
            color: 'textSecondary',
            icon: 'help-circle-outline'
        };
    };

    const fitMapToMarkers = () => {
        if (!driverLocation || !order?.delivery_lat || !order?.delivery_lng) return;

        mapRef.current?.fitToCoordinates([
            { latitude: driverLocation.lat, longitude: driverLocation.lng },
            { latitude: parseFloat(order.delivery_lat), longitude: parseFloat(order.delivery_lng) },
        ], {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
        });
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    {t('tracking.loading')}
                </Text>
            </View>
        );
    }

    const statusInfo = getStatusInfo(order?.order_status || '');
    const statusColor = (colors as any)[statusInfo.color] || colors.primary;

    const initialRegion: Region = driverLocation ? {
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    } : {
        latitude: 25.2854,
        longitude: 51.5310,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton={false}
                customMapStyle={isDark ? QATAR_DARK_MAP_STYLE : QATAR_LIGHT_MAP_STYLE}
                onMapReady={fitMapToMarkers}
            >
                {/* Route Polyline */}
                {routeCoordinates.length > 0 && (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={Colors.primary}
                        strokeWidth={4}
                        lineDashPattern={[0]}
                    />
                )}

                {/* Driver Marker with Animation */}
                {driverLocation && (
                    <Marker
                        coordinate={{
                            latitude: driverLocation.lat,
                            longitude: driverLocation.lng,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.driverMarkerContainer}>
                            <Animated.View style={[
                                styles.driverPulse,
                                { transform: [{ scale: pulseAnim }] }
                            ]} />
                            <View style={[styles.driverMarker, { backgroundColor: Colors.primary }]}>
                                <Text style={styles.driverMarkerIcon}>🚗</Text>
                            </View>
                        </View>
                    </Marker>
                )}

                {/* Destination Marker */}
                {order?.delivery_lat && order?.delivery_lng && (
                    <Marker
                        coordinate={{
                            latitude: parseFloat(order.delivery_lat),
                            longitude: parseFloat(order.delivery_lng),
                        }}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.destinationMarkerContainer}>
                            <View style={[styles.destinationMarker, { backgroundColor: '#22C55E' }]}>
                                <Text style={styles.destinationIcon}>📍</Text>
                            </View>
                            <View style={styles.destinationShadow} />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* Header Overlay */}
            <SafeAreaView style={styles.headerOverlay} edges={['top']}>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                {/* ETA Badge */}
                {eta && (
                    <View style={[styles.etaBadge, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.etaLabel, { color: colors.textSecondary }]}>{t('tracking.eta')}</Text>
                        <Text style={[styles.etaValue, { color: Colors.primary }]}>{eta}</Text>
                    </View>
                )}

                {/* Fit Map Button */}
                <TouchableOpacity
                    style={[styles.fitButton, { backgroundColor: colors.surface }]}
                    onPress={fitMapToMarkers}
                >
                    <Ionicons name="locate" size={24} color={colors.text} />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Bottom Card */}
            <View style={[styles.bottomCard, { backgroundColor: colors.surface }, Shadows.lg]}>
                {/* Status Row */}
                <View style={[styles.statusRow, { borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Ionicons name={statusInfo.icon as any} size={18} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor, textAlign: rtlTextAlign(isRTL) }]}>
                            {statusInfo.label}
                        </Text>
                    </View>
                    {distance && (
                        <Text style={[styles.distanceText, { color: colors.text }]}>
                            📏 {distance} {t('tracking.away')}
                        </Text>
                    )}
                </View>

                {/* Driver Info */}
                {order?.driver_id ? (
                    <View style={[styles.driverSection, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <View style={[styles.driverAvatar, { backgroundColor: Colors.primary + '20' }]}>
                            <Text style={styles.driverEmoji}>🚗</Text>
                        </View>
                        <View style={[styles.driverInfo, isRTL ? { marginRight: Spacing.md } : { marginLeft: Spacing.md }]}>
                            <Text style={[styles.driverName, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                                {order.driver_name}
                            </Text>
                            <Text style={[styles.vehicleInfo, { color: isDark ? '#FFFFFF' : colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                                {order.vehicle_type} • {order.vehicle_plate}
                            </Text>
                        </View>

                        {/* Action Buttons */}
                        <TouchableOpacity
                            style={styles.chatButton}
                            onPress={handleOpenChat}
                        >
                            <LinearGradient
                                colors={[Colors.primary, '#B31D4A']}
                                style={styles.actionGradient}
                            >
                                <Text style={styles.actionIcon}>💬</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.callButton}
                            onPress={handleCallDriver}
                        >
                            <LinearGradient
                                colors={['#22C55E', '#16A34A']}
                                style={styles.actionGradient}
                            >
                                <Ionicons name="call" size={18} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.noDriverSection}>
                        <Ionicons name="time-outline" size={24} color={isDark ? '#FFFFFF' : colors.textMuted} />
                        <Text style={[styles.noDriverText, { color: isDark ? '#FFFFFF' : colors.textMuted }]}>
                            {t('tracking.waitingForDriver')}
                        </Text>
                    </View>
                )}

                {/* Order Summary */}
                <View style={[styles.orderSummary, { backgroundColor: colors.surfaceSecondary || colors.background, flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text style={[styles.orderNumber, { color: Colors.primary }]}>
                        #{order?.order_number}
                    </Text>
                    <Text style={[styles.partDesc, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={1}>
                        {order?.part_description}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: FontSize.md },

    map: { flex: 1 },

    // Header
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.md
    },
    etaBadge: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        ...Shadows.md,
    },
    etaLabel: { fontSize: 10, fontWeight: '600' },
    etaValue: { fontSize: FontSize.lg, fontWeight: '800' },
    fitButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.md
    },

    // Driver Marker
    driverMarkerContainer: { alignItems: 'center', justifyContent: 'center' },
    driverPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary + '30',
    },
    driverMarker: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        ...Shadows.md,
    },
    driverMarkerIcon: { fontSize: 24 },

    // Destination Marker
    destinationMarkerContainer: { alignItems: 'center' },
    destinationMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        ...Shadows.md,
    },
    destinationIcon: { fontSize: 22 },
    destinationShadow: {
        width: 20,
        height: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        marginTop: 4,
    },

    // Bottom Card
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? Spacing.xl + 20 : Spacing.lg,
    },

    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        marginBottom: Spacing.md
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full
    },
    statusText: { fontSize: FontSize.sm, fontWeight: '600' },
    distanceText: { fontSize: FontSize.sm, fontWeight: '600' },

    driverSection: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center'
    },
    driverEmoji: { fontSize: 24 },
    driverInfo: { flex: 1, marginLeft: Spacing.md },
    driverName: { fontSize: FontSize.lg, fontWeight: '700' },
    vehicleInfo: { fontSize: FontSize.sm, marginTop: 2 },

    chatButton: {
        marginRight: Spacing.sm,
        borderRadius: 22,
        overflow: 'hidden',
    },
    callButton: {
        borderRadius: 22,
        overflow: 'hidden',
    },
    actionGradient: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: { fontSize: 20 },

    noDriverSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg
    },
    noDriverText: { fontSize: FontSize.md },

    orderSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md
    },
    orderNumber: { fontWeight: '700', fontSize: FontSize.md },
    partDesc: { flex: 1, fontSize: FontSize.sm },
});

export default DeliveryTrackingScreen;
