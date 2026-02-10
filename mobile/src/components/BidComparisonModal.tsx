// QScrap Bid Comparison Modal - Premium Design
import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Bid } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

interface BidComparisonModalProps {
    visible: boolean;
    bids: Bid[];
    onAccept: (bid: Bid) => void;
    onClose: () => void;
}

type SortKey = 'price' | 'rating' | 'warranty';

export const BidComparisonModal: React.FC<BidComparisonModalProps> = ({
    visible,
    bids,
    onAccept,
    onClose,
}) => {
    const { t } = useTranslation();
    const [sortBy, setSortBy] = useState<SortKey>('price');

    const handleSort = (key: SortKey) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSortBy(key);
    };

    const sortedBids = [...bids].sort((a, b) => {
        switch (sortBy) {
            case 'price':
                return Number(a.bid_amount) - Number(b.bid_amount);
            case 'rating':
                return (b.rating_average || 0) - (a.rating_average || 0);
            case 'warranty':
                return (b.warranty_days || 0) - (a.warranty_days || 0);
            default:
                return 0;
        }
    });

    const lowestPrice = Math.min(...bids.map(b => Number(b.bid_amount)));
    const highestRating = Math.max(...bids.map(b => b.rating_average || 0));
    const longestWarranty = Math.max(...bids.map(b => b.warranty_days || 0));

    const handleAccept = (bid: Bid) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAccept(bid);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#8D1B3D', '#C9A227'] as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <Text style={styles.headerTitle}>{t('bidComparison.compareBids')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Sort Tabs */}
                    <View style={styles.sortTabs}>
                        <TouchableOpacity
                            onPress={() => handleSort('price')}
                            style={[styles.sortTab, sortBy === 'price' && styles.sortTabActive]}
                        >
                            <Text style={[styles.sortTabText, sortBy === 'price' && styles.sortTabTextActive]}>
                                💰 {t('bidComparison.price')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSort('rating')}
                            style={[styles.sortTab, sortBy === 'rating' && styles.sortTabActive]}
                        >
                            <Text style={[styles.sortTabText, sortBy === 'rating' && styles.sortTabTextActive]}>
                                ⭐ {t('bidComparison.rating')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleSort('warranty')}
                            style={[styles.sortTab, sortBy === 'warranty' && styles.sortTabActive]}
                        >
                            <Text style={[styles.sortTabText, sortBy === 'warranty' && styles.sortTabTextActive]}>
                                🛡️ {t('bidComparison.warranty')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Comparison Table */}
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {sortedBids.map((bid, index) => {
                            const isBestPrice = bid.bid_amount === lowestPrice;
                            const isBestRating = bid.rating_average === highestRating;
                            const isBestWarranty = bid.warranty_days === longestWarranty;

                            return (
                                <View
                                    key={bid.bid_id}
                                    style={[
                                        styles.bidRow,
                                        isBestPrice && styles.bidRowHighlight,
                                    ]}
                                >
                                    {/* Garage Name */}
                                    <View style={styles.bidColumn}>
                                        <Text style={styles.garageName}>{bid.garage_name}</Text>
                                        {isBestPrice && (
                                            <View style={styles.bestBadge}>
                                                <Text style={styles.bestBadgeText}>{t('bidComparison.bestPriceBadge')}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Price */}
                                    <View style={styles.bidColumn}>
                                        <Text style={styles.columnLabel}>{t('bidComparison.price')}</Text>
                                        <Text style={[
                                            styles.priceText,
                                            isBestPrice && styles.priceTextBest
                                        ]}>
                                            {bid.bid_amount} {t('common.currency')}
                                        </Text>
                                    </View>

                                    {/* Rating */}
                                    <View style={styles.bidColumn}>
                                        <Text style={styles.columnLabel}>{t('bidComparison.rating')}</Text>
                                        <View style={styles.ratingRow}>
                                            <Text style={styles.ratingStar}>⭐</Text>
                                            <Text style={[
                                                styles.ratingText,
                                                isBestRating && styles.ratingTextBest
                                            ]}>
                                                {bid.rating_average?.toFixed(1) || '-'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Warranty */}
                                    <View style={styles.bidColumn}>
                                        <Text style={styles.columnLabel}>{t('bidComparison.warranty')}</Text>
                                        <Text style={[
                                            styles.warrantyText,
                                            isBestWarranty && styles.warrantyTextBest
                                        ]}>
                                            {bid.warranty_days > 0 ? `${bid.warranty_days}d` : t('bidComparison.none')}
                                        </Text>
                                    </View>

                                    {/* Accept Button */}
                                    <TouchableOpacity
                                        onPress={() => handleAccept(bid)}
                                        style={styles.acceptButton}
                                    >
                                        <LinearGradient
                                            colors={['#22C55E', '#16A34A'] as any}
                                            style={styles.acceptGradient}
                                        >
                                            <Text style={styles.acceptText}>{t('bidComparison.accept')}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        maxHeight: height * 0.85,
        ...Shadows.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.xl,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: FontSizes.xl,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    sortTabs: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8E8',
    },
    sortTab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.full,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    sortTabActive: {
        backgroundColor: Colors.theme.primary + '15',
    },
    sortTabText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.theme.textSecondary,
    },
    sortTabTextActive: {
        color: Colors.theme.primary,
    },
    scrollView: {
        padding: Spacing.lg,
    },
    bidRow: {
        backgroundColor: '#F9F9F9',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    bidRowHighlight: {
        borderColor: '#22C55E',
        borderWidth: 2,
        backgroundColor: '#F0FDF4',
    },
    bidColumn: {
        marginBottom: Spacing.sm,
    },
    garageName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.theme.text,
        marginBottom: Spacing.xs,
    },
    bestBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#22C55E',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    bestBadgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    columnLabel: {
        fontSize: FontSizes.xs,
        color: Colors.theme.textSecondary,
        marginBottom: 2,
    },
    priceText: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.theme.primary,
    },
    priceTextBest: {
        color: '#22C55E',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingStar: {
        fontSize: FontSizes.sm,
        marginRight: 4,
    },
    ratingText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.theme.text,
    },
    ratingTextBest: {
        color: '#F59E0B',
    },
    warrantyText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.theme.text,
    },
    warrantyTextBest: {
        color: '#6366F1',
    },
    acceptButton: {
        marginTop: Spacing.sm,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    acceptGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    acceptText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default BidComparisonModal;
