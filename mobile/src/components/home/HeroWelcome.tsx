// HeroWelcome - Premium hero section with greeting, notifications, loyalty badge, and delivery location
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, FontSizes, Colors as ThemeColors } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

interface HeroWelcomeProps {
    user: any;
    colors: any;
    onNotificationPress: () => void;
    unreadCount?: number;
    onLocationPress?: () => void;
    deliveryAddress?: string;
    loyalty?: { points: number; tier: string } | null;
    onLoyaltyPress?: () => void;
    greeting: string;
    customerLabel?: string;
}

const HeroWelcome = ({
    user,
    colors,
    onNotificationPress,
    unreadCount = 0,
    onLocationPress,
    deliveryAddress,
    loyalty,
    onLoyaltyPress,
    greeting,
    customerLabel
}: HeroWelcomeProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const loyaltyGlow = useRef(new Animated.Value(0.8)).current;
    const { t, isRTL } = useTranslation();

    const getTimeEmoji = () => {
        const hour = new Date().getHours();
        if (hour < 6) return '🌙';
        if (hour < 12) return '☀️';
        if (hour < 17) return '🌤️';
        if (hour < 20) return '🌅';
        return '🌙';
    };

    const getTierEmoji = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case 'platinum': return '💎';
            case 'gold': return '🏆';
            case 'silver': return '🥈';
            default: return '🏅';
        }
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const badgeScale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    return (
        <Animated.View style={[
            styles.heroSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
            <LinearGradient
                colors={ThemeColors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
            >
                <View style={[styles.heroContent, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <View style={[styles.heroLeft, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <View style={[styles.logoContainer, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>
                            <Image
                                source={require('../../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="cover"
                            />
                        </View>
                        <View style={styles.heroTextContainer}>
                            <Text style={[styles.heroGreeting, { textAlign: rtlTextAlign(isRTL) }]}>
                                {getTimeEmoji()} {greeting}
                            </Text>
                            <Text style={[styles.heroName, { textAlign: rtlTextAlign(isRTL) }]}>
                                {user?.full_name || customerLabel || t('common.customer')}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.notificationBtn}
                        onPress={onNotificationPress}
                        accessibilityLabel={t('accessibility.notifications') || 'Notifications'}
                        accessibilityHint={t('accessibility.viewNotifications') || 'View your notifications'}
                        accessibilityRole="button"
                    >
                        <Text style={styles.notificationIcon}>🔔</Text>
                        {unreadCount > 0 && (
                            <Animated.View style={[
                                styles.notificationBadge,
                                { transform: [{ scale: badgeScale }], backgroundColor: colors.secondary, borderColor: colors.primary }
                            ]}>
                                {unreadCount > 9 ? (
                                    <Text style={styles.notificationCount}>9+</Text>
                                ) : (
                                    <Text style={styles.notificationCount}>{unreadCount}</Text>
                                )}
                            </Animated.View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Compact Loyalty Badge - VIP Status Display */}
                {loyalty && (
                    <TouchableOpacity
                        onPress={onLoyaltyPress}
                        activeOpacity={0.7}
                        accessibilityLabel={t('accessibility.loyaltyBadge') || 'Your loyalty status'}
                        accessibilityHint={t('accessibility.viewRewards') || 'View your rewards'}
                        accessibilityRole="button"
                    >
                        <Animated.View style={[styles.heroLoyaltyBadge, { opacity: loyaltyGlow, alignSelf: isRTL ? 'flex-end' : 'flex-start', marginLeft: isRTL ? 0 : Spacing.lg, marginRight: isRTL ? Spacing.lg : 0, flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.heroLoyaltyEmoji}>{getTierEmoji(loyalty.tier)}</Text>
                            <Text style={styles.heroLoyaltyTier}>{t('loyalty.tierLabel', { tier: t(`loyalty.${loyalty.tier.toLowerCase()}`) })}</Text>
                            <View style={styles.heroLoyaltyDot} />
                            <Text style={styles.heroLoyaltyPoints}>{loyalty.points.toLocaleString()} {t('home.pts')}</Text>
                        </Animated.View>
                    </TouchableOpacity>
                )}

                {/* Refined Gold Divider */}
                <View style={[styles.goldDivider, { backgroundColor: colors.secondary }]} />

                {/* Premium Location Section - Integrated */}
                <TouchableOpacity
                    style={styles.locationSection}
                    onPress={onLocationPress}
                    activeOpacity={0.7}
                    accessibilityLabel={t('accessibility.deliveryLocation') || 'Delivery location'}
                    accessibilityHint={t('accessibility.changeLocation') || 'Change your delivery address'}
                    accessibilityRole="button"
                >
                    <View style={[styles.locationContent, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <View style={styles.locationIconContainer}>
                            <Text style={styles.locationIcon}>📍</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.locationLabel}>{t('home.deliveringTo')}</Text>
                            <Text style={styles.locationText} numberOfLines={1}>
                                {deliveryAddress || t('home.selectAddress')}
                            </Text>
                        </View>
                        <View style={[styles.changeButton, { backgroundColor: colors.secondary }]}>
                            <Text style={styles.changeButtonText}>{t('common.change')}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Gold accent line */}
                <View style={[styles.goldAccent, { backgroundColor: colors.secondary }]} />
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    heroSection: { marginBottom: Spacing.md },
    heroGradient: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
        borderBottomLeftRadius: BorderRadius.lg,
        borderBottomRightRadius: BorderRadius.lg,
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    logoContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        overflow: 'hidden',
        marginRight: Spacing.sm,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    logo: { width: 40, height: 40 },
    heroTextContainer: { flex: 1 },
    heroGreeting: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 2,
    },
    heroName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    notificationBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationIcon: { fontSize: 18 },
    notificationBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationCount: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    goldAccent: {
        height: 2,
        marginHorizontal: Spacing.md,
        borderRadius: 1,
    },
    goldDivider: {
        height: 1,
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md,
        opacity: 0.3,
        borderRadius: 0.5,
    },
    heroLoyaltyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginLeft: Spacing.lg,
        marginTop: Spacing.xs,
        backgroundColor: 'rgba(201, 162, 39, 0.25)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        gap: 6,
    },
    heroLoyaltyEmoji: { fontSize: 14 },
    heroLoyaltyTier: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    heroLoyaltyDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    heroLoyaltyPoints: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
    },
    locationSection: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    locationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    locationIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(201, 162, 39, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationIcon: { fontSize: 18 },
    locationLabel: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 2,
    },
    locationText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    changeButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    changeButtonText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#8D1B3D',
    },
});

export default HeroWelcome;
