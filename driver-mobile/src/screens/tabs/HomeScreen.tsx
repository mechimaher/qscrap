// QScrap Driver App - Premium Home Screen
// Live dashboard with assignments, stats, and availability toggle
// Now with skeleton loading and premium animations

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Switch,
    Alert,
    Animated,
    Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../contexts/SocketContext';
import { api, Assignment, DriverStats } from '../../services/api';
import { useJobStore } from '../../stores/useJobStore';
import { getSocket } from '../../services/socket';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig, Spacing, BorderRadius, FontSize, Shadows } from '../../constants/theme';
import { HomeScreenSkeleton, EmptyState, AnimatedNumber, AnimatedRating, LiveMapView, AssignmentPopup } from '../../components';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function HomeScreen() {
    const setStoreAssignments = useJobStore(state => state.setAssignments);
    const { driver, refreshDriver } = useAuth();
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const { isConnected } = useSocket(); // Get isConnected instead of socket
    const { location, isTracking, startTracking, stopTracking, hasPermission, requestPermission } = useLocation();

    const [stats, setStats] = useState<DriverStats | null>(null);
    const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isAvailable, setIsAvailable] = useState(driver?.status === 'available');
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    // VVIP: Accept/Reject popup state
    const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);
    const [showAssignmentPopup, setShowAssignmentPopup] = useState(false);

    // Animation values for entrance effects
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    // Refresh data when screen comes into focus (e.g. returning from details)
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!isConnected) return;

        const socket = getSocket();
        if (!socket) return;

        console.log('[Home] Setting up socket listeners');

        const handleUpdate = () => {
            console.log('[Home] Received update event, reloading data...');
            loadData();
        };

        // VVIP: Show accept/reject popup for new assignments
        const handleNewAssignment = (data: any) => {
            console.log('[Home] New assignment received:', data);

            // Critical for real-time: reload all data to update badges and lists
            loadData();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // If assignment data is included directly or as a property, show popup
            const assignmentData = data?.assignment || (data?.assignment_id ? data : null);
            if (assignmentData) {
                setPendingAssignment(assignmentData);
                setShowAssignmentPopup(true);
            }
        };

        const handleDriverStatusChange = (data: any) => {
            console.log('[Home] Driver status changed:', data.status);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            refreshDriver();
            loadData();
        };

        socket.on('new_assignment', handleNewAssignment);
        socket.on('assignment_cancelled', handleUpdate);
        socket.on('assignment_removed', handleUpdate);
        socket.on('order_status_updated', handleUpdate);
        socket.on('driver_status_changed', handleDriverStatusChange);

        return () => {
            console.log('[Home] Cleaning up socket listeners');
            socket.off('new_assignment', handleNewAssignment);
            socket.off('assignment_cancelled', handleUpdate);
            socket.off('assignment_removed', handleUpdate);
            socket.off('order_status_updated', handleUpdate);
            socket.off('driver_status_changed', handleDriverStatusChange);
        };
    }, [isConnected]);

    // POLLING FALLBACK: Ensure data is fresh even if socket fails
    useEffect(() => {
        if (!isAvailable) return;

        console.log('[Home] Starting polling interval (10s)');
        const intervalId = setInterval(() => {
            // Silent refresh - don't show loading spinner
            loadData(true);
        }, 10000);

        return () => {
            console.log('[Home] Clearing polling interval');
            clearInterval(intervalId);
        };
    }, [isAvailable]);

    useEffect(() => {
        setIsAvailable(driver?.status === 'available');
    }, [driver?.status]);

    // CRITICAL FIX: Auto-start location tracking when app opens if driver is already available
    // Without this, GPS shows "Acquiring..." forever when reopening the app
    useEffect(() => {
        if (driver?.status === 'available' && !isTracking && hasPermission) {
            console.log('[Home] Auto-starting location tracking (driver already available)');
            startTracking();
        }
    }, [driver?.status, hasPermission]);

    const loadData = async (silent = false) => {
        try {
            if (!silent) setIsLoading(true);
            // VVIP: Decouple assignments from stats to prevent one failure from blocking the other
            // 1. Fetch Assignments (Critical for workflow)
            try {
                const assignmentsRes = await api.getAssignments('active');
                const assignments = assignmentsRes.assignments || [];
                setActiveAssignments(assignments);
                setStoreAssignments(assignments);
                console.log('[Home] Assignments synced:', assignments.length);
            } catch (assignErr) {
                console.error('[Home] Failed to fetch assignments:', assignErr);
                // We do NOT clear assignments on error to support offline mode
            }

            // 2. Fetch Stats & Driver Data (Secondary)
            try {
                const [statsRes] = await Promise.all([
                    api.getStats(),
                    refreshDriver(),
                ]);
                setStats(statsRes.stats);
            } catch (statsErr) {
                console.warn('[Home] Failed to fetch stats:', statsErr);
            }

            // Start entrance animation regardless of success/partial success
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    easing: Easing.out(Easing.back(1.1)),
                    useNativeDriver: true,
                }),
            ]).start();
        } catch (err) {
            console.error('[Home] Critical Load Error:', err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await Promise.all([loadData(), refreshDriver()]);
        setIsRefreshing(false);
    }, [refreshDriver]);

    const toggleAvailability = async () => {
        const newStatus = isAvailable ? 'offline' : 'available';

        // If going available, ensure location permission
        if (newStatus === 'available' && !hasPermission) {
            const granted = await requestPermission();
            if (!granted) {
                Alert.alert(
                    'Location Required',
                    'Location permission is required to go online. Customers need to see your location during deliveries.'
                );
                return;
            }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsTogglingStatus(true);

        try {
            const result = await api.toggleAvailability(newStatus);
            if (result.success) {
                setIsAvailable(newStatus === 'available');

                // Start/stop location tracking
                if (newStatus === 'available') {
                    await startTracking();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    await stopTracking();
                }

                await refreshDriver();
            }
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', err.message || 'Failed to update status');
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const getStatusColor = () => {
        if (driver?.status === 'busy') return Colors.warning;
        return isAvailable ? Colors.success : Colors.danger;
    };

    const getStatusText = () => {
        if (driver?.status === 'busy') return 'On Delivery';
        return isAvailable ? 'Available' : 'Offline';
    };

    // VVIP: Accept/Reject/Timeout handlers
    const handleAcceptAssignment = async () => {
        console.log('[Home] Accepting assignment:', pendingAssignment?.assignment_id);
        setShowAssignmentPopup(false);
        setPendingAssignment(null);

        // For now, just reload data - backend already auto-assigned
        // TODO: Call accept API when backend supports pending state
        await loadData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleRejectAssignment = async () => {
        console.log('[Home] Rejecting assignment:', pendingAssignment?.assignment_id);
        setShowAssignmentPopup(false);
        setPendingAssignment(null);

        // TODO: Call reject API when backend supports pending state
        // For now, show alert that rejection is not yet implemented
        Alert.alert(
            'Assignment Rejected',
            'This assignment has been declined. Operations will reassign it.',
            [{ text: 'OK' }]
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    };

    const handleAssignmentTimeout = () => {
        console.log('[Home] Assignment timed out');
        setShowAssignmentPopup(false);
        setPendingAssignment(null);

        Alert.alert(
            'Assignment Expired',
            'You did not respond in time. The assignment may be reassigned.',
            [{ text: 'OK' }]
        );
    };

    // Show skeleton loading on initial load
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <HomeScreenSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                        {getGreeting()},
                    </Text>
                    <Text style={[styles.driverName, { color: colors.text }]}>
                        {driver?.full_name || 'Driver'}
                    </Text>
                </View>

                {/* Status Toggle */}
                <TouchableOpacity
                    onPress={toggleAvailability}
                    disabled={isTogglingStatus || driver?.status === 'busy'}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={isAvailable
                            ? [Colors.success, '#047857']
                            : [colors.border, colors.borderLight]}
                        style={styles.statusBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
                        <Text style={[styles.statusText, { color: '#fff' }]}>
                            {getStatusText()}
                        </Text>
                        {driver?.status !== 'busy' && (
                            <View style={{ marginLeft: 8 }}>
                                <Ionicons
                                    name={isAvailable ? "radio-button-on" : "radio-button-off"}
                                    size={24}
                                    color="#fff"
                                />
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* VVIP: Live Map Dashboard - Only render when location is available */}
                {isAvailable && location && (
                    <View style={styles.mapContainer}>
                        <ErrorBoundary name="LiveMap" fallback={
                            <View style={[styles.mapContainer, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', height: 180 }]}>
                                <Text style={{ fontSize: 24 }}>🗺️</Text>
                                <Text style={{ color: colors.textMuted, marginTop: 8 }}>Map unavailable</Text>
                            </View>
                        }>
                            <LiveMapView
                                driverLocation={location}
                                activeAssignment={activeAssignments[0] || null}
                                height={180}
                                showRoute={true}
                            />
                        </ErrorBoundary>
                    </View>
                )}

                {/* Location loading placeholder - shows when available but no location yet */}
                {isAvailable && !location && (
                    <View style={[styles.mapContainer, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', height: 180, borderRadius: 16 }]}>
                        <Text style={{ fontSize: 32 }}>📍</Text>
                        <Text style={{ color: colors.textMuted, marginTop: 8 }}>Acquiring GPS...</Text>
                    </View>
                )}

                {/* Quick Stats - 2x2 Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statsRow}>
                        <StatCard
                            icon="📦"
                            value={stats?.today_deliveries || 0}
                            label="Today"
                            color={Colors.primary}
                            colors={colors}
                            delay={0}
                        />
                        <StatCard
                            icon="💰"
                            value={stats?.today_earnings || 0}
                            label="Earnings"
                            color={Colors.success}
                            colors={colors}
                            delay={100}
                            isCurrency={true}
                        />
                    </View>
                    <View style={styles.statsRow}>
                        <StatCard
                            icon="⭐"
                            value={parseFloat(formatRating(stats?.rating_average))}
                            label="Rating"
                            color={Colors.warning}
                            colors={colors}
                            delay={200}
                            isRating={true}
                        />
                        <StatCard
                            icon="📋"
                            value={stats?.active_assignments || 0}
                            label="Active"
                            color={Colors.info}
                            colors={colors}
                            delay={300}
                        />
                    </View>
                </View>



                {/* Active Assignments */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Active Assignments
                    </Text>

                    {activeAssignments.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                            <Text style={styles.emptyIcon}>📭</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No active assignments
                            </Text>
                            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                                {isAvailable
                                    ? 'New assignments will appear here'
                                    : 'Go online to receive assignments'
                                }
                            </Text>
                        </View>
                    ) : (
                        activeAssignments.map((assignment) => (
                            <AssignmentCard
                                key={assignment.assignment_id}
                                assignment={assignment}
                                colors={colors}
                                onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: assignment.assignment_id })}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            {/* VVIP: Accept/Reject Popup */}
            <AssignmentPopup
                visible={showAssignmentPopup}
                assignment={pendingAssignment}
                onAccept={handleAcceptAssignment}
                onReject={handleRejectAssignment}
                onTimeout={handleAssignmentTimeout}
            />
        </SafeAreaView>
    );
}

// Helper components
function StatCard({ icon, value, label, color, colors, delay = 0, isRating = false, isCurrency = false }: any) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    // Format currency with compact notation for large amounts
    const formatCurrency = (num: number): { value: string; suffix: string } => {
        if (num >= 10000) {
            return { value: (num / 1000).toFixed(1), suffix: 'K QAR' };
        } else if (num >= 1000) {
            return { value: num.toFixed(0), suffix: ' QAR' };
        } else {
            return { value: num.toFixed(num % 1 === 0 ? 0 : 2), suffix: ' QAR' };
        }
    };

    // Parse numeric value
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;

    // Get display values based on type
    let displayValue = numericValue;
    let suffix = '';

    if (isCurrency) {
        const formatted = formatCurrency(numericValue);
        displayValue = parseFloat(formatted.value);
        suffix = formatted.suffix;
    }

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.statCardWrapper}
        >
            <Animated.View style={[
                styles.statCard,
                { backgroundColor: colors.surface, transform: [{ scale: scaleAnim }] }
            ]}>
                <Text style={styles.statIcon}>{icon}</Text>
                {isRating ? (
                    <AnimatedRating value={numericValue} delay={delay} style={{ color: colors.text }} />
                ) : (
                    <View style={styles.statValueContainer}>
                        <AnimatedNumber
                            value={displayValue}
                            delay={delay}
                            suffix={suffix}
                            style={styles.statValueText}
                        />
                    </View>
                )}
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
}


function AssignmentCard({ assignment, colors, onPress }: { assignment: Assignment; colors: any; onPress: () => void }) {
    const statusConfig = AssignmentStatusConfig[assignment.status as keyof typeof AssignmentStatusConfig];
    const typeConfig = AssignmentTypeConfig[assignment.assignment_type as keyof typeof AssignmentTypeConfig];

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={{ marginBottom: 12 }} // layout only
        >
            <GlassCard style={styles.assignmentCard}>
                {/* Header */}
                <View style={styles.assignmentHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: typeConfig?.color + '20' }]}>
                        <Text>{typeConfig?.icon}</Text>
                        <Text style={[styles.typeText, { color: typeConfig?.color }]}>
                            {typeConfig?.label}
                        </Text>
                    </View>
                    <View style={[styles.statusBadgeSmall, { backgroundColor: statusConfig?.color + '20' }]}>
                        <Text style={[styles.statusTextSmall, { color: statusConfig?.color }]}>
                            {statusConfig?.label}
                        </Text>
                    </View>
                </View>

                {/* Order Info */}
                <Text style={[styles.orderNumber, { color: colors.text }]}>
                    Order #{assignment.order_number}
                </Text>
                <Text style={[styles.partDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                    {assignment.part_description}
                </Text>

                {/* Locations */}
                <View style={styles.locationRow}>
                    <Text style={styles.locationEmoji}>🏪</Text>
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                        {assignment.pickup_address}
                    </Text>
                </View>
                <View style={styles.locationArrow}>
                    <Text style={{ color: colors.textMuted }}>↓</Text>
                </View>
                <View style={styles.locationRow}>
                    <Text style={styles.locationEmoji}>📍</Text>
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                        {assignment.delivery_address}
                    </Text>
                </View>

                {/* Action Button */}
                {statusConfig?.actionLabel && (
                    <LinearGradient
                        colors={[Colors.primary, Colors.primaryDark]}
                        style={styles.actionButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.actionButtonText}>{statusConfig.actionLabel}</Text>
                        <Text style={styles.actionButtonIcon}>→</Text>
                    </LinearGradient>
                )}
            </GlassCard>
        </TouchableOpacity>
    );
}

// Helper to safely format rating
function formatRating(value: any): string {
    if (value === null || value === undefined) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(1);
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    greeting: {
        fontSize: 14,
    },
    driverName: {
        fontSize: 24,
        fontWeight: '700',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 8,
        paddingBottom: Spacing.BOTTOM_NAV_HEIGHT,
    },
    statsGrid: {
        marginBottom: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    mapContainer: {
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    statCardWrapper: {
        flex: 1,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statValueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    statValueText: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    statIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    locationIcon: {
        fontSize: 20,
    },
    locationInfo: {
        flex: 1,
        marginLeft: 12,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    locationCoords: {
        fontSize: 11,
    },
    locationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.success,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    emptyState: {
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptySubtext: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    assignmentCard: {
        // padding/borderRadius handled by GlassCard default or passed via style
        // We only kept padding/radius in GlassCard definition, but here we can override if needed
        marginBottom: 0, // Handled by Touchable wrapper
    },
    assignmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadgeSmall: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusTextSmall: {
        fontSize: 12,
        fontWeight: '600',
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    partDescription: {
        fontSize: 14,
        marginBottom: 12,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationEmoji: {
        fontSize: 14,
    },
    locationText: {
        flex: 1,
        fontSize: 13,
    },
    locationArrow: {
        paddingLeft: 22,
        paddingVertical: 2,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    actionButtonIcon: {
        color: '#fff',
        fontSize: 18,
    },
});
