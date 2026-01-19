// Enhanced Shimmer Loading Component - Premium Multi-Layer
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');

export const EnhancedShimmer: React.FC = () => {
    const shimmerAnim = useSharedValue(0);

    useEffect(() => {
        shimmerAnim.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{
            translateX: interpolate(
                shimmerAnim.value,
                [0, 1],
                [-width, width]
            )
        }],
    }));

    return (
        <View style={styles.container}>
            {/* Header Shimmer */}
            <View style={styles.header}>
                <View style={styles.avatar} />
                <View style={styles.headerText}>
                    <View style={[styles.line, styles.lineTitle]} />
                    <View style={[styles.line, styles.lineSubtitle]} />
                </View>
            </View>

            {/* Card Shimmers */}
            <View style={styles.card}>
                <View style={styles.cardImage} />
                <View style={styles.cardContent}>
                    <View style={[styles.line, styles.lineFull]} />
                    <View style={[styles.line, styles.lineLarge]} />
                    <View style={[styles.line, styles.lineMedium]} />
                    <View style={styles.cardFooter}>
                        <View style={[styles.line, styles.lineSmall]} />
                        <View style={[styles.line, styles.lineSmall]} />
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.cardImage} />
                <View style={styles.cardContent}>
                    <View style={[styles.line, styles.lineFull]} />
                    <View style={[styles.line, styles.lineLarge]} />
                    <View style={[styles.line, styles.lineMedium]} />
                </View>
            </View>

            {/* Animated Shimmer Overlay */}
            <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Spacing.md,
        backgroundColor: Colors.theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.theme.surface,
    },
    headerText: {
        flex: 1,
        gap: Spacing.xs,
    },
    card: {
        backgroundColor: Colors.theme.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        height: 120,
        borderRadius: BorderRadius.md,
        backgroundColor: '#E5E7EB',
        marginBottom: Spacing.md,
    },
    cardContent: {
        gap: Spacing.sm,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    line: {
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E5E7EB',
    },
    lineTitle: {
        width: '70%',
        height: 16,
    },
    lineSubtitle: {
        width: '50%',
    },
    lineFull: {
        width: '100%',
    },
    lineLarge: {
        width: '85%',
    },
    lineMedium: {
        width: '60%',
    },
    lineSmall: {
        width: '30%',
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        width: width * 2,
    },
});

export default EnhancedShimmer;
