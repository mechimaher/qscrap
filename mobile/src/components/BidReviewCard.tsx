import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';

interface BidReviewCardProps {
    bid: {
        bid_id: string;
        garage_name: string;
        amount: number;
        delivery_time_days: number;
        part_condition: string;
        warranty_months?: number;
        expires_in_seconds?: number;
    };
    isLowestBid?: boolean;
    onAccept: () => void;
    onCounter: () => void;
    onReject: () => void;
}

const BidReviewCard: React.FC<BidReviewCardProps> = ({
    bid,
    isLowestBid,
    onAccept,
    onCounter,
    onReject,
}) => {
    const handleAccept = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onAccept();
    };

    const handleCounter = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCounter();
    };

    const handleReject = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReject();
    };

    return (
        <View style={[styles.container, isLowestBid && styles.containerHighlight]}>
            {/* Best Price Badge */}
            {isLowestBid && (
                <View style={styles.bestPriceBadge}>
                    <Text style={styles.bestPriceText}>🏆 Best Price</Text>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.garageInfo}>
                    <Text style={styles.garageName}>{bid.garage_name}</Text>
                    <View style={styles.conditionBadge}>
                        <Text style={styles.conditionText}>
                            {bid.part_condition === 'new' ? '✨ New' : '♻️ Used'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceValue}>{bid.amount} QAR</Text>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>🚚</Text>
                    <Text style={styles.detailLabel}>Delivery</Text>
                    <Text style={styles.detailValue}>{bid.delivery_time_days} days</Text>
                </View>

                {bid.warranty_months && (
                    <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>🛡️</Text>
                        <Text style={styles.detailLabel}>Warranty</Text>
                        <Text style={styles.detailValue}>{bid.warranty_months} months</Text>
                    </View>
                )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={handleReject}
                    style={[styles.actionButton, styles.rejectButton]}
                    activeOpacity={0.7}
                >
                    <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleCounter}
                    style={[styles.actionButton, styles.counterButton]}
                    activeOpacity={0.7}
                >
                    <Text style={styles.counterText}>Counter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleAccept}
                    style={[styles.actionButton, styles.acceptButton]}
                    activeOpacity={0.7}
                >
                    <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    containerHighlight: {
        borderColor: Colors.primary,
        borderWidth: 2,
        shadowOpacity: 0.12,
    },
    bestPriceBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    bestPriceText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    header: {
        marginBottom: Spacing.md,
    },
    garageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    garageName: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.text,
        flex: 1,
    },
    conditionBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    conditionText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    priceContainer: {
        backgroundColor: '#F9FAFB',
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.md,
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.primary,
    },
    detailsGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    detailItem: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: Spacing.sm,
        borderRadius: 10,
        alignItems: 'center',
    },
    detailIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    detailLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectButton: {
        backgroundColor: '#FEE2E2',
    },
    rejectText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },
    counterButton: {
        backgroundColor: '#FEF3C7',
    },
    counterText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F59E0B',
    },
    acceptButton: {
        backgroundColor: Colors.primary,
    },
    acceptText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default BidReviewCard;
