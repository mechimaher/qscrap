import React, { useEffect, useRef } from 'react';
import {
    View,
    Animated,
    StyleSheet,
    ViewStyle,
    Dimensions,
    DimensionValue,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, BorderRadius, Colors } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonLoaderProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Animated skeleton loader for better perceived performance.
 * Shows a shimmering placeholder while content is loading.
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = 20,
    borderRadius = BorderRadius.sm,
    style,
}) => {
    const { colors } = useTheme();
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: colors.border,
                    opacity,
                },
                style,
            ]}
        />
    );
};

/**
 * Pre-built skeleton card for assignment list items
 */
export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
            {/* Header row */}
            <View style={styles.cardHeader}>
                <SkeletonLoader width={48} height={48} borderRadius={12} />
                <View style={styles.cardHeaderText}>
                    <SkeletonLoader width="60%" height={16} />
                    <SkeletonLoader width="40%" height={12} style={{ marginTop: 8 }} />
                </View>
            </View>

            {/* Content rows */}
            <SkeletonLoader width="100%" height={14} style={{ marginTop: 16 }} />
            <SkeletonLoader width="80%" height={14} style={{ marginTop: 8 }} />

            {/* Footer */}
            <View style={styles.cardFooter}>
                <SkeletonLoader width={100} height={40} borderRadius={12} />
                <SkeletonLoader width={60} height={20} />
            </View>
        </View>
    );
};

/**
 * Pre-built skeleton list for multiple items
 */
export const SkeletonList: React.FC<{ count?: number; style?: ViewStyle }> = ({
    count = 3,
    style,
}) => {
    return (
        <View style={style}>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} style={{ marginBottom: Spacing.md }} />
            ))}
        </View>
    );
};

/**
 * Stats grid skeleton for home screen
 */
export const SkeletonStats: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map((_, index) => (
                <View key={index} style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <SkeletonLoader width={40} height={40} borderRadius={20} />
                    <SkeletonLoader width={60} height={24} style={{ marginTop: 12 }} />
                    <SkeletonLoader width={50} height={12} style={{ marginTop: 8 }} />
                </View>
            ))}
        </View>
    );
};

/**
 * Home screen skeleton
 */
export const HomeScreenSkeleton: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={styles.homeContainer}>
            {/* Header skeleton */}
            <View style={[styles.headerSkeleton, { backgroundColor: Colors.primary }]}>
                <View style={styles.headerContent}>
                    <View>
                        <SkeletonLoader width={100} height={14} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <SkeletonLoader width={150} height={24} style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                    </View>
                    <SkeletonLoader width={100} height={36} borderRadius={18} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                </View>
            </View>

            {/* Stats skeleton */}
            <SkeletonStats />

            {/* Section title */}
            <SkeletonLoader width={150} height={20} style={{ marginHorizontal: 20, marginTop: 24 }} />

            {/* Assignment cards */}
            <View style={{ padding: 20 }}>
                <SkeletonCard />
                <SkeletonCard style={{ marginTop: 12 }} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        overflow: 'hidden',
    },
    card: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        padding: 20,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    homeContainer: {
        flex: 1,
    },
    headerSkeleton: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});

export default SkeletonLoader;
