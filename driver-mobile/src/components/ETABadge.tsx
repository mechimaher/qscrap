// QScrap Driver App - ETA Badge Component
// Premium animated ETA countdown badge
// Shows estimated arrival time with color-coded urgency

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { calculateETA, formatCountdown, getETAColor, ETAResult } from '../services/eta.service';
import { Colors } from '../constants/theme';

interface ETABadgeProps {
    driverLat?: number;
    driverLng?: number;
    destLat?: number;
    destLng?: number;
    type?: 'pickup' | 'delivery' | 'none';
    size?: 'small' | 'medium' | 'large';
    showIcon?: boolean;
}

export default function ETABadge({
    driverLat,
    driverLng,
    destLat,
    destLng,
    type = 'none',
    size = 'medium',
    showIcon = true,
}: ETABadgeProps) {
    const [eta, setEta] = useState<ETAResult | null>(null);
    const pulseAnim = useState(new Animated.Value(1))[0];

    // Calculate ETA when location changes
    useEffect(() => {
        if (driverLat && driverLng && destLat && destLng) {
            const result = calculateETA(driverLat, driverLng, destLat, destLng, type);
            setEta(result);

            // Pulse animation for close ETA
            if (result.durationMinutes <= 5) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.1,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            }
        }
    }, [driverLat, driverLng, destLat, destLng, type]);

    // Update ETA every minute
    useEffect(() => {
        const interval = setInterval(() => {
            if (driverLat && driverLng && destLat && destLng) {
                const result = calculateETA(driverLat, driverLng, destLat, destLng, type);
                setEta(result);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [driverLat, driverLng, destLat, destLng, type]);

    if (!eta) {
        return null;
    }

    const bgColor = getETAColor(eta.durationMinutes);
    const fontSize = size === 'small' ? 11 : size === 'large' ? 16 : 13;
    const padding = size === 'small' ? 4 : size === 'large' ? 10 : 6;
    const iconSize = size === 'small' ? 10 : size === 'large' ? 16 : 12;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: bgColor + '20',
                    paddingHorizontal: padding + 4,
                    paddingVertical: padding,
                    transform: [{ scale: pulseAnim }],
                },
            ]}
        >
            {showIcon && <Text style={{ fontSize: iconSize }}>🕐</Text>}
            <Text style={[styles.text, { color: bgColor, fontSize }]}>
                {eta.countdownText}
            </Text>
        </Animated.View>
    );
}

// Inline ETA text for compact display
export function ETAText({
    minutes,
    style,
}: {
    minutes: number;
    style?: any;
}) {
    const color = getETAColor(minutes);
    return (
        <Text style={[{ color, fontWeight: '600' }, style]}>
            {formatCountdown(minutes)}
        </Text>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        gap: 4,
    },
    text: {
        fontWeight: '700',
    },
});
