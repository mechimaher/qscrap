import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../constants/theme';

interface LiveTrackingCardProps {
    type: 'quick_service' | 'order';
    data: any;
    onPress: () => void;
}

const LiveTrackingCard: React.FC<LiveTrackingCardProps> = ({ type, data, onPress }) => {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { color: string; label: string; icon: string }> = {
            // Quick Service statuses
            pending: { color: '#F59E0B', label: 'Pending', icon: '⏳' },
            assigned: { color: '#3B82F6', label: 'Assigned', icon: '✓' },
            dispatched: { color: '#8B5CF6', label: 'On The Way', icon: '🚗' },
            arrived: { color: '#EC4899', label: 'Arrived', icon: '📍' },
            in_progress: { color: '#10B981', label: 'In Progress', icon: '🔧' },
            completed: { color: '#059669', label: 'Completed', icon: '✅' },

            // Order statuses
            confirmed: { color: '#3B82F6', label: 'Confirmed', icon: '✓' },
            preparing: { color: '#8B5CF6', label: 'Preparing', icon: '📦' },
            ready_for_pickup: { color: '#10B981', label: 'Ready', icon: '✅' },
            collected: { color: '#EC4899', label: 'Collected', icon: '🚚' },
            in_transit: { color: '#F59E0B', label: 'In Transit', icon: '🚗' },
            delivered: { color: '#059669', label: 'Delivered', icon: '📍' },
        };
        return configs[status] || { color: '#6B7280', label: status, icon: '•' };
    };

    const statusConfig = getStatusConfig(data.status);

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={[styles.container, { borderLeftColor: statusConfig.color }]}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.typeContainer}>
                    <Text style={styles.typeIcon}>
                        {type === 'quick_service' ? '⚡' : '📦'}
                    </Text>
                    <Text style={styles.typeText}>
                        {type === 'quick_service' ? 'Quick Service' : 'Spare Parts Order'}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                    <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>
                    {data.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {data.subtitle}
                </Text>

                {/* Progress Indicator */}
                {data.progress && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${data.progress}%`,
                                        backgroundColor: statusConfig.color
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>{data.progress}%</Text>
                    </View>
                )}

                {/* ETA or Info */}
                {data.eta && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>🕐</Text>
                        <Text style={styles.infoText}>ETA: {data.eta}</Text>
                    </View>
                )}

                {data.location && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>📍</Text>
                        <Text style={styles.infoText} numberOfLines={1}>{data.location}</Text>
                    </View>
                )}
            </View>

            {/* Action */}
            <View style={styles.footer}>
                <Text style={styles.actionText}>Track Live →</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    typeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.theme.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    content: {
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.theme.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.theme.textSecondary,
        marginBottom: Spacing.sm,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
        marginRight: Spacing.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.theme.textSecondary,
        minWidth: 40,
        textAlign: 'right',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    infoIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    infoText: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.theme.textSecondary,
        flex: 1,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: Spacing.sm,
        marginTop: Spacing.sm,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
        textAlign: 'center',
    },
});

export default LiveTrackingCard;
