/**
 * QScrap Offline Banner Component
 * Displays a non-intrusive banner when the device is offline
 * Uses the useOffline hook to detect network status
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../hooks/useOffline';
import { Colors, Spacing, FontSizes, Shadows } from '../constants/theme';

export const OfflineBanner: React.FC = () => {
    const { isOffline } = useOffline();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isOffline ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isOffline]);

    if (!isOffline) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [
                        {
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-50, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            <View style={styles.content}>
                <Ionicons name="cloud-offline" size={20} color="#fff" />
                <Text style={styles.text}>You're offline. Some features may be limited.</Text>
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
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        ...Shadows.lg,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    text: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default OfflineBanner;
