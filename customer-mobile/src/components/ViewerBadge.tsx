// VVIP G-06: Viewer Badge Component
// Shows how many garages are currently viewing a request
// Creates social proof and urgency for customer engagement

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { useTranslation } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

interface ViewerBadgeProps {
    viewerCount: number;
    showAnimation?: boolean;
    size?: 'small' | 'medium' | 'large';
}

/**
 * Badge component showing how many garages are viewing a request
 * Displays with animated eye icon and count
 */
export const ViewerBadge: React.FC<ViewerBadgeProps> = ({
    viewerCount,
    showAnimation = true,
    size = 'medium',
}) => {
    const { t } = useTranslation();
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const [displayCount, setDisplayCount] = useState(viewerCount);

    // Animate count changes
    useEffect(() => {
        if (displayCount !== viewerCount) {
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setDisplayCount(viewerCount);
            });
        }
    }, [viewerCount]);

    // Subtle blink animation for the eye
    useEffect(() => {
        if (!showAnimation) return;

        Animated.loop(
            Animated.sequence([
                Animated.delay(3000),
                Animated.timing(blinkAnim, {
                    toValue: 0.3,
                    duration: 100,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 100,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [showAnimation]);

    // Don't render if no viewers
    if (viewerCount === 0) return null;

    const sizeStyles = {
        small: {
            container: styles.containerSmall,
            icon: styles.iconSmall,
            text: styles.textSmall,
        },
        medium: {
            container: styles.containerMedium,
            icon: styles.iconMedium,
            text: styles.textMedium,
        },
        large: {
            container: styles.containerLarge,
            icon: styles.iconLarge,
            text: styles.textLarge,
        },
    };

    const currentSize = sizeStyles[size];

    const scaleValue = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.15],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                currentSize.container,
                { transform: [{ scale: scaleValue }] },
            ]}
        >
            <Animated.View style={{ opacity: blinkAnim }}>
                <Ionicons name="eye-outline" size={size === 'small' ? 12 : size === 'large' ? 18 : 14} color="#B45309" />
            </Animated.View>
            <Text style={currentSize.text}>
                {displayCount === 1 ? t('viewerBadge.garageViewing', { count: displayCount }) : t('viewerBadge.garagesViewing', { count: displayCount })}
            </Text>
        </Animated.View>
    );
};

/**
 * Compact version for inline display
 */
export const ViewerBadgeCompact: React.FC<ViewerBadgeProps> = ({
    viewerCount,
}) => {
    if (viewerCount === 0) return null;

    return (
        <View style={styles.compactContainer}>
            <Ionicons name="eye-outline" size={12} color="#D97706" />
            <Text style={styles.compactText}>{viewerCount}</Text>
        </View>
    );
};

/**
 * Live indicator variant with pulsing dot
 */
export const ViewerBadgeLive: React.FC<ViewerBadgeProps & { isLive?: boolean }> = ({
    viewerCount,
    isLive = true,
}) => {
    const { t } = useTranslation();
    const pulseAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (!isLive) return;

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.5,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [isLive]);

    if (viewerCount === 0) return null;

    return (
        <View style={styles.liveContainer}>
            {isLive && (
                <Animated.View
                    style={[
                        styles.liveDot,
                        { opacity: pulseAnim },
                    ]}
                />
            )}
            <Ionicons name="eye-outline" size={14} color="#166534" />
            <Text style={styles.liveText}>
                {viewerCount === 1 ? t('viewerBadge.garageViewing', { count: viewerCount }) : t('viewerBadge.garagesViewing', { count: viewerCount })}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    // Base container
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F59E0B30',
    },

    // Size variants
    containerSmall: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    containerMedium: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    containerLarge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },

    iconSmall: { fontSize: 12 },
    iconMedium: { fontSize: 14 },
    iconLarge: { fontSize: 18 },

    textSmall: {
        fontSize: 11,
        fontWeight: '600',
        color: '#B45309',
    },
    textMedium: {
        fontSize: 13,
        fontWeight: '600',
        color: '#B45309',
    },
    textLarge: {
        fontSize: 15,
        fontWeight: '600',
        color: '#B45309',
    },

    // Compact variant
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C720',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    compactIcon: { fontSize: 12 },
    compactText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D97706',
    },

    // Live variant
    liveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#22C55E30',
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },
    liveIcon: { fontSize: 14 },
    liveText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
    },
});

export default ViewerBadge;
