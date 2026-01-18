// Quick Service Tracking Screen with Full Quote Flow
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { handleApiError } from '../utils/errorHandler';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParamsProp = RouteProp<RootStackParamList, 'QuickServiceTracking'>;

export default function QuickServiceTrackingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteParamsProp>();
    const { colors } = useTheme();
    const toast = useToast();

    const requestId = route.params?.requestId;

    const [request, setRequest] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActioning, setIsActioning] = useState(false);

    useEffect(() => {
        fetchRequestStatus();
        const interval = setInterval(fetchRequestStatus, 5000);
        return () => clearInterval(interval);
    }, [requestId]);

    const fetchRequestStatus = async () => {
        try {
            const response = await api.getMyQuickServiceRequests();
            if (response.success && response.requests) {
                const currentRequest = response.requests.find((r: any) => r.request_id === requestId);
                if (currentRequest) {
                    setRequest(currentRequest);
                }
            }
        } catch (error) {
            console.error('Failed to fetch request status:', error);
            if (!request) {
                handleApiError(error, toast, 'Failed to load tracking information');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusInfo = () => {
        if (!request) return { icon: '⏳', text: 'Loading...', color: colors.textMuted };

        switch (request.status) {
            case 'pending':
                return { icon: '🔍', text: 'Finding service provider...', color: '#F59E0B' };
            case 'assigned':
                return { icon: '📱', text: 'Waiting for price quote...', color: '#10B981' };
            case 'quoted':
                return { icon: '💰', text: 'Price Quote Received!', color: Colors.primary };
            case 'accepted':
                return { icon: '🚗', text: 'Technician on the way', color: '#3B82F6' };
            case 'in_progress':
                return { icon: '🔧', text: 'Service in progress', color: '#EC4899' };
            case 'completed':
                return { icon: '🎉', text: 'Service completed!', color: '#059669' };
            case 'cancelled':
                return { icon: '❌', text: 'Service cancelled', color: '#EF4444' };
            default:
                return { icon: '⏳', text: 'Processing...', color: colors.textMuted };
        }
    };

    // Handle accept quote
    const handleAcceptQuote = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsActioning(true);
        try {
            const response = await api.acceptQuickServiceQuote(requestId);
            if (response.success) {
                toast.success('Success', 'Quote accepted! Technician is on the way.');
                fetchRequestStatus();
            } else {
                toast.error('Error', response.message || 'Failed to accept quote');
            }
        } catch (error) {
            handleApiError(error, toast, 'Failed to accept quote');
        } finally {
            setIsActioning(false);
        }
    };

    // Handle reject quote - show options
    const handleRejectQuote = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Reject Price Quote',
            'Would you like to find another service provider or cancel the request?',
            [
                { text: 'Cancel Request', style: 'destructive', onPress: () => rejectQuote(false) },
                { text: 'Find Another', onPress: () => rejectQuote(true) },
                { text: 'Keep Quote', style: 'cancel' },
            ]
        );
    };

    const rejectQuote = async (findAnother: boolean) => {
        setIsActioning(true);
        try {
            const response = await api.rejectQuickServiceQuote(requestId, findAnother);
            if (response.success) {
                toast.info('Info', findAnother ? 'Finding another provider...' : 'Request cancelled');
                fetchRequestStatus();
            } else {
                toast.warning('Warning', response.message || 'No other providers available');
                fetchRequestStatus();
            }
        } catch (error) {
            handleApiError(error, toast, 'Failed to reject quote');
        } finally {
            setIsActioning(false);
        }
    };

    // Handle cancel request
    const handleCancelRequest = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Cancel Request',
            'Are you sure you want to cancel this service request?',
            [
                { text: 'Keep Request', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: cancelRequest },
            ]
        );
    };

    const cancelRequest = async () => {
        setIsActioning(true);
        try {
            const response = await api.cancelQuickService(requestId);
            if (response.success) {
                toast.success('Success', 'Request cancelled successfully');
                navigation.goBack();
            } else {
                toast.error('Error', response.message || 'Failed to cancel request');
            }
        } catch (error) {
            handleApiError(error, toast, 'Failed to cancel request');
        } finally {
            setIsActioning(false);
        }
    };

    // Can show actions?
    const canCancel = ['pending', 'assigned', 'quoted'].includes(request?.status);
    const showQuoteActions = request?.status === 'quoted';

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Loading service details...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Service Tracking</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Status Card */}
                <View style={[styles.statusCard, { backgroundColor: colors.surface }]}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.text}
                    </Text>
                </View>

                {/* Price Quote Display */}
                {request?.quoted_price && (
                    <View style={[styles.priceCard, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}>
                        <Text style={styles.priceLabel}>💰 Quoted Price</Text>
                        <Text style={[styles.priceAmount, { color: Colors.primary }]}>
                            {request.quoted_price} QAR
                        </Text>
                        {request.status === 'quoted' && (
                            <Text style={[styles.priceNote, { color: colors.textSecondary }]}>
                                Accept or reject this price quote
                            </Text>
                        )}
                    </View>
                )}

                {/* Quote Actions (when status is 'quoted') */}
                {showQuoteActions && (
                    <View style={styles.quoteActions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={handleAcceptQuote}
                            disabled={isActioning}
                        >
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                {isActioning ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>✅ Accept Price</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton, { borderColor: Colors.primary }]}
                            onPress={handleRejectQuote}
                            disabled={isActioning}
                        >
                            <Text style={[styles.rejectButtonText, { color: Colors.primary }]}>
                                🔄 Find Another Provider
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Service Details */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                            {request?.service_type?.toUpperCase()}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Vehicle:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                            {request?.vehicle_make} {request?.vehicle_model} {request?.vehicle_year}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
                            {request?.location_address}
                        </Text>
                    </View>

                    {request?.garage_name && (
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Provider:</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>
                                {request.garage_name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress Timeline */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Progress</Text>

                    {['pending', 'assigned', 'quoted', 'accepted', 'in_progress', 'completed'].map((status, index) => {
                        const statusOrder = ['pending', 'assigned', 'quoted', 'accepted', 'in_progress', 'completed'];
                        const currentIndex = statusOrder.indexOf(request?.status);
                        const isCompleted = currentIndex >= index;
                        const isCurrent = request?.status === status;

                        const statusLabels: Record<string, string> = {
                            pending: 'Finding Provider',
                            assigned: 'Provider Assigned',
                            quoted: 'Price Quoted',
                            accepted: 'Quote Accepted',
                            in_progress: 'Service In Progress',
                            completed: 'Completed'
                        };

                        return (
                            <View key={status} style={styles.timelineItem}>
                                <View style={[
                                    styles.timelineDot,
                                    { backgroundColor: isCompleted ? Colors.primary : colors.border },
                                    isCurrent && styles.timelineDotCurrent
                                ]} />
                                <Text style={[
                                    styles.timelineText,
                                    { color: isCompleted ? colors.text : colors.textMuted },
                                    isCurrent && { fontWeight: '700' }
                                ]}>
                                    {statusLabels[status] || status.replace('_', ' ').toUpperCase()}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                {/* Cancel button (when allowed) */}
                {canCancel && (
                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: '#EF4444' }]}
                        onPress={handleCancelRequest}
                        disabled={isActioning}
                    >
                        <Text style={styles.cancelButtonText}>🚫 Cancel Request</Text>
                    </TouchableOpacity>
                )}

                {/* Call button (when garage assigned) */}
                {request?.garage_phone && request.status !== 'completed' && request.status !== 'cancelled' && (
                    <TouchableOpacity style={styles.callButton}>
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.callGradient}
                        >
                            <Text style={styles.callText}>📞 Call Provider</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: FontSizes.md },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    backText: { fontSize: 24 },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },
    statusCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    statusIcon: { fontSize: 64, marginBottom: Spacing.md },
    statusText: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'center' },

    // Price Card
    priceCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.lg,
        borderWidth: 2,
        alignItems: 'center',
    },
    priceLabel: { fontSize: FontSizes.md, marginBottom: Spacing.xs },
    priceAmount: { fontSize: 36, fontWeight: '800' },
    priceNote: { fontSize: FontSizes.sm, marginTop: Spacing.xs },

    // Quote Actions
    quoteActions: { gap: Spacing.md, marginBottom: Spacing.lg },
    actionButton: { borderRadius: BorderRadius.xl, overflow: 'hidden' },
    acceptButton: {},
    buttonGradient: { padding: Spacing.lg, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '700' },
    rejectButton: {
        padding: Spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: BorderRadius.xl,
        backgroundColor: 'transparent',
    },
    rejectButtonText: { fontSize: FontSizes.md, fontWeight: '600' },

    section: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.md },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
        alignItems: 'flex-start',
    },
    detailLabel: { fontSize: FontSizes.md, fontWeight: '600', flex: 1 },
    detailValue: { fontSize: FontSizes.md, flex: 2, textAlign: 'right' },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    timelineDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: Spacing.md,
    },
    timelineDotCurrent: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    timelineText: { fontSize: FontSizes.md },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        gap: Spacing.md,
    },
    cancelButton: {
        padding: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 2,
        alignItems: 'center',
    },
    cancelButtonText: { color: '#EF4444', fontSize: FontSizes.md, fontWeight: '600' },
    callButton: { borderRadius: BorderRadius.xl, overflow: 'hidden' },
    callGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    callText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '700' },
});
