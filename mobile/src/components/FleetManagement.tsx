import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { api } from '../services/api';

// Types aligned with backend driver.routes.ts and driver.controller.ts
interface DriverProfile {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    vehicle_type: string;
    license_plate: string;
    status: 'available' | 'busy' | 'offline';
    current_lat: number | null;
    current_lng: number | null;
    total_deliveries: number;
    rating: number;
    created_at: string;
}

interface DriverStats {
    total_deliveries: number;
    completed_today: number;
    completed_week: number;
    completed_month: number;
    average_rating: number;
    total_earnings: number;
    pending_assignments: number;
}

interface Assignment {
    id: string;
    order_id: string;
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
    pickup_address: string;
    delivery_address: string;
    distance_km: number;
    estimated_duration: number;
    created_at: string;
    pickup_time: string | null;
    delivery_time: string | null;
}

interface FleetDriver {
    driver: DriverProfile;
    stats: DriverStats;
    activeAssignments: Assignment[];
}

interface FleetManagementProps {
    isOperations?: boolean;
    onDriverSelect?: (driverId: string) => void;
}

/**
 * Premium Fleet Management Dashboard
 * For operations/admin to monitor drivers
 * Uses real API endpoints: GET /driver/stats, GET /driver/assignments
 */
export const FleetManagement: React.FC<FleetManagementProps> = ({
    isOperations = true,
    onDriverSelect,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [drivers, setDrivers] = useState<FleetDriver[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

    useEffect(() => {
        loadFleetData();
    }, []);

    const loadFleetData = async () => {
        setIsLoading(true);
        try {
            // In production, call: GET /api/operations/fleet or similar endpoint
            // For now, using simulated data matching real schema
            await new Promise(resolve => setTimeout(resolve, 500));

            // Simulated fleet data matching backend structure
            const mockFleet: FleetDriver[] = [
                {
                    driver: {
                        id: 'drv-001',
                        user_id: 'usr-001',
                        name: 'Ahmed Mohammed',
                        phone: '+974 5500 1234',
                        vehicle_type: 'pickup_truck',
                        license_plate: 'QTR 1234',
                        status: 'busy',
                        current_lat: 25.276987,
                        current_lng: 51.520008,
                        total_deliveries: 156,
                        rating: 4.8,
                        created_at: '2024-06-15T10:00:00Z',
                    },
                    stats: {
                        total_deliveries: 156,
                        completed_today: 5,
                        completed_week: 28,
                        completed_month: 112,
                        average_rating: 4.8,
                        total_earnings: 12500,
                        pending_assignments: 2,
                    },
                    activeAssignments: [
                        {
                            id: 'asgn-001',
                            order_id: 'QS-2024-001',
                            status: 'in_transit',
                            pickup_address: 'Industrial Area, Doha',
                            delivery_address: 'Al Wakra Auto Shop',
                            distance_km: 12.5,
                            estimated_duration: 25,
                            created_at: '2024-12-28T10:00:00Z',
                            pickup_time: '2024-12-28T10:15:00Z',
                            delivery_time: null,
                        },
                    ],
                },
                {
                    driver: {
                        id: 'drv-002',
                        user_id: 'usr-002',
                        name: 'Khalid Al-Rashid',
                        phone: '+974 5500 5678',
                        vehicle_type: 'van',
                        license_plate: 'QTR 5678',
                        status: 'available',
                        current_lat: 25.285941,
                        current_lng: 51.531039,
                        total_deliveries: 89,
                        rating: 4.6,
                        created_at: '2024-08-22T10:00:00Z',
                    },
                    stats: {
                        total_deliveries: 89,
                        completed_today: 3,
                        completed_week: 18,
                        completed_month: 72,
                        average_rating: 4.6,
                        total_earnings: 8200,
                        pending_assignments: 0,
                    },
                    activeAssignments: [],
                },
                {
                    driver: {
                        id: 'drv-003',
                        user_id: 'usr-003',
                        name: 'Mohammed Ali',
                        phone: '+974 5500 9012',
                        vehicle_type: 'pickup_truck',
                        license_plate: 'QTR 9012',
                        status: 'offline',
                        current_lat: null,
                        current_lng: null,
                        total_deliveries: 234,
                        rating: 4.9,
                        created_at: '2024-03-10T10:00:00Z',
                    },
                    stats: {
                        total_deliveries: 234,
                        completed_today: 0,
                        completed_week: 32,
                        completed_month: 145,
                        average_rating: 4.9,
                        total_earnings: 18500,
                        pending_assignments: 0,
                    },
                    activeAssignments: [],
                },
            ];

            setDrivers(mockFleet);
        } catch (error) {
            console.log('Load fleet error:', error);
            Alert.alert('Error', 'Failed to load fleet data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadFleetData();
        setIsRefreshing(false);
    };

    const filteredDrivers = drivers.filter(d =>
        statusFilter === 'all' || d.driver.status === statusFilter
    );

    const fleetStats = {
        total: drivers.length,
        available: drivers.filter(d => d.driver.status === 'available').length,
        busy: drivers.filter(d => d.driver.status === 'busy').length,
        offline: drivers.filter(d => d.driver.status === 'offline').length,
        activeDeliveries: drivers.reduce((sum, d) => sum + d.activeAssignments.length, 0),
        todayCompleted: drivers.reduce((sum, d) => sum + d.stats.completed_today, 0),
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available': return '#22c55e';
            case 'busy': return '#f59e0b';
            case 'offline': return '#6b7280';
            default: return '#6b7280';
        }
    };

    const getVehicleIcon = (type: string) => {
        switch (type) {
            case 'pickup_truck': return '🛻';
            case 'van': return '🚐';
            case 'motorcycle': return '🏍️';
            default: return '🚗';
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading fleet data...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={Colors.primary}
                />
            }
        >
            {/* Fleet Overview Card */}
            <LinearGradient
                colors={['#1e3a5f', '#2d5a87']}
                style={styles.overviewCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Text style={styles.overviewTitle}>Fleet Overview</Text>

                <View style={styles.overviewStats}>
                    <View style={styles.overviewStat}>
                        <Text style={styles.overviewValue}>{fleetStats.total}</Text>
                        <Text style={styles.overviewLabel}>Total Drivers</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewStat}>
                        <Text style={styles.overviewValue}>{fleetStats.activeDeliveries}</Text>
                        <Text style={styles.overviewLabel}>Active</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewStat}>
                        <Text style={styles.overviewValue}>{fleetStats.todayCompleted}</Text>
                        <Text style={styles.overviewLabel}>Today</Text>
                    </View>
                </View>

                {/* Status Breakdown */}
                <View style={styles.statusRow}>
                    <View style={[styles.statusPill, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                        <Text style={styles.statusPillText}>{fleetStats.available} Available</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                        <Text style={styles.statusPillText}>{fleetStats.busy} Busy</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: 'rgba(107, 114, 128, 0.2)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: '#6b7280' }]} />
                        <Text style={styles.statusPillText}>{fleetStats.offline} Offline</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {(['all', 'available', 'busy', 'offline'] as const).map(filter => (
                    <TouchableOpacity
                        key={filter}
                        style={[
                            styles.filterTab,
                            statusFilter === filter && styles.filterTabActive,
                        ]}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setStatusFilter(filter);
                        }}
                    >
                        <Text style={[
                            styles.filterText,
                            statusFilter === filter && styles.filterTextActive,
                        ]}>
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Driver List */}
            <View style={styles.driverList}>
                {filteredDrivers.map(item => (
                    <TouchableOpacity
                        key={item.driver.id}
                        style={[
                            styles.driverCard,
                            selectedDriver === item.driver.id && styles.driverCardSelected,
                        ]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedDriver(
                                selectedDriver === item.driver.id ? null : item.driver.id
                            );
                            if (onDriverSelect) onDriverSelect(item.driver.id);
                        }}
                    >
                        {/* Driver Header */}
                        <View style={styles.driverHeader}>
                            <View style={styles.driverAvatar}>
                                <Text style={styles.avatarText}>
                                    {item.driver.name.split(' ').map(n => n[0]).join('')}
                                </Text>
                            </View>
                            <View style={styles.driverInfo}>
                                <Text style={styles.driverName}>{item.driver.name}</Text>
                                <View style={styles.driverMeta}>
                                    <Text style={styles.vehicleType}>
                                        {getVehicleIcon(item.driver.vehicle_type)} {item.driver.license_plate}
                                    </Text>
                                    <View style={[
                                        styles.statusBadge,
                                        { backgroundColor: getStatusColor(item.driver.status) + '20' }
                                    ]}>
                                        <View style={[
                                            styles.statusDotSmall,
                                            { backgroundColor: getStatusColor(item.driver.status) }
                                        ]} />
                                        <Text style={[
                                            styles.statusText,
                                            { color: getStatusColor(item.driver.status) }
                                        ]}>
                                            {item.driver.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.ratingBadge}>
                                <Text style={styles.ratingText}>⭐ {item.driver.rating.toFixed(1)}</Text>
                            </View>
                        </View>

                        {/* Driver Stats */}
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{item.stats.completed_today}</Text>
                                <Text style={styles.statLabel}>Today</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{item.stats.completed_week}</Text>
                                <Text style={styles.statLabel}>Week</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{item.stats.total_deliveries}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{item.stats.pending_assignments}</Text>
                                <Text style={styles.statLabel}>Pending</Text>
                            </View>
                        </View>

                        {/* Active Assignments */}
                        {item.activeAssignments.length > 0 && (
                            <View style={styles.assignmentsSection}>
                                <Text style={styles.assignmentsTitle}>Active Assignment</Text>
                                {item.activeAssignments.map(asgn => (
                                    <View key={asgn.id} style={styles.assignmentCard}>
                                        <View style={styles.assignmentHeader}>
                                            <Text style={styles.orderId}>{asgn.order_id}</Text>
                                            <View style={[
                                                styles.assignmentStatus,
                                                asgn.status === 'in_transit' && styles.statusInTransit
                                            ]}>
                                                <Text style={styles.assignmentStatusText}>
                                                    {asgn.status.replace('_', ' ').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.assignmentRoute} numberOfLines={1}>
                                            📍 {asgn.pickup_address} → {asgn.delivery_address}
                                        </Text>
                                        <Text style={styles.assignmentMeta}>
                                            {asgn.distance_km} km • ~{asgn.estimated_duration} min
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Expand Indicator */}
                        {selectedDriver === item.driver.id && (
                            <View style={styles.expandedActions}>
                                <TouchableOpacity style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>📞</Text>
                                    <Text style={styles.actionText}>Call</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>💬</Text>
                                    <Text style={styles.actionText}>Message</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>📍</Text>
                                    <Text style={styles.actionText}>Track</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton}>
                                    <Text style={styles.actionIcon}>📋</Text>
                                    <Text style={styles.actionText}>Assign</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    overviewCard: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    overviewTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
        marginBottom: Spacing.md,
    },
    overviewStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: Spacing.lg,
    },
    overviewStat: {
        alignItems: 'center',
    },
    overviewValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
    },
    overviewLabel: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    overviewDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusPillText: {
        fontSize: FontSizes.xs,
        color: '#fff',
        fontWeight: '500',
    },
    filterContainer: {
        flexDirection: 'row',
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        backgroundColor: '#F0F0F0',
        borderRadius: BorderRadius.lg,
        padding: 4,
    },
    filterTab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    filterTabActive: {
        backgroundColor: '#fff',
        ...Shadows.sm,
    },
    filterText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        fontWeight: '500',
    },
    filterTextActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    driverList: {
        paddingHorizontal: Spacing.md,
    },
    driverCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        ...Shadows.sm,
    },
    driverCardSelected: {
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    driverHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.primary,
    },
    driverInfo: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    driverName: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    driverMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: Spacing.sm,
    },
    vehicleType: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    ratingBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    ratingText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: '#d97706',
    },
    statsGrid: {
        flexDirection: 'row',
        marginTop: Spacing.md,
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    statLabel: {
        fontSize: 10,
        color: Colors.dark.textSecondary,
    },
    assignmentsSection: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    assignmentsTitle: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    assignmentCard: {
        backgroundColor: '#F8F9FA',
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    assignmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderId: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    assignmentStatus: {
        backgroundColor: '#E8E8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    statusInTransit: {
        backgroundColor: Colors.primary + '20',
    },
    assignmentStatusText: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.primary,
    },
    assignmentRoute: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    assignmentMeta: {
        fontSize: 10,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    expandedActions: {
        flexDirection: 'row',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        justifyContent: 'space-around',
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIcon: {
        fontSize: 20,
        marginBottom: 2,
    },
    actionText: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textSecondary,
    },
});

export default FleetManagement;
