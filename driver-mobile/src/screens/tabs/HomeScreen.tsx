// QScrap Driver App - Premium Home Screen
// Live dashboard with assignments, stats, and availability toggle
// REFACTORED: Components extracted to /components/home/

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
import { getSocket, updateActiveOrders } from '../../services/socket';
import { Colors, Spacing } from '../../constants/theme';
import { HomeScreenSkeleton, LiveMapView, AssignmentPopup, StatCard, AssignmentCard } from '../../components';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useI18n } from '../../i18n';

export default function HomeScreen() {
    const setStoreAssignments = useJobStore(state => state.setAssignments);
    const { t } = useI18n();
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
        }, [isAvailable])
    );

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!isConnected) return;

        const socket = getSocket();
        if (!socket) return;


        const handleUpdate = () => {
            loadData();
        };

        // VVIP: Show accept/reject popup for new assignments — INSTANT (Talabat/Uber pattern)
        const handleNewAssignment = (data: any) => {

            // Direct state injection — no API round-trip (0ms vs 200-2000ms)
            const assignmentData = data?.assignment || (data?.assignment_id ? data : null);
            if (assignmentData) {
                // Inject into active assignments list instantly
                setActiveAssignments(prev => {
                    const exists = prev.some(a => a.assignment_id === assignmentData.assignment_id);
                    return exists ? prev : [assignmentData, ...prev];
                });
                // Show the accept/reject popup immediately
                setPendingAssignment(assignmentData);
                setShowAssignmentPopup(true);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Background sync after 2s to get any missing fields
            setTimeout(() => loadData(true), 2000);
        };

        const handleDriverStatusChange = (data: any) => {
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
            socket.off('new_assignment', handleNewAssignment);
            socket.off('assignment_cancelled', handleUpdate);
            socket.off('assignment_removed', handleUpdate);
            socket.off('order_status_updated', handleUpdate);
            socket.off('driver_status_changed', handleDriverStatusChange);
        };
    }, [isConnected]);

    // P2 FIX: SMART POLLING - Adaptive interval based on socket health
    // When socket is healthy → Poll every 60s (battery friendly)
    // When socket fails → Start at 15s, increase to 30s, max 60s (backoff)
    useEffect(() => {
        if (!isAvailable) return;

        const getPollingInterval = () => {
            // If socket is connected and working, we can afford to poll less frequently
            if (isConnected) {
                return 60000; // 1 minute when socket is healthy (battery saver)
            }
            // Socket disconnected - use medium polling
            return 30000; // 30 seconds as fallback
        };

        const interval = getPollingInterval();

        const intervalId = setInterval(() => {
            // Silent refresh - don't show loading spinner
            loadData(true);
        }, interval);

        return () => {
            clearInterval(intervalId);
        };
    }, [isAvailable, isConnected]); // Re-initialize when socket status changes

    useEffect(() => {
        setIsAvailable(driver?.status === 'available');
    }, [driver?.status]);

    // CRITICAL FIX: Auto-start location tracking when app opens if driver is already available
    // Without this, GPS shows "Acquiring..." forever when reopening the app
    useEffect(() => {
        if (driver?.status === 'available' && !isTracking && hasPermission) {
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

                // FIX: Auto-join chat rooms for all active orders (real-time messages)
                const activeOrderIds = assignments.map((a: Assignment) => a.order_id).filter(Boolean);
                if (activeOrderIds.length > 0) {
                    await updateActiveOrders(activeOrderIds);
                }
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
        if (driver?.status === 'busy') return t('on_delivery');
        return isAvailable ? t('available') : t('offline');
    };

    // VVIP: Accept/Reject/Timeout handlers
    const handleAcceptAssignment = async () => {
        if (!pendingAssignment?.assignment_id) return;

        setShowAssignmentPopup(false);

        try {
            await api.acceptAssignment(pendingAssignment.assignment_id);
            setPendingAssignment(null);

            // Reload data to show accepted assignment
            await loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert(
                t('assignment_accepted'),
                t('assignment_accepted_message'),
                [{ text: t('ok') }]
            );
        } catch (err: any) {
            console.error('[Home] Failed to accept assignment:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                t('error'),
                err.message || t('something_went_wrong'),
                [{ text: t('ok') }]
            );
            // Reset popup state so user can retry
            setPendingAssignment(null);
        }
    };

    const handleRejectAssignment = async () => {
        if (!pendingAssignment?.assignment_id) return;

        setShowAssignmentPopup(false);

        try {
            await api.rejectAssignment(pendingAssignment.assignment_id, 'Driver declined');
            setPendingAssignment(null);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                t('assignment_rejected'),
                t('assignment_rejected_message'),
                [{ text: t('ok') }]
            );
        } catch (err: any) {
            console.error('[Home] Failed to reject assignment:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                t('error'),
                err.message || t('something_went_wrong'),
                [{ text: t('ok') }]
            );
            // Reset popup state
            setPendingAssignment(null);
        }
    };

    const handleAssignmentTimeout = () => {
        setShowAssignmentPopup(false);
        setPendingAssignment(null);

        Alert.alert(
            t('assignment_expired'),
            t('assignment_expired_message'),
            [{ text: t('ok') }]
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
                        {(() => {
                            const hour = new Date().getHours();
                            if (hour < 12) return t('good_morning');
                            if (hour < 17) return t('good_afternoon');
                            return t('good_evening');
                        })()},
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
                                <Ionicons name="map-outline" size={24} color={colors.textMuted} />
                                <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t('map_unavailable')}</Text>
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
                        <Ionicons name="location" size={32} color={Colors.primary} />
                        <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t('acquiring_gps')}</Text>
                    </View>
                )}

                {/* Quick Stats - 2x2 Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statsRow}>
                        <StatCard
                            icon="cube-outline"
                            value={stats?.today_deliveries || 0}
                            label={t('today')}
                            color={Colors.primary}
                            colors={colors}
                            delay={0}
                        />
                        <StatCard
                            icon="bar-chart-outline"
                            value={stats?.week_deliveries || 0}
                            label={t('this_week')}
                            color={Colors.success}
                            colors={colors}
                            delay={100}
                        />
                    </View>
                    <View style={styles.statsRow}>
                        <StatCard
                            icon="star"
                            value={parseFloat(formatRating(stats?.rating_average))}
                            label={t('rating')}
                            color={Colors.warning}
                            colors={colors}
                            delay={200}
                            isRating={true}
                        />
                        <StatCard
                            icon="clipboard-outline"
                            value={stats?.active_assignments || 0}
                            label={t('active')}
                            color={Colors.info}
                            colors={colors}
                            delay={300}
                        />
                    </View>
                </View>



                {/* Active Assignments */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {t('active_assignments')}
                    </Text>

                    {activeAssignments.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                            <Ionicons name="mail-open-outline" size={32} color={colors.textMuted} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {t('no_assignments')}
                            </Text>
                            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                                {isAvailable
                                    ? t('new_assignments_message')
                                    : t('go_online_message')
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

// Helper to safely format rating (used in stats grid)
function formatRating(value: any): string {
    if (value === null || value === undefined) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(1);
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
        // VVIP 2026: Premium glow effect
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5,
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
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 110,
        // VVIP 2026: Glassmorphism effect
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        borderTopColor: 'rgba(255,255,255,0.8)',
        // Premium shadow
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
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
