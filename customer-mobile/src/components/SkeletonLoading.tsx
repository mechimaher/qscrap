// QScrap Skeleton Loading Components - Premium Loading States
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

// Animated shimmer effect
const ShimmerPlaceholder: React.FC<{ style?: any }> = ({ style }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 1000, // Faster, snappier feel (Premium Standard)
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenWidth, screenWidth],
    });

    return (
        <View style={[styles.shimmerContainer, style]}>
            <Animated.View
                style={[
                    styles.shimmer,
                    { transform: [{ translateX }] },
                ]}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shimmerGradient}
                />
            </Animated.View>
        </View>
    );
};

// Skeleton for stat cards on HomeScreen
export const StatCardSkeleton: React.FC = () => (
    <View style={styles.statCard}>
        <ShimmerPlaceholder style={styles.statNumber} />
        <ShimmerPlaceholder style={styles.statLabel} />
    </View>
);

// Skeleton for list items (requests, orders)
export const ListItemSkeleton: React.FC = () => (
    <View style={styles.listItem}>
        <View style={styles.listItemLeft}>
            <ShimmerPlaceholder style={styles.listItemCircle} />
        </View>
        <View style={styles.listItemContent}>
            <ShimmerPlaceholder style={styles.listItemTitle} />
            <ShimmerPlaceholder style={styles.listItemSubtitle} />
            <ShimmerPlaceholder style={styles.listItemMeta} />
        </View>
    </View>
);

// Skeleton for notification items
export const NotificationSkeleton: React.FC = () => (
    <View style={styles.notificationItem}>
        <ShimmerPlaceholder style={styles.notificationIcon} />
        <View style={styles.notificationContent}>
            <ShimmerPlaceholder style={styles.notificationTitle} />
            <ShimmerPlaceholder style={styles.notificationMessage} />
        </View>
    </View>
);

// Skeleton for profile header
export const ProfileHeaderSkeleton: React.FC = () => (
    <View style={styles.profileHeader}>
        <ShimmerPlaceholder style={styles.profileAvatar} />
        <ShimmerPlaceholder style={styles.profileName} />
        <ShimmerPlaceholder style={styles.profilePhone} />
    </View>
);

// Loading list skeleton (multiple items)
export const LoadingList: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <View style={styles.loadingList}>
        {Array.from({ length: count }).map((_, index) => (
            <ListItemSkeleton key={index} />
        ))}
    </View>
);

// Loading stats skeleton
export const LoadingStats: React.FC = () => (
    <View style={styles.loadingStats}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <View style={styles.wideStatCard}>
            <ShimmerPlaceholder style={styles.statNumber} />
            <ShimmerPlaceholder style={styles.statLabel} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    shimmerContainer: {
        backgroundColor: Colors.dark.surface,
        overflow: 'hidden',
        borderRadius: BorderRadius.sm,
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
    },
    shimmerGradient: {
        flex: 1,
        width: screenWidth * 2,
    },

    // Stat card skeleton
    statCard: {
        width: '48%',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    wideStatCard: {
        width: '100%',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
    },
    statNumber: {
        width: 60,
        height: 36,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    statLabel: {
        width: 100,
        height: 14,
        borderRadius: BorderRadius.sm,
    },

    // List item skeleton
    listItem: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    listItemLeft: {
        marginRight: Spacing.md,
    },
    listItemCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        width: '70%',
        height: 18,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.sm,
    },
    listItemSubtitle: {
        width: '90%',
        height: 14,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.xs,
    },
    listItemMeta: {
        width: '40%',
        height: 12,
        borderRadius: BorderRadius.sm,
    },

    // Notification skeleton
    notificationItem: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    notificationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: Spacing.md,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        width: '60%',
        height: 16,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.sm,
    },
    notificationMessage: {
        width: '80%',
        height: 12,
        borderRadius: BorderRadius.sm,
    },

    // Profile header skeleton
    profileHeader: {
        alignItems: 'center',
        padding: Spacing.xl,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.xl,
    },
    profileAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: Spacing.md,
    },
    profileName: {
        width: 150,
        height: 24,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.sm,
    },
    profilePhone: {
        width: 120,
        height: 16,
        borderRadius: BorderRadius.sm,
    },

    // Loading containers
    loadingList: {
        padding: Spacing.lg,
    },
    loadingStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
});

export default ShimmerPlaceholder;
