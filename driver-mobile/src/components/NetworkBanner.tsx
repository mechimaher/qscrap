import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useNetwork } from '../hooks/useNetwork';

/**
 * Network status banner that shows when device is offline.
 * Automatically appears/disappears based on connectivity.
 */
export const NetworkBanner: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
    const { isConnected, isInternetReachable } = useNetwork();
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(-60)).current;
    const isOffline = !isConnected || isInternetReachable === false;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: isOffline ? 0 : -60,
            useNativeDriver: true,
            tension: 50,
            friction: 10,
        }).start();
    }, [isOffline, slideAnim]);

    if (!isOffline) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    paddingTop: insets.top + Spacing.sm,
                    transform: [{ translateY: slideAnim }]
                },
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>📡</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>No Internet Connection</Text>
                    <Text style={styles.message}>Please check your connection</Text>
                </View>
                {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.danger,
        zIndex: 9998,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    icon: {
        fontSize: 20,
        marginRight: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    message: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: FontSize.sm,
    },
    retryButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: BorderRadius.sm,
    },
    retryText: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
});

export default NetworkBanner;
