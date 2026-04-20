/**
 * StatusBadge — VVIP G-04
 * Human-readable status badge component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../contexts/LanguageContext';
import { getStatusLabel, getStatusColor, getStatusIcon } from '../constants/statusLabels';

interface StatusBadgeProps {
    type: 'request' | 'order';
    status: string;
    size?: 'small' | 'medium' | 'large';
    showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    type,
    status,
    size = 'medium',
    showIcon = true
}) => {
    const { isRTL } = useTranslation();
    const lang = isRTL ? 'ar' : 'en';

    const label = getStatusLabel(type, status, lang);
    const color = getStatusColor(type, status);
    const icon = getStatusIcon(type, status);

    const sizeStyles = {
        small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, iconSize: 12 },
        medium: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, iconSize: 16 },
        large: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, iconSize: 20 }
    };

    const s = sizeStyles[size];

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: color + '20', // 20% opacity
                    borderColor: color,
                    paddingHorizontal: s.paddingHorizontal,
                    paddingVertical: s.paddingVertical
                }
            ]}
        >
            {showIcon && (
                <MaterialCommunityIcons
                    name={icon as any}
                    size={s.iconSize}
                    color={color}
                    style={styles.icon}
                />
            )}
            <Text style={[styles.label, { color, fontSize: s.fontSize }]}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1
    },
    icon: {
        marginRight: 4
    },
    label: {
        fontWeight: '600'
    }
});

export default StatusBadge;
