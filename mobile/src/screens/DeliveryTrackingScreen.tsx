import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '../contexts';
import { orderApi, getSocket } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows, ORDER_STATUS } from '../constants';

const { width, height } = Dimensions.get('window');

const DeliveryTrackingScreen: React.FC = () => {
    const { colors, isDark } = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        loadOrderDetails();

        // Listen for real-time driver location updates
        const socket = getSocket();
        if (socket) {
            socket.on('driver_location_update', (data: any) => {
                if (data.order_id === orderId) {
                    setDriverLocation({ lat: data.lat, lng: data.lng });
                    // Animate map to new location
                    mapRef.current?.animateToRegion({
                        latitude: data.lat,
                        longitude: data.lng,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }, 1000);
                }
            });
        }

        // Poll for location updates every 30 seconds as fallback
        const pollInterval = setInterval(loadOrderDetails, 30000);

        return () => {
            clearInterval(pollInterval);
            if (socket) {
                socket.off('driver_location_update');
            }
        };
    }, [orderId]);

    const loadOrderDetails = async () => {
        try {
            const response = await orderApi.getDetails(orderId);
            const orderData = response.data.order;
            setOrder(orderData);

            if (orderData.driver_lat && orderData.driver_lng) {
                setDriverLocation({
                    lat: parseFloat(orderData.driver_lat),
                    lng: parseFloat(orderData.driver_lng)
                });
            }
        } catch (error) {
            console.error('Failed to load order:', error);
            Alert.alert('Error', 'Failed to load tracking data');
        } finally {
            setLoading(false);
        }
    };

    const handleCallDriver = () => {
        if (order?.driver_phone) {
            Linking.openURL(`tel:${order.driver_phone}`);
        }
    };

    const getStatusInfo = (status: string) => {
        return ORDER_STATUS[status as keyof typeof ORDER_STATUS] || { label: status, color: 'textSecondary', icon: 'help-circle-outline' };
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading tracking...</Text>
            </View>
        );
    }

    const statusInfo = getStatusInfo(order?.order_status || '');
    const statusColor = colors[statusInfo.color as keyof typeof colors] || colors.primary;

    // Default to Qatar if no location
    const initialRegion = driverLocation ? {
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
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton={false}
                customMapStyle={isDark ? darkMapStyle : []}
            >
                {/* Driver Marker */}
                {driverLocation && (
                    <Marker
                        coordinate={{
                            latitude: driverLocation.lat,
                            longitude: driverLocation.lng,
                        }}
                        title={order?.driver_name || 'Driver'}
                        description={`${order?.vehicle_type || ''} ${order?.vehicle_plate || ''}`}
                    >
                        <View style={[styles.driverMarker, { backgroundColor: colors.primary }]}>
                            <Ionicons name="car" size={20} color="#fff" />
                        </View>
                    </Marker>
                )}

                {/* Destination Marker (customer address) */}
                {order?.delivery_lat && order?.delivery_lng && (
                    <Marker
                        coordinate={{
                            latitude: parseFloat(order.delivery_lat),
                            longitude: parseFloat(order.delivery_lng),
                        }}
                        title="Delivery Location"
                        description={order.delivery_address}
                    >
                        <View style={[styles.destinationMarker, { backgroundColor: colors.success }]}>
                            <Ionicons name="location" size={20} color="#fff" />
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
            </SafeAreaView>

            {/* Bottom Card */}
            <View style={[styles.bottomCard, { backgroundColor: colors.surface }, Shadows.lg]}>
                {/* Status */}
                <View style={[styles.statusRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons name={statusInfo.icon as any} size={18} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusInfo.label}</Text>
                    </View>
                    {order?.estimated_delivery && (
                        <Text style={[styles.eta, { color: colors.textSecondary }]}>
                            ETA: {new Date(order.estimated_delivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>

                {/* Driver Info */}
                {order?.driver_id ? (
                    <View style={styles.driverSection}>
                        <View style={[styles.driverAvatar, { backgroundColor: colors.primary + '20' }]}>
                            <Ionicons name="person" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.driverInfo}>
                            <Text style={[styles.driverName, { color: colors.text }]}>{order.driver_name}</Text>
                            <Text style={[styles.vehicleInfo, { color: colors.textSecondary }]}>
                                {order.vehicle_type} • {order.vehicle_plate}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.callButton, { backgroundColor: colors.success }]}
                            onPress={handleCallDriver}
                        >
                            <Ionicons name="call" size={20} color="#fff" />
                            <Text style={styles.callButtonText}>Call</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.noDriverSection}>
                        <Ionicons name="time-outline" size={24} color={colors.textMuted} />
                        <Text style={[styles.noDriverText, { color: colors.textMuted }]}>
                            Waiting for driver assignment...
                        </Text>
                    </View>
                )}

                {/* Order Summary */}
                <View style={[styles.orderSummary, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.orderNumber, { color: colors.primary }]}>#{order?.order_number}</Text>
                    <Text style={[styles.partDesc, { color: colors.text }]} numberOfLines={1}>{order?.part_description}</Text>
                </View>
            </View>
        </View>
    );
};

// Dark map style for better night mode experience
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: FontSize.md },

    map: { flex: 1 },

    headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, padding: Spacing.md },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...Shadows.md },

    driverMarker: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
    destinationMarker: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },

    bottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        paddingBottom: Spacing.xl + 20, // Extra for home indicator
    },

    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    statusText: { fontSize: FontSize.sm, fontWeight: '600' },
    eta: { fontSize: FontSize.md, fontWeight: '600' },

    driverSection: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    driverAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    driverInfo: { flex: 1, marginLeft: Spacing.md },
    driverName: { fontSize: FontSize.lg, fontWeight: '600' },
    vehicleInfo: { fontSize: FontSize.sm, marginTop: 2 },
    callButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    callButtonText: { color: '#fff', fontWeight: '600' },

    noDriverSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
    noDriverText: { fontSize: FontSize.md },

    orderSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md },
    orderNumber: { fontWeight: '700', fontSize: FontSize.md },
    partDesc: { flex: 1, fontSize: FontSize.sm },
});

export default DeliveryTrackingScreen;
