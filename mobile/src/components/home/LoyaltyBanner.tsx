// LoyaltyBanner - Compact loyalty points display with tier badge
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { useLoyalty } from '../../hooks/useLoyalty';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import { rtlTextAlign } from '../../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

const LoyaltyBanner = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    // Centralized loyalty hook — shared cache, no duplicate API call
    const { loyalty: loyaltyHookData } = useLoyalty();
    const loyalty = loyaltyHookData ? { points: loyaltyHookData.points, tier: loyaltyHookData.tier } : null;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    const getTierConfig = (tier: string) => {
        switch (tier) {
            case 'silver': return { icon: 'medal-outline' as const, color: '#94A3B8', bg: ['#E2E8F0', '#F1F5F9'] };
            case 'gold': return { icon: 'trophy-outline' as const, color: '#D4AF37', bg: ['#FEF3C7', '#FFFBEB'] };
            case 'platinum': return { icon: 'diamond-outline' as const, color: '#8B5CF6', bg: ['#EDE9FE', '#F5F3FF'] };
            default: return { icon: 'ribbon-outline' as const, color: '#CD7F32', bg: ['#FFEDD5', '#FFF7ED'] };
        }
    };

    const tierConfig = getTierConfig(loyalty?.tier || 'bronze');

    return (
        <Animated.View style={[
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
            { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }
        ]}>
            <TouchableOpacity
                onPress={handlePress}
                onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
                activeOpacity={1}
            >
                <LinearGradient
                    colors={tierConfig.bg as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerGradient}
                >
                    {/* Shimmer effect */}
                    <Animated.View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 100,
                        height: '100%',
                        backgroundColor: 'rgba(255,255,255,0.4)',
                        transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }],
                    }} />

                    <View style={styles.tierIconContainer}>
                        <Ionicons name={tierConfig.icon} size={22} color={tierConfig.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={[styles.tierLabel, { color: tierConfig.color, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('loyalty.tierLabel', { tier: t(`loyalty.${(loyalty?.tier || 'bronze').toLowerCase()}`) })}
                        </Text>
                        <Text style={[styles.pointsText, { textAlign: rtlTextAlign(isRTL) }]}>
                            {loyalty?.points?.toLocaleString() || '0'} {t('home.pts')}
                        </Text>
                    </View>

                    <View style={styles.rewardsButton}>
                        <Text style={styles.rewardsButtonText}>{t('home.rewards')}</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    bannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    tierIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    tierLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    pointsText: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.primary,
    },
    rewardsButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    rewardsButtonText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '700',
    },
});

export default LoyaltyBanner;
