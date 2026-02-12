import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
// QScrap Request Detail Screen - Premium 2026 Design
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Request, Bid } from '../services/api';
import { BidComparisonModal } from '../components/BidComparisonModal';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../../App';
import ImageViewerModal from '../components/ImageViewerModal';
import { useSocketContext } from '../hooks/useSocket';
import { WaitStateReassurance } from '../components/WaitStateReassurance';
import { useToast } from '../components/Toast';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection } from '../utils/rtl';

// Extracted components
import HeroRequestCard from '../components/request/HeroRequestCard';
import BidComparisonBar from '../components/request/BidComparisonBar';
import PremiumBidCard from '../components/request/PremiumBidCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// ============================================
// SKELETON LOADING
// ============================================
const SkeletonLoading = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const SkeletonBox = ({ style }: { style: any }) => (
        <View style={[styles.skeletonBox, style]}>
            <Animated.View style={[
                styles.skeletonShimmer,
                { transform: [{ translateX: shimmerTranslate }] }
            ]} />
        </View>
    );

    return (
        <View style={styles.skeletonContainer}>
            {/* Hero skeleton */}
            <SkeletonBox style={styles.skeletonHero} />

            {/* Bids skeleton */}
            <SkeletonBox style={styles.skeletonBid} />
            <SkeletonBox style={styles.skeletonBid} />
        </View>
    );
};

// ============================================
// MAIN SCREEN COMPONENT
// ============================================
export default function RequestDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { requestId } = route.params as { requestId: string };
    const { socket, newBids } = useSocketContext();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const [request, setRequest] = useState<Request | null>(null);
    const [bids, setBids] = useState<Bid[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewerImages, setViewerImages] = useState<string[]>([]);
    const [isComparisonVisible, setIsComparisonVisible] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);


    useEffect(() => {
        loadRequestDetails();
        const unsubscribe = navigation.addListener('focus', loadRequestDetails);
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        const hasNewBidForThisRequest = newBids.some(b => b.request_id === requestId);
        if (hasNewBidForThisRequest) {
            loadRequestDetails();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [newBids, requestId]);

    useEffect(() => {
        if (!socket) return;
        const handleEvent = () => {
            log('[RequestDetail] Socket event received, refreshing...');
            loadRequestDetails();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };
        // Listen for all counter-offer related events
        socket.on('garage_counter_offer', handleEvent);
        socket.on('counter_offer_received', handleEvent); // Backend also emits this
        socket.on('counter_offer_accepted', handleEvent);
        socket.on('counter_offer_rejected', handleEvent);
        socket.on('bid_updated', handleEvent);
        socket.on('bid_withdrawn', handleEvent); // VVIP Fix: Now listening to bid_withdrawn
        socket.on('bid:superseded', handleEvent); // Flag workflow: corrected bid received
        return () => {
            socket.off('garage_counter_offer', handleEvent);
            socket.off('counter_offer_received', handleEvent);
            socket.off('counter_offer_accepted', handleEvent);
            socket.off('counter_offer_rejected', handleEvent);
            socket.off('bid_updated', handleEvent);
            socket.off('bid_withdrawn', handleEvent);
            socket.off('bid:superseded', handleEvent);
        };
    }, [socket, requestId]);

    const loadRequestDetails = async () => {
        try {
            const data = await api.getRequestDetails(requestId);
            setRequest(data.request);
            const sortedBids = (data.bids || []).sort((a: Bid, b: Bid) => Number(a.bid_amount) - Number(b.bid_amount));
            setBids(sortedBids);
        } catch (error) {
            toast.error(t('common.error'), t('errors.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptBid = async (bid: Bid, priceToShow: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Calculate delivery fee based on request location (Zone-based, not driver position)
        let deliveryFee = 10; // Zone 1 base fee - backend is source of truth
        try {
            if (request?.delivery_lat && request?.delivery_lng) {
                const feeResult = await api.calculateDeliveryFee(
                    parseFloat(request.delivery_lat),
                    parseFloat(request.delivery_lng)
                );
                deliveryFee = feeResult.fee || 10;
            }
        } catch (e) {
            log('Using Zone 1 base delivery fee');
        }

        Alert.alert(
            t('alerts.acceptBidTitle'),
            t('alerts.acceptBidMessage', { name: bid.garage_name, price: priceToShow }) +
            `\n\n${t('alerts.totalBreakdown', { total: priceToShow + deliveryFee, price: priceToShow, fee: deliveryFee, currency: t('common.currency') })}\n\n${t('alerts.chooseMethodHint')}`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('alerts.continueToPayment'),
                    onPress: () => {
                        // CRITICAL: Navigate to Payment screen with bid details
                        // Using unique key to force fresh screen instance (cache-busting)
                        const navigationParams = {
                            bidId: bid.bid_id,
                            garageName: bid.garage_name,
                            partPrice: priceToShow,
                            deliveryFee: deliveryFee,
                            partDescription: request?.part_description || 'Part',
                        };

                        log('========================================');
                        log('[Payment] NAVIGATING TO PAYMENT SCREEN');
                        log('[Payment] Params:', JSON.stringify(navigationParams, null, 2));
                        log('========================================');

                        navigation.navigate('Payment', {
                            ...navigationParams,
                            // Unique key forces new screen instance, bypassing cache
                            _cacheKey: `payment_${bid.bid_id}_${Date.now()}`,
                        });
                    },
                },
            ]
        );
    };

    const handleRejectBid = async (bid: Bid) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            t('alerts.rejectBidTitle'),
            t('alerts.rejectBidMessage', { name: bid.garage_name }),
            [
                { text: t('common.keep'), style: 'cancel' },
                {
                    text: t('common.reject'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.rejectBid(bid.bid_id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setBids(prev => prev.filter(b => b.bid_id !== bid.bid_id));
                        } catch (error: any) {
                            handleApiError(error, toast);
                        }
                    },
                },
            ]
        );
    };

    const handleCounter = (bid: Bid) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('CounterOffer', {
            bidId: bid.bid_id,
            garageName: bid.garage_name,
            currentAmount: (bid as any).garage_counter_amount || (bid as any).last_garage_offer_amount || bid.bid_amount,
            partDescription: request?.part_description || '',
            garageCounterId: (bid as any).garage_counter_id || null,
            requestId: request?.request_id || '',
        });
    };

    const handleImagePress = (images: string[], index: number) => {
        setViewerImages(images);
        setCurrentImageIndex(index);
        setIsViewerVisible(true);
    };



    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                        <Ionicons name="arrow-back" size={20} color={Colors.primary} /> <Text style={styles.backText}>{t('common.back')}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('requestDetail.title')}</Text>
                    <View style={{ width: 60 }} />
                </View>
                <SkeletonLoading />
            </SafeAreaView>
        );
    }

    if (!request) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <Text style={styles.errorText}>{t('errors.requestNotFound')}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Confetti Celebration for First Order */}
            {showConfetti && (
                <ConfettiCannon
                    count={200}
                    origin={{ x: width / 2, y: 0 }}
                    autoStart={true}
                    fadeOut={true}
                    colors={['#8D1B3D', '#C9A227', '#FFD700', '#FFFFFF']}
                    explosionSpeed={350}
                    fallSpeed={2500}
                />
            )}

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Ionicons name="arrow-back" size={20} color={Colors.primary} /> <Text style={styles.backText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('requestDetail.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Hero Card */}
                <HeroRequestCard
                    request={request}
                    colors={colors}
                    onImagePress={handleImagePress}
                />

                {/* Price Comparison Bar */}
                <BidComparisonBar bids={bids} colors={colors} />

                {/* Bids Section */}
                <View style={styles.bidsSection}>
                    <View style={[styles.bidsHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.bidsTitle, { color: colors.text }]}>
                            {bids.length === 0 ? t('requestDetail.waitingForBids') : t('requestDetail.bidCount', { count: bids.length })}
                        </Text>
                        {bids.length >= 2 && (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsComparisonVisible(true);
                                }}
                                style={styles.compareButton}
                            >
                                <LinearGradient
                                    colors={['#8D1B3D', '#C9A227']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.compareGradient}
                                >
                                    <Text style={styles.compareButtonText}>{t('common.compare')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                    {bids.length === 0 ? (
                        <WaitStateReassurance
                            createdAt={request.created_at}
                            colors={{
                                surface: colors.surface,
                                text: colors.text,
                                textSecondary: colors.textSecondary,
                            }}
                        />
                    ) : (
                        bids.map((bid, index) => (
                            <PremiumBidCard
                                key={bid.bid_id}
                                bid={bid}
                                index={index}
                                isBestDeal={index === 0}
                                isActive={request.status === 'active'}
                                colors={colors}
                                onAccept={handleAcceptBid}
                                onCounter={handleCounter}
                                onReject={handleRejectBid}
                                onImagePress={handleImagePress}
                                isAccepting={acceptingBid === bid.bid_id}
                                requestPartDescription={request.part_description}
                            />
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Image Viewer */}
            {viewerImages.length > 0 && (
                <ImageViewerModal
                    visible={isViewerVisible}
                    images={viewerImages}
                    imageIndex={currentImageIndex}
                    onClose={() => setIsViewerVisible(false)}
                />
            )}

            {/* Bid Comparison Modal */}
            <BidComparisonModal
                visible={isComparisonVisible}
                bids={bids}
                onAccept={(bid) => handleAcceptBid(bid, Number(bid.bid_amount))}
                onClose={() => setIsComparisonVisible(false)}
            />


        </SafeAreaView>
    );
}

// ============================================
// STYLES (main screen only)
// ============================================
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
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 },
    scrollView: { flex: 1 },
    errorText: { color: Colors.error, fontSize: FontSizes.lg, textAlign: 'center', marginTop: 100 },

    // Bids Section
    bidsSection: { paddingHorizontal: Spacing.lg },
    bidsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    bidsTitle: { fontSize: FontSizes.xl, fontWeight: '800' },
    compareButton: {
        borderRadius: BorderRadius.full,
        overflow: 'hidden',
    },
    compareGradient: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    compareButtonText: {
        color: '#FFFFFF',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },

    // Skeleton
    skeletonContainer: { padding: Spacing.lg },
    skeletonBox: {
        backgroundColor: '#E8E8E8',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    skeletonShimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    skeletonHero: { height: 280, marginBottom: Spacing.lg },
    skeletonBid: { height: 160, marginBottom: Spacing.md },
});
