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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { api, Assignment } from '../services/api';
import { offlineQueue } from '../services/OfflineQueue';
import { executeWithOfflineFallback } from '../utils/syncHelper';
import { useJobStore } from '../stores/useJobStore';
import { API_ENDPOINTS, SOCKET_URL } from '../config/api';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig, Shadows } from '../constants/theme';
import { LiveMapView, SwipeToComplete, TimelineItem } from '../components';
import { useI18n } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AssignmentDetailScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t } = useI18n();
    const { assignmentId } = route.params || {};
    const { location, startTracking, stopTracking } = useLocation();

    // Store - checking loose equality for robustness
    const assignmentFromStore = useJobStore(state =>
        state.assignments.find(a => String(a.assignment_id) === String(assignmentId))
    );
    const updateLocalStatus = useJobStore(state => state.updateAssignmentStatus);
    const setAssignments = useJobStore(state => state.setAssignments);

    const [assignment, setAssignment] = useState<Assignment | null>(assignmentFromStore || null);
    const [isLoading, setIsLoading] = useState(!assignmentFromStore);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (assignmentFromStore) {
            setAssignment(assignmentFromStore);
            setIsLoading(false);
        }
    }, [assignmentFromStore]);

    useEffect(() => {
        if (!assignmentId) {
            Alert.alert('Error', 'Invalid Assignment ID');
            navigation.goBack();
            return;
        }
        loadAssignment();
        // Start GPS tracking
        startTracking();
        return () => {
            stopTracking();
        };
    }, [assignmentId]);

    const loadAssignment = async () => {
        try {
            // Fetch fresh data
            const result = await api.getAssignmentDetails(assignmentId);

            // VVIP: Only update if we don't have a pending offline update for this assignment
            // This prevents the UI from "jumping back" to an old status while the queue is syncing
            setAssignment(result.assignment);
            // VVIP: Removed OfflineQueue pending check to prevent 'Stacked' state
            // relying on backend truth regardless of local queue status
        } catch (err: any) {
            // If we have store data, we are good. If not, show error.
            if (!assignmentFromStore) {
                Alert.alert('Error', 'Could not load assignment details');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadAssignment();
        setIsRefreshing(false);
    }, [assignmentId]);

    // Open external map app (Google Maps / Waze) — no in-app nav
    const openNavigation = (address: string, lat?: number, lng?: number, type: 'pickup' | 'delivery' = 'pickup') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (!lat || !lng) {
            // Fallback to Google Maps address search
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open maps');
            });
            return;
        }

        // Open external map directly — Google Maps or Waze handles turn-by-turn
        const { openExternalMap } = require('../services/routing.service');
        const label = type === 'pickup' ? (assignment?.garage_name || 'Pickup') : (assignment?.customer_name || 'Customer');
        openExternalMap(lat, lng, label);
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
            customerPhone: assignment.customer_phone,
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
                <Text style={[styles.errorText, { color: colors.text }]}>{t('assignment_not_found')}</Text>
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
                return { status: 'picked_up' as const, label: 'Confirm Pickup', color: Colors.primary, icon: 'cube' as const };
            case 'picked_up':
                return { status: 'in_transit' as const, label: 'Start Delivery', color: Colors.info, icon: 'car' as const };
            case 'in_transit':
                return { status: 'delivered' as const, label: 'Complete Delivery', color: Colors.success, icon: 'checkmark-circle' as const };
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
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.orderNumber}>#{assignment.order_number}</Text>
                    <View style={styles.statusBadge}>
                        {statusConfig?.icon && <Ionicons name={statusConfig.icon as any} size={14} color="#fff" style={{ marginRight: 4 }} />}
                        <Text style={styles.statusText}>
                            {statusConfig?.label}
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
                        <Ionicons name={isCompleted ? 'checkmark-circle' : 'close-circle'} size={28} color={isCompleted ? '#16a34a' : '#dc2626'} />
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
                    <Ionicons name={typeConfig?.icon as any} size={24} color={typeConfig?.color} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.typeLabel, { color: typeConfig?.color }]}>{typeConfig?.label}</Text>
                        <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{typeConfig?.description}</Text>
                    </View>
                </View>

                {/* Part Information - Simplified for drivers (full details are for garages) */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}><Ionicons name="cube" size={16} color={Colors.primary} /> {t('part_info')}</Text>
                    {assignment.part_category && (
                        <Text style={[styles.carInfo, { color: Colors.primary, fontWeight: '600', marginBottom: 4 }]}>
                            <Ionicons name="folder-outline" size={14} color={Colors.primary} /> {assignment.part_category}{assignment.part_subcategory ? ` > ${assignment.part_subcategory}` : ''}
                        </Text>
                    )}
                    {assignment.car_make && (
                        <Text style={[styles.carInfo, { color: colors.textMuted }]}>
                            <Ionicons name="car-outline" size={14} color={colors.textMuted} /> {assignment.car_make} {assignment.car_model} ({assignment.car_year})
                        </Text>
                    )}
                </View>

                {/* Pickup Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.warning }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pickup_location')}</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.garage_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.pickup_address}
                    </Text>

                    {/* Actions - Different for active vs completed */}
                    <View style={styles.actionRow}>
                        {isActive && assignment.status === 'assigned' && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionButtonPrimary]}
                                onPress={() => openNavigation(assignment.pickup_address, assignment.pickup_lat, assignment.pickup_lng, 'pickup')}
                            >
                                <Text style={styles.actionButtonTextWhite}><Ionicons name="navigate" size={14} color="#fff" /> {t('navigate')}</Text>
                            </TouchableOpacity>
                        )}
                        {isActive && assignment.garage_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.garage_phone!, assignment.garage_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}><Ionicons name="call" size={14} color={Colors.success} /> {t('call_garage')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Delivery Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.success }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('delivery_location')}</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.customer_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.delivery_address}
                    </Text>

                    {/* P1 FIX: ETA Display for Active Assignments */}
                    {isActive && location && assignment.delivery_lat && assignment.delivery_lng && (() => {
                        const { calculateETA, formatCountdown, getETAColor } = require('../services/eta.service');
                        const eta = calculateETA(
                            location.latitude,
                            location.longitude,
                            assignment.delivery_lat,
                            assignment.delivery_lng,
                            assignment.status === 'in_transit' ? 'delivery' : 'none'
                        );
                        return (
                            <View style={[styles.etaBadge, { backgroundColor: getETAColor(eta.durationMinutes) + '15' }]}>
                                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.etaLabel, { color: colors.textMuted }]}>{t('estimated_arrival')}</Text>
                                    <Text style={[styles.etaTime, { color: getETAColor(eta.durationMinutes) }]}>
                                        {eta.countdownText} • {eta.formattedETA}
                                    </Text>
                                    <Text style={[styles.etaDistance, { color: colors.textMuted }]}>
                                        {eta.distanceKm} km away
                                    </Text>
                                </View>
                            </View>
                        );
                    })()}

                    {/* Actions - Different for active vs completed */}
                    <View style={styles.actionRow}>
                        {isActive && ['picked_up', 'in_transit'].includes(assignment.status) && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionButtonPrimary]}
                                onPress={() => openNavigation(assignment.delivery_address, assignment.delivery_lat, assignment.delivery_lng, 'delivery')}
                            >
                                <Text style={styles.actionButtonTextWhite}><Ionicons name="navigate" size={14} color="#fff" /> {t('navigate')}</Text>
                            </TouchableOpacity>
                        )}
                        {isActive && assignment.customer_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.customer_phone!, assignment.customer_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}><Ionicons name="call" size={14} color={Colors.success} /> {t('call')}</Text>
                            </TouchableOpacity>
                        )}
                        {isActive && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.primary + '20' }]}
                                onPress={openChat}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.primary }]}><Ionicons name="chatbubble" size={14} color={Colors.primary} /> {t('chat')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* =====================================================
                    DELIVERY PROOF - Only for completed orders
                   ===================================================== */}
                {isCompleted && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}><Ionicons name="camera" size={16} color={Colors.primary} /> {t('delivery_proof')}</Text>

                        {assignment.delivery_photo_url ? (
                            <Image
                                source={{
                                    uri: assignment.delivery_photo_url.startsWith('http')
                                        ? assignment.delivery_photo_url
                                        : `${SOCKET_URL}${assignment.delivery_photo_url}`
                                }}
                                style={styles.proofImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.noProofPlaceholder}>
                                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                                <Text style={[styles.noProofText, { color: colors.textMuted }]}>
                                    No delivery photo
                                </Text>
                            </View>
                        )}

                        {assignment.signature_url && (
                            <>
                                <Text style={[styles.proofSubtitle, { color: colors.text }]}><Ionicons name="create-outline" size={14} color={colors.text} /> {t('customer_signature')}</Text>
                                <Image
                                    source={{
                                        uri: assignment.signature_url.startsWith('http')
                                            ? assignment.signature_url
                                            : `${SOCKET_URL}${assignment.signature_url}`
                                    }}
                                    style={styles.signatureImage}
                                    resizeMode="contain"
                                />
                            </>
                        )}

                        {assignment.driver_notes && (
                            <>
                                <Text style={[styles.proofSubtitle, { color: colors.text }]}><Ionicons name="document-text-outline" size={14} color={colors.text} /> {t('notes')}</Text>
                                <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                                    {assignment.driver_notes}
                                </Text>
                            </>
                        )}
                    </View>
                )}

                {/* Payment Summary - For completed orders (driver cash reconciliation) */}
                {isCompleted && (assignment.part_price || assignment.delivery_fee || assignment.total_amount) && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            <Ionicons name="wallet" size={16} color={Colors.primary} /> {t('payment_summary') || 'Payment Summary'}
                        </Text>

                        {/* Payment Method Badge */}
                        {assignment.payment_method && (
                            <View style={[styles.paymentMethodBadge, {
                                backgroundColor: assignment.payment_method === 'cod' || assignment.payment_method === 'cash'
                                    ? '#fef3c7' : '#dcfce7'
                            }]}>
                                <Ionicons
                                    name={assignment.payment_method === 'cod' || assignment.payment_method === 'cash' ? 'cash-outline' : 'card-outline'}
                                    size={16}
                                    color={assignment.payment_method === 'cod' || assignment.payment_method === 'cash' ? '#d97706' : '#16a34a'}
                                />
                                <Text style={[styles.paymentMethodText, {
                                    color: assignment.payment_method === 'cod' || assignment.payment_method === 'cash' ? '#92400e' : '#166534'
                                }]}>
                                    {assignment.payment_method === 'cod' ? 'Cash on Delivery' :
                                        assignment.payment_method === 'cash' ? 'Cash' :
                                            assignment.payment_method === 'card_full' ? 'Card (Full)' :
                                                assignment.payment_method === 'card' ? 'Card' :
                                                    assignment.payment_method === 'wallet' ? 'Wallet' : assignment.payment_method}
                                </Text>
                            </View>
                        )}

                        {/* Price Breakdown */}
                        <View style={styles.priceBreakdown}>
                            {assignment.part_price != null && (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                                        <Ionicons name="cube-outline" size={14} color={colors.textMuted} /> Spare Part Price
                                    </Text>
                                    <Text style={[styles.priceValue, { color: colors.text }]}>
                                        {Number(assignment.part_price).toFixed(2)} QAR
                                    </Text>
                                </View>
                            )}
                            {assignment.delivery_fee != null && (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                                        <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} /> Delivery Fee
                                    </Text>
                                    <Text style={[styles.priceValue, { color: colors.text }]}>
                                        {Number(assignment.delivery_fee).toFixed(2)} QAR
                                    </Text>
                                </View>
                            )}
                            {assignment.loyalty_discount != null && Number(assignment.loyalty_discount) > 0 && (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceLabel, { color: '#16a34a' }]}>
                                        <Ionicons name="gift-outline" size={14} color="#16a34a" /> Loyalty Discount
                                    </Text>
                                    <Text style={[styles.priceValue, { color: '#16a34a' }]}>
                                        -{Number(assignment.loyalty_discount).toFixed(2)} QAR
                                    </Text>
                                </View>
                            )}

                            {/* Divider */}
                            <View style={[styles.priceDivider, { backgroundColor: colors.textMuted + '30' }]} />

                            {/* Total */}
                            {assignment.total_amount != null && (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.totalLabel, { color: colors.text }]}>
                                        Total Amount
                                    </Text>
                                    <Text style={[styles.totalValue, {
                                        color: assignment.payment_method === 'cod' || assignment.payment_method === 'cash'
                                            ? '#d97706' : Colors.primary
                                    }]}>
                                        {Number(assignment.total_amount).toFixed(2)} QAR
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Cash reminder for COD */}
                        {(assignment.payment_method === 'cod' || assignment.payment_method === 'cash') && (
                            <View style={styles.cashReminder}>
                                <Ionicons name="information-circle" size={16} color="#d97706" />
                                <Text style={styles.cashReminderText}>
                                    Collect {assignment.total_amount ? `${Number(assignment.total_amount).toFixed(2)} QAR` : 'payment'} from customer and hand to finance
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Assignment Timeline - Always visible for premium history tracking */}
                <View style={[styles.section, { backgroundColor: colors.surface, marginBottom: 24 }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}><Ionicons name="calendar" size={16} color={Colors.primary} /> {t('assignment_timeline')}</Text>

                    <TimelineItem
                        dotColor={Colors.primary}
                        label={t('driver_assigned')}
                        value={formatDate(assignment.created_at)}
                        textColor={colors.text}
                        mutedColor={colors.textMuted}
                    />

                    {assignment.pickup_at && (
                        <TimelineItem
                            dotColor={Colors.warning}
                            label={t('part_picked_up')}
                            value={formatDate(assignment.pickup_at)}
                            textColor={colors.text}
                            mutedColor={colors.textMuted}
                        />
                    )}

                    {assignment.delivered_at && (
                        <TimelineItem
                            dotColor={isCompleted ? Colors.success : Colors.danger}
                            label={isCompleted ? t('successfully_delivered') : t('delivery_failed_label')}
                            value={formatDate(assignment.delivered_at)}
                            textColor={colors.text}
                            mutedColor={colors.textMuted}
                        />
                    )}
                </View>

                {/* Spacer for bottom bar */}
                {isActive && <View style={{ height: 100 }} />}
            </ScrollView>


            {/* Bottom Action Bar - Only for active orders */}
            {
                isActive && nextAction && (
                    <View style={[styles.bottomBar, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity
                            style={styles.failButton}
                            onPress={() => {
                                Alert.alert(
                                    t('confirm_failed_title'),
                                    t('confirm_failed_message'),
                                    [
                                        { text: t('cancel'), style: 'cancel' },
                                        {
                                            text: t('confirm'),
                                            style: 'destructive',
                                            onPress: async () => {
                                                setIsUpdating(true);
                                                try {
                                                    // 1. Optimistic Update
                                                    updateLocalStatus(assignment.assignment_id, 'failed');

                                                    // 2. Hybrid Sync
                                                    await executeWithOfflineFallback(
                                                        async () => api.updateAssignmentStatus(assignment.assignment_id, 'failed'),
                                                        {
                                                            endpoint: API_ENDPOINTS.UPDATE_ASSIGNMENT_STATUS(assignment.assignment_id),
                                                            method: 'PATCH',
                                                            body: { status: 'failed' }
                                                        },
                                                        { successMessage: 'Marked as failed' }
                                                    );

                                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                                    navigation.goBack();
                                                } catch (err: any) {
                                                    Alert.alert(t('error'), err.message);
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
                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                        <View style={styles.swipeContainer}>
                            <SwipeToComplete
                                onComplete={async () => {
                                    setIsUpdating(true);
                                    try {
                                        // 1. Determine if we need specialized flow
                                        if (nextAction.status === 'picked_up') {
                                            // SIMPLIFIED: Direct pickup confirmation (no inspection)
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                                            // Optimistic update
                                            updateLocalStatus(assignment.assignment_id, 'picked_up');

                                            // Sync to backend
                                            await executeWithOfflineFallback(
                                                async () => api.updateAssignmentStatus(assignment.assignment_id, 'picked_up'),
                                                {
                                                    endpoint: API_ENDPOINTS.UPDATE_ASSIGNMENT_STATUS(assignment.assignment_id),
                                                    method: 'PATCH',
                                                    body: { status: 'picked_up' }
                                                },
                                                { successMessage: 'Part picked up!' }
                                            );

                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            setIsUpdating(false);
                                            return;
                                        }

                                        if (nextAction.status === 'delivered') {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            // Navigate to POD
                                            navigation.navigate('ProofOfDelivery', {
                                                assignmentId: assignment.assignment_id,
                                                orderId: assignment.order_id
                                            });
                                            setIsUpdating(false);
                                            return;
                                        }

                                        // 2. Default Optimistic Update (e.g. Start Delivery -> In Transit)
                                        // Update store first so UI reflects change immediately
                                        updateLocalStatus(assignment.assignment_id, nextAction.status);

                                        // 3. Hybrid Sync
                                        await executeWithOfflineFallback(
                                            async () => api.updateAssignmentStatus(assignment.assignment_id, nextAction.status),
                                            {
                                                endpoint: API_ENDPOINTS.UPDATE_ASSIGNMENT_STATUS(assignment.assignment_id),
                                                method: 'PATCH',
                                                body: { status: nextAction.status }
                                            },
                                            { successMessage: 'Status updated' }
                                        );

                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    } catch (err: any) {
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                        Alert.alert(t('error'), err.message || t('something_went_wrong'));
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
                )
            }
        </SafeAreaView >
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
    backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
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

    // Type Card (VVIP 2026 Enhanced)
    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        gap: 14,
    },
    typeIcon: { fontSize: 32 },
    typeLabel: { fontSize: 16, fontWeight: '700' },
    typeDesc: { fontSize: 13, marginTop: 2 },

    // Section (VVIP 2026 Enhanced)
    section: {
        padding: 20,
        borderRadius: 24,
        // VVIP Glassmorphism
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
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

    // ETA Badge (P1 Fix)
    etaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
    },
    etaLabel: { fontSize: 12, fontWeight: '500' },
    etaTime: { fontSize: 16, fontWeight: '700', marginTop: 2 },
    etaDistance: { fontSize: 12, marginTop: 2 },

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

    // Payment Summary
    paymentMethodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        marginTop: 12,
        marginBottom: 4,
    },
    paymentMethodText: {
        fontSize: 13,
        fontWeight: '600',
    },
    priceBreakdown: {
        marginTop: 12,
        gap: 8,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    priceDivider: {
        height: 1,
        marginVertical: 6,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    cashReminder: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        padding: 12,
        borderRadius: 10,
        gap: 8,
        marginTop: 12,
    },
    cashReminderText: {
        flex: 1,
        fontSize: 13,
        color: '#92400e',
        fontWeight: '500',
    },


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
