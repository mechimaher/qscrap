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
    TextInput
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { requestApi, orderApi, bidApi, negotiationApi, onGarageCounterOffer, onCounterOfferAccepted, onCounterOfferRejected } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows, Colors, API_CONFIG } from '../constants';

const RequestDetailsScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const { requestId } = route.params as { requestId: string };

    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);
    const [bids, setBids] = useState<any[]>([]);

    // Negotiation Modal State
    const [negotiateModalVisible, setNegotiateModalVisible] = useState(false);
    const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
    const [counterAmount, setCounterAmount] = useState('');
    const [negotiationMessage, setNegotiationMessage] = useState('');

    useEffect(() => {
        loadDetails();

        // Listen for real-time updates
        const unsub1 = onGarageCounterOffer(() => loadDetails());
        const unsub2 = onCounterOfferAccepted(() => loadDetails());
        const unsub3 = onCounterOfferRejected(() => loadDetails());

        return () => {
            if (unsub1) unsub1();
            if (unsub2) unsub2();
            if (unsub3) unsub3();
        };
    }, [requestId]);

    const loadDetails = async () => {
        try {
            setLoading(true);
            const response = await requestApi.getDetails(requestId);
            setRequest(response.data.request);
            setBids(response.data.bids || []);
        } catch (error) {
            console.error('Failed to load details:', error);
            Alert.alert('Error', 'Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptBid = async (bidId: string, amount: number) => {
        Alert.alert(
            'Accept Bid',
            `Are you sure you want to accept this bid for ${amount} QAR?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await orderApi.acceptBid(bidId);
                            Alert.alert('Success', 'Bid accepted! Order created.');
                            navigation.goBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to accept bid');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRejectBid = async (bidId: string) => {
        Alert.alert(
            'Reject Bid',
            'Are you sure you want to reject this bid?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await bidApi.reject(bidId);
                            loadDetails(); // Reload to update status
                        } catch (error) {
                            Alert.alert('Error', 'Failed to reject bid');
                        }
                    }
                }
            ]
        );
    };

    const openNegotiateModal = (bidId: string) => {
        setSelectedBidId(bidId);
        setCounterAmount('');
        setNegotiationMessage('');
        setNegotiateModalVisible(true);
    };

    const submitCounterOffer = async () => {
        if (!selectedBidId || !counterAmount) {
            Alert.alert('Error', 'Please enter an amount');
            return;
        }

        try {
            setLoading(true);
            await negotiationApi.createCounterOffer(selectedBidId, parseFloat(counterAmount), negotiationMessage);
            setNegotiateModalVisible(false);
            Alert.alert('Success', 'Counter-offer sent to garage');
            loadDetails();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to send counter-offer');
        } finally {
            setLoading(false);
        }
    };

    // Handle accepting a garage counter offer
    const handleAcceptCounterOffer = async (counterOfferId: string, amount: number) => {
        Alert.alert(
            'Accept Counter Offer',
            `Accept the garage's counter offer of ${amount} QAR?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await negotiationApi.respondToGarageCounterOffer(counterOfferId, 'accept', '');
                            Alert.alert('Success', 'Counter offer accepted!');
                            loadDetails();
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to accept counter offer');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Handle rejecting a garage counter offer
    const handleRejectCounterOffer = async (counterOfferId: string) => {
        Alert.alert(
            'Decline Counter Offer',
            'Are you sure you want to decline this counter offer?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await negotiationApi.respondToGarageCounterOffer(counterOfferId, 'reject', '');
                            Alert.alert('Declined', 'Counter offer declined');
                            loadDetails();
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to decline counter offer');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Image Viewer State
    const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);

    const openImageViewer = (images: string[], index: number) => {
        const formattedImages = images.map(url => ({
            uri: url.startsWith('http') ? url : `${API_CONFIG.BASE_URL.replace('/api', '')}${url}`
        }));
        setViewerImages(formattedImages);
        setCurrentImageIndex(index);
        setIsImageViewerVisible(true);
    };

    if (loading && !request) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Request Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Request Info */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.partName, { color: colors.text }]}>{request?.part_description}</Text>
                    <View style={styles.row}>
                        <Ionicons name="car-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {request?.car_make} {request?.car_model} {request?.car_year}
                        </Text>
                    </View>
                    {request?.vin_number && (
                        <View style={styles.row}>
                            <Ionicons name="barcode-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>VIN: {request.vin_number}</Text>
                        </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: request?.status === 'active' ? colors.success + '20' : colors.textMuted + '20', alignSelf: 'flex-start', marginTop: Spacing.sm }]}>
                        <Text style={{ color: request?.status === 'active' ? colors.success : colors.textMuted, fontWeight: '700', fontSize: FontSize.xs }}>
                            {request?.status?.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Bids List */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Bids ({bids.length})</Text>

                {bids.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Waiting for garages to bid...</Text>
                    </View>
                ) : (
                    bids.map((bid) => (
                        <View key={bid.bid_id} style={[styles.bidCard, { backgroundColor: colors.surface }, Shadows.md]}>
                            <View style={styles.bidHeader}>
                                <View>
                                    <Text style={[styles.garageName, { color: colors.text }]}>{bid.garage_name}</Text>
                                    <View style={styles.ratingRow}>
                                        <Ionicons name="star" size={14} color="#FFD700" />
                                        <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{bid.garage_rating || 'New'}</Text>
                                    </View>
                                </View>
                                <View style={styles.priceContainer}>
                                    {/* Show counter offer amount if available */}
                                    {bid.garage_counter_amount ? (
                                        <>
                                            <Text style={[styles.originalPrice, { color: colors.textMuted, textDecorationLine: 'line-through' }]}>
                                                {bid.original_bid_amount || bid.bid_amount} QAR
                                            </Text>
                                            <Text style={[styles.counterOfferAmount, { color: colors.warning }]}>
                                                {bid.garage_counter_amount} QAR
                                            </Text>
                                            <View style={[styles.counterBadge, { backgroundColor: colors.warning + '20' }]}>
                                                <Ionicons name="swap-horizontal" size={12} color={colors.warning} />
                                                <Text style={[styles.counterBadgeText, { color: colors.warning }]}>Counter Offer</Text>
                                            </View>
                                        </>
                                    ) : (
                                        <Text style={[styles.bidAmount, { color: colors.success }]}>{bid.bid_amount} QAR</Text>
                                    )}
                                </View>
                            </View>

                            {/* Show garage message if counter offer */}
                            {bid.garage_counter_message && (
                                <View style={[styles.counterMessage, { backgroundColor: colors.warning + '10', borderLeftColor: colors.warning }]}>
                                    <Text style={[styles.counterMessageText, { color: colors.textSecondary }]}>
                                        "{bid.garage_counter_message}"
                                    </Text>
                                </View>
                            )}

                            <View style={styles.bidDetails}>
                                <Text style={{ color: colors.textSecondary }}>Condition: {bid.part_condition}</Text>
                                <Text style={{ color: colors.textSecondary }}>Warranty: {bid.warranty_days} days</Text>
                            </View>

                            {/* Part Images Gallery */}
                            {bid.image_urls && bid.image_urls.length > 0 && (
                                <View style={styles.imageGalleryContainer}>
                                    <View style={styles.imageGalleryHeader}>
                                        <Ionicons name="images-outline" size={16} color={colors.textSecondary} />
                                        <Text style={[styles.imageGalleryTitle, { color: colors.textSecondary }]}>
                                            Part Photos ({bid.image_urls.length})
                                        </Text>
                                        <Text style={[styles.zoomHint, { color: colors.primary }]}>
                                            Tap to zoom
                                        </Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bidImages}>
                                        {bid.image_urls.map((url: string, idx: number) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => openImageViewer(bid.image_urls, idx)}
                                                activeOpacity={0.85}
                                                style={styles.bidImageWrapper}
                                            >
                                                <Image
                                                    source={{ uri: url.startsWith('http') ? url : `${API_CONFIG.BASE_URL.replace('/api', '')}${url}` }}
                                                    style={styles.bidImage}
                                                    resizeMode="cover"
                                                />
                                                <View style={[styles.zoomOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                                                    <Ionicons name="expand" size={20} color="#fff" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Action buttons for pending bids */}
                            {bid.status === 'pending' && (
                                <>
                                    {/* If garage sent counter offer, show accept/reject for that */}
                                    {bid.garage_counter_id ? (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}
                                                onPress={() => handleRejectCounterOffer(bid.garage_counter_id)}
                                            >
                                                <Text style={{ color: colors.danger, fontWeight: '600' }}>Decline</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.primary + '20' }]}
                                                onPress={() => openNegotiateModal(bid.bid_id)}
                                            >
                                                <Text style={{ color: colors.primary, fontWeight: '600' }}>Counter</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.success, flex: 1 }]}
                                                onPress={() => handleAcceptCounterOffer(bid.garage_counter_id, bid.garage_counter_amount)}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '600' }}>Accept {bid.garage_counter_amount} QAR</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}
                                                onPress={() => handleRejectBid(bid.bid_id)}
                                            >
                                                <Text style={{ color: colors.danger, fontWeight: '600' }}>Reject</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.warning + '20' }]}
                                                onPress={() => openNegotiateModal(bid.bid_id)}
                                            >
                                                <Text style={{ color: colors.warning, fontWeight: '600' }}>Negotiate</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.success, flex: 1 }]}
                                                onPress={() => handleAcceptBid(bid.bid_id, bid.bid_amount)}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '600' }}>Accept</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            )}

                            {bid.status !== 'pending' && (
                                <View style={[styles.statusBanner, { backgroundColor: bid.status === 'rejected' ? colors.danger + '20' : colors.textMuted + '20' }]}>
                                    <Text style={{ color: bid.status === 'rejected' ? colors.danger : colors.textMuted, fontWeight: '600' }}>
                                        Bid {bid.status}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Negotiation Modal */}
            <Modal
                visible={negotiateModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setNegotiateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Make Counter Offer</Text>

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Your Price (QAR)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={counterAmount}
                            onChangeText={setCounterAmount}
                        />

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Message (Optional)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, height: 80 }]}
                            placeholder="Add a note..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            value={negotiationMessage}
                            onChangeText={setNegotiationMessage}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={() => setNegotiateModalVisible(false)}
                            >
                                <Text style={{ color: colors.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={submitCounterOffer}
                            >
                                <Text style={{ color: '#fff' }}>Send Offer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Premium Image Viewer */}
            <ImageViewing
                images={viewerImages}
                imageIndex={currentImageIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setIsImageViewerVisible(false)}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                FooterComponent={({ imageIndex }) => (
                    <View style={{ flex: 1, alignItems: 'center', marginBottom: 40 }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                            {imageIndex + 1} / {viewerImages.length}
                        </Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { padding: Spacing.lg },
    section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
    partName: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    detailText: { fontSize: FontSize.md },
    statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
    emptyState: { alignItems: 'center', padding: Spacing.xl },
    emptyText: { marginTop: Spacing.md, fontSize: FontSize.md },
    bidCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
    bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    garageName: { fontSize: FontSize.lg, fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { fontSize: FontSize.sm },
    bidAmount: { fontSize: FontSize.xl, fontWeight: '700' },
    bidDetails: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
    bidImages: { flexDirection: 'row', marginTop: Spacing.xs },
    bidImageWrapper: { position: 'relative', marginRight: Spacing.sm },
    bidImage: { width: 100, height: 100, borderRadius: BorderRadius.md },
    zoomOverlay: { position: 'absolute', bottom: 0, right: 0, padding: 4, borderTopLeftRadius: BorderRadius.md },
    imageGalleryContainer: { marginBottom: Spacing.md, marginTop: Spacing.sm },
    imageGalleryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    imageGalleryTitle: { fontSize: FontSize.sm, fontWeight: '500' },
    zoomHint: { fontSize: FontSize.xs, marginLeft: 'auto', fontWeight: '600' },
    actionButtons: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
    statusBanner: { padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
    modalContent: { borderRadius: BorderRadius.lg, padding: Spacing.xl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.lg, textAlign: 'center' },
    label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md },
    input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md },
    modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
    modalBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
    // Counter offer styles
    priceContainer: { alignItems: 'flex-end' },
    originalPrice: { fontSize: FontSize.sm },
    counterOfferAmount: { fontSize: FontSize.xl, fontWeight: '700' },
    counterBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, marginTop: 4 },
    counterBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
    counterMessage: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md, borderLeftWidth: 3 },
    counterMessageText: { fontSize: FontSize.sm, fontStyle: 'italic' },
});

export default RequestDetailsScreen;
