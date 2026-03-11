import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    Alert,
    PanResponder,
} from 'react-native';
import MapView from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';
import { api } from '../services/api';
import { Colors } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { useTheme } from '../contexts';
import { useToast } from '../components/Toast';
import { KEYS } from '../config/keys';

// Extracted Components
import TrackingHeader from '../components/tracking/TrackingHeader';
import DriverMap, { DriverLocation, RouteCoordinate } from '../components/tracking/DriverMap';
import OrderStatusSheet from '../components/tracking/OrderStatusSheet';

/** Decode Google Maps encoded polyline string into coordinates */
const decodePolyline = (encoded: string): RouteCoordinate[] => {
    const points: RouteCoordinate[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
};

export default function TrackingScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<any>();
    const { orderId, orderNumber } = route.params;
    const { t, isRTL } = useTranslation();
    const { colors, isDark } = useTheme();
    const { show: showToast } = useToast();

    const mapRef = useRef<MapView>(null);
    const socket = useRef<Socket | null>(null);

    // Bottom Sheet Animation
    const bottomSheetY = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const snapToPosition = (dest: number, index: number) => {
        Animated.spring(bottomSheetY, {
            toValue: dest,
            useNativeDriver: true,
            bounciness: 4,
        }).start();
        if (index === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
            onPanResponderMove: Animated.event([null, { dy: bottomSheetY }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gesture) => {
                const positions = [0, 400];
                const nearest = gesture.dy > 50 ? 1 : gesture.dy < -50 ? 0 : gesture.dy > 0 ? (bottomSheetY as any)._value > 200 ? 1 : 0 : (bottomSheetY as any)._value < 200 ? 0 : 1;
                snapToPosition(positions[nearest], nearest);
            },
        })
    ).current;

    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
    const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [eta, setEta] = useState<string | null>(null);
    const [distance, setDistance] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [driverInfo, setDriverInfo] = useState<{ id?: string; name: string; phone: string; vehicle: string } | null>(null);
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
    const [deliveryOtp, setDeliveryOtp] = useState<string | null>(null);
    const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
    const [isOtpLoading, setIsOtpLoading] = useState(false);

    const canShowDriver = !!(orderDetails?.order_status && ['collected', 'in_transit', 'delivered', 'completed'].includes(orderDetails.order_status));

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

    useEffect(() => {
        const connectSocket = async () => {
            const token = await api.getToken();
            socket.current = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });

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
                        if (customerLocation) {
                            fetchRoute({ lat, lng }, { lat: customerLocation.latitude, lng: customerLocation.longitude });
                        }
                    }
                }
            });

            socket.current.on('order_status_update', (data: any) => {
                if (data.order_id === orderId) {
                    setOrderDetails((prev: any) => prev ? { ...prev, order_status: data.status } : null);
                    if (['in_transit', 'delivered', 'completed'].includes(data.status)) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            });

            socket.current.on('disconnect', () => setIsConnected(false));
        };
        connectSocket();
        return () => { socket.current?.disconnect(); };
    }, [orderId, customerLocation]);

    useEffect(() => { loadOrderData(); }, []);

    const fetchDeliveryOtp = useCallback(async (silent = true) => {
        if (!orderId) return;
        setIsOtpLoading(true);
        try {
            const otpResponse = await api.getDeliveryOtp(orderId);
            if (otpResponse?.otp_code) {
                setDeliveryOtp(otpResponse.otp_code);
                setOtpExpiresAt(otpResponse.expires_at || null);
            }
        } catch (error) {
            if (!silent) {
                handleApiError(error, { error: (title, message) => showToast({ type: 'error', title, message: message || title }) }, t('tracking.otpError'));
            }
        } finally {
            setIsOtpLoading(false);
        }
    }, [orderId, showToast, t]);

    const loadOrderData = async () => {
        try {
            const response = await api.getOrderDetails(orderId);
            const order = response.order;

            if (order) {
                const delivLat = order.delivery_lat != null ? parseFloat(String(order.delivery_lat)) : NaN;
                const delivLng = order.delivery_lng != null ? parseFloat(String(order.delivery_lng)) : NaN;
                if (!isNaN(delivLat) && !isNaN(delivLng)) {
                    setCustomerLocation({ latitude: delivLat, longitude: delivLng });
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
                        if (!isNaN(delivLat) && !isNaN(delivLng)) {
                            fetchRoute({ lat, lng }, { lat: delivLat, lng: delivLng });
                        }
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

                setOrderDetails({
                    garage_name: order.garage_name || t('common.unknown'),
                    part_description: order.part_description || order.part_name || t('common.part'),
                    part_condition: order.part_condition || 'used_good',
                    warranty_days: parseInt(String(order.warranty_days)) || 0,
                    part_price: parseFloat(String(order.part_price)) || 0,
                    delivery_fee: parseFloat(String(order.delivery_fee || 0)),
                    loyalty_discount: parseFloat(String(order.loyalty_discount || 0)),
                    total_amount: parseFloat(String(order.total_amount)) || 0,
                    order_status: order.order_status || 'in_transit',
                    delivery_otp: order.delivery_otp,
                });
                if (order.delivery_otp) {
                    setDeliveryOtp(order.delivery_otp);
                } else {
                    fetchDeliveryOtp(true);
                }
            }
        } catch (error) {
            handleApiError(error, { error: (title, message) => showToast({ type: 'error', title, message: message || title }) }, t('tracking.loadFailed'));
        }
    };

    const fetchRoute = useCallback(async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${KEYS.GOOGLE_MAPS_API_KEY}&mode=driving`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const leg = route.legs[0];
                if (leg.duration?.text) setEta(leg.duration.text);
                if (leg.distance?.text) setDistance(leg.distance.text);
                setRouteCoordinates(decodePolyline(route.overview_polyline.points));
            }
        } catch (error) {
            log('Route fetch error:', error);
        }
    }, []);

    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;
        const startWatching = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
                    (location) => {
                        setMyLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
                        // BUG FIX REMEDIATION: Previously `setCustomerLocation` was called here, which overwrote the fixed delivery 
                        // address with the customer's current moving GPS location, confusing the driver routing map. It has been removed.
                    }
                );
            } catch (error) { log('Location watch error:', error); }
        };
        startWatching();
        return () => { subscription?.remove(); };
    }, []);

    const handleShareLocation = async () => {
        if (!myLocation) {
            Alert.alert(t('tracking.locationNotReady'), t('tracking.locationNotReadyMsg'));
            return;
        }
        try {
            Alert.alert(t('tracking.locationShared'), t('tracking.locationSharedMsg'), [{ text: t('common.ok') }]);
        } catch (error) {
            Alert.alert(t('common.error'), t('tracking.shareError'));
        }
    };

    return (
        <View style={styles.container}>
            <DriverMap
                mapRef={mapRef as React.RefObject<MapView>}
                isDark={isDark}
                canShowDriver={canShowDriver}
                driverLocation={driverLocation}
                customerLocation={customerLocation}
                routeCoordinates={routeCoordinates}
                pulseAnim={pulseAnim}
            />

            <TrackingHeader 
                colors={colors}
                t={t}
                isRTL={isRTL}
                orderStatus={orderDetails?.order_status}
                onBack={() => navigation.goBack()}
                onSupport={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('Support');
                }}
            />

            <OrderStatusSheet
                t={t}
                isRTL={isRTL}
                navigation={navigation}
                orderId={orderId}
                orderNumber={orderNumber}
                bottomSheetY={bottomSheetY}
                panResponder={panResponder}
                eta={eta}
                distance={distance}
                driverInfo={driverInfo}
                orderDetails={orderDetails}
                onShareLocation={handleShareLocation}
                deliveryOtp={deliveryOtp}
                otpExpiresAt={otpExpiresAt}
                isOtpLoading={isOtpLoading}
                onRefreshOtp={() => fetchDeliveryOtp(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
});
