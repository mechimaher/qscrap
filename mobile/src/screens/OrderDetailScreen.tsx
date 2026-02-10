// QScrap Order Detail Screen - Premium 2026 Design
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    TextInput,
    Animated,
    Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Order } from '../services/api';
import { SOCKET_URL, API_BASE_URL, UPLOAD_BASE_URL } from '../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { handleApiError } from '../utils/errorHandler';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../../App';
import { useSocketContext } from '../hooks/useSocket';

// Extracted components
import { getStatusConfig } from '../components/order/statusConfig';
import HeroStatusCard from '../components/order/HeroStatusCard';
import VisualTimeline from '../components/order/VisualTimeline';
import DriverCard from '../components/order/DriverCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// ============================================
// SKELETON LOADING
// ============================================
const SkeletonLoading = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1], outputRange: [-width, width],
    });

    const SkeletonBox = ({ style }: { style: any }) => (
        <View style={[styles.skeletonBox, style]}>
            <Animated.View style={[styles.skeletonShimmer, { transform: [{ translateX: shimmerTranslate }] }]} />
        </View>
    );

    return (
        <View style={styles.skeletonContainer}>
            <SkeletonBox style={styles.skeletonHero} />
            <SkeletonBox style={styles.skeletonTimeline} />
            <SkeletonBox style={styles.skeletonDetails} />
        </View>
    );
};

// ============================================
// MAIN SCREEN
// ============================================
export default function OrderDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();
    const { orderUpdates } = useSocketContext();

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
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
            handleApiError(error, toast, { customMessage: t('order.loadFailed'), useAlert: true });
        } finally {
            setIsLoading(false);
        }
    }, [orderId]);

    useFocusEffect(useCallback(() => { loadOrderDetails(); }, [loadOrderDetails]));

    useEffect(() => {
        const relevantUpdate = orderUpdates.find((u: any) => u.order_id === orderId);
        if (relevantUpdate) loadOrderDetails();
    }, [orderUpdates, orderId, loadOrderDetails]);

    const handleConfirmDelivery = async () => {
        Alert.alert(t('order.confirmDelivery'), t('order.haveYouReceived'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('order.confirmReceipt'),
                onPress: async () => {
                    setIsConfirming(true);
                    try {
                        await api.confirmDelivery(orderId);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        loadOrderDetails();
                        setShowReviewModal(true);
                    } catch (error: any) {
                        handleApiError(error, toast, { useAlert: true });
                    } finally {
                        setIsConfirming(false);
                    }
                },
            },
        ]);
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
            Alert.alert(t('review.thankYou'), t('review.submittedMsg'), [
                { text: t('common.ok'), onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            handleApiError(error, toast, { useAlert: true });
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order) return;

        // Determine fee based on status (BRAIN v3.0)
        const isConfirmedStatus = order.order_status === 'confirmed';
        const feeMessage = isConfirmedStatus
            ? t('cancel.feeConfirmed')
            : t('cancel.feePreparing');

        Alert.alert(
            t('cancel.confirmTitle'),
            feeMessage,
            [
                { text: t('common.no'), style: 'cancel' },
                {
                    text: t('common.yes'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsCancelling(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        try {
                            await api.request(`/cancellations/orders/${orderId}/cancel/customer`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    reason_code: 'changed_mind',
                                    reason_text: t('cancel.customerCancelledReason')
                                })
                            });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert(
                                t('cancel.success'),
                                t('cancel.successMessage'),
                                [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
                            );
                        } catch (error: any) {
                            handleApiError(error, toast, { useAlert: true });
                        } finally {
                            setIsCancelling(false);
                        }
                    }
                }
            ]
        );
    };

    const handleCallDriver = () => {
        if (order?.driver_phone) Linking.openURL(`tel:${order.driver_phone}`);
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;
        setIsDownloadingInvoice(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const token = await api.getToken();
            if (!token) {
                Alert.alert(t('auth.sessionExpired'), t('auth.loginAgainInvoice'));
                return;
            }
            const generateResponse = await fetch(`${SOCKET_URL}/api/documents/invoice/${order.order_id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            let documentId = null;
            if (generateResponse.ok) {
                const invoiceData = await generateResponse.json();
                documentId = invoiceData.document?.document_id || invoiceData.document_id;
            } else {
                const docsResponse = await fetch(`${SOCKET_URL}/api/documents/order/${order.order_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const docsData = await docsResponse.json();
                documentId = docsData.documents?.find((d: any) => d.document_type === 'invoice')?.document_id;
            }
            if (!documentId) throw new Error('Could not generate invoice');
            await Linking.openURL(`${SOCKET_URL}/api/documents/public/${documentId}/download?token=${token}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            handleApiError(error, toast, { useAlert: true });
        } finally {
            setIsDownloadingInvoice(false);
        }
    };

    const handleTrackLive = () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Tracking', {
            orderId: order.order_id,
            orderNumber: order.order_number,
            deliveryAddress: order.delivery_address,
        });
    };

    // Star rating component
    const StarRating = ({ rating, onRatingChange, label }: { rating: number; onRatingChange: (r: number) => void; label: string }) => (
        <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => { onRatingChange(star); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                        <Text style={[styles.star, { color: star <= rating ? '#FFD700' : colors.border }]}>★</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={[styles.header, { backgroundColor: colors.surface, flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('order.details')}</Text>
                    <View style={{ width: 60 }} />
                </View>
                <SkeletonLoading />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <Text style={styles.errorText}>{t('order.notFound')}</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = getStatusConfig(order.order_status, t);
    const isInTransit = ['in_transit', 'collected', 'qc_in_progress', 'qc_passed'].includes(order.order_status);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('order.details')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Hero Status */}
                <HeroStatusCard order={order} statusConfig={statusConfig} />

                {/* Live Tracking Button */}
                {isInTransit && (
                    <TouchableOpacity style={styles.trackButton} onPress={handleTrackLive}>
                        <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.trackGradient}>
                            <Text style={styles.trackIcon}>🗺️</Text>
                            <Text style={styles.trackText}>{t('order.openLiveMap')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Driver Card */}
                {order.driver_name && isInTransit && (
                    <DriverCard order={order} onCall={handleCallDriver} t={t} isRTL={isRTL} />
                )}

                {/* Timeline */}
                <VisualTimeline status={order.order_status} colors={colors} t={t} />

                {/* Order Details */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                    {/* Premium Order Summary Header */}
                    <View style={[styles.summaryHeader, { justifyContent: isRTL ? 'flex-end' : 'flex-start' }]}>
                        {!isRTL && <Text style={[styles.summaryIcon, { marginRight: Spacing.sm }]}>📋</Text>}
                        <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL), marginBottom: 0 }]}>{t('common.orderSummary')}</Text>
                        {isRTL && <Text style={[styles.summaryIcon, { marginLeft: Spacing.sm }]}>📋</Text>}
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.detailValue, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('common.garage')}  <Text style={{ fontWeight: '700' }}>{order.garage_name}</Text>
                        </Text>
                    </View>
                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.detailValue, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('common.vehicle')}  <Text style={{ fontWeight: '700' }}>{order.car_make} {order.car_model} ({order.car_year})</Text>
                        </Text>
                    </View>
                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.detailValue, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('common.type')}  <Text style={{ fontWeight: '700' }}>{order.part_category || t('common.part')}</Text>
                        </Text>
                    </View>
                    {order.part_subcategory && (
                        <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.detailValue, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('common.part')}  <Text style={{ fontWeight: '700' }}>{order.part_subcategory}</Text>
                            </Text>
                        </View>
                    )}
                    {order.part_description && (
                        <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.detailValue, { color: colors.textSecondary, fontStyle: 'italic', fontSize: 13, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={3}>
                                {t('order.customerNotes')}  <Text style={{ fontWeight: '700' }}>{order.part_description}</Text>
                            </Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            🔧 {t('order.partPrice')}
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text, fontWeight: '700' }]}>
                            {order.part_price} {t('common.currency')}
                        </Text>
                    </View>
                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            🚚 {t('order.deliveryFee')}
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text, fontWeight: '700' }]}>
                            {order.delivery_fee} {t('common.currency')}
                        </Text>
                    </View>

                    {/* Show loyalty discount if applied */}
                    {(order.loyalty_discount ?? 0) > 0 && (
                        <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.detailLabel, { color: '#10B981' }]}>
                                🎁 {t('order.loyaltyDiscount')}
                            </Text>
                            <Text style={[styles.detailValue, { color: '#10B981', fontWeight: '700' }]}>
                                -{order.loyalty_discount} {t('common.currency')}
                            </Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={[styles.detailRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.totalLabel, { textAlign: rtlTextAlign(isRTL) }]}>
                            {t('common.total')}
                        </Text>
                        <Text style={[styles.totalValue, { color: statusConfig.color, textAlign: rtlTextAlign(isRTL) }]}>{order.total_amount} {t('common.currency')}</Text>
                    </View>

                    {order.order_status === 'completed' && (
                        <>
                            <TouchableOpacity
                                style={[styles.invoiceButton, isDownloadingInvoice && { opacity: 0.6 }]}
                                onPress={handleDownloadInvoice}
                                disabled={isDownloadingInvoice}
                            >
                                <LinearGradient colors={['#8D1B3D', '#6B1530']} style={styles.invoiceGradient}>
                                    {isDownloadingInvoice ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Text style={styles.invoiceIcon}>📄</Text>
                                            <Text style={styles.invoiceText}>{t('order.downloadInvoice')}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.reorderButton}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('NewRequest', {
                                        prefill: {
                                            carMake: order.car_make,
                                            carModel: order.car_model,
                                            carYear: order.car_year,
                                            partDescription: order.part_description || '',
                                            partCategory: order.part_category || '',
                                            partSubCategory: order.part_subcategory || '',
                                        }
                                    });
                                }}
                            >
                                <LinearGradient
                                    colors={['#8D1B3D', '#C9A227']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.reorderGradient}
                                >
                                    <Text style={styles.reorderIcon}>🔄</Text>
                                    <Text style={styles.reorderText}>{t('order.orderAgain')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Delivery Address */}
                {order.delivery_address && order.delivery_address !== 'Location selected' && (
                    <View style={[styles.addressCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('common.deliveryAddress')}</Text>
                        <View style={[styles.addressRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.addressIcon}>📍</Text>
                            <Text style={[styles.addressText, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{order.delivery_address}</Text>
                        </View>
                    </View>
                )}


                {/* Proof of Delivery Image */}
                {order.pod_photo_url && (order.order_status === 'delivered' || order.order_status === 'completed') &&
                    !order.pod_photo_url.startsWith('file://') && (
                        <View style={[styles.addressCard, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                                📸 {t('order.proofOfDelivery')}
                            </Text>
                            <Image
                                source={{
                                    uri: order.pod_photo_url.startsWith('http')
                                        ? order.pod_photo_url
                                        : `${UPLOAD_BASE_URL}${order.pod_photo_url}`
                                }}
                                style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 12 }}
                                resizeMode="cover"
                            />
                        </View>
                    )}

                {/* Confirm Delivery */}
                {order.order_status === 'delivered' && (
                    <TouchableOpacity
                        style={[styles.confirmButton, isConfirming && { opacity: 0.7 }]}
                        onPress={handleConfirmDelivery}
                        disabled={isConfirming}
                    >
                        <LinearGradient colors={['#06B6D4', '#0891B2']} style={styles.confirmGradient}>
                            {isConfirming ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.confirmIcon}>✅</Text>
                                    <Text style={styles.confirmText}>{t('order.confirmReceived')}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Continue Payment - For pending_payment orders */}
                {order.order_status === 'pending_payment' && (
                    <TouchableOpacity
                        style={styles.continuePaymentButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Payment' as any, {
                                bidId: order.bid_id,
                                garageName: order.garage_name,
                                partPrice: order.part_price,
                                deliveryFee: order.delivery_fee,
                                partDescription: order.part_description || 'Part',
                                orderId: order.order_id, // Pass existing order ID to resume payment
                            });
                        }}
                    >
                        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.confirmGradient}>
                            <Text style={styles.confirmIcon}>💳</Text>
                            <Text style={styles.confirmText}>{t('payment.payNow')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Cancel Order - Stage 4-5 per BRAIN v3.0 (confirmed, preparing, ready_for_pickup) */}
                {['confirmed', 'preparing', 'ready_for_pickup'].includes(order.order_status) && (
                    <TouchableOpacity
                        style={[styles.cancelOrderButton, isCancelling && { opacity: 0.7 }]}
                        onPress={handleCancelOrder}
                        disabled={isCancelling}
                    >
                        {isCancelling ? (
                            <ActivityIndicator color="#EF4444" />
                        ) : (
                            <>
                                <Text style={styles.cancelOrderIcon}>✕</Text>
                                <Text style={styles.cancelOrderText}>{t('order.cancelOrder')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* Order Date */}
                <View style={styles.metaInfo}>
                    <Text style={styles.metaText}>
                        {t('order.orderedAt', { date: new Date(order.created_at).toLocaleDateString(), time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Review Modal */}
            <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>⭐ {t('review.title')}</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                            {t('review.howWasExp', { garage: order?.garage_name })}
                        </Text>

                        <ScrollView style={styles.ratingsScroll} showsVerticalScrollIndicator={false}>
                            <StarRating rating={overallRating} onRatingChange={setOverallRating} label={t('review.overall')} />
                            <StarRating rating={partQualityRating} onRatingChange={setPartQualityRating} label={t('review.quality')} />
                            <StarRating rating={communicationRating} onRatingChange={setCommunicationRating} label={t('review.communication')} />
                            <StarRating rating={deliveryRating} onRatingChange={setDeliveryRating} label={t('review.delivery')} />

                            <Text style={[styles.reviewInputLabel, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{t('review.writeReview')}</Text>
                            <TextInput
                                style={[styles.reviewInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('review.placeholder')}
                                placeholderTextColor={colors.textMuted}
                                value={reviewText}
                                onChangeText={setReviewText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </ScrollView>

                        <View style={[styles.modalButtons, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <TouchableOpacity style={[styles.skipButton, { borderColor: colors.border }]} onPress={() => setShowReviewModal(false)}>
                                <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>{t('common.skip')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, isSubmittingReview && { opacity: 0.7 }]}
                                onPress={handleSubmitReview}
                                disabled={isSubmittingReview}
                            >
                                <LinearGradient colors={[Colors.primary, '#B31D4A']} style={styles.submitGradient}>
                                    {isSubmittingReview ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>{t('common.submit')}</Text>
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

// ============================================
// STYLES (main screen only — hero, timeline, driver styles moved to components)
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: { padding: Spacing.sm, borderRadius: BorderRadius.md },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 },
    scrollView: { flex: 1 },
    errorText: { color: Colors.error, fontSize: FontSizes.lg, textAlign: 'center', marginTop: 100 },

    // Section title (shared by details card + address card)
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.lg },

    // Track button
    trackButton: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
    trackGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
    trackIcon: { fontSize: 24, marginRight: Spacing.sm },
    trackText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },

    // Details - Enhanced Order Summary Card
    detailsCard: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        ...Shadows.md
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    summaryIcon: { fontSize: 24 },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E8E8E8',
        marginBottom: Spacing.lg,
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, paddingVertical: Spacing.sm },
    detailLabel: { fontSize: FontSizes.md, color: '#737373', fontWeight: '500' },
    detailValue: { fontSize: FontSizes.md, fontWeight: '700', color: '#333', textAlign: 'right' },
    divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: Spacing.md },
    totalLabel: { fontSize: FontSizes.lg, fontWeight: '700' },
    totalValue: { fontSize: FontSizes.xl, fontWeight: '800' },
    invoiceButton: { marginTop: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
    invoiceGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
    invoiceIcon: { fontSize: 20, marginRight: Spacing.sm },
    invoiceText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    reorderButton: { marginTop: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
    reorderGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
    reorderIcon: { fontSize: 20, marginRight: Spacing.sm },
    reorderText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },

    // Address
    addressCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
    addressIcon: { fontSize: 20, marginRight: Spacing.sm },
    addressText: { fontSize: FontSizes.md, flex: 1, lineHeight: 22 },

    // Continue Payment
    continuePaymentButton: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },

    // Confirm
    confirmButton: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
    confirmGradient: { flexDirection: 'row', paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
    confirmIcon: { fontSize: 20, marginRight: Spacing.sm },
    confirmText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },

    metaInfo: { alignItems: 'center', marginTop: Spacing.md },
    metaText: { fontSize: FontSizes.sm, color: '#737373' },

    // Skeleton
    skeletonContainer: { padding: Spacing.lg },
    skeletonBox: { backgroundColor: '#E8E8E8', borderRadius: BorderRadius.xl, overflow: 'hidden' },
    skeletonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' },
    skeletonHero: { height: 200, marginBottom: Spacing.lg },
    skeletonTimeline: { height: 250, marginBottom: Spacing.lg },
    skeletonDetails: { height: 180 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BorderRadius.xl * 1.5, borderTopRightRadius: BorderRadius.xl * 1.5, padding: Spacing.xl, maxHeight: '85%' },
    modalTitle: { fontSize: FontSizes.xxl, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.xs },
    modalSubtitle: { fontSize: FontSizes.md, textAlign: 'center', marginBottom: Spacing.lg },
    ratingsScroll: { maxHeight: 350 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    ratingLabel: { fontSize: FontSizes.md, fontWeight: '600' },
    starsContainer: { flexDirection: 'row', gap: Spacing.xs },
    star: { fontSize: 28, marginHorizontal: 2 },
    reviewInputLabel: { fontSize: FontSizes.sm, fontWeight: '600', marginTop: Spacing.lg, marginBottom: Spacing.sm },
    reviewInput: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSizes.md, minHeight: 100 },
    modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    skipButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, alignItems: 'center' },
    skipButtonText: { fontSize: FontSizes.md, fontWeight: '600' },
    submitButton: { flex: 2, borderRadius: BorderRadius.xl, overflow: 'hidden' },
    submitGradient: { paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    submitButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },

    // Cancel Order Button
    cancelOrderButton: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 2,
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cancelOrderIcon: { fontSize: 18, color: '#EF4444', marginRight: Spacing.sm, fontWeight: '700' },
    cancelOrderText: { fontSize: FontSizes.md, fontWeight: '700', color: '#EF4444' },
});
