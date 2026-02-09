// PremiumBidCard - Glassmorphism style bid card with negotiation support
import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Bid } from '../../services/api';
import { UPLOAD_BASE_URL } from '../../config/api';
import { SocialProofBadges } from '../../components/SocialProofBadges';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

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
    // Flag feature deprecated - customers can simply choose another bid
    const isSuperseded = bid.bid_status === 'superseded';

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

            {/* Superseded Badge - Has been replaced */}
            {isSuperseded && (
                <View style={[styles.supersededBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.supersededBadgeText}>🔄 {t('bids.flag.statusCorrected')}</Text>
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
                    {/* Final Round Warning - Show when round 3/3 is reached */}
                    {negotiationRounds >= 3 && !isNegotiationAgreed && !isAccepted && (
                        <View style={styles.finalRoundWarning}>
                            <Text style={styles.finalRoundWarningText}>
                                ⚠️ {t('bidCard.finalRoundWarning')}
                            </Text>
                        </View>
                    )}

                    {customerCounterAmount && (
                        <View style={[styles.negotiationRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.negotiationLabel}>{t('bidCard.youOffered')}</Text>
                            <Text style={[
                                styles.negotiationValue,
                                customerCounterStatus === 'accepted' && { color: '#22C55E' },
                                customerCounterStatus === 'countered' && { color: '#F59E0B' },
                                customerCounterStatus === 'rejected' && {
                                    color: '#9CA3AF',
                                    textDecorationLine: 'line-through',
                                },
                            ]}>
                                {customerCounterAmount} {t('common.qar')}
                                {customerCounterStatus === 'countered' && ` ${t('bidCard.counteredStatus')}`}
                                {customerCounterStatus === 'rejected' && ` ❌`}
                            </Text>
                        </View>
                    )}

                    {/* Garage's Last Offer - Highlight when customer's is rejected */}
                    {(hasGarageCounterOffer || (customerCounterStatus === 'rejected' && lastGarageOfferAmount)) && (
                        <View style={[
                            styles.negotiationRow,
                            { flexDirection: rtlFlexDirection(isRTL) },
                            customerCounterStatus === 'rejected' && styles.garageOfferHighlight
                        ]}>
                            <Text style={[
                                styles.negotiationLabel,
                                customerCounterStatus === 'rejected' && { fontWeight: '600' }
                            ]}>
                                {customerCounterStatus === 'rejected'
                                    ? t('bidCard.acceptableOffer')
                                    : t('bidCard.garageOffers')
                                }
                            </Text>
                            <Text style={[
                                styles.negotiationValue,
                                { color: customerCounterStatus === 'rejected' ? '#22C55E' : '#F59E0B' },
                                customerCounterStatus === 'rejected' && { fontWeight: '700', fontSize: 16 }
                            ]}>
                                {garageCounterAmount || lastGarageOfferAmount} {t('common.qar')}
                                {customerCounterStatus === 'rejected' && ` ✓`}
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
                                <Text style={styles.acceptBtnText}>⏳ {t('bidCard.waitingForGarage')}</Text>
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

const styles = StyleSheet.create({
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
    supersededBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#6B7280',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    supersededBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },

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
    garagePhotoEmoji: { fontSize: 28 },
    garageInfoSection: { flex: 1 },
    garageRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    ratingStarSmall: { fontSize: 14 },
    ratingValueSmall: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#F59E0B',
    },

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
    finalRoundWarning: {
        backgroundColor: '#FEF3C7',
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    finalRoundWarningText: {
        fontSize: FontSizes.sm,
        color: '#92400E',
        fontWeight: '600',
        textAlign: 'center',
    },
    garageOfferHighlight: {
        backgroundColor: '#DCFCE7',
        padding: Spacing.xs,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.xs,
    },

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
    conditionTitle: { fontSize: FontSizes.md, fontWeight: '700' },
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
    conditionPhoto: { width: '100%', height: '100%' },
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
    photoOverlayIcon: { fontSize: 20 },

    // Warranty badge
    warrantyBadgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        gap: 4,
        ...Shadows.sm,
    },
    warrantyIcon: { fontSize: 14 },
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
});

export { getConditionLabel };
export default PremiumBidCard;
