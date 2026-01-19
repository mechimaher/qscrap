// Live Typing Indicator Component
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FontSizes, Spacing } from '../constants/theme';

interface TypingIndicatorProps {
    userName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName = 'Someone' }) => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        const anim1 = animateDot(dot1, 0);
        const anim2 = animateDot(dot2, 200);
        const anim3 = animateDot(dot3, 400);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
        };
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>{userName} is typing</Text>
            <View style={styles.dotsContainer}>
                <Animated.View
                    style={[
                        styles.dot,
                        {
                            opacity: dot1,
                            transform: [{
                                translateY: dot1.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                }),
                            }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.dot,
                        {
                            opacity: dot2,
                            transform: [{
                                translateY: dot2.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                }),
                            }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.dot,
                        {
                            opacity: dot3,
                            transform: [{
                                translateY: dot3.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                }),
                            }],
                        },
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: 'rgba(141, 27, 61, 0.1)',
        borderRadius: 20,
        gap: Spacing.sm,
    },
    text: {
        fontSize: FontSizes.sm,
        color: '#8D1B3D',
        fontStyle: 'italic',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#8D1B3D',
    },
});

export default TypingIndicator;
