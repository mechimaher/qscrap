/**
 * QScrap Offline Banner Component
 * Displays a non-intrusive banner when the device is offline
 * Uses the useOffline hook to detect network status
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../hooks/useOffline';
import { useSocketContext } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { Colors, Spacing, FontSizes, Shadows } from '../constants/theme';

export const OfflineBanner: React.FC = () => {
    const { isOffline } = useOffline();
    const { isConnected, isRealtimeDegraded } = useSocketContext();
    const { isAuthenticated } = useAuth();
    const { t } = useTranslation();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const [show, setShow] = React.useState(false);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Show banner when network is offline OR (if logged in) socket disconnected/degraded for >30s
    React.useEffect(() => {
        // Only care about socket connection if we are logged in
        const socketIssue = isAuthenticated && (isRealtimeDegraded || !isConnected);
        const shouldTrigger = isOffline || socketIssue;

        if (shouldTrigger) {
            if (!timer.current) {
                timer.current = setTimeout(() => {
                    setShow(true);
                }, 30000);
            }
        } else {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
            setShow(false);
        }

        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
    }, [isOffline, isConnected, isRealtimeDegraded, isAuthenticated]);

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: show ? 1 : 0,
            duration: 300,
            useNativeDriver: true
        }).start();
    }, [show]);

    if (!show) {
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
                                outputRange: [-50, 0]
                            })
                        }
                    ]
                }
            ]}
        >
            <View style={styles.content}>
                <Ionicons name="cloud-offline" size={20} color="#fff" />
                <Text style={styles.text}>
                    {isOffline ? t('errors.network') : t('errors.networkRetry')}
                </Text>
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
        ...Shadows.lg
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm
    },
    text: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textAlign: 'center'
    }
});

export default OfflineBanner;
