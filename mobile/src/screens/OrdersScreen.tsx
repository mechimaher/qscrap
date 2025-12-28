import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts';
import { orderApi, onOrderStatusUpdated } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows, ORDER_STATUS } from '../constants';
import { SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { useRefresh } from '../hooks';
import { formatCurrency } from '../utils/formatters';

interface Order {
    order_id: string;
    order_number: string;
    order_status: string;
    part_description: string;
    car_make: string;
    car_model: string;
    total_amount: number;
    garage_name: string;
    created_at: string;
}

const OrdersScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const loadOrders = useCallback(async () => {
        try {
            const response = await orderApi.getMyOrders();
            setOrders(response.data.orders || []);
        } catch (error) {
            console.error('Failed to load orders:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Use custom refresh hook with haptic feedback
    const { refreshing, onRefresh } = useRefresh({
        onRefresh: loadOrders,
        hapticFeedback: true,
    });

    useEffect(() => {
        loadOrders();
        const unsubscribe = onOrderStatusUpdated(() => loadOrders());
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [loadOrders]);

    const handleFilterChange = async (newFilter: string) => {
        await Haptics.selectionAsync();
        setFilter(newFilter);
    };

    const handleOrderPress = async (orderId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('OrderDetails', { orderId });
    };

    const getStatusInfo = (status: string) => {
        return ORDER_STATUS[status as keyof typeof ORDER_STATUS] || { label: status, color: 'textSecondary', icon: 'help' };
    };

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'primary' | 'muted' => {
        switch (status) {
            case 'completed':
            case 'delivered':
                return 'success';
            case 'processing':
            case 'out_for_delivery':
                return 'primary';
            case 'cancelled':
            case 'disputed':
                return 'danger';
            case 'pending':
                return 'warning';
            default:
                return 'muted';
        }
    };

    const filteredOrders = orders.filter(o => {
        if (filter === 'all') return true;
        if (filter === 'active') return !['completed', 'cancelled'].includes(o.order_status);
        if (filter === 'completed') return o.order_status === 'completed';
        if (filter === 'cancelled') return o.order_status === 'cancelled';
        return true;
    });

    const renderOrder = ({ item }: { item: Order }) => {
        const statusInfo = getStatusInfo(item.order_status);
        const statusColor = colors[statusInfo.color as keyof typeof colors] || colors.textSecondary;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface }, Shadows.sm]}
                onPress={() => handleOrderPress(item.order_id)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.orderNumber, { color: colors.primary }]}>#{item.order_number}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons name={statusInfo.icon as any} size={14} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusInfo.label}</Text>
                    </View>
                </View>

                <Text style={[styles.partName, { color: colors.text }]} numberOfLines={2}>
                    {item.part_description}
                </Text>

                <View style={styles.details}>
                    <View style={styles.detailRow}>
                        <Ionicons name="car-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {item.car_make} {item.car_model}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {item.garage_name}
                        </Text>
                    </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.price, { color: colors.success }]}>
                        {formatCurrency(item.total_amount)}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderFilters = () => (
        <View style={styles.filters}>
            {['all', 'active', 'completed', 'cancelled'].map(f => (
                <TouchableOpacity
                    key={f}
                    style={[
                        styles.filterBtn,
                        { backgroundColor: filter === f ? colors.primary : colors.surfaceSecondary },
                    ]}
                    onPress={() => handleFilterChange(f)}
                >
                    <Text style={[styles.filterText, { color: filter === f ? '#fff' : colors.textSecondary }]}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderEmpty = () => (
        <EmptyState
            variant={filter === 'all' ? 'default' : 'search'}
            icon={filter === 'all' ? 'cube-outline' : 'filter-outline'}
            title={filter === 'all' ? 'No Orders Yet' : 'No Matching Orders'}
            message={
                filter === 'all'
                    ? 'When you accept a bid, your order will appear here'
                    : 'Try adjusting your filters to see more results'
            }
            actionLabel={filter === 'all' ? 'Browse Requests' : 'Clear Filters'}
            onAction={() => {
                if (filter === 'all') {
                    navigation.navigate('Requests');
                } else {
                    setFilter('all');
                }
            }}
        />
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>My Orders</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {orders.length} order{orders.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {renderFilters()}

            {loading ? (
                <View style={styles.list}>
                    <SkeletonList count={4} />
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={renderOrder}
                    keyExtractor={item => item.order_id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={renderEmpty}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    title: { fontSize: FontSize.xxl, fontWeight: '700' },
    subtitle: { fontSize: FontSize.md, marginTop: Spacing.xs },
    filters: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
    filterBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    filterText: { fontSize: FontSize.sm, fontWeight: '600' },
    list: { padding: Spacing.lg, flexGrow: 1 },
    card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    orderNumber: { fontSize: FontSize.md, fontWeight: '700' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
    statusText: { fontSize: FontSize.xs, fontWeight: '600' },
    partName: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.md },
    details: { gap: Spacing.xs },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    detailText: { fontSize: FontSize.sm },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    price: { fontSize: FontSize.lg, fontWeight: '700' },
});

export default OrdersScreen;
