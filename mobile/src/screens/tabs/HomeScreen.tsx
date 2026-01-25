// QScrap Home Screen - Premium 2026 Brand Experience
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Linking,
    Image,
    Animated,
    Easing,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign, rtlChevron } from '../../utils/rtl';
import { api, Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, Colors as ThemeColors } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { useSocketContext } from '../../hooks/useSocket';
import { useToast } from '../../components/Toast';
import FeaturedProductsSection from '../../components/FeaturedProductsSection';
import HowItWorksCarousel from '../../components/HowItWorksCarousel';
import { DeliveryLocationWidget } from '../../components/DeliveryLocationWidget';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 3) / 2;
const SUPPORT_PHONE = '97412345678'; // Should be in constants

// ============================================
// ANIMATED COUNT-UP COMPONENT
// ============================================
const AnimatedNumber = ({ value, delay = 0 }: { value: number; delay?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animRef = useRef<any>(null);
    const { colors } = useTheme();

    useEffect(() => {
        const timeout = setTimeout(() => {
            let start = 0;
            const duration = 1000;
            const step = (timestamp: number) => {
                if (!animRef.current) animRef.current = timestamp;
                const progress = Math.min((timestamp - animRef.current) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
                setDisplayValue(Math.floor(eased * value));
                if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, delay);
        return () => clearTimeout(timeout);
    }, [value, delay]);

    return <Text style={[styles.statValue, { color: colors.text }]}>{displayValue}</Text>;
};

// ============================================
// HERO WELCOME SECTION
// ============================================
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
}: {
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
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const loyaltyGlow = useRef(new Animated.Value(0.8)).current;
    const { t, isRTL } = useTranslation();

    // Greeting is now passed from parent with translations

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
        // Simple fade-in entrance animation only - no loops for performance
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300, // Reduced from 600ms
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300, // Reduced from 600ms
                useNativeDriver: true,
            }),
        ]).start();
        // Removed: pulse and glow loop animations (battery/performance drain)
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
                    <TouchableOpacity onPress={onLoyaltyPress} activeOpacity={0.7}>
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

// ============================================
// SIGNATURE CTA CARD
// ============================================
const SignatureCTA = ({ onPress }: { onPress: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const plusIconAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        // Entrance animation
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
        // Removed: glow pulse and breathing animations (battery drain)
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

                            {/* Request Button - Center */}
                            <Animated.View style={[
                                styles.ctaButton,
                                { transform: [{ scale: plusScale }], marginTop: Spacing.md, alignSelf: 'center', backgroundColor: colors.primary }
                            ]}>
                                <Text style={[styles.ctaButtonText, { color: '#FFFFFF' }]}>{t('home.requestPart')}</Text>
                            </Animated.View>

                            {/* 3-Tier Supplier Badges */}
                            <View style={[styles.supplierBadges, { marginTop: Spacing.md, flexDirection: rtlFlexDirection(isRTL) }]}>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                                    <Text style={styles.badgeIcon}>♻️</Text>
                                    <Text style={[styles.badgeText, { color: '#15803d' }]}>{t('condition.used')}</Text>
                                </View>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                    <Text style={styles.badgeIcon}>🔩</Text>
                                    <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>{t('condition.commercial')}</Text>
                                </View>
                                <View style={[styles.supplierBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                    <Text style={styles.badgeIcon}>⭐</Text>
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

// ============================================
// ANIMATED STATS DASHBOARD
// ============================================
const AnimatedStats = ({
    stats,
    onRequestsPress,
    onOrdersPress
}: {
    stats: Stats | null;
    onRequestsPress: () => void;
    onOrdersPress: () => void;
}) => {
    const slideAnims = useRef([
        new Animated.Value(40),
        new Animated.Value(40),
        new Animated.Value(40),
    ]).current;
    const fadeAnims = useRef([
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
    ]).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        slideAnims.forEach((anim, index) => {
            Animated.timing(anim, {
                toValue: 0,
                duration: 500,
                delay: 400 + index * 100,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }).start();
        });

        fadeAnims.forEach((anim, index) => {
            Animated.timing(anim, {
                toValue: 1,
                duration: 400,
                delay: 400 + index * 100,
                useNativeDriver: true,
            }).start();
        });
    }, []);

    const StatCard = ({
        index,
        emoji,
        value,
        label,
        colors: cardColors,
        onPress
    }: {
        index: number;
        emoji: string;
        value: number;
        label: string;
        colors: readonly [string, string];
        onPress: () => void;
    }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        const handlePressIn = () => {
            Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
        };
        const handlePressOut = () => {
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        };

        return (
            <Animated.View style={[
                styles.statCardWrapper,
                {
                    opacity: fadeAnims[index],
                    transform: [{ translateY: slideAnims[index] }, { scale: scaleAnim }],
                }
            ]}>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={1}
                >
                    <LinearGradient colors={cardColors} style={styles.statCardInner}>
                        <Text style={styles.statEmoji}>{emoji}</Text>
                        <AnimatedNumber value={value} delay={500 + index * 150} />
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>📊 {t('home.yourActivity')}</Text>
            <View style={[styles.statsRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <StatCard
                    index={0}
                    emoji="🔍"
                    value={stats?.active_requests || 0}
                    label={t('home.activeRequests')}
                    colors={['#FFF9E6', '#FFF3CC']}
                    onPress={onRequestsPress}
                />
                <StatCard
                    index={1}
                    emoji="🚚"
                    value={stats?.pending_deliveries || 0}
                    label={t('home.inProgress')}
                    colors={['#E6F7FF', '#CCF0FF']}
                    onPress={onOrdersPress}
                />
            </View>
            <Animated.View style={[
                styles.statCardWide,
                {
                    opacity: fadeAnims[2],
                    transform: [{ translateY: slideAnims[2] }],
                }
            ]}>
                <TouchableOpacity onPress={onOrdersPress} activeOpacity={0.9}>
                    <LinearGradient
                        colors={['rgba(138,21,56,0.08)', 'rgba(138,21,56,0.15)']}
                        style={[styles.statCardWideInner, { flexDirection: rtlFlexDirection(isRTL) }]}
                    >
                        <View style={[styles.wideCardLeft, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.wideCardEmoji, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>📦</Text>
                            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                                <AnimatedNumber value={stats?.total_orders || 0} delay={700} />
                                <Text style={[styles.wideCardLabel, { color: colors.textSecondary }]}>{t('home.totalOrders')}</Text>
                            </View>
                        </View>
                        <View style={[styles.wideCardBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.wideCardBadgeText, { color: colors.primary }]}>{t('common.viewAll')} {isRTL ? '←' : '→'}</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

// ============================================
// PREMIUM QUICK ACTIONS
// ============================================
const QuickActions = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: 700,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                delay: 700,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const ActionButton = ({
        emoji,
        label,
        bgColor,
        onPress
    }: {
        emoji: string;
        label: string;
        bgColor: string;
        onPress: () => void;
    }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        return (
            <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
                onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
                activeOpacity={1}
            >
                <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleAnim }], backgroundColor: colors.surface }]}>
                    <View style={[styles.actionIconBg, { backgroundColor: bgColor }]}>
                        <Text style={styles.actionEmoji}>{emoji}</Text>
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.textSecondary, textAlign: 'center' }]}>{label}</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Animated.View style={[
            styles.actionsSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
            <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>⚡ {t('home.quickActions')}</Text>
            <View style={[styles.actionsGrid, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <ActionButton
                    emoji="📋"
                    label={t('nav.newRequest')}
                    bgColor="#E8F5E9"
                    onPress={() => navigation.navigate('NewRequest')}
                />
                <ActionButton
                    emoji="🚗"
                    label={t('nav.myVehicles')}
                    bgColor="#E3F2FD"
                    onPress={() => navigation.navigate('MyVehicles')}
                />
                <ActionButton
                    emoji="💬"
                    label={t('nav.support')}
                    bgColor="#FFF3E0"
                    onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=Hi%20QScrap%20Support`)}
                />
                <ActionButton
                    emoji="⚙️"
                    label={t('nav.settings')}
                    bgColor="#F3E5F5"
                    onPress={() => navigation.navigate('Settings')}
                />
            </View>
        </Animated.View>
    );
};

// ============================================
// PRO TIP CARD - TAPPABLE WITH ANIMATED LIGHTBULB
// ============================================
const ProTipCard = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.6)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            delay: 400,
            useNativeDriver: true,
        }).start();
        // Removed: lightbulb glow loop (battery drain)
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('NewRequest');
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
            activeOpacity={1}
        >
            <Animated.View style={[
                styles.proTipCard,
                { opacity: fadeAnim, backgroundColor: colors.surface, transform: [{ scale: scaleAnim }], flexDirection: rtlFlexDirection(isRTL) }
            ]}>
                <View style={[styles.proTipIconWrapper, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>
                    <Animated.Text style={[styles.proTipIcon, { opacity: glowAnim }]}>💡</Animated.Text>
                </View>
                <View style={styles.proTipContent}>
                    <Text style={[styles.proTipTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('home.proTip')}</Text>
                    <Text style={[styles.proTipText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('home.proTipMessage')} {isRTL ? '←' : '→'}
                    </Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

// ============================================
// LOYALTY POINTS BANNER (MVP)
// ============================================
const LoyaltyBanner = ({ navigation }: { navigation: any }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const [loyalty, setLoyalty] = useState<{ points: number; tier: string } | null>(null);

    useEffect(() => {
        // Load loyalty balance
        api.getLoyaltyBalance().then(data => {
            setLoyalty({ points: data.points, tier: data.tier });
        }).catch(() => {
            // Fail silently - show default values
            setLoyalty({ points: 0, tier: 'bronze' });
        });

        // Entrance animation - simplified
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        // Removed: shimmer loop (battery drain)
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Could navigate to loyalty screen
    };

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    const getTierConfig = (tier: string) => {
        switch (tier) {
            case 'silver': return { emoji: '🥈', color: '#94A3B8', bg: ['#E2E8F0', '#F1F5F9'] };
            case 'gold': return { emoji: '🥇', color: '#D4AF37', bg: ['#FEF3C7', '#FFFBEB'] };
            case 'platinum': return { emoji: '💎', color: '#8B5CF6', bg: ['#EDE9FE', '#F5F3FF'] };
            default: return { emoji: '🏅', color: '#CD7F32', bg: ['#FFEDD5', '#FFF7ED'] };
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
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: Spacing.md,
                        borderRadius: BorderRadius.lg,
                        overflow: 'hidden',
                    }}
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

                    <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: Spacing.md,
                    }}>
                        <Text style={{ fontSize: 22 }}>{tierConfig.emoji}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: FontSizes.sm, color: tierConfig.color, fontWeight: '600', textTransform: 'uppercase', textAlign: rtlTextAlign(isRTL) }}>
                            {t('loyalty.tierLabel', { tier: t(`loyalty.${(loyalty?.tier || 'bronze').toLowerCase()}`) })}
                        </Text>
                        <Text style={{ fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary, textAlign: rtlTextAlign(isRTL) }}>
                            {loyalty?.points?.toLocaleString() || '0'} {t('home.pts')}
                        </Text>
                    </View>

                    <View style={{
                        backgroundColor: Colors.primary,
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.xs,
                        borderRadius: BorderRadius.full,
                    }}>
                        <Text style={{ color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' }}>🎁 {t('home.rewards')}</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================
// SKELETON LOADING
// ============================================
const SkeletonLoading = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const SkeletonBox = ({ style }: { style: any }) => (
        <View style={[styles.skeletonBox, style, { backgroundColor: colors.surfaceSecondary }]}>
            <Animated.View style={[styles.skeletonShimmer, { transform: [{ translateX: shimmerTranslate }], backgroundColor: colors.surface }]} />
        </View>
    );

    return (
        <View style={styles.skeletonContainer}>
            <SkeletonBox style={styles.skeletonHero} />
            <SkeletonBox style={styles.skeletonCTA} />
            <View style={styles.skeletonStatsRow}>
                <SkeletonBox style={styles.skeletonStatCard} />
                <SkeletonBox style={styles.skeletonStatCard} />
            </View>
        </View>
    );
};

// ============================================
// MAIN HOME SCREEN
// ============================================
export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { user } = useAuth();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const { newBids, orderUpdates } = useSocketContext();
    const toast = useToast();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [deliveryAddress, setDeliveryAddress] = useState(t('common.loading'));
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [loyalty, setLoyalty] = useState<{ points: number; tier: string } | null>(null);
    // Store full location for NewRequest submission
    const [deliveryLocationData, setDeliveryLocationData] = useState<{
        lat: number | null;
        lng: number | null;
        address: string;
    }>({ lat: null, lng: null, address: '' });

    // Get localized greeting based on time of day
    const getGreeting = useCallback(() => {
        const hour = new Date().getHours();
        if (hour < 12) return t('greetings.morning');
        if (hour < 17) return t('greetings.afternoon');
        return t('greetings.evening');
    }, [t]);

    // GPS Fallback Detection (lightweight, with timeout)
    const detectLocationFallback = useCallback(async () => {
        try {
            setIsDetectingLocation(true);
            setDeliveryAddress(`📍 ${t('common.detecting')}...`);

            // Check permissions silently
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                // Permission denied - prompt manual entry
                setDeliveryAddress(t('home.selectAddress'));
                setDeliveryLocationData({ lat: null, lng: null, address: '' });
                return;
            }

            // Get position with 5-second timeout (Balanced accuracy for speed)
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS Timeout')), 5000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]);

            // Reverse geocode using Google Maps API for better results
            const GOOGLE_MAPS_API_KEY = 'AIzaSyBXRcKuHOW9r7TYNjVvNXZjYwx_6TLfxXo';
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

            try {
                const response = await fetch(geocodeUrl);
                const data = await response.json();

                if (data.status === 'OK' && data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const fullAddress = result.formatted_address;

                    // Smart display: Show first 3 parts (street, area, city) or full if short
                    const parts = fullAddress.split(',').map((p: string) => p.trim());
                    let displayAddress;
                    if (parts.length > 3) {
                        // Show: "Street, Area, City" (skip country)
                        displayAddress = parts.slice(0, 3).join(', ');
                    } else {
                        displayAddress = fullAddress;
                    }

                    setDeliveryAddress(displayAddress);
                    setDeliveryLocationData({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        address: fullAddress,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    // Geocoding failed but we have coordinates
                    setDeliveryAddress(t('home.currentLocation'));
                    setDeliveryLocationData({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        address: t('home.currentLocation'),
                    });
                }
            } catch (geocodeError) {
                console.log('[GPS Fallback] Google geocoding failed:', geocodeError);
                // Fallback to showing current location
                setDeliveryAddress(t('home.currentLocation'));
                setDeliveryLocationData({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    address: t('home.currentLocation'),
                });
            }
        } catch (error) {
            console.log('[GPS Fallback] Detection failed:', error);
            // Graceful fallback - prompt user to set manually
            setDeliveryAddress(t('home.selectAddress'));
            setDeliveryLocationData({ lat: null, lng: null, address: '' });
        } finally {
            setIsDetectingLocation(false);
        }
    }, [t]);


    const loadData = useCallback(async () => {
        try {
            const [statsData, notifData, loyaltyData, addressesData] = await Promise.all([
                api.getStats(),
                api.request('/notifications/unread-count').catch(() => ({ count: 0 })),
                api.request('/loyalty/summary').catch(() => ({ points: 0, tier: 'Bronze' })),
                api.getAddresses().catch(() => ({ addresses: [] }))
            ]);
            setStats(statsData.stats);
            setUnreadNotifications((notifData as any).count || 0);
            setLoyalty(loyaltyData as any);

            // WATERFALL PATTERN: Saved addresses first, GPS fallback if none
            if (addressesData.addresses && addressesData.addresses.length > 0) {
                // Priority 1: Use saved default address (instant)
                const defaultAddr = addressesData.addresses.find((a: any) => a.is_default) || addressesData.addresses[0];
                const displayText = defaultAddr.address_text;
                // Format concise for display
                const parts = displayText.split(',').map((p: string) => p.trim());
                const concise = parts.length >= 2 ? `${parts[parts.length - 2]}, ${parts[parts.length - 1]}` : displayText;
                setDeliveryAddress(concise);
                setDeliveryLocationData({
                    lat: defaultAddr.latitude || 0,
                    lng: defaultAddr.longitude || 0,
                    address: displayText
                });
            } else {
                // Priority 2: Auto-detect GPS location (non-blocking fallback)
                detectLocationFallback();
            }
        } catch (error) {
            console.log('Failed to load data:', error);
            toast.error('Error', 'Failed to load data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useFocusEffect(useCallback(() => {
        setLoading(true); // Ensure loading state is true on focus
        loadData();
    }, [loadData]));

    useEffect(() => {
        if (newBids.length > 0 || orderUpdates.length > 0) {
            loadData();
        }
    }, [newBids, orderUpdates, loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadData();
    }, [loadData]);

    const handleNewRequest = () => {
        // Block if no address
        if (!deliveryLocationData.lat || !deliveryLocationData.lng) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                t('home.alertAddressTitle'),
                t('home.alertAddressMessage'),
                [
                    {
                        text: t('home.addAddress'),
                        onPress: () => setShowLocationPicker(true),
                        style: 'default'
                    },
                    {
                        text: t('common.cancel'),
                        style: 'cancel'
                    }
                ]
            );
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('NewRequest', {
            deliveryLocation: {
                lat: deliveryLocationData.lat,
                lng: deliveryLocationData.lng,
                address: deliveryLocationData.address,
            }
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <SkeletonLoading />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Hero Welcome with Integrated Loyalty */}
                <HeroWelcome
                    user={user}
                    colors={colors}
                    unreadCount={unreadNotifications}
                    onNotificationPress={() => navigation.navigate('Notifications')}
                    onLocationPress={() => setShowLocationPicker(true)}
                    deliveryAddress={deliveryAddress}
                    loyalty={loyalty}
                    onLoyaltyPress={() => navigation.navigate('Rewards')}
                    greeting={getGreeting()}
                    customerLabel={t('common.customer')}
                />

                {/* Signature CTA */}
                <SignatureCTA onPress={handleNewRequest} />

                {/* Featured Products */}
                <FeaturedProductsSection
                    onProductPress={(product) => {
                        console.log('Product pressed:', product.title);
                    }}
                />

                {/* Animated Stats */}
                <AnimatedStats
                    stats={stats}
                    onRequestsPress={() => navigation.navigate('Requests')}
                    onOrdersPress={() => navigation.navigate('Orders')}
                />

                {/* Quick Actions */}
                <QuickActions navigation={navigation} />

                {/* How It Works Carousel */}
                <View style={{ marginTop: Spacing.xl, marginBottom: Spacing.lg }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, textAlign: rtlTextAlign(isRTL) }]}>{t('home.howItWorks')}</Text>
                    <HowItWorksCarousel onGetStarted={handleNewRequest} autoPlay={true} />
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>


            {/* Location Picker Modal - Premium Integration */}
            {showLocationPicker && (
                <DeliveryLocationWidget
                    onLocationChange={(address) => {
                        if (address) {
                            // Show full geocoded address (or smart truncation if too long)
                            const fullAddress = address.address_text;
                            const parts = fullAddress.split(',').map(p => p.trim());

                            // Smart display: Show first 3 parts (street, area, city) or full if short
                            let displayAddress;
                            if (parts.length > 3) {
                                // Show: "Street, Area, City" (skip country)
                                displayAddress = parts.slice(0, 3).join(', ');
                            } else {
                                displayAddress = fullAddress;
                            }

                            setDeliveryAddress(displayAddress);
                            // Store full coordinates for driver navigation
                            setDeliveryLocationData({
                                lat: address.latitude || null,
                                lng: address.longitude || null,
                                address: address.address_text,
                            });
                        }
                        setShowLocationPicker(false);
                    }}
                />
            )}
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },

    // Hero Section - SLIM VERSION
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
    // Hero Loyalty Badge - Compact VIP Status
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
    heroLoyaltyEmoji: {
        fontSize: 14,
    },
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
    // Premium Location Section (Integrated in Hero)
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
    locationIcon: {
        fontSize: 18,
    },
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
    heroSubtitle: {
        marginTop: Spacing.sm,
        width: 40,
        alignSelf: 'center',
    },

    // CTA Card - COMPACT 2026
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
    ctaTextContainer: { flex: 1 },
    ctaTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
        textAlign: 'center',
    },
    ctaSubtitle: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.85)',
    },
    ctaIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    ctaIcon: { fontSize: 24, color: '#fff', fontWeight: '300' },
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
    // 3-Tier Supplier Badges
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
    badgeIcon: {
        fontSize: 12,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },

    // Stats Section - COMPACT 2026
    statsSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    sectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    statCardWrapper: { width: cardWidth },
    statCardInner: {
        padding: Spacing.xs,
        alignItems: 'center',
        minHeight: 72,
        justifyContent: 'center',
        borderRadius: BorderRadius.md,
    },
    statEmoji: { fontSize: 20, marginBottom: 2 },
    statValue: { fontSize: 24, fontWeight: '700' },
    statLabel: { fontSize: FontSizes.xs, marginTop: 1 },
    statCardWide: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    statCardWideInner: {
        padding: Spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wideCardLeft: { flexDirection: 'row', alignItems: 'center' },
    wideCardEmoji: { fontSize: 28, marginRight: Spacing.sm },
    wideCardLabel: { fontSize: FontSizes.xs },
    wideCardBadge: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
    },
    wideCardBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },

    // Quick Actions - COMPACT 2026
    actionsSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    actionCard: {
        width: cardWidth,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    actionIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    actionEmoji: { fontSize: 22 },
    actionLabel: { fontSize: FontSizes.xs, fontWeight: '600' },

    // Pro Tip - COMPACT 2026
    proTipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        marginHorizontal: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.secondary + '50',
    },
    proTipIconWrapper: {
        marginRight: Spacing.sm,
    },
    proTipIcon: { fontSize: 22 },
    proTipContent: { flex: 1 },
    proTipTitle: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.secondary, marginBottom: 1 },
    proTipText: { fontSize: 11, lineHeight: 14 },

    // Skeleton
    skeletonContainer: { padding: Spacing.lg },
    skeletonBox: { backgroundColor: '#E8E8E8', borderRadius: BorderRadius.xl, overflow: 'hidden' },
    skeletonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' },
    skeletonHero: { height: 140, marginBottom: Spacing.lg, borderRadius: 0, borderBottomLeftRadius: BorderRadius.xl * 1.5, borderBottomRightRadius: BorderRadius.xl * 1.5 },
    skeletonCTA: { height: 120, marginBottom: Spacing.lg },
    skeletonStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    skeletonStatCard: { width: cardWidth, height: 130 },
});
