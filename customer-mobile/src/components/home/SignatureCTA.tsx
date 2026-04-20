// SignatureCTA - Premium call-to-action card for creating new part requests
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, Colors as ThemeColors } from '../../constants/theme';
import { rtlFlexDirection } from '../../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

const SignatureCTA = ({ onPress }: { onPress: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const plusIconAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                delay: 200,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.6],
    });

    const plusScale = plusIconAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    return (
        <Animated.View style={[
            styles.ctaWrapper,
            {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
            }
        ]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                accessibilityLabel={t('accessibility.newRequest') || 'Create new part request'}
                accessibilityHint={t('accessibility.newRequestHint') || 'Tap to request a car part'}
                accessibilityRole="button"
            >
                <View style={[styles.ctaCard, { backgroundColor: colors.surface }]}>
                    {/* Glow effect */}
                    <Animated.View style={[styles.ctaGlow, { opacity: glowOpacity, backgroundColor: colors.primary }]} />

                    <LinearGradient
                        colors={ThemeColors.gradients.champagne}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaGradient}
                    >
                        <View style={styles.ctaContent}>
                            <Text style={[styles.ctaTitle, { color: colors.primary }]}>{t('home.findYourPart')}</Text>

                            {/* Request Button - Center with Premium Shadow */}
                            <Animated.View style={[
                                styles.ctaButton,
                                {
                                    transform: [{ scale: plusScale }],
                                    marginTop: Spacing.md,
                                    alignSelf: 'center',
                                    backgroundColor: colors.primary,
                                    shadowColor: colors.primary,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 8,
                                    elevation: 8,
                                }
                            ]}>
                                <Text style={[styles.ctaButtonText, { color: '#FFFFFF' }]}>{t('home.requestPart')}</Text>
                            </Animated.View>

                            {/* 3-Tier Supplier Badges */}
                            <View style={[styles.supplierBadges, { marginTop: Spacing.md, flexDirection: rtlFlexDirection(isRTL) }]}>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                                    <Ionicons name="leaf-outline" size={12} color="#15803d" />
                                    <Text style={[styles.badgeText, { color: '#15803d' }]}>{t('condition.used')}</Text>
                                </View>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                    <Ionicons name="construct-outline" size={12} color="#1d4ed8" />
                                    <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>{t('condition.commercial')}</Text>
                                </View>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                    <Ionicons name="star" size={12} color="#b45309" />
                                    <Text style={[styles.badgeText, { color: '#b45309' }]}>{t('condition.genuine')}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.ctaFooter, { flexDirection: rtlFlexDirection(isRTL), borderTopColor: 'rgba(0,0,0,0.05)' }]}>
                            <View style={styles.ctaFooterDot} />
                            <Text style={[styles.ctaFooterText, { color: colors.textSecondary }]}>
                                {t('home.verifiedSuppliers')}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    ctaWrapper: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    ctaCard: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    ctaGlow: {
        position: 'absolute',
        top: -15,
        left: -15,
        right: -15,
        bottom: -15,
        borderRadius: BorderRadius.lg + 15,
    },
    ctaGradient: { padding: Spacing.md },
    ctaContent: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    ctaTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
        textAlign: 'center',
    },
    ctaButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    ctaButtonText: {
        color: '#8D1B3D',
        fontSize: FontSizes.sm,
        fontWeight: '700',
    },
    ctaFooter: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.xs,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    ctaFooterDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22C55E',
        marginRight: Spacing.xs,
    },
    ctaFooterText: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
    supplierBadges: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    supplierBadge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: BorderRadius.lg,
        gap: 4,
    },
    badgeIcon: { fontSize: 12 },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
});

export default SignatureCTA;
