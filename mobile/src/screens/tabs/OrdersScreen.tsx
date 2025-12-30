// QScrap Orders Screen - Premium VIP Design
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
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
import { LoadingList } from '../../components/SkeletonLoading';
import { useSocketContext } from '../../hooks/useSocket';

type OrdersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

export default function OrdersScreen() {
    const navigation = useNavigation<OrdersScreenNavigationProp>();
    const { colors } = useTheme();
    const { orderUpdates } = useSocketContext();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadOrders = useCallback(async () => {
        try {
            const data = await api.getMyOrders();
            setOrders(data.orders || []);
        } catch (error) {
            console.log('Failed to load orders:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Auto-refresh when screen gains focus (e.g., after order status changes)
    useFocusEffect(
        useCallback(() => {
            loadOrders();
        }, [loadOrders])
    );

    // Real-time: Reload when socket receives order status update
    useEffect(() => {
        if (orderUpdates.length > 0) {
            console.log('[OrdersScreen] Socket order update received, refreshing...');
            loadOrders();
        }
    }, [orderUpdates, loadOrders]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadOrders();
    }, []);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'confirmed': return { color: '#3B82F6', bg: '#DBEAFE', icon: '✓', label: 'Confirmed' };
            case 'preparing': return { color: '#F59E0B', bg: '#FEF3C7', icon: '🔧', label: 'Preparing' };
            case 'ready_for_pickup': return { color: '#8B5CF6', bg: '#EDE9FE', icon: '📦', label: 'Ready' };
            // Internal QC statuses - show as "In Transit" to customers
            case 'collected': return { color: Colors.primary, bg: Colors.primary + '20', icon: '🚚', label: 'In Transit' };
            case 'qc_in_progress': return { color: Colors.primary, bg: Colors.primary + '20', icon: '🚚', label: 'In Transit' };
            case 'qc_passed': return { color: Colors.primary, bg: Colors.primary + '20', icon: '🚚', label: 'In Transit' };
            case 'qc_failed': return { color: '#F59E0B', bg: '#FEF3C7', icon: '⏳', label: 'Processing' };
            case 'in_transit': return { color: Colors.primary, bg: Colors.primary + '20', icon: '🚗', label: 'On The Way' };
            case 'delivered': return { color: '#22C55E', bg: '#DCFCE7', icon: '📍', label: 'Delivered' };
            case 'completed': return { color: '#22C55E', bg: '#DCFCE7', icon: '✅', label: 'Completed' };
            default: return { color: '#6B7280', bg: '#F3F4F6', icon: '•', label: status };
        }
    };

    const renderOrder = ({ item }: { item: Order }) => {
        const statusConfig = getStatusConfig(item.order_status);

        return (
            <TouchableOpacity
                style={[styles.orderCard, { backgroundColor: colors.surface }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('OrderDetail', { orderId: item.order_id });
                }}
                activeOpacity={0.8}
            >
                {/* Order Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.orderInfo}>
                        <View style={styles.orderIconBg}>
                            <Text style={styles.orderIcon}>📦</Text>
                        </View>
                        <View>
                            <Text style={[styles.orderNumber, { color: colors.text }]}>Order #{item.order_number}</Text>
                            <Text style={styles.garageName}>{item.garage_name}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.icon} {statusConfig.label}
                        </Text>
                    </View>
                </View>

                {/* Car Info */}
                <View style={[styles.carInfo, { backgroundColor: colors.background }]}>
                    <Text style={styles.carEmoji}>🚗</Text>
                    <Text style={[styles.carText, { color: colors.textSecondary }]}>{item.car_make} {item.car_model} ({item.car_year})</Text>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                {/* Footer with Price */}
                <View style={styles.cardFooter}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalAmount}>{item.total_amount} QAR</Text>
                    </View>
                    <View style={styles.dateContainer}>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Ordered</Text>
                        <Text style={[styles.dateText, { color: colors.text }]}>
                            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {/* Live Tracking Banner */}
                {item.order_status === 'in_transit' && (
                    <TouchableOpacity
                        style={styles.trackingBanner}
                        onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Tracking', {
                                orderId: item.order_id,
                                orderNumber: item.order_number,
                                deliveryAddress: item.delivery_address,
                            });
                        }}
                    >
                        <LinearGradient
                            colors={[Colors.primary, '#B31D4A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.trackingGradient}
                        >
                            <Text style={styles.trackingIcon}>🗺️</Text>
                            <Text style={styles.trackingText}>Track Live Delivery</Text>
                            <Text style={styles.trackingArrow}>→</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
            </View>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>Your orders will appear here once you accept a bid from a garage</Text>
            <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('Main', { screen: 'Home' } as any)}
            >
                <Text style={styles.emptyButtonText}>Browse Requests</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Premium Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>My Orders</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{orders.length} total orders</Text>
                </View>
                <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>📦 {orders.filter(o =>
                        !['completed', 'cancelled', 'refunded', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_operations'].includes(o.order_status)
                    ).length} active</Text>
                </View>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <LoadingList count={4} />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.order_id}
                    renderItem={renderOrder}
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
                    // Performance optimizations
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={7}
                    removeClippedSubviews={true}
                    updateCellsBatchingPeriod={50}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.dark.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    headerBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    headerBadgeText: {
        fontSize: FontSizes.xs,
        color: '#22C55E',
        fontWeight: '600',
    },
    loadingContainer: {
        padding: Spacing.lg,
    },
    listContent: {
        padding: Spacing.lg,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
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
    },
    orderIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    orderIcon: {
        fontSize: 22,
    },
    orderNumber: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    garageName: {
        fontSize: FontSizes.sm,
        color: Colors.primary,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    carInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    carEmoji: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    carText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: Spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceContainer: {},
    totalLabel: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textSecondary,
    },
    totalAmount: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.primary,
    },
    dateContainer: {
        alignItems: 'flex-end',
    },
    dateLabel: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textSecondary,
    },
    dateText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    trackingBanner: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    trackingGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
    },
    trackingIcon: {
        fontSize: 18,
        marginRight: Spacing.sm,
    },
    trackingText: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
    },
    trackingArrow: {
        fontSize: FontSizes.lg,
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl * 2,
        paddingHorizontal: Spacing.xl,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyIcon: {
        fontSize: 48,
    },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    emptyButton: {
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    emptyButtonText: {
        color: Colors.dark.text,
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
});
