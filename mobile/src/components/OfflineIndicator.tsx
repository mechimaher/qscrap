import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useOffline } from '../hooks/useOffline';
import { Colors, Spacing, FontSizes } from '../constants/theme';

/**
 * Offline indicator banner that appears at the top when network is unavailable
 * Auto-hides when connection is restored
 */
export default function OfflineIndicator() {
    const { isOffline } = useOffline();
    const [slideAnim] = useState(new Animated.Value(-60));

    useEffect(() => {
        if (isOffline) {
            // Slide down
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 8,
            }).start();
        } else {
            // Slide up
            Animated.timing(slideAnim, {
                toValue: -60,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [isOffline, slideAnim]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>📡</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>No Internet Connection</Text>
                    <Text style={styles.subtitle}>Some features may be unavailable</Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#EF4444',
        zIndex: 9999,
        elevation: 10,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        paddingTop: Spacing.xl, // Account for status bar
    },
    icon: {
        fontSize: 24,
        marginRight: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    subtitle: {
        color: '#fff',
        fontSize: FontSizes.sm,
        opacity: 0.9,
        marginTop: 2,
    },
});
