import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Modal,
    Animated,
    PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PartImage {
    uri: string;
    angle?: number; // 0-360 for 360° view
    label?: string;
}

interface PartImageGalleryProps {
    images: string[] | PartImage[];
    partName?: string;
    condition?: 'new' | 'used' | 'refurbished';
    onImagePress?: (index: number) => void;
}

/**
 * Premium Part Image Gallery with 360° View
 * Swipe through images or rotate for 360° view
 */
export const PartImageGallery: React.FC<PartImageGalleryProps> = ({
    images,
    partName = 'Part',
    condition = 'used',
    onImagePress,
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [is360Mode, setIs360Mode] = useState(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const rotationAngle = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Normalize images to PartImage format
    const normalizedImages: PartImage[] = images.map((img, index) =>
        typeof img === 'string'
            ? { uri: img, angle: (index * 360) / images.length }
            : img
    );

    // Pan responder for 360° rotation
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => is360Mode,
            onMoveShouldSetPanResponder: () => is360Mode,
            onPanResponderGrant: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            onPanResponderMove: (_, gestureState) => {
                if (is360Mode) {
                    // Calculate rotation based on drag
                    const rotation = (gestureState.dx / SCREEN_WIDTH) * 360;
                    rotationAngle.setValue(rotation);

                    // Calculate which image to show based on rotation
                    const newIndex = Math.round((rotation % 360) / (360 / normalizedImages.length));
                    const normalizedIndex = ((newIndex % normalizedImages.length) + normalizedImages.length) % normalizedImages.length;
                    if (normalizedIndex !== activeIndex) {
                        setActiveIndex(normalizedIndex);
                        Haptics.selectionAsync();
                    }
                }
            },
            onPanResponderRelease: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
        })
    ).current;

    const handleScroll = (event: any) => {
        if (!is360Mode) {
            const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            if (index !== activeIndex && index >= 0 && index < normalizedImages.length) {
                setActiveIndex(index);
                Haptics.selectionAsync();
            }
        }
    };

    const toggle360Mode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIs360Mode(!is360Mode);

        // Animate scale
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const openFullscreen = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsFullscreen(true);
    };

    const getConditionBadge = () => {
        switch (condition) {
            case 'new':
                return { text: 'NEW', color: '#22c55e', bg: '#dcfce7' };
            case 'refurbished':
                return { text: 'REFURB', color: '#f59e0b', bg: '#fef3c7' };
            case 'used':
            default:
                return { text: 'USED', color: '#6b7280', bg: '#f3f4f6' };
        }
    };

    const conditionBadge = getConditionBadge();

    if (normalizedImages.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📷</Text>
                <Text style={styles.emptyText}>No images available</Text>
            </View>
        );
    }

    return (
        <>
            <View style={styles.container}>
                {/* Main Image Area */}
                <Animated.View
                    style={[styles.imageContainer, { transform: [{ scale: scaleAnim }] }]}
                    {...(is360Mode ? panResponder.panHandlers : {})}
                >
                    {is360Mode ? (
                        // 360° Mode - Single image with rotation hint
                        <View style={styles.rotateContainer}>
                            <Image
                                source={{ uri: normalizedImages[activeIndex].uri }}
                                style={styles.mainImage}
                                resizeMode="contain"
                            />
                            <View style={styles.rotateHint}>
                                <Text style={styles.rotateIcon}>🔄</Text>
                                <Text style={styles.rotateText}>Drag to rotate</Text>
                            </View>
                            <View style={styles.angleBadge}>
                                <Text style={styles.angleText}>
                                    {Math.round((activeIndex / normalizedImages.length) * 360)}°
                                </Text>
                            </View>
                        </View>
                    ) : (
                        // Normal Swipe Mode
                        <ScrollView
                            ref={scrollViewRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                        >
                            {normalizedImages.map((img, index) => (
                                <TouchableOpacity
                                    key={index}
                                    activeOpacity={0.95}
                                    onPress={openFullscreen}
                                >
                                    <Image
                                        source={{ uri: img.uri }}
                                        style={styles.mainImage}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Condition Badge */}
                    <View style={[styles.conditionBadge, { backgroundColor: conditionBadge.bg }]}>
                        <Text style={[styles.conditionText, { color: conditionBadge.color }]}>
                            {conditionBadge.text}
                        </Text>
                    </View>

                    {/* 360° Toggle */}
                    {normalizedImages.length > 2 && (
                        <TouchableOpacity
                            style={[styles.toggleButton, is360Mode && styles.toggleButtonActive]}
                            onPress={toggle360Mode}
                        >
                            <Text style={styles.toggleIcon}>🔄</Text>
                            <Text style={[styles.toggleText, is360Mode && styles.toggleTextActive]}>
                                360°
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Fullscreen Button */}
                    <TouchableOpacity
                        style={styles.fullscreenButton}
                        onPress={openFullscreen}
                    >
                        <Text style={styles.fullscreenIcon}>⛶</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Thumbnail Strip */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbnailContainer}
                >
                    {normalizedImages.map((img, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.thumbnail,
                                activeIndex === index && styles.thumbnailActive,
                            ]}
                            onPress={() => {
                                setActiveIndex(index);
                                scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
                                Haptics.selectionAsync();
                            }}
                        >
                            <Image
                                source={{ uri: img.uri }}
                                style={styles.thumbnailImage}
                                resizeMode="cover"
                            />
                            {img.angle !== undefined && is360Mode && (
                                <View style={styles.thumbnailAngle}>
                                    <Text style={styles.thumbnailAngleText}>{img.angle}°</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Dots Indicator */}
                {!is360Mode && (
                    <View style={styles.dotsContainer}>
                        {normalizedImages.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    activeIndex === index && styles.dotActive,
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* Fullscreen Modal */}
            <Modal
                visible={isFullscreen}
                animationType="fade"
                onRequestClose={() => setIsFullscreen(false)}
            >
                <View style={styles.fullscreenContainer}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setIsFullscreen(false)}
                    >
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>

                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        contentOffset={{ x: activeIndex * SCREEN_WIDTH, y: 0 }}
                    >
                        {normalizedImages.map((img, index) => (
                            <Image
                                key={index}
                                source={{ uri: img.uri }}
                                style={styles.fullscreenImage}
                                resizeMode="contain"
                            />
                        ))}
                    </ScrollView>

                    <View style={styles.fullscreenInfo}>
                        <Text style={styles.fullscreenTitle}>{partName}</Text>
                        <Text style={styles.fullscreenCount}>
                            {activeIndex + 1} / {normalizedImages.length}
                        </Text>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    imageContainer: {
        height: 280,
        backgroundColor: '#F8F9FA',
        position: 'relative',
    },
    rotateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainImage: {
        width: SCREEN_WIDTH,
        height: 280,
    },
    rotateHint: {
        position: 'absolute',
        bottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    rotateIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    rotateText: {
        fontSize: FontSizes.xs,
        color: '#fff',
    },
    angleBadge: {
        position: 'absolute',
        top: Spacing.md,
        left: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
    },
    angleText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#fff',
    },
    conditionBadge: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
    },
    conditionText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    toggleButton: {
        position: 'absolute',
        bottom: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        ...Shadows.sm,
    },
    toggleButtonActive: {
        backgroundColor: Colors.primary,
    },
    toggleIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    toggleText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    toggleTextActive: {
        color: '#fff',
    },
    fullscreenButton: {
        position: 'absolute',
        bottom: Spacing.md,
        left: Spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenIcon: {
        fontSize: 18,
        color: '#fff',
    },
    thumbnailContainer: {
        padding: Spacing.sm,
        gap: Spacing.sm,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        marginRight: Spacing.xs,
    },
    thumbnailActive: {
        borderColor: Colors.primary,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    thumbnailAngle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
    },
    thumbnailAngleText: {
        fontSize: 8,
        color: '#fff',
        fontWeight: '600',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E0E0E0',
    },
    dotActive: {
        backgroundColor: Colors.primary,
        width: 20,
    },
    emptyContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.xl,
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    // Fullscreen styles
    fullscreenContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    closeText: {
        fontSize: 20,
        color: '#fff',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    fullscreenInfo: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    fullscreenTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
        color: '#fff',
    },
    fullscreenCount: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
});

export default PartImageGallery;
