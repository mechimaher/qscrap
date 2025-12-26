// QScrap Request Detail Screen - Full Featured with Bid Viewing
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Request, Bid } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../config/api';
import { RootStackParamList } from '../../App';
import ImageViewerModal from '../components/ImageViewerModal';
import { useSocketContext } from '../hooks/useSocket';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RequestDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { requestId } = route.params as { requestId: string };
    const { socket, newBids } = useSocketContext();
    const { colors } = useTheme();

    const [request, setRequest] = useState<Request | null>(null);
    const [bids, setBids] = useState<Bid[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Load data on mount and when screen regains focus (e.g., after CounterOfferScreen)
    useEffect(() => {
        loadRequestDetails();

        // Also reload when screen comes back into focus
        const unsubscribe = navigation.addListener('focus', () => {
            loadRequestDetails();
        });
        return unsubscribe;
    }, [navigation]);

    // Reload when new bids arrive for this request (from global socket context)
    useEffect(() => {
        const hasNewBidForThisRequest = newBids.some(b => b.request_id === requestId);
        if (hasNewBidForThisRequest) {
            loadRequestDetails();
        }
    }, [newBids, requestId]);

    // Listen for counter-offer events on the authenticated socket
    useEffect(() => {
        if (!socket) return;

        const handleCounterOfferEvent = (data: any) => {
            console.log('[RequestDetail] Counter-offer event received:', data);
            loadRequestDetails();
        };

        socket.on('garage_counter_offer', handleCounterOfferEvent);
        socket.on('counter_offer_accepted', handleCounterOfferEvent);
        socket.on('counter_offer_rejected', handleCounterOfferEvent);
        socket.on('bid_updated', handleCounterOfferEvent);

        return () => {
            socket.off('garage_counter_offer', handleCounterOfferEvent);
            socket.off('counter_offer_accepted', handleCounterOfferEvent);
            socket.off('counter_offer_rejected', handleCounterOfferEvent);
            socket.off('bid_updated', handleCounterOfferEvent);
        };
    }, [socket, requestId]);

    const loadRequestDetails = async () => {
        try {
            const data = await api.getRequestDetails(requestId);
            setRequest(data.request);
            // Sort bids by amount (lowest first for customer benefit)
            const sortedBids = (data.bids || []).sort((a: Bid, b: Bid) => a.bid_amount - b.bid_amount);
            setBids(sortedBids);
        } catch (error) {
            console.log('Failed to load request:', error);
            Alert.alert('Error', 'Failed to load request details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptBid = async (bid: Bid) => {
        Alert.alert(
            'Accept Bid',
            `Accept bid from ${bid.garage_name} for ${bid.bid_amount} QAR?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        setAcceptingBid(bid.bid_id);
                        try {
                            await api.acceptBid(bid.bid_id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert(
                                'Order Created!',
                                'Your order has been created. The garage will prepare your part.',
                                [{ text: 'View Orders', onPress: () => navigation.goBack() }]
                            );
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to accept bid');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        } finally {
                            setAcceptingBid(null);
                        }
                    },
                },
            ]
        );
    };

    const handleRejectBid = async (bid: Bid) => {
        Alert.alert(
            'Reject Bid',
            `Are you sure you want to reject the bid from ${bid.garage_name}?`,
            [
                { text: 'Keep Bid', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.rejectBid(bid.bid_id, 'Customer rejected bid');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            // Remove bid from list
                            setBids(prev => prev.filter(b => b.bid_id !== bid.bid_id));
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to reject bid');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                    },
                },
            ]
        );
    };

    const handleCancelRequest = async () => {
        Alert.alert(
            'Cancel Request',
            'Are you sure you want to cancel this request? All bids will be rejected.',
            [
                { text: 'Keep Request', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.cancelRequest(requestId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            navigation.goBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to cancel request');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                    },
                },
            ]
        );
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'active': return { color: Colors.success, label: 'Active', icon: '🟢' };
            case 'accepted': return { color: Colors.info, label: 'Accepted', icon: '✓' };
            case 'expired': return { color: Colors.dark.textMuted, label: 'Expired', icon: '⏰' };
            default: return { color: Colors.dark.textSecondary, label: status, icon: '•' };
        }
    };

    const getConditionLabel = (condition: string) => {
        switch (condition) {
            case 'new': return { label: 'New', color: Colors.success };
            case 'used_excellent': return { label: 'Used - Excellent', color: Colors.info };
            case 'used_good': return { label: 'Used - Good', color: Colors.info };
            case 'used_fair': return { label: 'Used - Fair', color: Colors.warning };
            case 'refurbished': return { label: 'Refurbished', color: Colors.primary };
            default: return { label: condition, color: Colors.dark.textSecondary };
        }
    };

    const renderBid = (bid: Bid) => {
        const conditionInfo = getConditionLabel(bid.part_condition);
        const isAccepting = acceptingBid === bid.bid_id;
        const isAccepted = bid.status === 'accepted';

        // Check for garage counter-offer (pending response from customer) or last garage offer
        const hasGarageCounterOffer = !!(bid as any).garage_counter_amount;
        const garageCounterAmount = (bid as any).garage_counter_amount;
        const lastGarageOfferAmount = (bid as any).last_garage_offer_amount;
        const negotiationRounds = parseInt((bid as any).negotiation_rounds) || 0;

        // Customer's last counter-offer
        const customerCounterAmount = (bid as any).customer_counter_amount;
        const customerCounterStatus = (bid as any).customer_counter_status;

        // Check if garage accepted the customer's counter-offer (negotiation complete, waiting for customer to finalize)
        const isNegotiationAgreed = customerCounterStatus === 'accepted';

        // Determine the CURRENT GARAGE PRICE (what customer will pay if they accept)
        // Priority: pending garage counter-offer > last garage offer > original bid
        // NOTE: We show garage's price, not customer's counter (customer's counter is what THEY offered)
        const currentGaragePrice = garageCounterAmount || lastGarageOfferAmount || bid.bid_amount;
        const hasNegotiatedPrice = !!(garageCounterAmount || lastGarageOfferAmount);

        // Agreed price is customer's counter if garage accepted it (customer needs to finalize)
        const agreedPrice = isNegotiationAgreed ? customerCounterAmount : null;

        // Display price for Accept button: agreed price (if garage accepted customer's counter) OR current garage price
        const displayPrice = agreedPrice || currentGaragePrice;

        return (
            <View key={bid.bid_id} style={[
                styles.bidCard,
                { backgroundColor: colors.surface },
                isAccepted && styles.bidCardAccepted,
                isNegotiationAgreed && !isAccepted && styles.bidCardAgreed,
                hasGarageCounterOffer && !isNegotiationAgreed && styles.bidCardCounterOffer
            ]}>
                {/* Accepted Badge (ORDER CREATED) */}
                {isAccepted && (
                    <View style={styles.acceptedBadge}>
                        <Text style={styles.acceptedBadgeText}>✓ ACCEPTED</Text>
                    </View>
                )}

                {/* Price Agreed Badge (negotiation complete, waiting for customer to create order) */}
                {isNegotiationAgreed && !isAccepted && (
                    <View style={styles.agreedBadge}>
                        <Text style={styles.agreedBadgeText}>✓ PRICE AGREED - Click Accept!</Text>
                    </View>
                )}

                {/* Counter-Offer Badge */}
                {hasGarageCounterOffer && !isAccepted && !isNegotiationAgreed && (
                    <View style={styles.counterOfferBadge}>
                        <Text style={styles.counterOfferBadgeText}>🔄 NEW COUNTER-OFFER</Text>
                    </View>
                )}

                <View style={styles.bidHeader}>
                    <View style={styles.garageInfo}>
                        <Text style={[styles.garageName, { color: colors.text }]}>{bid.garage_name}</Text>
                        {bid.rating_average && (
                            <View style={styles.ratingContainer}>
                                <Text style={styles.ratingStar}>⭐</Text>
                                <Text style={styles.ratingText}>
                                    {bid.rating_average.toFixed(1)} ({bid.rating_count})
                                </Text>
                            </View>
                        )}
                        {negotiationRounds > 0 && (
                            <Text style={styles.negotiationRounds}>
                                Round {negotiationRounds}/3
                            </Text>
                        )}
                    </View>
                    <View style={styles.priceContainer}>
                        {hasNegotiatedPrice ? (
                            <>
                                <Text style={styles.originalPriceStrike}>{bid.bid_amount} QAR</Text>
                                <Text style={styles.counterPriceLabel}>
                                    {isNegotiationAgreed ? 'Agreed Price' : (hasGarageCounterOffer ? 'Garage Offers' : 'Garage Price')}
                                </Text>
                                <Text style={styles.counterPriceAmount}>{displayPrice} QAR</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.priceLabel}>{isAccepted ? 'Final Price' : 'Price'}</Text>
                                <Text style={styles.priceAmount}>{bid.bid_amount} QAR</Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Negotiation Summary - shows customer's offer */}
                {negotiationRounds > 0 && (
                    <View style={styles.negotiationSummary}>
                        {customerCounterAmount && (
                            <View style={styles.negotiationRow}>
                                <Text style={styles.negotiationLabel}>👤 You offered:</Text>
                                <Text style={[
                                    styles.negotiationValue,
                                    customerCounterStatus === 'pending' && styles.negotiationPending,
                                    customerCounterStatus === 'accepted' && styles.negotiationAccepted,
                                    customerCounterStatus === 'rejected' && styles.negotiationRejected,
                                    customerCounterStatus === 'countered' && styles.negotiationCountered,
                                ]}>
                                    {customerCounterAmount} QAR
                                    {customerCounterStatus === 'pending' && ' (waiting)'}
                                    {customerCounterStatus === 'countered' && ' (countered)'}
                                </Text>
                            </View>
                        )}
                        {hasGarageCounterOffer && (
                            <View style={styles.negotiationRow}>
                                <Text style={styles.negotiationLabel}>🏭 Garage countered:</Text>
                                <Text style={[styles.negotiationValue, styles.negotiationPending]}>
                                    {garageCounterAmount} QAR (waiting for you)
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.bidDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Condition</Text>
                        <View style={[styles.conditionBadge, { backgroundColor: conditionInfo.color + '20' }]}>
                            <Text style={[styles.conditionText, { color: conditionInfo.color }]}>
                                {conditionInfo.label}
                            </Text>
                        </View>
                    </View>

                    {bid.warranty_days > 0 && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Warranty</Text>
                            <Text style={styles.detailValue}>{bid.warranty_days} days</Text>
                        </View>
                    )}

                    {bid.notes && (
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>Notes</Text>
                            <Text style={styles.notesText}>{bid.notes}</Text>
                        </View>
                    )}
                </View>

                {/* Only show actions for active requests with pending bids */}
                {request?.status === 'active' && !isAccepted && (
                    <View style={styles.bidActions}>
                        {/* Accept Button - show counter amount if available */}
                        <TouchableOpacity
                            style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
                            onPress={() => handleAcceptBid(bid)}
                            disabled={isAccepting}
                        >
                            <LinearGradient
                                colors={['#22c55e', '#16a34a'] as const}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.acceptGradient}
                            >
                                {isAccepting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.acceptText}>
                                        ✓ Accept {hasGarageCounterOffer ? `${garageCounterAmount} QAR` : ''}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Counter-Offer Button - hide when max rounds reached */}
                        {negotiationRounds < 3 && (
                            <TouchableOpacity
                                style={styles.counterButton}
                                onPress={() => navigation.navigate('CounterOffer', {
                                    bidId: bid.bid_id,
                                    garageName: bid.garage_name,
                                    currentAmount: displayPrice,
                                    partDescription: request.part_description,
                                    // Pass garage counter ID if responding to a pending offer
                                    garageCounterId: (bid as any).garage_counter_id || null,
                                })}
                            >
                                <Text style={styles.counterText}>↩ Counter</Text>
                            </TouchableOpacity>
                        )}

                        {/* Reject Button */}
                        <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => handleRejectBid(bid)}
                        >
                            <Text style={styles.rejectText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (!request) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Request not found</Text>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo(request.status);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Request Details</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Request Card */}
                <View style={[styles.requestCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.requestHeader}>
                        <View>
                            <Text style={[styles.carName, { color: colors.text }]}>{request.car_make} {request.car_model}</Text>
                            <Text style={styles.carYear}>{request.car_year}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                            <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                {statusInfo.label}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Part Needed</Text>
                    <Text style={[styles.partDescription, { color: colors.text }]}>{request.part_description}</Text>

                    {request.part_number && (
                        <>
                            <Text style={styles.sectionLabel}>Part Number</Text>
                            <Text style={styles.partNumber}>{request.part_number}</Text>
                        </>
                    )}

                    {request.vin_number && (
                        <>
                            <Text style={styles.sectionLabel}>VIN</Text>
                            <Text style={styles.vinNumber}>{request.vin_number}</Text>
                        </>
                    )}

                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                            Created: {new Date(request.created_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.metaText}>
                            Expires: {new Date(request.expires_at).toLocaleDateString()}
                        </Text>
                    </View>

                    {/* Images */}
                    {request.image_urls && request.image_urls.length > 0 && (
                        <ScrollView horizontal style={styles.imagesContainer}>
                            {request.image_urls.map((url, index) => {
                                const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL.replace('/api', '')}${url}`;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => {
                                            setCurrentImageIndex(index);
                                            setIsViewerVisible(true);
                                        }}
                                    >
                                        <Image
                                            source={{ uri: fullUrl }}
                                            style={styles.requestImage}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* Bids Section */}
                <View style={styles.bidsSection}>
                    <Text style={styles.bidsTitle}>
                        {bids.length === 0 ? 'No Bids Yet' : `${bids.length} Bid${bids.length > 1 ? 's' : ''}`}
                    </Text>

                    {bids.length === 0 ? (
                        <View style={styles.noBids}>
                            <Text style={styles.noBidsIcon}>⏳</Text>
                            <Text style={styles.noBidsText}>
                                Waiting for garages to send bids...
                            </Text>
                        </View>
                    ) : (
                        bids.map(renderBid)
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
            {/* Image Viewer */}
            {request && request.image_urls && (
                <ImageViewerModal
                    visible={isViewerVisible}
                    images={request.image_urls.map(url =>
                        url.startsWith('http') ? url : `${API_BASE_URL.replace('/api', '')}${url}`
                    )}
                    imageIndex={currentImageIndex}
                    onClose={() => setIsViewerVisible(false)}
                />
            )}
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
    requestCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    carName: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.dark.text },
    carYear: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: '600' },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    statusIcon: { fontSize: 12, marginRight: Spacing.xs },
    statusText: { fontSize: FontSizes.sm, fontWeight: '600' },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: Spacing.lg,
    },
    sectionLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
        marginTop: Spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    partDescription: { fontSize: FontSizes.lg, color: Colors.dark.text, lineHeight: 24 },
    partNumber: { fontSize: FontSizes.md, color: Colors.dark.text, fontFamily: 'monospace' },
    vinNumber: { fontSize: FontSizes.md, color: Colors.dark.text, fontFamily: 'monospace' },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.lg,
    },
    metaText: { fontSize: FontSizes.sm, color: Colors.dark.textMuted },
    imagesContainer: { marginTop: Spacing.lg },
    requestImage: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.lg,
        marginRight: Spacing.sm,
    },
    bidsSection: { marginTop: Spacing.xl },
    bidsTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.dark.text,
        marginBottom: Spacing.lg,
    },
    noBids: { alignItems: 'center', padding: Spacing.xl },
    noBidsIcon: { fontSize: 48, marginBottom: Spacing.md },
    noBidsText: { fontSize: FontSizes.md, color: Colors.dark.textSecondary, textAlign: 'center' },
    bidCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    bidCardAccepted: {
        borderColor: Colors.success,
        borderWidth: 2,
        backgroundColor: '#E8F5E9',
    },
    acceptedBadge: {
        backgroundColor: Colors.success,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        alignSelf: 'flex-start',
        marginBottom: Spacing.md,
    },
    acceptedBadgeText: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
    // Counter-offer styles
    bidCardCounterOffer: {
        borderColor: Colors.warning,
        borderWidth: 2,
        backgroundColor: '#FFF8E1',
    },
    counterOfferBadge: {
        backgroundColor: Colors.warning,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        alignSelf: 'flex-start',
        marginBottom: Spacing.md,
    },
    counterOfferBadgeText: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
    // Price agreed styles (garage accepted customer's counter)
    bidCardAgreed: {
        borderColor: Colors.success,
        borderWidth: 2,
        backgroundColor: '#E8F5E9',
    },
    agreedBadge: {
        backgroundColor: Colors.success,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        alignSelf: 'flex-start',
        marginBottom: Spacing.md,
    },
    agreedBadgeText: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
    originalPriceStrike: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textMuted,
        textDecorationLine: 'line-through',
    },
    counterPriceLabel: {
        fontSize: FontSizes.xs,
        color: Colors.warning,
        fontWeight: '600',
    },
    counterPriceAmount: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.warning,
    },
    negotiationRounds: {
        fontSize: FontSizes.xs,
        color: Colors.primary,
        fontWeight: '600',
        marginTop: Spacing.xs,
    },
    bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    garageInfo: { flex: 1 },
    garageName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
    ratingStar: { fontSize: 14, marginRight: Spacing.xs },
    ratingText: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    priceContainer: { alignItems: 'flex-end' },
    priceLabel: { fontSize: FontSizes.xs, color: Colors.dark.textSecondary },
    priceAmount: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
    // Negotiation summary styles
    negotiationSummary: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginTop: Spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    negotiationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    negotiationLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    negotiationValue: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    negotiationPending: {
        color: Colors.warning,
    },
    negotiationAccepted: {
        color: Colors.success,
    },
    negotiationRejected: {
        color: Colors.error,
    },
    negotiationCountered: {
        color: Colors.info,
    },
    bidDetails: { marginTop: Spacing.md },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    detailLabel: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    detailValue: { fontSize: FontSizes.md, color: Colors.dark.text, fontWeight: '500' },
    conditionBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full
    },
    conditionText: { fontSize: FontSizes.sm, fontWeight: '600' },
    notesContainer: { marginTop: Spacing.sm },
    notesLabel: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary, marginBottom: Spacing.xs },
    notesText: { fontSize: FontSizes.md, color: Colors.dark.text, fontStyle: 'italic' },
    bidActions: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    acceptButton: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    acceptButtonDisabled: { opacity: 0.7 },
    acceptGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    acceptText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    counterButton: {
        flex: 0.8,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    counterText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.primary,
    },
    rejectButton: {
        width: 44,
        height: 44,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.error
    },
    cancelRequestButton: {
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginTop: Spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.error,
    },
    cancelRequestText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.error,
    },
});
