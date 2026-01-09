// QScrap Driver App - Premium Assignment Detail Screen
// Full assignment view with separated active/completed order views
// Business logic aligned with backend data structure

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    RefreshControl,
    ActivityIndicator,
    Image,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { api, Assignment } from '../services/api';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig, Shadows } from '../constants/theme';
import { LiveMapView, SwipeToComplete } from '../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AssignmentDetailScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { assignmentId } = route.params || {};
    const { location } = useLocation();

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAssignment();
    }, [assignmentId]);

    const loadAssignment = async () => {
        try {
            const result = await api.getAssignmentDetails(assignmentId);
            setAssignment(result.assignment);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to load assignment');
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadAssignment();
        setIsRefreshing(false);
    }, [assignmentId]);

    // FIXED: Guard against null coordinates for completed orders
    const openNavigation = (address: string, lat?: number, lng?: number, type: 'pickup' | 'delivery' = 'pickup') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Guard: Check if coordinates are available
        if (!lat || !lng) {
            // Fallback to Google Maps address search
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open maps');
            });
            return;
        }

        // VVIP: Open in-app navigation with OSRM
        navigation.navigate('Navigation', {
            pickupLat: assignment?.pickup_lat,
            pickupLng: assignment?.pickup_lng,
            deliveryLat: assignment?.delivery_lat,
            deliveryLng: assignment?.delivery_lng,
            destinationType: type,
            destinationName: type === 'pickup' ? assignment?.garage_name : assignment?.customer_name,
            destinationAddress: address,
        });
    };

    const callContact = (phone: string, name: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL(`tel:${phone}`).catch(() => {
            Alert.alert('Error', 'Could not make call');
        });
    };

    const openChat = () => {
        if (!assignment) return;
        navigation.navigate('Chat', {
            orderId: assignment.order_id,
            orderNumber: assignment.order_number,
            recipientName: assignment.customer_name,
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!assignment) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.text }]}>Assignment not found</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = AssignmentStatusConfig[assignment.status as keyof typeof AssignmentStatusConfig];
    const typeConfig = AssignmentTypeConfig[assignment.assignment_type as keyof typeof AssignmentTypeConfig];
    const isActive = !['delivered', 'failed'].includes(assignment.status);
    const isCompleted = assignment.status === 'delivered';
    const isFailed = assignment.status === 'failed';

    // Determine next action for active orders
    const getNextAction = () => {
        switch (assignment.status) {
            case 'assigned':
                return { status: 'picked_up' as const, label: '📦 Confirm Pickup', color: Colors.primary };
            case 'picked_up':
                return { status: 'in_transit' as const, label: '🚚 Start Delivery', color: Colors.info };
            case 'in_transit':
                return { status: 'delivered' as const, label: '✅ Complete Delivery', color: Colors.success };
            default:
                return null;
        }
    };

    const nextAction = getNextAction();

    // Format timestamp for display
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-QA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Premium Header */}
            <LinearGradient
                colors={isCompleted ? ['#10b981', '#059669'] : isFailed ? ['#ef4444', '#dc2626'] : [Colors.primary, '#6b0f1a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.orderNumber}>#{assignment.order_number}</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>
                            {statusConfig?.icon} {statusConfig?.label}
                        </Text>
                    </View>
                </View>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* =====================================================
                    COMPLETED ORDER SUMMARY (Only for delivered/failed)
                   ===================================================== */}
                {!isActive && (
                    <View style={[styles.completedSummary, {
                        backgroundColor: isCompleted ? '#dcfce7' : '#fee2e2',
                        borderColor: isCompleted ? '#22c55e' : '#ef4444'
                    }]}>
                        <Text style={[styles.completedIcon, { color: isCompleted ? '#16a34a' : '#dc2626' }]}>
                            {isCompleted ? '✅' : '❌'}
                        </Text>
                        <View style={styles.completedInfo}>
                            <Text style={[styles.completedTitle, { color: isCompleted ? '#166534' : '#991b1b' }]}>
                                {isCompleted ? 'Delivery Completed' : 'Delivery Failed'}
                            </Text>
                            <Text style={[styles.completedTime, { color: isCompleted ? '#15803d' : '#b91c1c' }]}>
                                {formatDate(assignment.delivered_at || assignment.pickup_at)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Live Map - Only for active orders */}
                {isActive && (
                    <LiveMapView
                        driverLocation={location}
                        activeAssignment={assignment}
                        height={200}
                        showRoute={true}
                    />
                )}

                {/* Assignment Type Badge */}
                <View style={[styles.typeCard, { backgroundColor: typeConfig?.color + '15' }]}>
                    <Text style={styles.typeIcon}>{typeConfig?.icon}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.typeLabel, { color: typeConfig?.color }]}>{typeConfig?.label}</Text>
                        <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{typeConfig?.description}</Text>
                    </View>
                </View>

                {/* Part Information */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.small]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>📦 Part Details</Text>
                    <Text style={[styles.partDescription, { color: colors.text }]}>
                        {assignment.part_description}
                    </Text>
                    {assignment.car_make && (
                        <Text style={[styles.carInfo, { color: colors.textMuted }]}>
                            🚗 {assignment.car_make} {assignment.car_model}
                        </Text>
                    )}
                </View>

                {/* Pickup Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.small]}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.warning }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup Location</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.garage_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.pickup_address}
                    </Text>

                    {/* Actions - Different for active vs completed */}
                    <View style={styles.actionRow}>
                        {isActive && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionButtonPrimary]}
                                onPress={() => openNavigation(assignment.pickup_address, assignment.pickup_lat, assignment.pickup_lng, 'pickup')}
                            >
                                <Text style={styles.actionButtonTextWhite}>🧭 Navigate</Text>
                            </TouchableOpacity>
                        )}
                        {assignment.garage_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.garage_phone!, assignment.garage_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}>📞 Call Garage</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Delivery Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.small]}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.success }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery Location</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.customer_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.delivery_address}
                    </Text>

                    {/* Actions - Different for active vs completed */}
                    <View style={styles.actionRow}>
                        {isActive && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionButtonPrimary]}
                                onPress={() => openNavigation(assignment.delivery_address, assignment.delivery_lat, assignment.delivery_lng, 'delivery')}
                            >
                                <Text style={styles.actionButtonTextWhite}>🧭 Navigate</Text>
                            </TouchableOpacity>
                        )}
                        {assignment.customer_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.customer_phone!, assignment.customer_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}>📞 Call</Text>
                            </TouchableOpacity>
                        )}
                        {isActive && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.primary + '20' }]}
                                onPress={openChat}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.primary }]}>💬 Chat</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* =====================================================
                    DELIVERY PROOF - Only for completed orders
                   ===================================================== */}
                {isCompleted && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.small]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>📸 Delivery Proof</Text>

                        {assignment.delivery_photo_url ? (
                            <Image
                                source={{ uri: assignment.delivery_photo_url }}
                                style={styles.proofImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.noProofPlaceholder}>
                                <Text style={styles.noProofIcon}>📷</Text>
                                <Text style={[styles.noProofText, { color: colors.textMuted }]}>
                                    No delivery photo
                                </Text>
                            </View>
                        )}

                        {assignment.signature_url && (
                            <>
                                <Text style={[styles.proofSubtitle, { color: colors.text }]}>✍️ Customer Signature</Text>
                                <Image
                                    source={{ uri: assignment.signature_url }}
                                    style={styles.signatureImage}
                                    resizeMode="contain"
                                />
                            </>
                        )}

                        {assignment.driver_notes && (
                            <>
                                <Text style={[styles.proofSubtitle, { color: colors.text }]}>📝 Notes</Text>
                                <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                                    {assignment.driver_notes}
                                </Text>
                            </>
                        )}
                    </View>
                )}

                {/* Timeline for completed orders */}
                {!isActive && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.small]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Timeline</Text>
                        <View style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: colors.textMuted }]} />
                            <View style={styles.timelineContent}>
                                <Text style={[styles.timelineLabel, { color: colors.textMuted }]}>Assigned</Text>
                                <Text style={[styles.timelineValue, { color: colors.text }]}>{formatDate(assignment.created_at)}</Text>
                            </View>
                        </View>
                        {assignment.pickup_at && (
                            <View style={styles.timelineItem}>
                                <View style={[styles.timelineDot, { backgroundColor: Colors.warning }]} />
                                <View style={styles.timelineContent}>
                                    <Text style={[styles.timelineLabel, { color: colors.textMuted }]}>Picked Up</Text>
                                    <Text style={[styles.timelineValue, { color: colors.text }]}>{formatDate(assignment.pickup_at)}</Text>
                                </View>
                            </View>
                        )}
                        {assignment.delivered_at && (
                            <View style={styles.timelineItem}>
                                <View style={[styles.timelineDot, { backgroundColor: isCompleted ? Colors.success : Colors.danger }]} />
                                <View style={styles.timelineContent}>
                                    <Text style={[styles.timelineLabel, { color: colors.textMuted }]}>
                                        {isCompleted ? 'Delivered' : 'Failed'}
                                    </Text>
                                    <Text style={[styles.timelineValue, { color: colors.text }]}>{formatDate(assignment.delivered_at)}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Spacer for bottom bar */}
                {isActive && <View style={{ height: 100 }} />}
            </ScrollView>

            {/* VVIP Bottom Action Bar - Only for active orders */}
            {isActive && nextAction && (
                <View style={[styles.bottomBar, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity
                        style={styles.failButton}
                        onPress={() => {
                            Alert.alert(
                                'Mark as Failed',
                                'Are you sure this delivery cannot be completed?',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Confirm',
                                        style: 'destructive',
                                        onPress: async () => {
                                            setIsUpdating(true);
                                            try {
                                                await api.updateAssignmentStatus(assignment.assignment_id, 'failed');
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                                await loadAssignment();
                                            } catch (err: any) {
                                                Alert.alert('Error', err.message);
                                            } finally {
                                                setIsUpdating(false);
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                        disabled={isUpdating}
                    >
                        <Text style={styles.failButtonText}>❌</Text>
                    </TouchableOpacity>
                    <View style={styles.swipeContainer}>
                        <SwipeToComplete
                            onComplete={async () => {
                                setIsUpdating(true);
                                try {
                                    await api.updateAssignmentStatus(assignment.assignment_id, nextAction.status);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    await loadAssignment();
                                } catch (err: any) {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                    Alert.alert('Error', err.message || 'Failed to update');
                                } finally {
                                    setIsUpdating(false);
                                }
                            }}
                            label={nextAction.label}
                            type={nextAction.status === 'delivered' ? 'success' : 'primary'}
                            icon="→"
                            completeIcon="✓"
                            disabled={isUpdating}
                        />
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 40 },

    // Premium Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 8,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backIcon: { fontSize: 24, color: '#fff' },
    headerCenter: { flex: 1, alignItems: 'center' },
    orderNumber: { fontSize: 20, fontWeight: '700', color: '#fff' },
    statusBadge: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        marginTop: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    statusText: { fontSize: 13, fontWeight: '600', color: '#fff' },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, gap: 16 },

    // Completed Summary
    completedSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        gap: 12,
    },
    completedIcon: { fontSize: 36 },
    completedInfo: { flex: 1 },
    completedTitle: { fontSize: 18, fontWeight: '700' },
    completedTime: { fontSize: 14, marginTop: 2 },

    // Type Card
    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    typeIcon: { fontSize: 32 },
    typeLabel: { fontSize: 16, fontWeight: '700' },
    typeDesc: { fontSize: 13, marginTop: 2 },

    // Section
    section: {
        padding: 16,
        borderRadius: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    partDescription: { fontSize: 15, lineHeight: 22 },
    carInfo: { fontSize: 13, marginTop: 8 },

    locationDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    locationName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    locationAddress: { fontSize: 14, lineHeight: 20 },

    // Action Buttons
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionButtonPrimary: {
        backgroundColor: Colors.primary,
    },
    actionButtonText: { fontSize: 14, fontWeight: '600' },
    actionButtonTextWhite: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // Proof Section
    proofImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginTop: 12,
        backgroundColor: '#f1f5f9',
    },
    signatureImage: {
        width: '100%',
        height: 100,
        borderRadius: 12,
        marginTop: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    proofSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 16,
    },
    notesText: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },
    noProofPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginTop: 12,
    },
    noProofIcon: { fontSize: 40, opacity: 0.5 },
    noProofText: { marginTop: 8, fontSize: 14 },

    // Timeline
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 12,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
    },
    timelineContent: { flex: 1 },
    timelineLabel: { fontSize: 12, fontWeight: '500' },
    timelineValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },

    // Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 16,
        paddingBottom: 32,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    failButton: {
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#fee2e2',
    },
    failButtonText: { fontSize: 18 },
    swipeContainer: { flex: 1 },
});
