import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Modal,
    TextInput,
    Linking,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { orderApi, onOrderStatusUpdated } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows, API_CONFIG, ORDER_STATUS } from '../constants';

interface StatusHistoryItem {
    status: string;
    created_at: string;
    notes?: string;
}

const OrderDetailsScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
    const [review, setReview] = useState<any>(null);

    // Review Modal
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState('');

    useEffect(() => {
        loadDetails();
        const unsub = onOrderStatusUpdated((data) => {
            if (data.order_id === orderId) loadDetails();
        });
        return () => { if (unsub) unsub(); };
    }, [orderId]);

    const loadDetails = async () => {
        try {
            setLoading(true);
            const response = await orderApi.getDetails(orderId);
            setOrder(response.data.order);
            setStatusHistory(response.data.status_history || []);
            setReview(response.data.review);
        } catch (error) {
            console.error('Failed to load order details:', error);
            Alert.alert('Error', 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status: string) => {
        return ORDER_STATUS[status as keyof typeof ORDER_STATUS] || { label: status, color: 'textSecondary', icon: 'help-circle-outline' };
    };

    const handleCallDriver = () => {
        if (order?.driver_phone) {
            Linking.openURL(`tel:${order.driver_phone}`);
        }
    };

    const handleTrackDelivery = () => {
        navigation.navigate('DeliveryTracking', { orderId });
    };

    const handleCancelOrder = () => {
        navigation.navigate('CancellationPreview', { orderId });
    };

    const handleReportIssue = () => {
        navigation.navigate('Dispute', { orderId });
    };

    const handleConfirmDelivery = async () => {
        Alert.alert(
            'Confirm Delivery',
            'Have you received the part and verified it matches your order?',
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Yes, Confirm',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await orderApi.confirmDelivery(orderId);
                            Alert.alert('Success', 'Delivery confirmed! Please leave a review.');
                            loadDetails();
                            setReviewModalVisible(true);
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to confirm delivery');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const submitReview = async () => {
        try {
            setLoading(true);
            await orderApi.submitReview(orderId, {
                overall_rating: rating,
                quality_rating: rating,
                communication_rating: rating,
                timeliness_rating: rating,
                review_text: reviewText
            });
            setReviewModalVisible(false);
            Alert.alert('Thank You!', 'Your review helps other customers.');
            loadDetails();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to submit review');
        } finally {
            setLoading(false);
        }
    };

    const canCancel = order && ['pending', 'processing'].includes(order.order_status);
    const canTrack = order && ['assigned_for_pickup', 'collected', 'out_for_delivery'].includes(order.order_status);
    const canConfirm = order && order.order_status === 'delivered';
    const canDispute = order && ['delivered', 'completed'].includes(order.order_status) && !review;

    if (loading && !order) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const statusInfo = getStatusInfo(order?.order_status || '');
    const statusColor = colors[statusInfo.color as keyof typeof colors] || colors.textSecondary;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Order #{order?.order_number}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: statusColor + '15' }, Shadows.sm]}>
                    <Ionicons name={statusInfo.icon as any} size={32} color={statusColor} />
                    <Text style={[styles.statusValue, { color: statusColor }]}>{statusInfo.label}</Text>
                    <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
                        {order?.order_status === 'out_for_delivery' && order?.estimated_delivery
                            ? `ETA: ${new Date(order.estimated_delivery).toLocaleTimeString()}`
                            : `Updated ${new Date(order?.updated_at).toLocaleDateString()}`}
                    </Text>
                </View>

                {/* Track Delivery Button - Prominent when available */}
                {canTrack && (
                    <TouchableOpacity
                        style={[styles.trackBtn, { backgroundColor: colors.primary }]}
                        onPress={handleTrackDelivery}
                    >
                        <Ionicons name="location" size={24} color="#fff" />
                        <View style={styles.trackBtnText}>
                            <Text style={styles.trackBtnTitle}>Track Delivery</Text>
                            <Text style={styles.trackBtnSub}>View live driver location</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Driver Info Card - Show when driver assigned */}
                {order?.driver_id && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="car-sport" size={20} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Driver</Text>
                        </View>
                        <View style={styles.driverCard}>
                            <View style={styles.driverInfo}>
                                <Text style={[styles.driverName, { color: colors.text }]}>{order.driver_name}</Text>
                                <Text style={[styles.vehicleInfo, { color: colors.textSecondary }]}>
                                    {order.vehicle_type} • {order.vehicle_plate}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.callBtn, { backgroundColor: colors.success + '20' }]}
                                onPress={handleCallDriver}
                            >
                                <Ionicons name="call" size={20} color={colors.success} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Part Details */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="cog" size={20} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Part Details</Text>
                    </View>
                    <Text style={[styles.partName, { color: colors.text }]}>{order?.part_description}</Text>
                    <View style={styles.row}>
                        <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {order?.car_make} {order?.car_model} {order?.car_year}
                        </Text>
                    </View>
                    <View style={styles.chipRow}>
                        <View style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>{order?.part_condition}</Text>
                        </View>
                        {order?.brand_name && (
                            <View style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                <Text style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>{order.brand_name}</Text>
                            </View>
                        )}
                        {order?.warranty_days > 0 && (
                            <View style={[styles.chip, { backgroundColor: colors.success + '20' }]}>
                                <Text style={{ color: colors.success, fontSize: FontSize.xs }}>{order.warranty_days} day warranty</Text>
                            </View>
                        )}
                    </View>

                    {/* Part Images */}
                    {(order?.bid_images?.length > 0 || order?.request_images?.length > 0) && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                            {(order?.bid_images || order?.request_images || []).map((url: string, idx: number) => (
                                <Image
                                    key={idx}
                                    source={{ uri: url.startsWith('http') ? url : `${API_CONFIG.BASE_URL.replace('/api', '')}${url}` }}
                                    style={styles.partImage}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Garage Info */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="business" size={20} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sold By</Text>
                    </View>
                    <Text style={[styles.garageName, { color: colors.text }]}>{order?.garage_name}</Text>
                    <View style={styles.row}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                            {order?.rating_average && !isNaN(parseFloat(order.rating_average)) ? parseFloat(order.rating_average).toFixed(1) : 'New'} ({order?.rating_count || 0} reviews)
                        </Text>
                    </View>
                </View>

                {/* Payment Info */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card" size={20} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment</Text>
                    </View>
                    <View style={styles.paymentRow}>
                        <Text style={{ color: colors.textSecondary }}>Part Price</Text>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{order?.part_price} QAR</Text>
                    </View>
                    <View style={styles.paymentRow}>
                        <Text style={{ color: colors.textSecondary }}>Delivery</Text>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{order?.delivery_fee || 0} QAR</Text>
                    </View>
                    <View style={[styles.paymentRow, styles.totalRow, { borderTopColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: FontSize.lg }}>Total</Text>
                        <Text style={{ color: colors.success, fontWeight: '700', fontSize: FontSize.xl }}>{order?.total_amount} QAR</Text>
                    </View>
                    <View style={styles.paymentMethod}>
                        <Ionicons name={order?.payment_method === 'card' ? 'card-outline' : 'cash-outline'} size={16} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, marginLeft: Spacing.xs }}>{order?.payment_method?.toUpperCase() || 'CASH'}</Text>
                    </View>
                </View>

                {/* Status Timeline */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="time" size={20} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Timeline</Text>
                    </View>
                    {statusHistory.map((item, idx) => {
                        const info = getStatusInfo(item.status);
                        const itemColor = colors[info.color as keyof typeof colors] || colors.textMuted;
                        const isLast = idx === statusHistory.length - 1;

                        return (
                            <View key={idx} style={styles.timelineItem}>
                                <View style={styles.timelineDot}>
                                    <View style={[styles.dot, { backgroundColor: isLast ? itemColor : colors.textMuted }]} />
                                    {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                                </View>
                                <View style={styles.timelineContent}>
                                    <Text style={[styles.timelineStatus, { color: isLast ? itemColor : colors.textSecondary }]}>
                                        {info.label}
                                    </Text>
                                    <Text style={[styles.timelineDate, { color: colors.textMuted }]}>
                                        {new Date(item.created_at).toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    {canConfirm && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.success }]}
                            onPress={handleConfirmDelivery}
                        >
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Confirm Delivery</Text>
                        </TouchableOpacity>
                    )}

                    {canDispute && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.warning }]}
                            onPress={handleReportIssue}
                        >
                            <Ionicons name="alert-circle" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Report Issue</Text>
                        </TouchableOpacity>
                    )}

                    {canCancel && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                            onPress={handleCancelOrder}
                        >
                            <Ionicons name="close-circle" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Cancel Order</Text>
                        </TouchableOpacity>
                    )}

                    {/* Always show support option */}
                    <TouchableOpacity
                        style={[styles.actionBtnOutline, { borderColor: colors.border }]}
                        onPress={() => navigation.navigate('Support')}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                        <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>Contact Support</Text>
                    </TouchableOpacity>
                </View>

                {/* Existing Review */}
                {review && (
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="star" size={20} color="#FFD700" />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Review</Text>
                        </View>
                        <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <Ionicons
                                    key={star}
                                    name={star <= review.overall_rating ? "star" : "star-outline"}
                                    size={20}
                                    color="#FFD700"
                                />
                            ))}
                        </View>
                        {review.review_text && (
                            <Text style={[styles.reviewText, { color: colors.textSecondary }]}>{review.review_text}</Text>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Review Modal */}
            <Modal
                visible={reviewModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setReviewModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Rate Your Experience</Text>

                        <View style={styles.stars}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                    <Ionicons
                                        name={star <= rating ? "star" : "star-outline"}
                                        size={40}
                                        color="#FFD700"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            placeholder="Share your experience (optional)..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={() => setReviewModalVisible(false)}
                            >
                                <Text style={{ color: colors.text }}>Skip</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={submitReview}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { padding: Spacing.lg, paddingBottom: 100 },

    statusBanner: { padding: Spacing.xl, borderRadius: BorderRadius.lg, alignItems: 'center', marginBottom: Spacing.lg },
    statusValue: { fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing.sm },
    statusSubtext: { fontSize: FontSize.sm, marginTop: Spacing.xs },

    trackBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
    trackBtnText: { flex: 1, marginLeft: Spacing.md },
    trackBtnTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
    trackBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },

    section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700' },

    driverCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    driverInfo: { flex: 1 },
    driverName: { fontSize: FontSize.lg, fontWeight: '600' },
    vehicleInfo: { fontSize: FontSize.sm, marginTop: 2 },
    callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    partName: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    detailText: { fontSize: FontSize.md },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
    chip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
    imageScroll: { marginTop: Spacing.md },
    partImage: { width: 100, height: 100, borderRadius: BorderRadius.md, marginRight: Spacing.sm },

    garageName: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.xs },
    ratingText: { fontSize: FontSize.sm },

    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    totalRow: { borderTopWidth: 1, paddingTop: Spacing.md, marginTop: Spacing.md },
    paymentMethod: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },

    timelineItem: { flexDirection: 'row', marginBottom: Spacing.md },
    timelineDot: { alignItems: 'center', marginRight: Spacing.md },
    dot: { width: 12, height: 12, borderRadius: 6 },
    line: { width: 2, flex: 1, marginTop: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.md },
    timelineStatus: { fontSize: FontSize.md, fontWeight: '600' },
    timelineDate: { fontSize: FontSize.xs, marginTop: 2 },

    actions: { gap: Spacing.md, marginTop: Spacing.lg },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg },
    actionBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
    actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    actionBtnOutlineText: { fontSize: FontSize.md, fontWeight: '600' },

    reviewStars: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
    reviewText: { fontSize: FontSize.md, fontStyle: 'italic' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
    modalContent: { borderRadius: BorderRadius.lg, padding: Spacing.xl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.lg, textAlign: 'center' },
    stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, height: 100, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
    modalBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
});

export default OrderDetailsScreen;
