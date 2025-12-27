// QScrap Order Detail Screen - Full Featured with Tracking
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Order } from '../services/api';
import { SOCKET_URL } from '../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../../App';
import { useSocketContext } from '../hooks/useSocket';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function OrderDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const { colors } = useTheme();
    const { orderUpdates } = useSocketContext();

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

    // Review modal state
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [overallRating, setOverallRating] = useState(5);
    const [partQualityRating, setPartQualityRating] = useState(5);
    const [communicationRating, setCommunicationRating] = useState(5);
    const [deliveryRating, setDeliveryRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    const loadOrderDetails = useCallback(async () => {
        try {
            const data = await api.getMyOrders();
            const foundOrder = data.orders?.find((o: Order) => o.order_id === orderId);
            setOrder(foundOrder || null);
        } catch (error) {
            console.log('Failed to load order:', error);
            Alert.alert('Error', 'Failed to load order details');
        } finally {
            setIsLoading(false);
        }
    }, [orderId]);

    // Auto-refresh when screen gains focus
    useFocusEffect(
        useCallback(() => {
            loadOrderDetails();
        }, [loadOrderDetails])
    );

    // Real-time: Reload when socket receives order status update
    useEffect(() => {
        if (orderUpdates.length > 0) {
            // Check if any update is for this order
            const relevantUpdate = orderUpdates.find((u: any) => u.order_id === orderId);
            if (relevantUpdate) {
                console.log('[OrderDetail] Socket order update received for this order, refreshing...');
                loadOrderDetails();
            }
        }
    }, [orderUpdates, orderId, loadOrderDetails]);

    const handleConfirmDelivery = async () => {
        Alert.alert(
            'Confirm Delivery',
            'Have you received your part? This will complete the order.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Receipt',
                    onPress: async () => {
                        setIsConfirming(true);
                        try {
                            await api.confirmDelivery(orderId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            loadOrderDetails(); // Reload to get completed status
                            // Show review modal after successful confirmation
                            setShowReviewModal(true);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to confirm delivery');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        } finally {
                            setIsConfirming(false);
                        }
                    },
                },
            ]
        );
    };

    const handleSubmitReview = async () => {
        setIsSubmittingReview(true);
        try {
            await api.submitReview(orderId, {
                overall_rating: overallRating,
                part_quality_rating: partQualityRating,
                communication_rating: communicationRating,
                delivery_rating: deliveryRating,
                review_text: reviewText.trim() || undefined,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowReviewModal(false);
            Alert.alert(
                'Thank You! 🌟',
                'Your review has been submitted and will be visible after moderation.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit review');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleSkipReview = () => {
        setShowReviewModal(false);
        Alert.alert(
            'Order Completed!',
            'Thank you for using QScrap. You can leave a review later.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
    };

    // Star rating component
    const StarRating = ({ rating, onRatingChange, label }: { rating: number; onRatingChange: (r: number) => void; label: string }) => (
        <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => {
                            onRatingChange(star);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <Text style={[styles.star, { color: star <= rating ? '#FFD700' : colors.border }]}>
                            ★
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const handleCallDriver = () => {
        if (order?.driver_phone) {
            Linking.openURL(`tel:${order.driver_phone}`);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;

        setIsDownloadingInvoice(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await api.getToken();

            // Step 1: Generate invoice (or get existing)
            const generateResponse = await fetch(`${SOCKET_URL}/api/documents/invoice/${order.order_id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            let documentId = null;

            if (generateResponse.ok) {
                const invoiceData = await generateResponse.json();
                // API returns {document: {document_id: ...}}
                documentId = invoiceData.document?.document_id || invoiceData.document_id;
            } else {
                // Try to get existing invoice
                const docsResponse = await fetch(`${SOCKET_URL}/api/documents/order/${order.order_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const docsData = await docsResponse.json();
                const existingInvoice = docsData.documents?.find((d: any) => d.document_type === 'invoice');

                if (existingInvoice) {
                    documentId = existingInvoice.document_id;
                }
            }

            if (!documentId) {
                throw new Error('Could not generate or find invoice');
            }

            // Open PDF in browser (handles download natively)
            const pdfUrl = `${SOCKET_URL}/api/documents/${documentId}/download?token=${token}`;
            await Linking.openURL(pdfUrl);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            console.log('Invoice download error:', error);
            Alert.alert('Error', error.message || 'Failed to download invoice');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsDownloadingInvoice(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'confirmed': return {
                color: Colors.info,
                icon: '✓',
                label: 'Confirmed',
                description: 'Garage has confirmed your order'
            };
            case 'preparing': return {
                color: Colors.warning,
                icon: '🔧',
                label: 'Preparing',
                description: 'Garage is preparing your part'
            };
            case 'ready_for_pickup': return {
                color: Colors.info,
                icon: '📦',
                label: 'Ready for Pickup',
                description: 'Driver will pick up soon'
            };
            case 'collected': return {
                color: Colors.info,
                icon: '🚚',
                label: 'Collected',
                description: 'Part collected, heading to quality check'
            };
            case 'qc_in_progress': return {
                color: Colors.warning,
                icon: '🔍',
                label: 'Quality Check',
                description: 'Part is being inspected'
            };
            case 'qc_passed': return {
                color: Colors.success,
                icon: '✅',
                label: 'QC Passed',
                description: 'Quality verified! Ready for delivery'
            };
            case 'qc_failed': return {
                color: Colors.error,
                icon: '❌',
                label: 'QC Failed',
                description: 'Quality issue - being resolved'
            };
            case 'in_transit': return {
                color: Colors.primary,
                icon: '🚗',
                label: 'On The Way',
                description: 'Your part is on the way!'
            };
            case 'delivered': return {
                color: Colors.success,
                icon: '📍',
                label: 'Delivered',
                description: 'Please confirm receipt'
            };
            case 'completed': return {
                color: Colors.success,
                icon: '🎉',
                label: 'Completed',
                description: 'Order completed successfully'
            };
            default: return {
                color: Colors.dark.textMuted,
                icon: '•',
                label: status,
                description: ''
            };
        }
    };

    const getStepProgress = (status: string) => {
        // Complete order lifecycle in correct sequence
        const steps = [
            'confirmed',        // 0 - Order created
            'preparing',        // 1 - Garage working
            'ready_for_pickup', // 2 - Ready for collection
            'collected',        // 3 - Collected by QScrap
            'qc_in_progress',   // 4 - Quality check
            'qc_passed',        // 5 - QC passed
            'in_transit',       // 6 - Driver delivering
            'delivered',        // 7 - Arrived
            'completed'         // 8 - Confirmed by customer
        ];
        const currentIndex = steps.indexOf(status);
        // If status not found (like qc_failed), return last known step or keep at collected
        if (currentIndex < 0) {
            // Handle edge cases
            if (status === 'qc_failed') return 4; // Stay at QC step
            return 0;
        }
        return currentIndex;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Order not found</Text>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo(order.order_status);
    const stepProgress = getStepProgress(order.order_status);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Order #{order.order_number}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <View style={[styles.statusCard, { borderColor: statusInfo.color }]}>
                    <LinearGradient
                        colors={[statusInfo.color + '20', statusInfo.color + '05']}
                        style={styles.statusGradient}
                    >
                        <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                        <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                        <Text style={styles.statusDescription}>{statusInfo.description}</Text>
                    </LinearGradient>
                </View>

                {/* Progress Steps */}
                <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Progress</Text>
                    <View style={styles.progressSteps}>
                        {['Confirmed', 'Preparing', 'Ready', 'Collected', 'QC', 'Verified', 'Transit', 'Delivered', 'Done'].map((step, index) => (
                            <View key={step} style={styles.progressStep}>
                                <View style={[
                                    styles.progressDot,
                                    index <= stepProgress && styles.progressDotActive
                                ]}>
                                    {index <= stepProgress && <Text style={styles.progressCheck}>✓</Text>}
                                </View>
                                {index < 8 && (
                                    <View style={[
                                        styles.progressLine,
                                        index < stepProgress && styles.progressLineActive
                                    ]} />
                                )}
                            </View>
                        ))}
                    </View>
                    <View style={styles.progressLabels}>
                        {['✓', '🔧', '📦', '🚚', '🔍', '✅', '🚗', '📍', '🎉'].map((icon, index) => (
                            <Text key={index} style={[
                                styles.progressLabel,
                                index <= stepProgress && styles.progressLabelActive
                            ]}>{icon}</Text>
                        ))}
                    </View>
                </View>

                {/* Driver Info (if in transit) */}
                {order.driver_name && order.order_status === 'in_transit' && (
                    <View style={styles.driverCard}>
                        <View style={styles.driverInfo}>
                            <View style={styles.driverAvatar}>
                                <Text style={styles.driverAvatarText}>🚗</Text>
                            </View>
                            <View>
                                <Text style={styles.driverLabel}>Your Driver</Text>
                                <Text style={styles.driverName}>{order.driver_name}</Text>
                            </View>
                        </View>
                        {order.driver_phone && (
                            <TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
                                <Text style={styles.callIcon}>📞</Text>
                                <Text style={styles.callText}>Call</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Live Map Button - when driver is on the way */}
                {['picked_up', 'in_transit'].includes(order.order_status) && (
                    <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Tracking', {
                                orderId: order.order_id,
                                orderNumber: order.order_number,
                                deliveryAddress: order.delivery_address,
                            });
                        }}
                    >
                        <LinearGradient
                            colors={['#3b82f6', '#1d4ed8'] as const}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.mapButtonGradient}
                        >
                            <Text style={styles.mapButtonIcon}>🗺️</Text>
                            <Text style={styles.mapButtonText}>Open Live Map</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Order Details */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Garage</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{order.garage_name}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Vehicle</Text>
                        <Text style={styles.detailValue}>
                            {order.car_make} {order.car_model} ({order.car_year})
                        </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Part Price</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{order.part_price} QAR</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Delivery Fee</Text>
                        <Text style={styles.detailValue}>{order.delivery_fee} QAR</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{order.total_amount} QAR</Text>
                    </View>

                    {/* Download Invoice Button - for completed orders */}
                    {order.order_status === 'completed' && (
                        <TouchableOpacity
                            style={[styles.invoiceButton, isDownloadingInvoice && styles.invoiceButtonDisabled]}
                            onPress={handleDownloadInvoice}
                            disabled={isDownloadingInvoice}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#4f46e5'] as const}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.invoiceGradient}
                            >
                                {isDownloadingInvoice ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.invoiceIcon}>📄</Text>
                                        <Text style={styles.invoiceText}>Download Invoice</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Delivery Address */}
                {order.delivery_address && (
                    <View style={[styles.addressCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery Address</Text>
                        <View style={styles.addressRow}>
                            <Text style={styles.addressIcon}>📍</Text>
                            <Text style={styles.addressText}>{order.delivery_address}</Text>
                        </View>
                    </View>
                )}

                {/* Confirm Delivery Button */}
                {order.order_status === 'delivered' && (
                    <TouchableOpacity
                        style={[styles.confirmButton, isConfirming && styles.confirmButtonDisabled]}
                        onPress={handleConfirmDelivery}
                        disabled={isConfirming}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.confirmGradient}
                        >
                            {isConfirming ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.confirmIcon}>✅</Text>
                                    <Text style={styles.confirmText}>Confirm I Received the Part</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Order Date */}
                <View style={styles.metaInfo}>
                    <Text style={styles.metaText}>
                        Ordered on {new Date(order.created_at).toLocaleDateString()} at{' '}
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Review Modal */}
            <Modal
                visible={showReviewModal}
                transparent
                animationType="slide"
                onRequestClose={handleSkipReview}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            ⭐ Rate Your Experience
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            How was your experience with {order?.garage_name}?
                        </Text>

                        <ScrollView style={styles.ratingsScroll} showsVerticalScrollIndicator={false}>
                            <StarRating
                                rating={overallRating}
                                onRatingChange={setOverallRating}
                                label="Overall Experience"
                            />
                            <StarRating
                                rating={partQualityRating}
                                onRatingChange={setPartQualityRating}
                                label="Part Quality"
                            />
                            <StarRating
                                rating={communicationRating}
                                onRatingChange={setCommunicationRating}
                                label="Communication"
                            />
                            <StarRating
                                rating={deliveryRating}
                                onRatingChange={setDeliveryRating}
                                label="Delivery Speed"
                            />

                            <Text style={[styles.reviewInputLabel, { color: colors.textSecondary }]}>
                                Write a review (optional)
                            </Text>
                            <TextInput
                                style={[styles.reviewInput, {
                                    backgroundColor: colors.background,
                                    color: colors.text,
                                    borderColor: colors.border
                                }]}
                                placeholder="Share your experience..."
                                placeholderTextColor={colors.textMuted}
                                value={reviewText}
                                onChangeText={setReviewText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.skipButton, { borderColor: colors.border }]}
                                onPress={handleSkipReview}
                            >
                                <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                                    Skip
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, isSubmittingReview && styles.submitButtonDisabled]}
                                onPress={handleSubmitReview}
                                disabled={isSubmittingReview}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.primaryDark || '#6366F1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitGradient}
                                >
                                    {isSubmittingReview ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Submit Review</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.dark.text, letterSpacing: -0.5 },
    scrollView: { flex: 1, padding: Spacing.lg },
    errorText: {
        color: Colors.error,
        fontSize: FontSizes.lg,
        textAlign: 'center',
        marginTop: 100
    },
    statusCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        borderWidth: 2,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    statusGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    statusIcon: { fontSize: 48, marginBottom: Spacing.sm },
    statusLabel: { fontSize: FontSizes.xxl, fontWeight: '800' },
    statusDescription: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs
    },
    progressContainer: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    progressSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    progressStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    progressDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E8E8E8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressDotActive: { backgroundColor: Colors.primary },
    progressCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
    progressLine: { flex: 1, height: 3, backgroundColor: '#E8E8E8' },
    progressLineActive: { backgroundColor: Colors.primary },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    progressLabel: { fontSize: FontSizes.xs, color: Colors.dark.textMuted, textAlign: 'center', width: 45 },
    progressLabelActive: { color: Colors.primary, fontWeight: '600' },
    driverCard: {
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    driverInfo: { flexDirection: 'row', alignItems: 'center' },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        ...Shadows.sm,
    },
    driverAvatarText: { fontSize: 24 },
    driverLabel: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    driverName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    callIcon: { fontSize: 16, marginRight: Spacing.xs },
    callText: { color: '#fff', fontWeight: '700' },
    detailsCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    detailLabel: { fontSize: FontSizes.md, color: Colors.dark.textSecondary },
    detailValue: { fontSize: FontSizes.md, color: Colors.dark.text, textAlign: 'right', flex: 1, fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: Spacing.md },
    totalLabel: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    totalValue: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary },
    addressCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
    addressIcon: { fontSize: 20, marginRight: Spacing.sm },
    addressText: { fontSize: FontSizes.md, color: Colors.dark.text, flex: 1, lineHeight: 22 },
    confirmButton: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadows.md },
    confirmButtonDisabled: { opacity: 0.7 },
    confirmGradient: {
        flexDirection: 'row',
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmIcon: { fontSize: 20, marginRight: Spacing.sm },
    confirmText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },
    metaInfo: { alignItems: 'center', marginTop: Spacing.md },
    metaText: { fontSize: FontSizes.sm, color: Colors.dark.textMuted },
    mapButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    mapButtonGradient: {
        flexDirection: 'row',
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapButtonIcon: { fontSize: 24, marginRight: Spacing.sm },
    mapButtonText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },
    // Invoice Button Styles
    invoiceButton: {
        marginTop: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    invoiceButtonDisabled: {
        opacity: 0.6,
    },
    invoiceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    invoiceIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    invoiceText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
    },
    // Review Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BorderRadius.xl * 1.5,
        borderTopRightRadius: BorderRadius.xl * 1.5,
        padding: Spacing.xl,
        maxHeight: '85%',
    },
    modalTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    modalSubtitle: {
        fontSize: FontSizes.md,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    ratingsScroll: {
        maxHeight: 350,
    },
    ratingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    ratingLabel: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    starsContainer: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    star: {
        fontSize: 28,
        marginHorizontal: 2,
    },
    reviewInputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    reviewInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        minHeight: 100,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.lg,
    },
    skipButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    submitButton: {
        flex: 2,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
    },
});
