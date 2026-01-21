// Loyalty Tier Animation Component - P2 Feature
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Colors, FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface LoyaltyTierAnimationProps {
    visible: boolean;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    onComplete: () => void;
}

export const LoyaltyTierAnimation: React.FC<LoyaltyTierAnimationProps> = ({
    visible,
    tier,
    onComplete,
}) => {
    const scale = useSharedValue(0);
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSequence(
                withSpring(1.2, { damping: 8 }),
                withSpring(1, { damping: 10 })
            );
            rotation.value = withSequence(
                withTiming(360, { duration: 800 }),
                withTiming(0, { duration: 0 })
            );

            // Auto-close after animation
            setTimeout(onComplete, 4000);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ],
        opacity: opacity.value,
    }));

    const getTierConfig = () => {
        switch (tier) {
            case 'bronze':
                return {
                    colors: ['#CD7F32', '#8B4513'],
                    icon: '🥉',
                    name: 'Bronze',
                    confetti: ['#CD7F32', '#8B4513', '#D2691E'],
                };
            case 'silver':
                return {
                    colors: ['#C0C0C0', '#A8A8A8'],
                    icon: '🥈',
                    name: 'Silver',
                    confetti: ['#C0C0C0', '#A8A8A8', '#D3D3D3'],
                };
            case 'gold':
                return {
                    colors: ['#FFD700', '#FFA500'],
                    icon: '🥇',
                    name: 'Gold',
                    confetti: ['#FFD700', '#FFA500', '#FFED4E'],
                };
            case 'platinum':
                return {
                    colors: ['#E5E4E2', '#B9F2FF'],
                    icon: '💎',
                    name: 'Platinum',
                    confetti: ['#E5E4E2', '#B9F2FF', '#FFFFFF'],
                };
        }
    };

    const config = getTierConfig();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <ConfettiCannon
                    count={150}
                    origin={{ x: -10, y: 0 }}
                    autoStart
                    fadeOut
                    colors={config.confetti}
                />
                <Animated.View style={animatedStyle}>
                    <LinearGradient
                        colors={config.colors as any}
                        style={styles.badge}
                    >
                        <Text style={styles.icon}>{config.icon}</Text>
                        <Text style={styles.tierName}>{config.name} Tier</Text>
                        <Text style={styles.subtitle}>Unlocked!</Text>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        width: 280,
        padding: Spacing.xxl,
        borderRadius: BorderRadius.xxl,
        alignItems: 'center',
        ...Shadows.xxl,
    },
    icon: {
        fontSize: 80,
        marginBottom: Spacing.md,
    },
    tierName: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: Spacing.xs,
    },
});

export default LoyaltyTierAnimation;
