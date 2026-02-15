// QScrap Driver App - Swipe To Complete Component
// Premium gesture-based action completion like Uber's slide to confirm
// VVIP cutting-edge feature with smooth animations

import React, { useRef, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 0.7; // 70% of the track
const BUTTON_SIZE = 56;

interface SwipeToCompleteProps {
    onComplete: () => Promise<void> | void;
    label?: string;
    completeLabel?: string;
    icon?: string;
    completeIcon?: string;
    disabled?: boolean;
    type?: 'success' | 'primary' | 'danger';
}

export default function SwipeToComplete({
    onComplete,
    label = 'Swipe to confirm',
    completeLabel = 'Completed!',
    icon = '→',
    completeIcon = '✓',
    disabled = false,
    type = 'success',
}: SwipeToCompleteProps) {
    const { colors } = useTheme();
    const translateX = useRef(new Animated.Value(0)).current;
    const progressOpacity = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const [isCompleted, setIsCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 80);

    // Use refs so PanResponder always reads current state
    const isCompletedRef = useRef(isCompleted);
    const isLoadingRef = useRef(isLoading);
    isCompletedRef.current = isCompleted;
    isLoadingRef.current = isLoading;

    const maxSwipe = trackWidth - BUTTON_SIZE - 8;

    const gradientColors = {
        success: [Colors.success, '#059669'] as [string, string],
        primary: [Colors.primary, Colors.primaryDark] as [string, string],
        danger: [Colors.danger, '#dc2626'] as [string, string],
    };

    const panResponder = useMemo(
        () => PanResponder.create({
            onStartShouldSetPanResponder: () => !disabled && !isCompletedRef.current && !isLoadingRef.current,
            onMoveShouldSetPanResponder: () => !disabled && !isCompletedRef.current && !isLoadingRef.current,

            onPanResponderGrant: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Animated.spring(buttonScale, {
                    toValue: 1.1,
                    useNativeDriver: true,
                }).start();
            },

            onPanResponderMove: (_, gestureState) => {
                const newX = Math.max(0, Math.min(gestureState.dx, maxSwipe));
                translateX.setValue(newX);

                // Update progress opacity
                const progress = newX / maxSwipe;
                progressOpacity.setValue(progress);

                // Haptic feedback at threshold
                if (progress >= SWIPE_THRESHOLD && progress < SWIPE_THRESHOLD + 0.05) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            },

            onPanResponderRelease: async (_, gestureState) => {
                Animated.spring(buttonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                }).start();

                const progress = gestureState.dx / maxSwipe;

                if (progress >= SWIPE_THRESHOLD) {
                    // Complete the action
                    setIsLoading(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                    // Animate to end
                    Animated.spring(translateX, {
                        toValue: maxSwipe,
                        friction: 6,
                        tension: 40,
                        useNativeDriver: true,
                    }).start();

                    try {
                        await onComplete();
                        setIsCompleted(true);
                    } catch (error) {
                        // Reset on error
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Animated.spring(translateX, {
                            toValue: 0,
                            friction: 6,
                            useNativeDriver: true,
                        }).start();
                        Animated.timing(progressOpacity, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: true,
                        }).start();
                    } finally {
                        setIsLoading(false);
                    }
                } else {
                    // Reset to start
                    Animated.spring(translateX, {
                        toValue: 0,
                        friction: 6,
                        useNativeDriver: true,
                    }).start();
                    Animated.timing(progressOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }
            },
        }),
        [disabled, maxSwipe]
    );

    return (
        <View
            style={[styles.container, disabled && styles.disabled]}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
            {/* Background track */}
            <View style={[styles.track, { backgroundColor: colors.surface }]}>
                {/* Progress fill */}
                <Animated.View
                    style={[
                        styles.progressFill,
                        {
                            opacity: progressOpacity,
                            backgroundColor: gradientColors[type][0] + '30',
                        },
                    ]}
                />

                {/* Label */}
                <Animated.Text
                    style={[
                        styles.label,
                        {
                            color: isCompleted ? Colors.success : colors.textSecondary,
                            opacity: progressOpacity.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 0.5, 0],
                            }),
                        },
                    ]}
                >
                    {isCompleted ? completeLabel : label}
                </Animated.Text>

                {/* Sliding button */}
                <Animated.View
                    {...panResponder.panHandlers}
                    style={[
                        styles.buttonContainer,
                        {
                            transform: [
                                { translateX },
                                { scale: buttonScale },
                            ],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={isCompleted ? [Colors.success, '#059669'] : gradientColors[type]}
                        style={styles.button}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.buttonIcon}>
                                {isCompleted ? completeIcon : icon}
                            </Text>
                        )}
                    </LinearGradient>
                </Animated.View>

                {/* Arrow hints */}
                {!isCompleted && !isLoading && (
                    <View style={styles.arrowHints}>
                        <Animated.Text
                            style={[
                                styles.arrowHint,
                                {
                                    opacity: progressOpacity.interpolate({
                                        inputRange: [0, 0.3],
                                        outputRange: [0.3, 0],
                                    }),
                                },
                            ]}
                        >
                            ›››
                        </Animated.Text>
                    </View>
                )}
            </View>
        </View>
    );
}

// Export a simpler inline swipe button
export function SwipeButton({
    onSwipe,
    label,
    color = Colors.success,
}: {
    onSwipe: () => void;
    label: string;
    color?: string;
}) {
    const translateX = useRef(new Animated.Value(0)).current;
    const buttonWidth = 200;
    const maxSwipe = buttonWidth - 50;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newX = Math.max(0, Math.min(gestureState.dx, maxSwipe));
                translateX.setValue(newX);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx / maxSwipe >= 0.7) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Animated.spring(translateX, {
                        toValue: maxSwipe,
                        useNativeDriver: true,
                    }).start(() => onSwipe());
                } else {
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <View style={[styles.inlineContainer, { backgroundColor: color + '20' }]}>
            <Text style={[styles.inlineLabel, { color }]}>{label}</Text>
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.inlineButton,
                    { backgroundColor: color, transform: [{ translateX }] },
                ]}
            >
                <Text style={styles.inlineIcon}>→</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    disabled: {
        opacity: 0.5,
    },
    track: {
        height: 64,
        borderRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        right: 0,
    },
    label: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: BUTTON_SIZE,
    },
    buttonContainer: {
        position: 'absolute',
        left: 4,
        top: 4,
        bottom: 4,
    },
    button: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonIcon: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
    arrowHints: {
        position: 'absolute',
        right: 24,
    },
    arrowHint: {
        color: '#9ca3af',
        fontSize: 20,
        letterSpacing: -4,
    },
    // Inline style
    inlineContainer: {
        width: 200,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    inlineLabel: {
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 40,
    },
    inlineButton: {
        position: 'absolute',
        left: 4,
        top: 4,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inlineIcon: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
