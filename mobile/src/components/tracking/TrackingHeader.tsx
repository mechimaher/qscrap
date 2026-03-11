import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

interface TrackingHeaderProps {
    colors: any;
    t: any;
    isRTL: boolean;
    orderStatus: string;
    onBack: () => void;
    onSupport: () => void;
}

const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'delivered':
        case 'completed':
            return { bg: '#22C55E15', text: '#22C55E', icon: 'checkmark-circle' as const };
        case 'in_transit':
        case 'collected':
            return { bg: '#3B82F615', text: '#3B82F6', icon: 'car-sport' as const };
        case 'pending':
        case 'confirmed':
            return { bg: '#F59E0B15', text: '#F59E0B', icon: 'time' as const };
        default:
            return { bg: '#6B728015', text: '#6B7280', icon: 'information-circle' as const };
    }
};

export default function TrackingHeader({ colors, t, isRTL, orderStatus, onBack, onSupport }: TrackingHeaderProps) {
    const statusColor = getStatusColor(orderStatus);
    
    return (
        <View style={styles.container}>
            <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={onBack} style={[styles.headerButton, { backgroundColor: colors.surface }]}>
                    <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Ionicons name={statusColor.icon} size={16} color={statusColor.text} style={{ marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0 }} />
                    <Text style={[styles.statusText, { color: statusColor.text }]}>
                        {t(`tracking.status_${orderStatus || 'in_transit'}`)}
                    </Text>
                </View>

                <TouchableOpacity onPress={onSupport} style={[styles.headerButton, { backgroundColor: colors.surface }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: Spacing.lg,
        right: Spacing.lg,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    statusText: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
});
