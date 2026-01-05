// QScrap Driver App - Status Badge Component
// Color-coded status indicator for assignments and driver status

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, FontWeights } from '../constants/theme';

type StatusType =
    | 'available' | 'busy' | 'offline'  // Driver status
    | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed'  // Assignment status
    | 'success' | 'warning' | 'error' | 'info';  // Generic

interface StatusBadgeProps {
    status: StatusType;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    showDot?: boolean;
    style?: ViewStyle;
}

const STATUS_CONFIG: Record<StatusType, { color: string; label: string; icon?: string }> = {
    // Driver statuses
    available: { color: Colors.success, label: 'Available', icon: '🟢' },
    busy: { color: Colors.warning, label: 'On Delivery', icon: '🟡' },
    offline: { color: Colors.danger, label: 'Offline', icon: '🔴' },

    // Assignment statuses
    assigned: { color: Colors.assigned, label: 'Assigned', icon: '📋' },
    picked_up: { color: Colors.pickedUp, label: 'Picked Up', icon: '📦' },
    in_transit: { color: Colors.inTransit, label: 'In Transit', icon: '🚚' },
    delivered: { color: Colors.delivered, label: 'Delivered', icon: '✅' },
    failed: { color: Colors.failed, label: 'Failed', icon: '❌' },

    // Generic statuses
    success: { color: Colors.success, label: 'Success' },
    warning: { color: Colors.warning, label: 'Warning' },
    error: { color: Colors.error, label: 'Error' },
    info: { color: Colors.info, label: 'Info' },
};

export function StatusBadge({
    status,
    label,
    size = 'md',
    showDot = true,
    style
}: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.info;
    const displayLabel = label || config.label;

    const sizeStyles = {
        sm: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, dotSize: 6 },
        md: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, dotSize: 8 },
        lg: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 14, dotSize: 10 },
    }[size];

    return (
        <View style={[
            styles.badge,
            {
                backgroundColor: config.color + '20',
                paddingHorizontal: sizeStyles.paddingHorizontal,
                paddingVertical: sizeStyles.paddingVertical,
            },
            style,
        ]}>
            {showDot && (
                <View style={[
                    styles.dot,
                    {
                        backgroundColor: config.color,
                        width: sizeStyles.dotSize,
                        height: sizeStyles.dotSize,
                        borderRadius: sizeStyles.dotSize / 2,
                    },
                ]} />
            )}
            <Text style={[
                styles.label,
                {
                    color: config.color,
                    fontSize: sizeStyles.fontSize,
                },
            ]}>
                {displayLabel}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.full,
        gap: 6,
    },
    dot: {
        // Dynamic styles applied inline
    },
    label: {
        fontWeight: FontWeights.semibold,
    },
});

export default StatusBadge;
