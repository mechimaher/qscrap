import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
    ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import * as storage from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    color: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        id: '1',
        icon: 'search-outline',
        title: 'Find Any Auto Part',
        description: 'Search for new or used parts for any car make and model. Our network of verified garages has you covered.',
        color: '#6366f1',
    },
    {
        id: '2',
        icon: 'pricetags-outline',
        title: 'Get Competitive Bids',
        description: 'Post your request and receive multiple bids from trusted suppliers. Compare prices, warranties, and ratings.',
        color: '#8b5cf6',
    },
    {
        id: '3',
        icon: 'shield-checkmark-outline',
        title: 'Quality Guaranteed',
        description: 'All garages are verified. Parts go through quality checks before delivery. Warranty protection included.',
        color: '#10b981',
    },
    {
        id: '4',
        icon: 'bicycle-outline',
        title: 'Fast Delivery',
        description: 'Track your order in real-time. Same-day delivery available across Qatar. Hassle-free returns.',
        color: '#f59e0b',
    },
];

interface OnboardingScreenProps {
    onComplete: () => void;
}

/**
 * Premium onboarding experience for first-time users.
 * Shows key features with smooth animations.
 */
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
    const { colors } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleComplete = async () => {
        await storage.setItem(storage.StorageKey.ONBOARDING_COMPLETE, true);
        onComplete();
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp',
        });

        return (
            <View style={styles.slide}>
                <Animated.View style={[styles.iconContainer, { transform: [{ scale }], opacity }]}>
                    <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                        <Ionicons name={item.icon} size={80} color={item.color} />
                    </View>
                </Animated.View>

                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {item.description}
                </Text>
            </View>
        );
    };

    const renderDots = () => {
        return (
            <View style={styles.dotsContainer}>
                {SLIDES.map((_, index) => {
                    const inputRange = [
                        (index - 1) * SCREEN_WIDTH,
                        index * SCREEN_WIDTH,
                        (index + 1) * SCREEN_WIDTH,
                    ];

                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [8, 24, 8],
                        extrapolate: 'clamp',
                    });

                    const dotOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    width: dotWidth,
                                    opacity: dotOpacity,
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    const isLastSlide = currentIndex === SLIDES.length - 1;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Skip Button */}
            {!isLastSlide && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* Slides */}
            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                scrollEventThrottle={16}
            />

            {/* Dots */}
            {renderDots()}

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
                <TouchableOpacity
                    style={[styles.nextButton, { backgroundColor: colors.primary }, Shadows.md]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    {isLastSlide ? (
                        <>
                            <Text style={styles.nextButtonText}>Get Started</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                    ) : (
                        <>
                            <Text style={styles.nextButtonText}>Next</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: Spacing.xl,
        zIndex: 10,
        padding: Spacing.sm,
    },
    skipText: {
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    slide: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xxl,
    },
    iconContainer: {
        marginBottom: Spacing.xxxl,
    },
    iconCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: FontSize.xxl + 4,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    description: {
        fontSize: FontSize.lg,
        textAlign: 'center',
        lineHeight: 28,
        paddingHorizontal: Spacing.lg,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    bottomSection: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxxl,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
});

export default OnboardingScreen;
