// QScrap Orders Screen - Premium 2026 Design
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { api, Order } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { useSocketContext } from '../../hooks/useSocket';
import { useToast } from '../../components/Toast';

type OrdersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// ============================================
// STATUS CONFIGURATION
// ============================================
const getStatusConfig = (status: string) => {
    switch (status) {
        case 'confirmed': return {
            color: '#3B82F6',
            bg: '#DBEAFE',
            icon: '✓',
            label: 'Confirmed',
            gradient: ['#3B82F6', '#2563EB'] as const
        };
        case 'preparing': return {
            color: '#F59E0B',
            bg: '#FEF3C7',
            icon: '🔧',
            label: 'Preparing',
            gradient: ['#F59E0B', '#D97706'] as const
        };
        case 'ready_for_pickup': return {
            color: '#8B5CF6',
            bg: '#EDE9FE',
            icon: '📦',
            label: 'Ready',
            gradient: ['#8B5CF6', '#7C3AED'] as const
        };
        case 'collected':
        case 'qc_in_progress':
        case 'qc_passed':
        case 'in_transit': return {
            color: '#22C55E',
            bg: '#DCFCE7',
            icon: '🚚',
            label: 'On The Way',
            gradient: ['#22C55E', '#16A34A'] as const
        };
        case 'qc_failed': return {
            color: '#F59E0B',
            bg: '#FEF3C7',
            icon: '⏳',
            label: 'Processing',
            gradient: ['#F59E0B', '#D97706'] as const
        };
        case 'delivered': return {
            color: '#06B6D4',
            bg: '#CFFAFE',
            icon: '📍',
            label: 'Delivered',
            gradient: ['#06B6D4', '#0891B2'] as const
        };
        case 'completed': return {
            color: '#22C55E',
            bg: '#DCFCE7',
            icon: '✅',
            label: 'Completed',
            gradient: ['#22C55E', '#16A34A'] as const
        };
        default: return {
            color: '#6B7280',
            bg: '#F3F4F6',
            icon: '•',
            label: status,
            gradient: ['#6B7280', '#4B5563'] as const
        };
    }
};

// ============================================
// PREMIUM ORDER CARD COMPONENT
// ============================================
const PremiumOrderCard = ({
    item,
    index,
    colors,
    onPress,
    onTrack,
}: {
    item: Order;
    index: number;
    colors: any;
    onPress: () => void;
    onTrack: () => void;
}) => {
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    const statusConfig = getStatusConfig(item.order_status);
    const isInTransit = ['in_transit', 'collected', 'qc_in_progress', 'qc_passed'].includes(item.order_status);
    const needsConfirmation = item.order_status === 'delivered';

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                delay: index * 80,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 80,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animation for in-transit orders
        if (isInTransit) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [index, isInTransit]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    const pulseOpacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
    });

    const glowScale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.02],
    });

    return (
        <Animated.View style={[
            styles.cardWrapper,
            {
                opacity: fadeAnim,
                transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim },
                    ...(isInTransit ? [{ scale: glowScale }] : []),
                ],
            },
        ]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.95}
            >
                <View style={[
                    styles.orderCard,
                    { backgroundColor: colors.surface },
                    isInTransit && styles.orderCardInTransit,
                    needsConfirmation && styles.orderCardNeedsAction,
                ]}>
                    {/* Status Accent Bar */}
                    <LinearGradient
                        colors={statusConfig.gradient}
                        style={styles.accentBar}
                    />

                    <View style={styles.cardContent}>
                        {/* Header: Order Number + Status */}
                        <View style={styles.cardHeader}>
                            <View style={styles.orderInfo}>
                                <Animated.View style={[
                                    styles.orderIconBg,
                                    { backgroundColor: statusConfig.bg },
                                    isInTransit && { opacity: pulseOpacity }
                                ]}>
                                    <Text style={styles.orderIcon}>{statusConfig.icon}</Text>
                                </Animated.View>
                                <View>
                                    <Text style={[styles.orderNumber, { color: colors.text }]}>
                                        Order #{item.order_number}
                                    </Text>
                                    <Text style={[styles.garageName, { color: statusConfig.color }]}>
                                        {item.garage_name}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                        </View>

                        {/* Car Info Chip */}
                        <View style={[styles.carChip, { backgroundColor: colors.background }]}>
                            <Text style={styles.carEmoji}>🚗</Text>
                            <Text style={[styles.carText, { color: colors.textSecondary }]}>
                                {item.car_make} {item.car_model} ({item.car_year})
                            </Text>
                        </View>

                        {/* Divider */}
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Footer: Price + Date + Escrow */}
                        <View style={styles.cardFooter}>
                            <View>
                                <Text style={styles.priceLabel}>Total</Text>
                                <Text style={[styles.priceAmount, { color: statusConfig.color }]}>
                                    {item.total_amount} QAR
                                </Text>
                            </View>
                            {/* Escrow Protection Badge */}
                            <View style={styles.escrowBadge}>
                                <Text style={styles.escrowIcon}>🛡️</Text>
                                <Text style={styles.escrowText}>Protected</Text>
                            </View>
                            <View style={styles.dateSection}>
                                <Text style={styles.dateLabel}>Ordered</Text>
                                <Text style={[styles.dateText, { color: colors.text }]}>
                                    {new Date(item.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </Text>
                            </View>
                        </View>

                        {/* Action Banners */}
                        {isInTransit && (
                            <TouchableOpacity
                                style={styles.trackBanner}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onTrack();
                                }}
                            >
                                <LinearGradient
                                    colors={['#22C55E', '#16A34A']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.trackGradient}
                                >
                                    <Animated.View style={[styles.liveDot, { opacity: pulseOpacity }]} />
                                    <Text style={styles.trackText}>🗺️ Track Live Delivery</Text>
                                    <Text style={styles.trackArrow}>→</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {needsConfirmation && (
                            <View style={styles.confirmBanner}>
                                <LinearGradient
                                    colors={['#06B6D4', '#0891B2']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.confirmGradient}
                                >
                                    <Text style={styles.confirmText}>📍 Tap to Confirm Delivery</Text>
                                </LinearGradient>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================
// SKELETON LOADING
// ============================================
const SkeletonCard = ({ index }: { index: number }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1200,
                delay: index * 100,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <View style={styles.skeletonCard}>
            <Animated.View style={[
                styles.skeletonShimmer,
                { transform: [{ translateX: shimmerTranslate }] }
            ]} />
        </View>
    );
};

// ============================================
// MAIN SCREEN
// ============================================
export default function OrdersScreen() {
    const navigation = useNavigation<OrdersScreenNavigationProp>();
    const { colors } = useTheme();
    const { orderUpdates } = useSocketContext();
    const toast = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadOrders = useCallback(async () => {
        try {
            const data = await api.getMyOrders();
            setOrders(data.orders || []);
        } catch (error) {
            console.log('Failed to load orders:', error);
            toast.error('Error', 'Failed to load orders');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadOrders();
        }, [loadOrders])
    );

    useEffect(() => {
        if (orderUpdates.length > 0) {
            loadOrders();
        }
    }, [orderUpdates, loadOrders]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadOrders();
    }, [loadOrders]);

    const handleOrderPress = (order: Order) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('OrderDetail', { orderId: order.order_id });
    };

    const handleTrack = (order: Order) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Tracking', {
            orderId: order.order_id,
            orderNumber: order.order_number,
            deliveryAddress: order.delivery_address,
        });
    };

    const activeOrders = orders.filter(o =>
        !['completed', 'cancelled', 'refunded'].includes(o.order_status)
    );

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={styles.emptyIcon}>📦</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Orders Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your orders will appear here once you accept a bid
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>My Orders</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {orders.length} total orders
                    </Text>
                </View>
                {activeOrders.length > 0 && (
                    <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>{activeOrders.length} active</Text>
                    </View>
                )}
            </View>

            {isLoading ? (
                <View style={styles.skeletonContainer}>
                    {[0, 1, 2, 3].map(i => <SkeletonCard key={i} index={i} />)}
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.order_id}
                    renderItem={({ item, index }) => (
                        <PremiumOrderCard
                            item={item}
                            index={index}
                            colors={colors}
                            onPress={() => handleOrderPress(item)}
                            onTrack={() => handleTrack(item)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={EmptyState}
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={7}
                />
            )}
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        // borderBottomColor set dynamically
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        marginRight: Spacing.xs,
    },
    activeBadgeText: {
        fontSize: FontSizes.xs,
        color: '#16A34A',
        fontWeight: '600',
    },
    listContent: { padding: Spacing.lg },
    skeletonContainer: { padding: Spacing.lg },
    skeletonCard: {
        height: 180,
        backgroundColor: '#E8E8E8',
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    skeletonShimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },

    // Card styles
    cardWrapper: { marginBottom: Spacing.md },
    orderCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        flexDirection: 'row',
        ...Shadows.md,
    },
    orderCardInTransit: {
        shadowColor: '#22C55E',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    orderCardNeedsAction: {
        shadowColor: '#06B6D4',
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    accentBar: { width: 5 },
    cardContent: { flex: 1, padding: Spacing.lg },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    orderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Spacing.md,
        paddingRight: Spacing.sm,
    },
    orderIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        flexShrink: 0,
    },
    orderIcon: { fontSize: 22 },
    orderNumber: { fontSize: FontSizes.lg, fontWeight: '700' },
    garageName: { fontSize: FontSizes.sm, fontWeight: '600', marginTop: 2 },
    statusBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        flexShrink: 0,
    },
    statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
    carChip: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    carEmoji: { fontSize: 16, marginRight: Spacing.sm },
    carText: { fontSize: FontSizes.sm },
    divider: { height: 1, marginBottom: Spacing.md },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    priceLabel: { fontSize: FontSizes.xs, opacity: 0.6 },
    priceAmount: { fontSize: FontSizes.xl, fontWeight: '800' },
    dateSection: { alignItems: 'flex-end' },
    dateLabel: { fontSize: FontSizes.xs, opacity: 0.6 },
    dateText: { fontSize: FontSizes.sm, fontWeight: '600' },

    // Escrow Badge
    escrowBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
        gap: 4,
    },
    escrowIcon: { fontSize: 12 },
    escrowText: { fontSize: FontSizes.xs, color: '#2E7D32', fontWeight: '600' },
    // Banners
    trackBanner: { marginTop: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden' },
    trackGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: Spacing.sm,
    },
    trackText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },
    trackArrow: { color: '#fff', fontSize: FontSizes.lg },
    confirmBanner: { marginTop: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden' },
    confirmGradient: { padding: Spacing.md, alignItems: 'center' },
    confirmText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl * 2,
        paddingHorizontal: Spacing.xl,
    },
    emptyIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyIcon: { fontSize: 48 },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        // color set dynamically
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSizes.md,
        // color set dynamically
        textAlign: 'center',
        lineHeight: 22,
    },
});
