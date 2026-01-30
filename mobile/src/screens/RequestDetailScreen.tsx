// QScrap Request Detail Screen - Premium 2026 Design
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Request, Bid } from '../services/api';
import { BidComparisonModal } from '../components/BidComparisonModal';
import { SocialProofBadges } from '../components/SocialProofBadges';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL, UPLOAD_BASE_URL } from '../config/api';
import { RootStackParamList } from '../../App';
import ImageViewerModal from '../components/ImageViewerModal';
import { useSocketContext } from '../hooks/useSocket';

import { useToast } from '../components/Toast';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// ============================================
// HERO REQUEST CARD - Premium Header Component
// ============================================
const HeroRequestCard = ({
    request,
    colors,
    onImagePress
}: {
    request: Request;
    colors: any;
    onImagePress: (images: string[], index: number) => void;
}) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<{ text: string; urgency: string } | null>(null);

    const { t, isRTL } = useTranslation();

    // Calculate time remaining
    const calculateTimeRemaining = useCallback(() => {
        if (!request.expires_at) return null;
        const now = new Date();
        const expires = new Date(request.expires_at);
        const diff = expires.getTime() - now.getTime();

        if (diff <= 0) return { text: t('common.expired'), urgency: 'expired' };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        let urgency = 'normal';
        if (hours <= 6) urgency = 'critical';
        else if (hours <= 24) urgency = 'warning';

        if (days > 0) {
            return { text: `${days}d ${remainingHours}h ${minutes}m`, urgency };
        }
        return { text: `${hours}h ${minutes}m`, urgency };
    }, [request.expires_at]);

    useEffect(() => {
        setTimeRemaining(calculateTimeRemaining());
        countdownRef.current = setInterval(() => {
            setTimeRemaining(calculateTimeRemaining());
        }, 60000); // Update every minute

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [calculateTimeRemaining]);

    // Pulse animation for active status
    useEffect(() => {
        if (request.status === 'active') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [request.status]);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return { color: '#22C55E', bg: '#DCFCE7', icon: '🟢', label: t('status.active') };
            case 'accepted': return { color: '#3B82F6', bg: '#DBEAFE', icon: '✓', label: t('status.accepted') };
            case 'expired': return { color: '#9CA3AF', bg: '#F3F4F6', icon: '⏰', label: t('status.expired') };
            default: return { color: '#6B7280', bg: '#F3F4F6', icon: '•', label: status };
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'critical': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#22C55E';
        }
    };

    const statusConfig = getStatusConfig(request.status);
    const isActive = request.status === 'active';

    const pulseOpacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
    });

    return (
        <LinearGradient
            colors={isActive ? ['#1a1a2e', '#16213e', '#0f0f23'] : ['#f8f9fa', '#e9ecef', '#dee2e6']}
            style={styles.heroCard}
        >
            {/* Status Badge */}
            <View style={[styles.heroHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Animated.View style={[
                    styles.heroStatusBadge,
                    { backgroundColor: statusConfig.bg },
                    isActive && { opacity: pulseOpacity }
                ]}>
                    <Text style={styles.heroStatusIcon}>{statusConfig.icon}</Text>
                    <Text style={[styles.heroStatusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </Animated.View>

                {/* Countdown Timer */}
                {isActive && timeRemaining && (
                    <View style={[
                        styles.countdownBadge,
                        { backgroundColor: getUrgencyColor(timeRemaining.urgency) + '20' }
                    ]}>
                        <Text style={styles.countdownIcon}>⏱</Text>
                        <Text style={[
                            styles.countdownText,
                            { color: getUrgencyColor(timeRemaining.urgency) }
                        ]}>
                            {timeRemaining.text}
                        </Text>
                    </View>
                )}
            </View>

            {/* Car Info */}
            <View style={[styles.heroCarInfo, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={[styles.heroCarEmoji, isRTL ? { marginLeft: Spacing.md, marginRight: 0 } : { marginRight: Spacing.md, marginLeft: 0 }]}>🚗</Text>
                <View style={styles.heroCarDetails}>
                    <Text style={[styles.heroCarName, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.car_make} {request.car_model}
                    </Text>
                    <Text style={[styles.heroCarYear, !isActive && { color: Colors.primary }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.car_year}
                    </Text>
                </View>
            </View>

            {/* Divider */}
            <View style={[styles.heroDivider, !isActive && { backgroundColor: '#dee2e6' }]} />

            {/* Part Category & Description */}
            <View style={styles.heroSection}>
                <Text style={[styles.heroLabel, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                    {t('requestDetail.partNeeded')}
                </Text>
                {request.part_category ? (
                    <>
                        <Text style={[styles.heroPartDescription, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                            {request.part_category}{(request as any).part_subcategory ? ` > ${(request as any).part_subcategory}` : ''}
                        </Text>
                        {request.part_description && request.part_description !== request.part_category && (
                            <Text style={[styles.heroPartNotes, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.part_description}
                            </Text>
                        )}
                    </>
                ) : (
                    <Text style={[styles.heroPartDescription, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.part_description}
                    </Text>
                )}
            </View>

            {/* Part Number & VIN */}
            {(request.part_number || request.vin_number) && (
                <View style={[styles.heroMetaRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    {request.part_number && (
                        <View style={styles.heroMetaItem}>
                            <Text style={[styles.heroMetaLabel, !isActive && { color: '#737373' }, { textAlign: rtlTextAlign(isRTL) }]}>{t('requestDetail.partNumber')}</Text>
                            <Text style={[styles.heroMetaValue, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.part_number}
                            </Text>
                        </View>
                    )}
                    {request.vin_number && (
                        <View style={styles.heroMetaItem}>
                            <Text style={[styles.heroMetaLabel, !isActive && { color: '#737373' }, { textAlign: rtlTextAlign(isRTL) }]}>{t('common.vin')}</Text>
                            <Text style={[styles.heroMetaValue, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.vin_number}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Images */}
            {request.image_urls && request.image_urls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroImages}>
                    {request.image_urls.map((url, index) => {
                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    const images = request.image_urls!.map(u =>
                                        u.startsWith('http') ? u : `${UPLOAD_BASE_URL}${u}`
                                    );
                                    onImagePress(images, index);
                                }}
                                activeOpacity={0.85}
                            >
                                <Image source={{ uri: fullUrl }} style={styles.heroImage} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {/* Vehicle ID Photos */}
            {((request as any).car_front_image_url || (request as any).car_rear_image_url) && (
                <>
                    <Text style={[styles.heroLabel, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        🚗 {t('newRequest.vehicleIdPhotos')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroImages}>
                        {(request as any).car_front_image_url && (
                            <View style={{ marginRight: 12 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = (request as any).car_front_image_url;
                                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                        onImagePress([fullUrl], 0);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Image
                                        source={{
                                            uri: ((request as any).car_front_image_url as string).startsWith('http')
                                                ? (request as any).car_front_image_url
                                                : `${UPLOAD_BASE_URL}${(request as any).car_front_image_url}`
                                        }}
                                        style={styles.heroImage}
                                    />
                                    <Text style={styles.vehiclePhotoLabel}>{t('newRequest.frontView')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {(request as any).car_rear_image_url && (
                            <View>
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = (request as any).car_rear_image_url;
                                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                        onImagePress([fullUrl], 0);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Image
                                        source={{
                                            uri: ((request as any).car_rear_image_url as string).startsWith('http')
                                                ? (request as any).car_rear_image_url
                                                : `${UPLOAD_BASE_URL}${(request as any).car_rear_image_url}`
                                        }}
                                        style={styles.heroImage}
                                    />
                                    <Text style={styles.vehiclePhotoLabel}>{t('newRequest.rearView')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </>
            )}
        </LinearGradient>
    );
};

// Assuming 'styles' is defined elsewhere in the file,
// the following style would be added to it:
// heroImage: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },
// vehiclePhotoLabel: {
//     position: 'absolute',
//     bottom: 4,
//     left: 4,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 6,
//     fontSize: 10,
//     color: '#fff',
//     fontWeight: '600'
// },

// ============================================
// BID COMPARISON BAR - Visual Price Range
// ============================================

const BidComparisonBar = ({ bids, colors }: { bids: Bid[]; colors: any }) => {
    const { t, isRTL } = useTranslation();
    if (bids.length < 2) return null;

    const prices = bids.map(b => Number(b.bid_amount));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    if (range === 0) return null;

    return (
        <View style={[styles.comparisonContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.comparisonTitle, { textAlign: rtlTextAlign(isRTL) }]}>{t('requestDetail.priceRange')}</Text>
            <View style={styles.comparisonBar}>
                <LinearGradient
                    colors={['#22C55E', '#F59E0B', '#EF4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.comparisonGradient}
                >
                    {bids.map((bid, index) => {
                        const position = range > 0 ? ((Number(bid.bid_amount) - minPrice) / range) * 100 : 50;
                        return (
                            <View
                                key={bid.bid_id}
                                style={[styles.comparisonDot, { left: isRTL ? undefined : `${position}%`, right: isRTL ? `${position}%` : undefined }]}
                            >
                                <View style={styles.comparisonDotInner} />
                            </View>
                        );
                    })}
                </LinearGradient>
            </View>
            <View style={[styles.comparisonLabels, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={styles.comparisonMin}>{minPrice} {t('common.qar')}</Text>
                <Text style={styles.comparisonMax}>{maxPrice} {t('common.qar')}</Text>
            </View>
        </View>
    );
};

// ============================================
// PREMIUM BID CARD - Glassmorphism Style
// ============================================
const PremiumBidCard = ({
    bid,
    index,
    isBestDeal,
    isActive,
    colors,
    onAccept,
    onCounter,
    onReject,
    onImagePress,
    isAccepting,
    requestPartDescription,
}: {
    bid: Bid;
    index: number;
    isBestDeal: boolean;
    isActive: boolean;
    colors: any;
    onAccept: (bid: Bid, price: number) => void;
    onCounter: (bid: Bid) => void;
    onReject: (bid: Bid) => void;
    onImagePress: (images: string[], index: number) => void;
    isAccepting: boolean;
    requestPartDescription: string;
}) => {
    const { t, isRTL } = useTranslation();
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                delay: index * 100,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [index]);

    const conditionInfo = getConditionLabel(bid.part_condition, t);
    const isAccepted = bid.bid_status === 'accepted';

    // Negotiation state
    const hasGarageCounterOffer = !!(bid as any).garage_counter_amount;
    const garageCounterAmount = (bid as any).garage_counter_amount;
    const lastGarageOfferAmount = (bid as any).last_garage_offer_amount;
    const negotiationRounds = parseInt((bid as any).negotiation_rounds) || 0;
    const originalBidAmount = (bid as any).original_bid_amount || bid.bid_amount;
    const customerCounterAmount = (bid as any).customer_counter_amount;
    const customerCounterStatus = (bid as any).customer_counter_status;
    const isNegotiationAgreed = customerCounterStatus === 'accepted';
    const currentGaragePrice = garageCounterAmount || lastGarageOfferAmount || bid.bid_amount;
    const hasNegotiatedPrice = !!(garageCounterAmount || lastGarageOfferAmount || negotiationRounds > 0);
    const agreedPrice = isNegotiationAgreed ? customerCounterAmount : null;
    const displayPrice = agreedPrice || currentGaragePrice;

    // TURN VALIDATION: Customer can only accept if they don't have a pending counter-offer
    // (i.e., it's customer's turn to respond, not garage's)
    const isCustomersTurn = customerCounterStatus !== 'pending';

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    return (
        <Animated.View style={[
            styles.premiumBidCard,
            {
                backgroundColor: colors.surface,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                opacity: fadeAnim
            },
            isBestDeal && styles.bestDealCard,
            isAccepted && styles.acceptedCard,
            isNegotiationAgreed && !isAccepted && styles.agreedCard,
            hasGarageCounterOffer && !isNegotiationAgreed && styles.counterOfferCard,
        ]}>
            {/* Best Price Badge - Enhanced */}
            {isBestDeal && !isAccepted && (
                <View style={[styles.bestDealBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.bestDealText}>{t('bidCard.bestPrice')}</Text>
                </View>
            )}

            {/* Accepted Badge */}
            {isAccepted && (
                <View style={[styles.acceptedBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.acceptedBadgeText}>{t('bidCard.orderCreated')}</Text>
                </View>
            )}

            {/* Price Agreed Badge */}
            {isNegotiationAgreed && !isAccepted && (
                <View style={[styles.agreedBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.agreedBadgeText}>{t('bidCard.priceAgreed')}</Text>
                </View>
            )}

            {/* Counter-Offer Badge */}
            {hasGarageCounterOffer && !isAccepted && !isNegotiationAgreed && (
                <View style={[styles.counterBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.counterBadgeText}>{t('bidCard.counterOffer')}</Text>
                </View>
            )}

            {/* Garage Profile Header */}
            <View style={[styles.garageProfileHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.garagePhotoContainer}>
                    {bid.garage_photo_url ? (
                        <Image
                            source={{ uri: bid.garage_photo_url }}
                            style={styles.garagePhoto}
                        />
                    ) : (
                        <View style={[styles.garagePhoto, styles.garagePhotoFallback]}>
                            <Text style={styles.garagePhotoEmoji}>🏪</Text>
                        </View>
                    )}
                </View>
                <View style={styles.garageInfoSection}>
                    <Text style={[styles.garageName, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{bid.garage_name}</Text>
                    {bid.rating_average && (
                        <View style={[styles.garageRatingRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.ratingStarSmall}>⭐</Text>
                            <Text style={styles.ratingValueSmall}>{bid.rating_average.toFixed(1)}</Text>
                        </View>
                    )}
                    {/* Social Proof Badges */}
                    <SocialProofBadges
                        avgResponseTime={(bid as any).avg_response_time_minutes}
                        ratingAverage={bid.rating_average}
                        totalTransactions={(bid as any).total_transactions}
                    />
                </View>
            </View>

            {/* Header: Garage Info + Price */}
            <View style={[styles.bidHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.garageInfo}>
                    <Text style={[styles.garageName, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{bid.garage_name}</Text>
                    {bid.rating_average && (
                        <View style={[styles.ratingRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.ratingStar}>⭐</Text>
                            <Text style={styles.ratingText}>
                                {bid.rating_average.toFixed(1)} ({bid.rating_count})
                            </Text>
                        </View>
                    )}
                    {negotiationRounds > 0 && (
                        <Text style={[styles.roundsText, { textAlign: rtlTextAlign(isRTL) }]}>
                            {t('bidCard.negotiationRound', { current: negotiationRounds, total: 3 })}
                        </Text>
                    )}
                </View>
                <View style={[styles.priceSection, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
                    {hasNegotiatedPrice ? (
                        <>
                            <Text style={styles.originalPrice}>{originalBidAmount} {t('common.qar')}</Text>
                            <Text style={styles.currentPriceLabel}>
                                {isNegotiationAgreed ? t('bidCard.agreed') : t('bidCard.offered')}
                            </Text>
                            <Text style={[
                                styles.currentPrice,
                                isNegotiationAgreed && { color: '#22C55E' }
                            ]}>
                                {displayPrice} {t('common.qar')}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.priceLabel}>{isAccepted ? t('bidCard.final') : t('bidCard.price')}</Text>
                            <Text style={[styles.priceAmount, isBestDeal && { color: '#22C55E' }]}>
                                {bid.bid_amount} {t('common.qar')}
                            </Text>
                        </>
                    )}
                </View>
            </View>

            {/* Negotiation Summary */}
            {negotiationRounds > 0 && (
                <View style={[styles.negotiationBox, { borderLeftWidth: isRTL ? 0 : 3, borderRightWidth: isRTL ? 3 : 0, borderRightColor: Colors.primary }]}>
                    {customerCounterAmount && (
                        <View style={[styles.negotiationRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.negotiationLabel}>{t('bidCard.youOffered')}</Text>
                            <Text style={[
                                styles.negotiationValue,
                                customerCounterStatus === 'accepted' && { color: '#22C55E' },
                                customerCounterStatus === 'countered' && { color: '#F59E0B' },
                            ]}>
                                {customerCounterAmount} {t('common.qar')}
                                {customerCounterStatus === 'countered' && ` ${t('bidCard.counteredStatus')}`}
                            </Text>
                        </View>
                    )}
                    {hasGarageCounterOffer && (
                        <View style={[styles.negotiationRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.negotiationLabel}>{t('bidCard.garageOffers')}</Text>
                            <Text style={[styles.negotiationValue, { color: '#F59E0B' }]}>
                                {garageCounterAmount} {t('common.qar')}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Details */}
            <View style={[styles.bidDetails, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.detailChip}>
                    <Text style={[styles.detailChipText, { color: conditionInfo.color }]}>
                        {conditionInfo.label}
                    </Text>
                </View>
                {bid.warranty_days > 0 && (
                    <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.warrantyBadgeGradient, { flexDirection: rtlFlexDirection(isRTL) }]}
                    >
                        <Text style={styles.warrantyIcon}>🛡️</Text>
                        <Text style={styles.warrantyBadgeText}>
                            {t('bidCard.warrantyDays', { count: bid.warranty_days })}
                        </Text>
                    </LinearGradient>
                )}
            </View>

            {/* Notes */}
            {bid.notes && (
                <Text style={[styles.bidNotes, { textAlign: rtlTextAlign(isRTL) }]}>"{bid.notes}"</Text>
            )}

            {/* Bid Images */}
            {bid.image_urls && bid.image_urls.length > 0 && (
                <View style={styles.bidImagesSection}>
                    <Text style={[styles.bidImagesLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('bidCard.garagePartPhotos')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ transform: isRTL ? [{ scaleX: -1 }] : [] }}>
                        <View style={{ flexDirection: 'row', transform: isRTL ? [{ scaleX: -1 }] : [] }}>
                            {bid.image_urls.map((url, idx) => {
                                const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => {
                                            const images = bid.image_urls!.map(u =>
                                                u.startsWith('http') ? u : `${UPLOAD_BASE_URL}${u}`
                                            );
                                            onImagePress(images, idx);
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Image source={{ uri: fullUrl }} style={[styles.bidImage, isRTL ? { marginRight: 0, marginLeft: Spacing.sm } : { marginRight: Spacing.sm }]} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Part Condition Photos */}
            {bid.condition_photos && bid.condition_photos.length > 0 && (
                <View style={styles.conditionSection}>
                    <View style={[styles.conditionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={[styles.conditionTitle, { color: colors.text }]}>
                            📸 {t('bidCard.conditionPhotos')}
                        </Text>
                        <Text style={styles.conditionCount}>
                            {t('bidCard.photoCount', { count: bid.condition_photos.length })}
                        </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ transform: isRTL ? [{ scaleX: -1 }] : [] }}>
                        <View style={{ flexDirection: 'row', transform: isRTL ? [{ scaleX: -1 }] : [] }}>
                            {bid.condition_photos.map((url, idx) => {
                                const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            const images = bid.condition_photos!.map(u =>
                                                u.startsWith('http') ? u : `${UPLOAD_BASE_URL}${u}`
                                            );
                                            onImagePress(images, idx);
                                        }}
                                        activeOpacity={0.85}
                                        style={[styles.conditionPhotoWrapper, isRTL ? { marginRight: 0, marginLeft: Spacing.sm } : { marginRight: Spacing.sm }]}
                                    >
                                        <Image source={{ uri: fullUrl }} style={styles.conditionPhoto} />
                                        <View style={styles.photoOverlay}>
                                            <Text style={styles.photoOverlayIcon}>🔍</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Actions */}
            {isActive && !isAccepted && (
                <View style={[styles.bidActions, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    {isCustomersTurn ? (
                        <TouchableOpacity
                            style={[styles.acceptBtn, isAccepting && { opacity: 0.7 }]}
                            onPress={() => onAccept(bid, displayPrice)}
                            onPressIn={handlePressIn}
                            onPressOut={handlePressOut}
                            disabled={isAccepting}
                        >
                            <LinearGradient
                                colors={['#22c55e', '#16a34a']}
                                style={styles.acceptGradient}
                            >
                                {isAccepting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.acceptBtnText}>
                                        ✓ {t('common.accept')} {hasNegotiatedPrice ? `${displayPrice}` : ''}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.acceptBtn, { opacity: 0.5 }]}>
                            <LinearGradient
                                colors={['#9CA3AF', '#6B7280']}
                                style={styles.acceptGradient}
                            >
                                <Text style={styles.acceptBtnText}>⏳ {t('bidCard.waitingForGarage', 'Waiting for garage')}</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {negotiationRounds < 3 && isCustomersTurn && (
                        <TouchableOpacity
                            style={styles.counterBtn}
                            onPress={() => onCounter(bid)}
                        >
                            <Text style={styles.counterBtnText}>↩ {t('common.counter')}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => onReject(bid)}
                    >
                        <Text style={styles.rejectBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}
        </Animated.View>
    );
};

// Helper function
const getConditionLabel = (condition: string, t: any) => {
    switch (condition) {
        case 'new': return { label: t('condition.new'), color: '#22C55E' };
        case 'used_excellent': return { label: t('condition.used_excellent'), color: '#3B82F6' };
        case 'used_good': return { label: t('condition.used_good'), color: '#3B82F6' };
        case 'used_fair': return { label: t('condition.used_fair'), color: '#F59E0B' };
        case 'refurbished': return { label: t('condition.refurbished'), color: Colors.primary };
        default: return { label: condition, color: '#6B7280' };
    }
};

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
            console.log('[RequestDetail] Socket event received, refreshing...');
            loadRequestDetails();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };
        // Listen for all counter-offer related events
        socket.on('garage_counter_offer', handleEvent);
        socket.on('counter_offer_received', handleEvent); // Backend also emits this
        socket.on('counter_offer_accepted', handleEvent);
        socket.on('counter_offer_rejected', handleEvent);
        socket.on('bid_updated', handleEvent);
        return () => {
            socket.off('garage_counter_offer', handleEvent);
            socket.off('counter_offer_received', handleEvent);
            socket.off('counter_offer_accepted', handleEvent);
            socket.off('counter_offer_rejected', handleEvent);
            socket.off('bid_updated', handleEvent);
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

        // Calculate delivery fee based on request location
        let deliveryFee = 25; // Default zone 1
        try {
            if (request?.delivery_lat && request?.delivery_lng) {
                const feeResult = await api.calculateDeliveryFee(
                    parseFloat(request.delivery_lat),
                    parseFloat(request.delivery_lng)
                );
                deliveryFee = feeResult.fee || 25;
            }
        } catch (e) {
            console.log('Using default delivery fee');
        }

        Alert.alert(
            t('alerts.acceptBidTitle'),
            t('alerts.acceptBidMessage', { name: bid.garage_name, price: priceToShow }) +
            `\n\nTotal: ${priceToShow + deliveryFee} QAR\n(Part: ${priceToShow} QAR + Delivery: ${deliveryFee} QAR)\n\nYou can choose payment method on the next screen.`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Continue to Payment',
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

                        console.log('========================================');
                        console.log('🚀 NAVIGATING TO PAYMENT SCREEN');
                        console.log('📦 Params:', JSON.stringify(navigationParams, null, 2));
                        console.log('========================================');

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
                            toast.error(t('common.error'), error.message || t('errors.rejectBidFailed'));
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
                        <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
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
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
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
                            {bids.length === 0 ? t('requestDetail.waitingForBids') : `📬 ${t('requestDetail.bidCount', { count: bids.length })}`}
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
                                    <Text style={styles.compareButtonText}>⚖️ {t('common.compare')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                    {bids.length === 0 ? (
                        <View style={[styles.noBidsCard, { backgroundColor: colors.surface }]}>
                            <Text style={styles.noBidsEmoji}>🔔</Text>
                            <Text style={styles.noBidsText}>
                                {t('requestDetail.noBidsMessage')}
                            </Text>
                            <Text style={styles.noBidsSubtext}>
                                {t('requestDetail.noBidsSubtext')}
                            </Text>
                        </View>
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
// STYLES
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

    // Hero Card
    heroCard: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.lg,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    heroStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    heroStatusIcon: { fontSize: 12, marginRight: Spacing.xs },
    heroStatusText: { fontSize: FontSizes.sm, fontWeight: '700' },
    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    countdownIcon: { fontSize: 12, marginRight: 4 },
    countdownText: { fontSize: FontSizes.sm, fontWeight: '700' },
    heroCarInfo: { flexDirection: 'row', alignItems: 'center' },
    heroCarEmoji: { fontSize: 48, marginRight: Spacing.md },
    heroCarDetails: { flex: 1 },
    heroCarName: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#fff' },
    heroCarYear: { fontSize: FontSizes.lg, color: '#C9A227', fontWeight: '600' },
    heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: Spacing.lg },
    heroSection: { marginBottom: Spacing.md },
    heroLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 1,
        marginBottom: Spacing.xs,
    },
    heroPartDescription: { fontSize: FontSizes.lg, color: '#fff', lineHeight: 24 },
    heroPartNotes: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs, lineHeight: 20 },
    heroMetaRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
    heroMetaItem: {},
    heroMetaLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
    heroMetaValue: { fontSize: FontSizes.md, color: '#fff', fontFamily: 'monospace' },
    heroImages: { marginTop: Spacing.lg },
    heroImage: { width: 80, height: 80, borderRadius: BorderRadius.md, marginRight: Spacing.sm },
    vehiclePhotoLabel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 80, // Match heroImage width
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: 3,
        fontSize: 9,
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.3,
        borderBottomLeftRadius: BorderRadius.md,
        borderBottomRightRadius: BorderRadius.md,
    },
    // Comparison Bar
    comparisonContainer: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    comparisonTitle: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm },
    comparisonBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
    comparisonGradient: { flex: 1, position: 'relative' },
    comparisonDot: {
        position: 'absolute',
        top: -4,
        width: 16,
        height: 16,
        marginLeft: -8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    comparisonDotInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#1a1a2e',
    },
    comparisonLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    comparisonMin: { fontSize: FontSizes.sm, color: '#22C55E', fontWeight: '600' },
    comparisonMax: { fontSize: FontSizes.sm, color: '#EF4444', fontWeight: '600' },

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
        ...Shadows.md,
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
    noBidsCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        ...Shadows.sm,
    },
    noBidsEmoji: { fontSize: 48, marginBottom: Spacing.md },
    noBidsText: { fontSize: FontSizes.md, fontWeight: '600', textAlign: 'center' },
    noBidsSubtext: { fontSize: FontSizes.sm, color: '#737373', marginTop: Spacing.xs },

    // Premium Bid Card
    premiumBidCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.md,
    },
    bestDealCard: { borderColor: '#22C55E', borderWidth: 2 },
    acceptedCard: { borderColor: '#22C55E', borderWidth: 2, backgroundColor: '#E8F5E9' },
    agreedCard: { borderColor: '#22C55E', borderWidth: 2, backgroundColor: '#E8F5E9' },
    counterOfferCard: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: '#FFF8E1' },
    bestDealBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#22C55E',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    bestDealText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
    acceptedBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#22C55E',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    acceptedBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
    agreedBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#22C55E',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    agreedBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
    counterBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F59E0B',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    counterBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },

    bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    garageInfo: { flex: 1 },
    garageName: { fontSize: FontSizes.lg, fontWeight: '700' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingStar: { fontSize: 14, marginRight: 4 },
    ratingText: { fontSize: FontSizes.sm, color: '#525252' },
    roundsText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600', marginTop: 4 },
    priceSection: { alignItems: 'flex-end' },
    priceLabel: { fontSize: FontSizes.xs, color: '#737373' },
    priceAmount: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
    originalPrice: { fontSize: FontSizes.sm, color: '#737373', textDecorationLine: 'line-through' },
    currentPriceLabel: { fontSize: FontSizes.xs, color: '#F59E0B', fontWeight: '600' },
    currentPrice: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#F59E0B' },

    negotiationBox: {
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
        marginBottom: 4,
    },
    negotiationLabel: { fontSize: FontSizes.sm, color: '#525252' },
    negotiationValue: { fontSize: FontSizes.sm, fontWeight: '600' },

    bidDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    detailChip: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    detailChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: '#1a1a1a' },
    bidNotes: {
        fontSize: FontSizes.sm,
        color: '#525252',
        fontStyle: 'italic',
        marginTop: Spacing.md,
    },

    bidImagesSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    bidImagesLabel: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm },
    bidImage: { width: 120, height: 120, borderRadius: BorderRadius.lg, marginRight: Spacing.sm },

    // Garage Profile Header
    garageProfileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.md,
    },
    garagePhotoContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    garagePhoto: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F5F5F5',
    },
    garagePhotoFallback: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    garagePhotoEmoji: {
        fontSize: 28,
    },
    garageInfoSection: {
        flex: 1,
    },
    garageRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    ratingStarSmall: {
        fontSize: 14,
    },
    ratingValueSmall: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#F59E0B',
    },

    // Condition Photos Section
    conditionSection: {
        marginTop: Spacing.lg,
        paddingTop: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    conditionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    conditionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    conditionCount: {
        fontSize: FontSizes.sm,
        color: Colors.theme.textSecondary,
        fontWeight: '600',
    },
    conditionPhotoWrapper: {
        width: 120,
        height: 120,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginRight: Spacing.sm,
        position: 'relative',
    },
    conditionPhoto: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.6,
    },
    photoOverlayIcon: {
        fontSize: 20,
    },

    // Premium Warranty Badge
    warrantyBadgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        gap: 4,
        ...Shadows.sm,
    },
    warrantyIcon: {
        fontSize: 14,
    },
    warrantyBadgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Actions
    bidActions: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.sm },
    acceptBtn: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
    acceptGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    acceptBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    counterBtn: {
        flex: 0.8,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    counterBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
    rejectBtn: {
        width: 44,
        height: 44,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectBtnText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.error },

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
