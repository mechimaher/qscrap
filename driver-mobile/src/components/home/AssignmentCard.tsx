// QScrap Driver App - AssignmentCard Component
// Extracted from HomeScreen for reusability
// Displays assignment info in a premium glass card

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Assignment } from '../../services/api';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig } from '../../constants/theme';
import { GlassCard } from '../common/GlassCard';
import { Ionicons } from '@expo/vector-icons';

interface AssignmentCardProps {
    assignment: Assignment;
    colors: any; // Theme colors
    onPress: () => void;
}

export function AssignmentCard({ assignment, colors, onPress }: AssignmentCardProps) {
    const statusConfig = AssignmentStatusConfig[assignment.status as keyof typeof AssignmentStatusConfig];
    const typeConfig = AssignmentTypeConfig[assignment.assignment_type as keyof typeof AssignmentTypeConfig];

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.wrapper}
        >
            <GlassCard style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.typeBadge, { backgroundColor: typeConfig?.color + '20' }]}>
                        <Ionicons name={(typeConfig?.icon || 'cube-outline') as any} size={14} color={typeConfig?.color} />
                        <Text style={[styles.typeText, { color: typeConfig?.color }]}>
                            {typeConfig?.label}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig?.color + '20' }]}>
                        <Text style={[styles.statusText, { color: statusConfig?.color }]}>
                            {statusConfig?.label}
                        </Text>
                    </View>
                </View>

                {/* Order Info */}
                <Text style={[styles.orderNumber, { color: colors.text }]}>
                    Order #{assignment.order_number}
                </Text>

                {/* COD Badge - shows amount driver needs to collect */}
                {assignment.total_amount && (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: assignment.payment_method === 'cod' || assignment.payment_method === 'cash'
                            ? '#10B98110' : '#3B82F610',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                        marginBottom: 8,
                        gap: 4,
                    }}>
                        <Text style={{ fontSize: 12 }}>
                            <Ionicons name={assignment.payment_method === 'cod' || assignment.payment_method === 'cash' ? 'cash-outline' : 'card-outline'} size={12} color={assignment.payment_method === 'cod' || assignment.payment_method === 'cash' ? '#10B981' : '#3B82F6'} />
                        </Text>
                        <Text style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: assignment.payment_method === 'cod' || assignment.payment_method === 'cash'
                                ? '#10B981' : '#3B82F6',
                        }}>
                            {assignment.payment_method === 'cod' || assignment.payment_method === 'cash'
                                ? `COD: QAR ${assignment.total_amount}`
                                : `QAR ${assignment.total_amount} (Paid)`}
                        </Text>
                    </View>
                )}

                {/* Part Category - simplified for drivers */}
                <Text style={[styles.partDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                    <Ionicons name="cube-outline" size={14} color={colors.textSecondary} /> {assignment.part_category || 'Auto Part'}
                </Text>

                {/* Locations */}
                <View style={styles.locationRow}>
                    <Ionicons name="storefront-outline" size={14} color={Colors.primary} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                        {assignment.pickup_address}
                    </Text>
                </View>
                <View style={styles.locationArrow}>
                    <Text style={{ color: colors.textMuted }}>↓</Text>
                </View>
                <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color={Colors.primary} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                        {assignment.delivery_address}
                    </Text>
                </View>

                {/* Action Button */}
                {statusConfig?.actionLabel && (
                    <LinearGradient
                        colors={[Colors.primary, Colors.primaryDark]}
                        style={styles.actionButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.actionButtonText}>{statusConfig.actionLabel}</Text>
                        <Text style={styles.actionButtonIcon}>→</Text>
                    </LinearGradient>
                )}
            </GlassCard>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 12,
    },
    card: {
        marginBottom: 0, // Handled by wrapper
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    partDescription: {
        fontSize: 14,
        marginBottom: 12,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationEmoji: {
        fontSize: 14,
    },
    locationText: {
        flex: 1,
        fontSize: 13,
    },
    locationArrow: {
        paddingLeft: 22,
        paddingVertical: 2,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    actionButtonIcon: {
        color: '#fff',
        fontSize: 18,
    },
});

export default AssignmentCard;
