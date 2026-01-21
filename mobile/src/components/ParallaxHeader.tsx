// Parallax Header Component - P2 Premium Feature
import React, { ReactNode } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { Spacing } from '../constants/theme';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 250;

interface ParallaxHeaderProps {
    imageUrl?: string;
    children: ReactNode;
}

export const ParallaxHeader: React.FC<ParallaxHeaderProps> = ({
    imageUrl,
    children,
}) => {
    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        const translateY = interpolate(
            scrollY.value,
            [0, HEADER_HEIGHT],
            [0, -HEADER_HEIGHT / 2],
            Extrapolate.CLAMP
        );

        const scale = interpolate(
            scrollY.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [2, 1, 0.8],
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_HEIGHT / 2, HEADER_HEIGHT],
            [1, 0.5, 0],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ translateY }, { scale }],
            opacity,
        };
    });

    const contentAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                translateY: interpolate(
                    scrollY.value,
                    [0, HEADER_HEIGHT],
                    [0, -20],
                    Extrapolate.CLAMP
                )
            }],
        };
    });

    return (
        <View style={styles.container}>
            {/* Parallax Header */}
            <Animated.View style={[styles.header, headerAnimatedStyle]}>
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.headerImage} />
                ) : (
                    <View style={styles.headerPlaceholder} />
                )}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={styles.headerGradient}
                />
            </Animated.View>

            {/* Scrollable Content */}
            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={contentAnimatedStyle}>
                    {children}
                </Animated.View>
            </Animated.ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT,
        zIndex: 1,
        overflow: 'hidden',
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    headerPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#8D1B3D',
    },
    headerGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
});

export default ParallaxHeader;
