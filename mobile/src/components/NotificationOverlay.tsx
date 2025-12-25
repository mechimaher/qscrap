// QScrap Notifications Component - Visual + Haptic + Sound Alerts
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Dimensions,
    Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSocketContext } from '../hooks/useSocket';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { RootStackParamList } from '../../App';

const { width } = Dimensions.get('window');

interface BidNotification {
    bid_id: string;
    request_id: string;
    garage_name: string;
    bid_amount: number;
    part_condition: string;
    warranty_days: number;
    created_at: string;
}

export default function NotificationOverlay() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { newBids, clearBidsForRequest } = useSocketContext();
    const [currentBid, setCurrentBid] = useState<BidNotification | null>(null);

    const slideAnim = useRef(new Animated.Value(-150)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Watch for new bids
    useEffect(() => {
        if (newBids.length > 0 && !currentBid) {
            const latestBid = newBids[newBids.length - 1];
            showNotification(latestBid);
        }
    }, [newBids]);

    const showNotification = async (bid: BidNotification) => {
        setCurrentBid(bid);

        // Vibration pattern: short-short-long
        Vibration.vibrate([0, 100, 100, 100, 100, 300]);

        // Strong haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Slide in from top
        Animated.spring(slideAnim, {
            toValue: 50,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
        }).start();

        // Shake animation - attention grabbing
        const shakeSequence = Animated.loop(
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -6, duration: 80, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
                Animated.delay(500),
            ]),
            { iterations: 3 }
        );

        // Pulse animation
        const pulseSequence = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 400, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),
            { iterations: 5 }
        );

        // Glow animation
        const glowSequence = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
                Animated.timing(glowAnim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
            ]),
            { iterations: 8 }
        );

        shakeSequence.start();
        pulseSequence.start();
        glowSequence.start();

        // Auto-hide after 10 seconds
        setTimeout(() => {
            hideNotification();
        }, 10000);
    };

    const hideNotification = () => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setCurrentBid(null);
            shakeAnim.setValue(0);
            pulseAnim.setValue(1);
            glowAnim.setValue(0);
        });
    };

    const handlePress = () => {
        if (currentBid) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            hideNotification();
            navigation.navigate('RequestDetail', { requestId: currentBid.request_id });
        }
    };

    const handleDismiss = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        hideNotification();
    };

    if (!currentBid) return null;

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 1],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { translateX: shakeAnim },
                        { scale: pulseAnim },
                    ],
                },
            ]}
        >
            <Animated.View style={[styles.glowBorder, { opacity: glowOpacity }]} />

            <TouchableOpacity
                style={styles.notification}
                onPress={handlePress}
                activeOpacity={0.9}
            >
                {/* Animated Icon */}
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>💰</Text>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>🔔 New Bid Received!</Text>
                    <Text style={styles.garageName}>{currentBid.garage_name}</Text>
                    <View style={styles.priceRow}>
                        <Text style={styles.price}>{currentBid.bid_amount} QAR</Text>
                        {currentBid.warranty_days > 0 && (
                            <Text style={styles.warranty}>
                                • {currentBid.warranty_days}d warranty
                            </Text>
                        )}
                    </View>
                </View>

                {/* Dismiss */}
                <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
                    <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>

            {/* Tap to view hint */}
            <Text style={styles.tapHint}>👆 Tap to view all bids</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 9999,
        alignItems: 'center',
    },
    glowBorder: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: BorderRadius.xl + 4,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 25,
        elevation: 25,
    },
    notification: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        borderWidth: 3,
        borderColor: Colors.primary,
        width: width - Spacing.md * 2,
        ...Shadows.lg,
    },
    iconContainer: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
        backgroundColor: Colors.primary + '30',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    icon: {
        fontSize: 30,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 2,
    },
    garageName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs,
    },
    price: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.primary,
    },
    warranty: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginLeft: Spacing.sm,
    },
    dismissButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.dark.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dismissText: {
        color: Colors.dark.textMuted,
        fontSize: 16,
        fontWeight: '700',
    },
    tapHint: {
        fontSize: FontSizes.sm,
        color: Colors.primary,
        marginTop: Spacing.sm,
        fontWeight: '600',
    },
});
