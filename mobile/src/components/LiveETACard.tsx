import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface LiveETACardProps {
    etaMinutes: number | null; // null = calculating
    distance: string | null;
    driverStatus: 'picking_up' | 'in_transit' | 'arriving' | 'delivered';
    driverName?: string;
}

/**
 * Premium Live ETA Card with animated countdown
 * Inspired by Uber/Keeta tracking experience
 */
export const LiveETACard: React.FC<LiveETACardProps> = ({
    etaMinutes,
    distance,
    driverStatus,
    driverName,
}) => {
    const [countdown, setCountdown] = useState<number>(0);
    const [displayMinutes, setDisplayMinutes] = useState<number>(0);
    const [displaySeconds, setDisplaySeconds] = useState<number>(0);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const carAnim = useRef(new Animated.Value(0)).current;

    // Initialize countdown when ETA changes
    useEffect(() => {
        if (etaMinutes !== null && etaMinutes > 0) {
            const totalSeconds = etaMinutes * 60;
            setCountdown(totalSeconds);
        }
    }, [etaMinutes]);

    // Countdown timer - updates every second
    useEffect(() => {
        if (countdown <= 0) return;

        const timer = setInterval(() => {
            setCountdown(prev => {
                const newVal = Math.max(0, prev - 1);
                setDisplayMinutes(Math.floor(newVal / 60));
                setDisplaySeconds(newVal % 60);
                return newVal;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown > 0]);

    // Pulse animation for the icon
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Progress bar animation
    useEffect(() => {
        const progressValues: Record<string, number> = {
            'picking_up': 0.25,
            'in_transit': 0.6,
            'arriving': 0.9,
            'delivered': 1,
        };

        Animated.timing(progressAnim, {
            toValue: progressValues[driverStatus] || 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [driverStatus]);

    // Car moving animation
    useEffect(() => {
        const move = Animated.loop(
            Animated.sequence([
                Animated.timing(carAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(carAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        if (driverStatus === 'in_transit') {
            move.start();
        }

        return () => move.stop();
    }, [driverStatus]);

    const getStatusText = () => {
        switch (driverStatus) {
            case 'picking_up':
                return 'Driver is picking up your part';
            case 'in_transit':
                return 'On the way to you';
            case 'arriving':
                return 'Driver is almost there!';
            case 'delivered':
                return 'Delivered! ✓';
            default:
                return 'Tracking your order';
        }
    };

    const getStatusIcon = () => {
        switch (driverStatus) {
            case 'picking_up':
                return '📦';
            case 'in_transit':
                return '🚗';
            case 'arriving':
                return '🏁';
            case 'delivered':
                return '✅';
            default:
                return '🚗';
        }
    };

    const formatTime = (mins: number, secs: number) => {
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `0:${secs.toString().padStart(2, '0')}`;
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const carTranslateX = carAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 5],
    });

    return (
        <LinearGradient
            colors={driverStatus === 'arriving'
                ? ['#10B981', '#059669'] // Green when arriving
                : Colors.gradients.primaryDark}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            {/* Main ETA Display */}
            <View style={styles.mainContent}>
                <View style={styles.etaSection}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>

                    <View style={styles.countdownRow}>
                        {countdown > 0 ? (
                            <>
                                <Text style={styles.countdownText}>
                                    {displayMinutes}
                                </Text>
                                <Text style={styles.countdownUnit}>min</Text>
                                <Text style={styles.countdownSeparator}>:</Text>
                                <Text style={styles.countdownText}>
                                    {displaySeconds.toString().padStart(2, '0')}
                                </Text>
                                <Text style={styles.countdownUnit}>sec</Text>
                            </>
                        ) : etaMinutes === null ? (
                            <Text style={styles.calculatingText}>Calculating...</Text>
                        ) : (
                            <Text style={styles.arrivedText}>Arriving now!</Text>
                        )}
                    </View>

                    {distance && (
                        <View style={styles.distanceRow}>
                            <Text style={styles.distanceIcon}>📍</Text>
                            <Text style={styles.distanceText}>{distance} away</Text>
                        </View>
                    )}
                </View>

                {/* Animated Icon */}
                <Animated.View
                    style={[
                        styles.iconContainer,
                        {
                            transform: [
                                { scale: pulseAnim },
                                { translateX: carTranslateX }
                            ]
                        }
                    ]}
                >
                    <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
                </Animated.View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            { width: progressWidth }
                        ]}
                    />
                </View>
                <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Picked up</Text>
                    <Text style={styles.progressLabel}>On the way</Text>
                    <Text style={styles.progressLabel}>Delivered</Text>
                </View>
            </View>

            {/* Driver Name if available */}
            {driverName && (
                <View style={styles.driverRow}>
                    <Text style={styles.driverNameText}>
                        {driverName} is on their way
                    </Text>
                </View>
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.lg,
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    etaSection: {
        flex: 1,
    },
    statusText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: Spacing.xs,
        fontWeight: '500',
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    countdownText: {
        fontSize: 42,
        fontWeight: '700',
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    countdownUnit: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        marginLeft: 4,
        marginRight: 8,
    },
    countdownSeparator: {
        fontSize: 32,
        fontWeight: '300',
        color: 'rgba(255,255,255,0.5)',
    },
    calculatingText: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.7)',
        fontStyle: 'italic',
    },
    arrivedText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    distanceIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    distanceText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIcon: {
        fontSize: 36,
    },
    progressContainer: {
        marginTop: Spacing.lg,
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 2,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.xs,
    },
    progressLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
    },
    driverRow: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
    },
    driverNameText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
    },
});

export default LiveETACard;
