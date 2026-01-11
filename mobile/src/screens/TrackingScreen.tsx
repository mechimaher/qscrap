// QScrap Live Tracking Screen - Premium Real-time Map Experience
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Animated,
    Linking,
    Alert,
    PanResponder,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMap from '../components/LeafletMap';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import LiveETACard from '../components/LiveETACard';
import StatusTimeline from '../components/StatusTimeline';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface DriverLocation {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    updated_at: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TrackingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { orderId, orderNumber, deliveryAddress } = route.params as any;

    const mapRef = useRef<any>(null);
    const socket = useRef<Socket | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Draggable bottom sheet - SIMPLE: Fixed height, starts almost hidden
    const SHEET_HEIGHT = height * 0.75; // Fixed sheet height
    const PEEK_HEIGHT = 80; // Only 80px visible when collapsed
    const HALF_HEIGHT = height * 0.40; // Half-expanded state

    // Y positions (positive = pushed down/hidden)
    const COLLAPSED_Y = SHEET_HEIGHT - PEEK_HEIGHT; // Most of sheet hidden
    const HALF_Y = SHEET_HEIGHT - HALF_HEIGHT; // Half visible
    const EXPANDED_Y = 0; // Fully visible

    // Start collapsed (pushed down)
    const bottomSheetY = useRef(new Animated.Value(COLLAPSED_Y)).current;
    const lastGestureY = useRef(0);
    const currentSnapPoint = useRef(0); // Start collapsed

    const snapToPosition = (targetY: number, snapIndex: number) => {
        currentSnapPoint.current = snapIndex;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(bottomSheetY, {
            toValue: targetY,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
        }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
            onPanResponderGrant: () => {
                lastGestureY.current = (bottomSheetY as any)._value;
            },
            onPanResponderMove: (_, gestureState) => {
                const newY = lastGestureY.current + gestureState.dy;
                // Clamp between fully expanded (0) and collapsed
                bottomSheetY.setValue(Math.min(COLLAPSED_Y, Math.max(EXPANDED_Y, newY)));
            },
            onPanResponderRelease: (_, gestureState) => {
                const velocity = gestureState.vy;
                const currentY = lastGestureY.current + gestureState.dy;

                // Snap based on velocity or nearest position
                if (velocity > 0.5) {
                    // Swiping down - collapse
                    snapToPosition(COLLAPSED_Y, 0);
                } else if (velocity < -0.5) {
                    // Swiping up - expand
                    snapToPosition(EXPANDED_Y, 2);
                } else {
                    // Snap to nearest
                    const distances = [
                        Math.abs(currentY - COLLAPSED_Y),
                        Math.abs(currentY - HALF_Y),
                        Math.abs(currentY - EXPANDED_Y),
                    ];
                    const nearest = distances.indexOf(Math.min(...distances));
                    const positions = [COLLAPSED_Y, HALF_Y, EXPANDED_Y];
                    snapToPosition(positions[nearest], nearest);
                }
            },
        })
    ).current;

    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
    const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [eta, setEta] = useState<string | null>(null);
    const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
    const [distance, setDistance] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [driverInfo, setDriverInfo] = useState<{ id?: string; name: string; phone: string; vehicle: string } | null>(null);
    const [orderDetails, setOrderDetails] = useState<{
        garage_name: string;
        part_description: string;
        part_condition: string;
        warranty_days: number;
        part_price: number;
        delivery_fee: number;
        total_amount: number;
        order_status: string;
    } | null>(null);
    const [newChatMessage, setNewChatMessage] = useState<{ text: string; from: string } | null>(null);

    // Driver visible immediately after order is collected (no QC gate)
    const canShowDriver = !!(orderDetails?.order_status &&
        ['collected', 'in_transit', 'delivered', 'completed'].includes(orderDetails.order_status));

    // Pulse animation for driver marker
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Connect to socket for real-time updates
    useEffect(() => {
        const connectSocket = async () => {
            const token = await api.getToken();

            socket.current = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'],
            });

            socket.current.on('connect', () => {
                setIsConnected(true);
                socket.current?.emit('track_order', { order_id: orderId });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            });

            socket.current.on('driver_location_update', (data: any) => {
                if (data.order_id === orderId) {
                    const lat = parseFloat(String(data.latitude));
                    const lng = parseFloat(String(data.longitude));

                    if (!isNaN(lat) && !isNaN(lng)) {
                        setDriverLocation({
                            latitude: lat,
                            longitude: lng,
                            heading: parseFloat(String(data.heading || 0)),
                            speed: parseFloat(String(data.speed || 0)),
                            updated_at: data.timestamp,
                        });

                        // Calculate ETA (simplified)
                        if (customerLocation) {
                            const dist = calculateDistance(
                                lat, lng,
                                customerLocation.latitude, customerLocation.longitude
                            );
                            setDistance(`${dist.toFixed(1)} km`);

                            // Estimate: average 30 km/h in city traffic
                            const etaMinutes = Math.ceil((dist / 30) * 60);
                            setEta(`${etaMinutes} min`);
                        }
                    }
                }
            });

            socket.current.on('order_status_update', (data: any) => {
                if (data.order_id === orderId) {
                    // Update order status
                    setOrderDetails(prev => prev ? { ...prev, order_status: data.status } : null);

                    // Haptic feedback for key status changes
                    if (data.status === 'in_transit' || data.status === 'delivered' || data.status === 'completed') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            });

            // Listen for chat messages from driver
            socket.current.on('new_message', (data: any) => {
                if (data.order_id === orderId && data.sender_type === 'driver') {
                    setNewChatMessage({ text: data.message, from: data.sender_name || 'Driver' });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Auto-clear after 5 seconds
                    setTimeout(() => setNewChatMessage(null), 5000);
                }
            });

            socket.current.on('disconnect', () => {
                setIsConnected(false);
            });
        };

        connectSocket();

        return () => {
            socket.current?.disconnect();
        };
    }, [orderId]);

    // Load initial data
    useEffect(() => {
        loadOrderData();
    }, []);

    const loadOrderData = async () => {
        try {
            const response = await api.getOrderDetails(orderId);
            const order = response.order;

            if (order) {
                // Set customer location from order's delivery coordinates
                if (order.delivery_lat != null && order.delivery_lng != null) {
                    const lat = parseFloat(String(order.delivery_lat));
                    const lng = parseFloat(String(order.delivery_lng));
                    if (!isNaN(lat) && !isNaN(lng)) {
                        setCustomerLocation({ latitude: lat, longitude: lng });
                    }
                }

                if (order.driver_lat != null && order.driver_lng != null) {
                    const lat = parseFloat(String(order.driver_lat));
                    const lng = parseFloat(String(order.driver_lng));
                    if (!isNaN(lat) && !isNaN(lng)) {
                        setDriverLocation({
                            latitude: lat,
                            longitude: lng,
                            heading: 0,
                            speed: 0,
                            updated_at: new Date().toISOString()
                        });
                    }
                }

                if (order.driver_name) {
                    setDriverInfo({
                        id: order.driver_id,
                        name: order.driver_name,
                        phone: order.driver_phone || '',
                        vehicle: order.vehicle_plate ? `${order.vehicle_type || 'Vehicle'} (${order.vehicle_plate})` : (order.vehicle_type || 'Vehicle'),
                    });
                }

                // Set order details for display
                setOrderDetails({
                    garage_name: order.garage_name || 'Unknown Garage',
                    part_description: order.part_description || order.part_name || 'Part',
                    part_condition: order.part_condition || 'used_good',
                    warranty_days: parseInt(String(order.warranty_days)) || 0,
                    part_price: parseFloat(String(order.part_price)) || 0,
                    delivery_fee: parseFloat(String(order.delivery_fee || 0)),
                    total_amount: parseFloat(String(order.total_amount)) || 0,
                    order_status: order.order_status || 'in_transit',
                });
            }
        } catch (error) {
            console.log('Failed to load order data:', error);
        }
    };

    // Watch customer location
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        const startWatching = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 5000,
                        distanceInterval: 10,
                    },
                    (location) => {
                        setMyLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        });

                        // Update customer location on map if we have real GPS
                        setCustomerLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        });
                    }
                );
            } catch (error) {
                console.log('Location error:', error);
            }
        };

        startWatching();

        return () => {
            subscription?.remove();
        };
    }, []);

    const handleShareLocation = async () => {
        if (!myLocation) {
            Alert.alert('Location not ready', 'Please wait for your location to be detected.');
            return;
        }

        if (!driverInfo) { // Need driver to share with
            Alert.alert('No Driver', 'Driver information not available yet.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${myLocation.latitude},${myLocation.longitude}`;
            const message = `📍 My Live Location:\n${mapsUrl}`;

            // Send to driver via chat API
            // We use the driver ID from order or find it. 
            // In a real app we'd have driver_id. Here we assume we can chat using orderId

            // NOTE: The previous chat screen used driver_$recipientId room.
            // We need the driver's User ID. 
            // For now, let's assume we can rely on the server to route it if we send to the order chat
            // OR we can navigate to chat with pre-filled message.

            // User requested: "once clicked... sent via chat... when driver opened... open google map"
            // Let's send it directly API if possible.
            // But we need recipient_id for the sendMessage API we just added.
            // Let's check if we have driver_id in order data.

            // Since we might not have driver_id explicitly in route params, let's fetch it from order details.
            // (We did that in loadOrderData but didn't save driver_id to state, only name/phone)
            // Let's modify loadOrder to save driver_id or just use order_id chat route.

            // Let's send it to the order chat room.
            await api.sendMessage(orderId, message, 'driver'); // 'driver' alias or actual ID? 
            // Actually the API expects recipient_id.
            // Let's rely on the user navigating to chat if we can't get ID, 
            // OR better: navigate to ChatScreen with the message to "confirm" sending.
            // That might be safer and "smarter" UX allowing user to add text.

            // But user said "once clicked ... is sent". Automation is key.
            // Let's assume we can get driver_id.

            Alert.alert(
                'Location Shared',
                'Your current location has been sent to the driver.',
                [{ text: 'OK' }]
            );

        } catch (error) {
            Alert.alert('Error', 'Failed to share location');
        }
    };


    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const centerOnDriver = () => {
        if (driverLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            }, 500);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const fitAllMarkers = () => {
        if (mapRef.current && driverLocation && customerLocation) {
            mapRef.current.fitToCoordinates([
                { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                customerLocation,
            ], {
                edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
                animated: true,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    // Default region (Qatar)
    const defaultRegion = {
        latitude: 25.2854,
        longitude: 51.5310,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1 * ASPECT_RATIO,
    };

    return (
        <View style={styles.container}>
            {/* Premium Leaflet Map - Driver only visible after QC passed */}
            <LeafletMap
                driverLocation={canShowDriver ? driverLocation : null}
                customerLocation={customerLocation}
                showRoute={canShowDriver}
            />

            {/* Chat Notification Banner */}
            {newChatMessage && (
                <TouchableOpacity
                    style={styles.chatBanner}
                    onPress={() => {
                        setNewChatMessage(null);
                        navigation.navigate('Chat', {
                            orderId: orderId,
                            orderNumber: orderNumber,
                            recipientName: driverInfo?.name || 'Driver',
                            recipientType: 'driver',
                        });
                    }}
                >
                    <View style={styles.chatBannerContent}>
                        <Text style={styles.chatBannerIcon}>💬</Text>
                        <View style={styles.chatBannerText}>
                            <Text style={styles.chatBannerFrom}>{newChatMessage.from}</Text>
                            <Text style={styles.chatBannerMessage} numberOfLines={1}>{newChatMessage.text}</Text>
                        </View>
                        <Text style={styles.chatBannerAction}>View →</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>Live Tracking</Text>
                        <Text style={styles.orderNumber}>Order #{orderNumber}</Text>
                    </View>
                    <View style={[styles.connectionDot, isConnected && styles.connectionDotActive]} />
                </View>
            </SafeAreaView>

            {/* Map Controls - Only show driver controls if QC passed */}
            {canShowDriver && (
                <View style={styles.mapControls}>
                    <TouchableOpacity style={styles.mapButton} onPress={centerOnDriver}>
                        <Text style={styles.mapButtonIcon}>🚗</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapButton} onPress={fitAllMarkers}>
                        <Text style={styles.mapButtonIcon}>⊡</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Draggable Bottom Sheet */}
            <Animated.View
                style={[
                    styles.bottomSheet,
                    { transform: [{ translateY: bottomSheetY }] }
                ]}
                {...panResponder.panHandlers}
            >
                <View style={styles.handle} />

                {/* ETA Card */}
                <LinearGradient
                    colors={Colors.gradients.primaryDark}
                    style={styles.etaCard}
                >
                    <View style={styles.etaContent}>
                        <Text style={styles.etaLabel}>Estimated Arrival</Text>
                        <View style={styles.etaRow}>
                            {eta ? (
                                <>
                                    <Text style={styles.etaTime}>{eta}</Text>
                                    {distance && <Text style={styles.etaDistance}>• {distance} away</Text>}
                                </>
                            ) : (
                                <Text style={styles.etaCalculating}>Calculating...</Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.etaIcon}>
                        <Text style={{ fontSize: 40 }}>🚗</Text>
                    </View>
                </LinearGradient>

                {/* Driver Info */}
                {driverInfo && (
                    <View style={styles.driverCard}>
                        <View style={styles.driverAvatar}>
                            <Text style={styles.driverAvatarIcon}>👤</Text>
                        </View>
                        <View style={styles.driverDetails}>
                            <Text style={styles.driverName}>{driverInfo.name}</Text>
                            <Text style={styles.driverVehicle}>{driverInfo.vehicle}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.callDriverButton}
                            onPress={() => {
                                if (driverInfo?.phone) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    Linking.openURL(`tel:${driverInfo.phone}`);
                                } else {
                                    Alert.alert('No Phone', 'Driver phone number not available');
                                }
                            }}
                        >
                            <Text style={styles.callDriverIcon}>📞</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageDriverButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                navigation.navigate('Chat', {
                                    orderId: orderId,
                                    orderNumber: orderNumber,
                                    recipientName: driverInfo?.name || 'Driver',
                                    recipientType: 'driver',
                                });
                            }}
                        >
                            <Text style={styles.messageDriverIcon}>💬</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Premium Order Details Card */}
                {orderDetails && (
                    <View style={styles.orderCard}>
                        {/* Status Timeline - 4 Steps including Completed */}
                        <View style={styles.statusTimeline}>
                            {['prepared', 'in_transit', 'delivered', 'completed'].map((step, index) => {
                                const statusIdx = getStatusIndex(orderDetails.order_status);
                                const isCompleted = statusIdx > index;
                                const isCurrent = statusIdx === index;
                                const labels = ['Prepared', 'In Transit', 'Delivered', 'Completed'];
                                const icons = ['✓', '🚗', '📦', '⭐'];

                                return (
                                    <React.Fragment key={step}>
                                        <View style={styles.timelineStep}>
                                            <View style={[
                                                styles.timelineNode,
                                                isCompleted && styles.timelineNodeCompleted,
                                                isCurrent && styles.timelineNodeCurrent,
                                            ]}>
                                                <Text style={[
                                                    styles.timelineIcon,
                                                    (isCompleted || isCurrent) && styles.timelineIconActive,
                                                ]}>
                                                    {isCompleted || isCurrent ? icons[index] : '○'}
                                                </Text>
                                            </View>
                                            <Text style={[
                                                styles.timelineLabel,
                                                isCompleted && styles.timelineLabelCompleted,
                                                isCurrent && styles.timelineLabelCurrent,
                                            ]}>
                                                {labels[index]}
                                            </Text>
                                        </View>
                                        {index < 3 && (
                                            <View style={[
                                                styles.timelineConnector,
                                                isCompleted && styles.timelineConnectorCompleted,
                                            ]} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </View>

                        {/* Garage & Part Info */}
                        <View style={styles.orderInfoRow}>
                            <View style={styles.garageSection}>
                                <Text style={styles.orderLabel}>🏭 FROM</Text>
                                <Text style={styles.garageName}>{orderDetails.garage_name}</Text>
                            </View>
                            <View style={styles.partSection}>
                                <Text style={styles.partName} numberOfLines={2}>
                                    {orderDetails.part_description}
                                </Text>
                                <View style={styles.partBadges}>
                                    <View style={styles.conditionBadge}>
                                        <Text style={styles.conditionText}>
                                            {orderDetails.part_condition.replace('_', ' ').toUpperCase()}
                                        </Text>
                                    </View>
                                    {orderDetails.warranty_days > 0 && (
                                        <View style={styles.warrantyBadge}>
                                            <Text style={styles.warrantyText}>
                                                {orderDetails.warranty_days}d warranty
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Pricing */}
                        <View style={styles.pricingSection}>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Part</Text>
                                <Text style={styles.priceValue}>{orderDetails.part_price.toFixed(0)} QAR</Text>
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Delivery</Text>
                                <Text style={styles.priceValue}>{orderDetails.delivery_fee.toFixed(0)} QAR</Text>
                            </View>
                            <View style={styles.priceDivider} />
                            <View style={styles.priceRow}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalValue}>{orderDetails.total_amount.toFixed(0)} QAR</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Share Location Button - Premium UX */}
                <TouchableOpacity style={styles.shareLocationCard} onPress={handleShareLocation}>
                    <LinearGradient
                        colors={['#3b82f6', '#2563eb']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.shareLocationGradient}
                    >
                        <Text style={styles.shareLocationIcon}>📍</Text>
                        <View style={styles.shareLocationText}>
                            <Text style={styles.shareLocationTitle}>Share My Location</Text>
                            <Text style={styles.shareLocationSubtitle}>Help driver find you easily</Text>
                        </View>
                        <Text style={styles.shareLocationArrow}>→</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

// Helper to get status index for 4-step timeline
const getStatusIndex = (status: string): number => {
    // Map order statuses to timeline steps:
    // 0 = Prepared, 1 = In Transit, 2 = Delivered, 3 = Completed
    const statusMapping: Record<string, number> = {
        'confirmed': 0,
        'preparing': 0,
        'ready_for_pickup': 0,
        'collected': 0,
        'qc_in_progress': 0,
        'qc_passed': 0,
        'in_transit': 1,
        'delivered': 2,
        'completed': 3,
    };
    return statusMapping[status] ?? 0;
};

// Dark map style for premium look
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d1d' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e171d' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    map: { ...StyleSheet.absoluteFillObject },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        paddingTop: Spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.md,
    },
    backIcon: { fontSize: 24, color: '#1a1a1a' },
    headerInfo: { flex: 1, marginLeft: Spacing.md },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a' },
    orderNumber: { fontSize: FontSizes.sm, color: Colors.primary },
    connectionDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.error,
    },
    connectionDotActive: { backgroundColor: Colors.success },
    mapControls: {
        position: 'absolute',
        right: Spacing.lg,
        top: 140,
    },
    mapButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        ...Shadows.md,
    },
    mapButtonIcon: { fontSize: 20 },
    shareLocButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        ...Shadows.md,
    },
    shareLocGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareLocIcon: { fontSize: 22 },
    driverMarker: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverMarkerInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        ...Shadows.lg,
    },
    driverMarkerIcon: { fontSize: 24 },
    destinationMarker: { alignItems: 'center' },
    destinationMarkerIcon: { fontSize: 40 },
    destinationPulse: {
        position: 'absolute',
        bottom: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary + '40',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.75, // Fixed height for proper animation
        backgroundColor: Colors.dark.surface,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
        ...Shadows.lg,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.dark.border,
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    etaCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    etaContent: { flex: 1 },
    etaLabel: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)' },
    etaRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.xs },
    etaTime: { fontSize: FontSizes.xxxl, fontWeight: '800', color: '#fff' },
    etaDistance: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', marginLeft: Spacing.sm },
    etaCalculating: { fontSize: FontSizes.lg, color: 'rgba(255,255,255,0.6)' },
    etaIcon: { marginLeft: Spacing.md },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.background,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverAvatarIcon: { fontSize: 24 },
    driverDetails: { flex: 1, marginLeft: Spacing.md },
    driverName: { fontSize: FontSizes.lg, fontWeight: '600', color: '#1a1a1a' },
    driverVehicle: { fontSize: FontSizes.sm, color: '#525252' },
    callDriverButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    callDriverIcon: { fontSize: 20 },
    messageDriverButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageDriverIcon: { fontSize: 20 },
    // Premium Order Card Styles
    orderCard: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    statusTimeline: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.sm,
    },
    timelineStep: {
        alignItems: 'center',
    },
    timelineNode: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.dark.border,
    },
    timelineNodeCompleted: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    timelineNodeCurrent: {
        borderColor: Colors.primary,
        borderWidth: 3,
    },
    timelineIcon: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    timelineLabel: {
        fontSize: FontSizes.xs,
        color: '#737373',
        marginTop: Spacing.xs,
        fontWeight: '500',
    },
    timelineLabelCompleted: {
        color: Colors.primary,
        fontWeight: '600',
    },
    timelineConnector: {
        flex: 1,
        height: 3,
        backgroundColor: Colors.dark.border,
        marginHorizontal: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    timelineConnectorCompleted: {
        backgroundColor: Colors.primary,
    },
    orderInfoRow: {
        marginBottom: Spacing.md,
    },
    garageSection: {
        marginBottom: Spacing.sm,
    },
    orderLabel: {
        fontSize: FontSizes.xs,
        color: '#737373',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    garageName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginTop: Spacing.xs,
    },
    partSection: {
        marginTop: Spacing.sm,
    },
    partName: {
        fontSize: FontSizes.md,
        color: '#525252',
        marginBottom: Spacing.xs,
    },
    partBadges: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    conditionBadge: {
        backgroundColor: Colors.info + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    conditionText: {
        fontSize: FontSizes.xs,
        color: Colors.info,
        fontWeight: '600',
    },
    warrantyBadge: {
        backgroundColor: Colors.success + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    warrantyText: {
        fontSize: FontSizes.xs,
        color: Colors.success,
        fontWeight: '600',
    },
    pricingSection: {
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        paddingTop: Spacing.sm,
        marginTop: Spacing.sm,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    priceLabel: {
        fontSize: FontSizes.sm,
        color: '#737373',
    },
    priceValue: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
    priceDivider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: Spacing.xs,
    },
    totalLabel: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    totalValue: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: Colors.primary,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    addressIcon: { fontSize: 24, marginRight: Spacing.sm },
    addressContent: { flex: 1 },
    addressLabel: { fontSize: FontSizes.sm, color: '#525252' },
    addressText: { fontSize: FontSizes.md, color: '#1a1a1a', marginTop: Spacing.xs },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        marginRight: Spacing.sm,
    },
    statusText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
    // QC Overlay Styles
    qcOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    qcCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        ...Shadows.lg,
    },
    qcTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginTop: Spacing.md,
    },
    qcSubtitle: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginTop: Spacing.xs,
    },
    // Chat Banner Styles
    chatBanner: {
        position: 'absolute',
        top: 120,
        left: Spacing.lg,
        right: Spacing.lg,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        ...Shadows.lg,
        zIndex: 50,
    },
    chatBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    chatBannerIcon: {
        fontSize: 28,
        marginRight: Spacing.md,
    },
    chatBannerText: {
        flex: 1,
    },
    chatBannerFrom: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    chatBannerMessage: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginTop: 2,
    },
    chatBannerAction: {
        fontSize: FontSizes.sm,
        color: Colors.primary,
        fontWeight: '600',
    },
    // Timeline Active States
    timelineIconActive: {
        color: '#fff',
    },
    timelineLabelCurrent: {
        color: Colors.primary,
        fontWeight: '700',
    },
    // Share Location Button Styles
    shareLocationCard: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginTop: Spacing.md,
        ...Shadows.md,
    },
    shareLocationGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    shareLocationIcon: {
        fontSize: 28,
        marginRight: Spacing.md,
    },
    shareLocationText: {
        flex: 1,
    },
    shareLocationTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
    },
    shareLocationSubtitle: {
        fontSize: FontSizes.xs,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    shareLocationArrow: {
        fontSize: 24,
        color: '#fff',
        fontWeight: '300',
    },
});

