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
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
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

interface OnboardingSlide {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    color: string;
}

interface OnboardingScreenProps {
    onComplete: () => void;
}

/**
 * Premium onboarding experience for first-time users.
 * Shows key features with smooth animations.
 */
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);

    const SLIDES: OnboardingSlide[] = [
        {
            id: '1',
            icon: 'search-outline',
            title: t('onboarding.slide1Title'),
            description: t('onboarding.slide1Desc'),
            color: '#8D1B3D', // Maroon
        },
        {
            id: '2',
            icon: 'pricetags-outline',
            title: t('onboarding.slide2Title'),
            description: t('onboarding.slide2Desc'),
            color: '#C9A227', // Gold
        },
        {
            id: '3',
            icon: 'shield-checkmark-outline',
            title: t('onboarding.slide3Title'),
            description: t('onboarding.slide3Desc'),
            color: '#059669', // Green (success)
        },
        {
            id: '4',
            icon: 'bicycle-outline',
            title: t('onboarding.slide4Title'),
            description: t('onboarding.slide4Desc'),
            color: '#8D1B3D', // Maroon
        },
    ];
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
                <TouchableOpacity style={[styles.skipButton, isRTL ? { left: Spacing.xl, right: undefined } : { right: Spacing.xl, left: undefined }]} onPress={handleSkip}>
                    <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('common.skip')}</Text>
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
                inverted={isRTL}
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
                            <Text style={styles.nextButtonText}>{t('onboarding.getStarted')}</Text>
                            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
                        </>
                    ) : (
                        <>
                            <Text style={styles.nextButtonText}>{t('common.next')}</Text>
                            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};


// ... existing styles ...
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
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
