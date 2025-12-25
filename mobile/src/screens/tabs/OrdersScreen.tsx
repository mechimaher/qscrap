// QScrap Orders Screen - View and track orders
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { api, Order } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { LoadingList } from '../../components/SkeletonLoading';

type OrdersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function OrdersScreen() {
    const navigation = useNavigation<OrdersScreenNavigationProp>();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadOrders = async () => {
        try {
            const data = await api.getMyOrders();
            setOrders(data.orders || []);
        } catch (error) {
            console.log('Failed to load orders:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadOrders();
    }, []);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'confirmed': return { color: Colors.info, icon: '✓', label: 'Confirmed' };
            case 'preparing': return { color: Colors.warning, icon: '🔧', label: 'Preparing' };
            case 'ready_for_pickup': return { color: Colors.info, icon: '📦', label: 'Ready' };
            case 'picked_up': return { color: Colors.info, icon: '🚚', label: 'Picked Up' };
            case 'in_transit': return { color: Colors.primary, icon: '🚗', label: 'On The Way' };
            case 'delivered': return { color: Colors.success, icon: '📍', label: 'Delivered' };
            case 'completed': return { color: Colors.success, icon: '✅', label: 'Completed' };
            default: return { color: Colors.dark.textMuted, icon: '•', label: status };
        }
    };

    const renderOrder = ({ item }: { item: Order }) => {
        const statusInfo = getStatusInfo(item.order_status);

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('OrderDetail', { orderId: item.order_id });
                }}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.orderNumber}>#{item.order_number}</Text>
                        <Text style={styles.garageName}>{item.garage_name}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                        <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.carInfo}>
                    <Text style={styles.carText}>{item.car_make} {item.car_model} ({item.car_year})</Text>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.priceInfo}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalAmount}>{item.total_amount} QAR</Text>
                    </View>
                    <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>

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
                        <Text style={styles.trackingIcon}>🗺️</Text>
                        <Text style={styles.trackingText}>Open Live Map</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>Your orders will appear here once you accept a bid</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Orders</Text>
            </View>

            {isLoading ? (
                <LoadingList count={4} />
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
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        padding: Spacing.lg,
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: 0,
    },
    orderCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    orderNumber: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    garageName: {
        fontSize: FontSizes.sm,
        color: Colors.primary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    statusIcon: {
        fontSize: 12,
        marginRight: Spacing.xs,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    carInfo: {
        marginBottom: Spacing.md,
    },
    carText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginRight: Spacing.xs,
    },
    totalAmount: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.primary,
    },
    dateText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textMuted,
    },
    trackingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary + '20',
        marginTop: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
    },
    trackingIcon: {
        fontSize: 16,
        marginRight: Spacing.xs,
    },
    trackingText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: Spacing.md,
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
    },
});
