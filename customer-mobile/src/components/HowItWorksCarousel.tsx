// QScrap - How It Works Carousel
// Premium animated carousel showing the 4-step process

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - (Spacing.lg * 2);
const AUTO_SWIPE_INTERVAL = 4000; // 4 seconds

interface Step {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle: string;
    color: string;
    gradient: string[];
}



interface Props {
    onGetStarted?: () => void;
    autoPlay?: boolean;
}

export default function HowItWorksCarousel({ onGetStarted, autoPlay = true }: Props) {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const isFocused = useIsFocused();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
    const [isPaused, setIsPaused] = useState(false);

    const STEPS: Step[] = [
        {
            icon: 'clipboard-outline' as const,
            title: t('home.howItWorksSteps.step1.title'),
            subtitle: t('home.howItWorksSteps.step1.subtitle'),
            color: '#3B82F6',
            gradient: ['#3B82F6', '#2563EB'],
        },
        {
            icon: 'cash-outline' as const,
            title: t('home.howItWorksSteps.step2.title'),
            subtitle: t('home.howItWorksSteps.step2.subtitle'),
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'],
        },
        {
            icon: 'checkmark-circle' as const,
            title: t('home.howItWorksSteps.step3.title'),
            subtitle: t('home.howItWorksSteps.step3.subtitle'),
            color: '#22C55E',
            gradient: ['#22C55E', '#16A34A'],
        },
        {
            icon: 'car-sport' as const,
            title: t('home.howItWorksSteps.step4.title'),
            subtitle: t('home.howItWorksSteps.step4.subtitle'),
            color: Colors.primary,
            gradient: [Colors.primary, '#B31D4A'],
        },
    ];

    // Pan responder for swipe gestures
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            // Smoothness Fix: Only capture horizontal swipes
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
            },
            // Smoothness Fix: Don't let parent ScrollView steal gesture
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                setIsPaused(true);
                Haptics.selectionAsync();
            },
            onPanResponderMove: (_, gestureState) => {
                // RTL Fix: Invert visual feedback for RTL if needed, 
                // but usually direct mapping feels most natural (finger follows content).
                // If we want "pulling" feel, simple dx mapping works.
                Animated.spring(slideAnim, {
                    toValue: -gestureState.dx / SLIDE_WIDTH,
                    useNativeDriver: true,
                    friction: 10,
                }).start();
            },
            onPanResponderRelease: (_, gestureState) => {
                const threshold = SLIDE_WIDTH / 4;
                const dx = gestureState.dx;

                // RTL Logic:
                // LTR: Swipe Left (dx < 0) -> Next | Swipe Right (dx > 0) -> Prev
                // RTL: Swipe Right (dx > 0) -> Next | Swipe Left (dx < 0) -> Prev
                const isNext = isRTL ? dx > threshold : dx < -threshold;
                const isPrev = isRTL ? dx < -threshold : dx > threshold;

                if (isNext && currentIndex < STEPS.length - 1) {
                    goToSlide(currentIndex + 1);
                } else if (isPrev && currentIndex > 0) {
                    goToSlide(currentIndex - 1);
                } else {
                    // Snap back
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 8,
                    }).start();
                }

                setIsPaused(false);
            },
        })
    ).current;

    // Animate to slide (no haptics — used by auto-play)
    const animateToSlide = (index: number) => {
        setCurrentIndex(index);

        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                friction: 8,
            }),
            Animated.spring(scrollX, {
                toValue: index * SLIDE_WIDTH,
                useNativeDriver: true,
                friction: 9,
            }),
        ]).start();
    };

    // User-initiated slide change (with haptic feedback)
    const goToSlide = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animateToSlide(index);
    };

    // Auto-play — pauses when screen is not focused or user is swiping
    useEffect(() => {
        if (!autoPlay || isPaused || !isFocused) {
            if (autoPlayTimer.current) {
                clearInterval(autoPlayTimer.current);
                autoPlayTimer.current = null;
            }
            return;
        }

        autoPlayTimer.current = setInterval(() => {
            setCurrentIndex((prev) => {
                const next = prev === STEPS.length - 1 ? 0 : prev + 1;
                animateToSlide(next);
                return next;
            });
        }, AUTO_SWIPE_INTERVAL);

        return () => {
            if (autoPlayTimer.current) {
                clearInterval(autoPlayTimer.current);
                autoPlayTimer.current = null;
            }
        };
    }, [autoPlay, isPaused, isFocused, currentIndex]);

    const currentStep = STEPS[currentIndex];

    return (
        <View style={styles.container}>
            {/* Animated background gradient */}
            <Animated.View style={[styles.backgroundGradient, { opacity: 0.1 }]}>
                <LinearGradient
                    colors={currentStep.gradient as any}
                    start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
                    end={isRTL ? { x: 0, y: 0 } : { x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            {/* Swipeable slide */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.slideContainer,
                    {
                        transform: [
                            {
                                translateX: slideAnim.interpolate({
                                    inputRange: [-1, 0, 1],
                                    outputRange: [-SLIDE_WIDTH, 0, SLIDE_WIDTH],
                                }),
                            },
                        ],
                    },
                ]}
            >
                {/* Step indicator dots */}
                <View style={styles.dotsContainer}>
                    {STEPS.map((_, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => goToSlide(index)}
                            style={styles.dotWrapper}
                        >
                            <View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            index === currentIndex
                                                ? currentStep.color
                                                : colors.border,
                                        width: index === currentIndex ? 24 : 8,
                                    },
                                ]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Icon */}
                <View
                    style={[
                        styles.iconContainer,
                        {
                            backgroundColor: currentStep.color + '15',
                            borderColor: currentStep.color + '30',
                        },
                    ]}
                >
                    <Ionicons name={currentStep.icon} size={40} color={currentStep.color} />
                </View>

                {/* Step number */}
                <Text style={[styles.stepNumber, { color: currentStep.color, letterSpacing: isRTL ? 0 : 1.5 }]}>
                    {t('home.step')} {currentIndex + 1} {t('home.of')} {STEPS.length}
                </Text>

                {/* Title */}
                <Text style={[styles.title, { color: colors.text, letterSpacing: isRTL ? 0 : -0.5 }]}>
                    {currentStep.title}
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {currentStep.subtitle}
                </Text>

                {/* Progress bar */}
                <View style={[styles.progressBar, { backgroundColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            {
                                backgroundColor: currentStep.color,
                                width: `${((currentIndex + 1) / STEPS.length) * 100}%`,
                            },
                        ]}
                    />
                </View>

                {/* CTA Button (only on last step) */}
                {currentIndex === STEPS.length - 1 && onGetStarted && (
                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onGetStarted();
                        }}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={currentStep.gradient as any}
                            start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
                            end={isRTL ? { x: 0, y: 0 } : { x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Text style={styles.ctaText}>{t('common.getStarted')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Swipe hint */}
                {currentIndex < STEPS.length - 1 && (
                    <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
                        {isRTL ? '→' : '←'} {t('home.swipeNext')} {isRTL ? '←' : '→'}
                    </Text>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SLIDE_WIDTH,
        height: 320, // Reduced from 400 for more compact look
        alignSelf: 'center',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    backgroundGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    slideContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    dotsContainer: {
        flexDirection: 'row',
        position: 'absolute',
        top: Spacing.md,
        gap: 6,
    },
    dotWrapper: {
        padding: 4,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    iconContainer: {
        width: 80, // Reduced from 100
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md, // Reduced spacing
        borderWidth: 2,
    },
    icon: {
        fontSize: 40, // Reduced from 48
    },
    stepNumber: {
        fontSize: FontSizes.xs,
        fontWeight: '800',
        // RTL Fix: Remove letter spacing for Arabic
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: Spacing.sm,
        // RTL Fix: Remove letter spacing for Arabic to keep letters connected
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: FontSizes.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.md,
    },
    progressBar: {
        width: '60%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    ctaButton: {
        width: '100%',
        maxWidth: 280,
        marginTop: Spacing.md,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    ctaGradient: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
    },
    ctaText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    swipeHint: {
        fontSize: FontSizes.xs,
        marginTop: Spacing.md,
        opacity: 0.6,
    },
});
