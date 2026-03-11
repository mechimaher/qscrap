import { log, warn, error as logError } from '../../utils/logger';
import { handleApiError } from '../../utils/errorHandler';
// QScrap Home Screen - Premium 2026 Brand Experience
import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Linking,
    Image,
    Animated,
    Easing,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign, rtlChevron } from '../../utils/rtl';
import { api, Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, FontFamily, Shadows, Colors as ThemeColors } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { useSocketContext } from '../../hooks/useSocket';
import { useToast } from '../../components/Toast';
import FeaturedProductsSection from '../../components/FeaturedProductsSection';
import HowItWorksCarousel from '../../components/HowItWorksCarousel';
import { DeliveryLocationWidget } from '../../components/DeliveryLocationWidget';
import { KEYS } from '../../config/keys';
import { useLoyalty } from '../../hooks/useLoyalty';

// Extracted sub-components
import HeroWelcome from '../../components/home/HeroWelcome';
import SignatureCTA from '../../components/home/SignatureCTA';
import AnimatedStats from '../../components/home/AnimatedStats';
import QuickActions from '../../components/home/QuickActions';
import ProTipCard from '../../components/home/ProTipCard';
import LoyaltyBanner from '../../components/home/LoyaltyBanner';
import WelcomeNewUser from '../../components/home/WelcomeNewUser';
import { LoadingStats } from '../../components/SkeletonLoading';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ============================================
// SKELETON LOADING (Home-specific)
// ============================================
const HomeSkeletonLoading = () => {
    const { width } = Dimensions.get('window');
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();
    const { isRTL } = useTranslation();

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const SkeletonBox = ({ style }: { style: any }) => (
        <View style={[styles.skeletonBox, style, { backgroundColor: colors.surfaceSecondary }]}>
            <Animated.View style={[styles.skeletonShimmer, { transform: [{ translateX: shimmerTranslate }], backgroundColor: colors.surface }]} />
        </View>
    );

    const cardWidth = (width - Spacing.lg * 3) / 2;

    return (
        <View style={styles.skeletonContainer}>
            <SkeletonBox style={styles.skeletonHero} />
            <SkeletonBox style={styles.skeletonCTA} />
            <View style={[styles.skeletonStatsRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <SkeletonBox style={[styles.skeletonStatCard, { width: cardWidth }]} />
                <SkeletonBox style={[styles.skeletonStatCard, { width: cardWidth }]} />
            </View>
        </View>
    );
};

// ============================================
// MAIN HOME SCREEN
// ============================================
export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { user } = useAuth();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const { newBids, orderUpdates } = useSocketContext();
    const toast = useToast();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [deliveryAddress, setDeliveryAddress] = useState(t('common.loading'));
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    // Loyalty - centralized hook (shared cache with PaymentScreen)
    const { loyalty: loyaltyHookData, refresh: refreshLoyalty } = useLoyalty();
    const loyalty = loyaltyHookData ? { points: loyaltyHookData.points, tier: loyaltyHookData.tier } : null;
    // Store full location for NewRequest submission
    const [deliveryLocationData, setDeliveryLocationData] = useState<{
        lat: number | null;
        lng: number | null;
        address: string;
    }>({ lat: null, lng: null, address: '' });

    // Get localized greeting based on time of day
    const getGreeting = useCallback(() => {
        const hour = new Date().getHours();
        if (hour < 12) return t('greetings.morning');
        if (hour < 17) return t('greetings.afternoon');
        return t('greetings.evening');
    }, [t]);

    // GPS Fallback Detection (lightweight, with timeout)
    const detectLocationFallback = useCallback(async () => {
        try {
            setIsDetectingLocation(true);
            setDeliveryAddress(`${t('common.detecting')}...`);

            // Check permissions silently
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                // Permission denied - prompt manual entry
                setDeliveryAddress(t('home.selectAddress'));
                setDeliveryLocationData({ lat: null, lng: null, address: '' });
                return;
            }

            // Get position with 5-second timeout (Balanced accuracy for speed)
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS Timeout')), 5000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]);

            // Reverse geocode using Google Maps API for better results
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${KEYS.GOOGLE_MAPS_API_KEY}`;

            try {
                const response = await fetch(geocodeUrl);
                const data = await response.json();

                if (data.status === 'OK' && data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const fullAddress = result.formatted_address;

                    // Smart display: Show first 3 parts (street, area, city) or full if short
                    const parts = fullAddress.split(',').map((p: string) => p.trim());
                    let displayAddress;
                    if (parts.length > 3) {
                        // Show: "Street, Area, City" (skip country)
                        displayAddress = parts.slice(0, 3).join(', ');
                    } else {
                        displayAddress = fullAddress;
                    }

                    setDeliveryAddress(displayAddress);
                    setDeliveryLocationData({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        address: fullAddress,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    // Geocoding failed but we have coordinates
                    setDeliveryAddress(t('home.currentLocation'));
                    setDeliveryLocationData({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        address: t('home.currentLocation'),
                    });
                }
            } catch (geocodeError) {
                log('[GPS Fallback] Google geocoding failed:', geocodeError);
                // Fallback to showing current location
                setDeliveryAddress(t('home.currentLocation'));
                setDeliveryLocationData({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    address: t('home.currentLocation'),
                });
            }
        } catch (error) {
            log('[GPS Fallback] Detection failed:', error);
            // Graceful fallback - prompt user to set manually
            setDeliveryAddress(t('home.selectAddress'));
            setDeliveryLocationData({ lat: null, lng: null, address: '' });
        } finally {
            setIsDetectingLocation(false);
        }
    }, [t]);


    const loadData = useCallback(async () => {
        try {
            const [statsData, notifData, addressesData] = await Promise.all([
                api.getStats(),
                api.request('/notifications/unread-count').catch(() => ({ count: 0 })),
                api.getAddresses().catch(() => ({ addresses: [] }))
            ]);
            // Refresh loyalty via centralized hook
            refreshLoyalty();
            setStats(statsData.stats);
            setUnreadNotifications((notifData as any).count || 0);

            // WATERFALL PATTERN: Saved addresses first, GPS fallback if none
            if (addressesData.addresses && addressesData.addresses.length > 0) {
                // Priority 1: Use saved default address (instant)
                const defaultAddr = addressesData.addresses.find((a: any) => a.is_default) || addressesData.addresses[0];
                const displayText = defaultAddr.address_text;
                // Format concise for display
                const parts = displayText.split(',').map((p: string) => p.trim());
                const concise = parts.length >= 2 ? `${parts[parts.length - 2]}, ${parts[parts.length - 1]}` : displayText;
                setDeliveryAddress(concise);
                setDeliveryLocationData({
                    lat: defaultAddr.latitude || 0,
                    lng: defaultAddr.longitude || 0,
                    address: displayText
                });
            } else {
                // Priority 2: Auto-detect GPS location (non-blocking fallback)
                detectLocationFallback();
            }
        } catch (error) {
            handleApiError(error, toast, t('errors.loadFailed'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useFocusEffect(useCallback(() => {
        setLoading(true); // Ensure loading state is true on focus
        loadData();
    }, [loadData]));

    useEffect(() => {
        if (newBids.length > 0 || orderUpdates.length > 0) {
            loadData();
        }
    }, [newBids, orderUpdates, loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadData();
    }, [loadData]);

    const handleNewRequest = () => {
        // Block if no address
        if (!deliveryLocationData.lat || !deliveryLocationData.lng) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                t('home.alertAddressTitle'),
                t('home.alertAddressMessage'),
                [
                    {
                        text: t('home.addAddress'),
                        onPress: () => setShowLocationPicker(true),
                        style: 'default'
                    },
                    {
                        text: t('common.cancel'),
                        style: 'cancel'
                    }
                ]
            );
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('NewRequest', {
            deliveryLocation: {
                lat: deliveryLocationData.lat,
                lng: deliveryLocationData.lng,
                address: deliveryLocationData.address,
            }
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <HomeSkeletonLoading />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Hero Welcome with Integrated Loyalty */}
                <HeroWelcome
                    user={user}
                    colors={colors}
                    unreadCount={unreadNotifications}
                    onNotificationPress={() => navigation.navigate('Notifications')}
                    onLocationPress={() => setShowLocationPicker(true)}
                    deliveryAddress={deliveryAddress}
                    loyalty={loyalty}
                    onLoyaltyPress={() => navigation.navigate('Rewards')}
                    greeting={getGreeting()}
                    customerLabel={t('common.customer')}
                />

                {/* Signature CTA */}
                <SignatureCTA onPress={handleNewRequest} />

                {/* Featured Products */}
                <FeaturedProductsSection
                    onProductPress={(product) => {
                        log('Product pressed:', product.title);
                    }}
                />

                {/* Animated Stats OR Welcome for New Users */}
                {stats && (stats.active_requests === 0 && stats.pending_deliveries === 0 && stats.total_orders === 0) ? (
                    <WelcomeNewUser onGetStarted={handleNewRequest} />
                ) : (
                    <AnimatedStats
                        stats={stats}
                        onRequestsPress={() => navigation.navigate('Requests')}
                        onOrdersPress={() => navigation.navigate('Orders')}
                    />
                )}

                {/* Quick Actions */}
                <QuickActions navigation={navigation} />

                {/* How It Works Carousel */}
                <View style={{ marginTop: Spacing.xl, marginBottom: Spacing.lg }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, textAlign: rtlTextAlign(isRTL) }]}>{t('home.howItWorks')}</Text>
                    <HowItWorksCarousel onGetStarted={handleNewRequest} autoPlay={true} />
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>


            {/* Location Picker Modal - Premium Integration */}
            {showLocationPicker && (
                <DeliveryLocationWidget
                    onLocationChange={(address) => {
                        if (address) {
                            // Show full geocoded address (or smart truncation if too long)
                            const fullAddress = address.address_text;
                            const parts = fullAddress.split(',').map(p => p.trim());

                            // Smart display: Show first 3 parts (street, area, city) or full if short
                            let displayAddress;
                            if (parts.length > 3) {
                                // Show: "Street, Area, City" (skip country)
                                displayAddress = parts.slice(0, 3).join(', ');
                            } else {
                                displayAddress = fullAddress;
                            }

                            setDeliveryAddress(displayAddress);
                            // Store full coordinates for driver navigation
                            setDeliveryLocationData({
                                lat: address.latitude || null,
                                lng: address.longitude || null,
                                address: address.address_text,
                            });
                        }
                        setShowLocationPicker(false);
                    }}
                />
            )}
        </SafeAreaView>
    );
}

// ============================================
// STYLES (main screen + skeleton only)
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    sectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        fontFamily: FontFamily.semibold,
        marginBottom: Spacing.sm,
    },

    // Skeleton
    skeletonContainer: { padding: Spacing.lg },
    skeletonBox: { backgroundColor: '#E8E8E8', borderRadius: BorderRadius.xl, overflow: 'hidden' },
    skeletonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' },
    skeletonHero: { height: 140, marginBottom: Spacing.lg, borderRadius: 0, borderBottomLeftRadius: BorderRadius.xl * 1.5, borderBottomRightRadius: BorderRadius.xl * 1.5 },
    skeletonCTA: { height: 120, marginBottom: Spacing.lg },
    skeletonStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    skeletonStatCard: { height: 130 },
});
