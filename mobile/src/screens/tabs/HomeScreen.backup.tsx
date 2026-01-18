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
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, Colors as ThemeColors } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { useSocketContext } from '../../hooks/useSocket';
import { useToast } from '../../components/Toast';
import FeaturedProductsSection from '../../components/FeaturedProductsSection';
import QuickServicesBanner from '../../components/QuickServicesBanner';

import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from '../../config/api';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 3) / 2;

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
    onNotificationPress
}: {
    user: any;
    colors: any;
    onNotificationPress: () => void;
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getTimeEmoji = () => {
        const hour = new Date().getHours();
        if (hour < 6) return '🌙';
        if (hour < 12) return '☀️';
        if (hour < 17) return '🌤️';
        if (hour < 20) return '🌅';
        return '🌙';
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse for notification badge
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
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
                <View style={styles.heroContent}>
                    <View style={styles.heroLeft}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="cover"
                            />
                        </View>
                        <View style={styles.heroTextContainer}>
                            <Text style={styles.heroGreeting}>
                                {getTimeEmoji()} {greeting()}
                            </Text>
                            <Text style={styles.heroName}>
                                {user?.full_name || 'Customer'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.notificationBtn}
                        onPress={onNotificationPress}
                    >
                        <Text style={styles.notificationIcon}>🔔</Text>
                        <Animated.View style={[
                            styles.notificationBadge,
                            { transform: [{ scale: badgeScale }], backgroundColor: colors.secondary, borderColor: colors.primary }
                        ]} />
                    </TouchableOpacity>
                </View>

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
    const { colors } = useTheme();

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

        // Subtle glow pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ])
        ).start();
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
                        colors={ThemeColors.gradients.primaryDark}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaGradient}
                    >
                        <View style={styles.ctaContent}>
                            <View style={styles.ctaTextContainer}>
                                <Text style={styles.ctaTitle}>Find Your Part</Text>
                                <Text style={styles.ctaSubtitle}>
                                    Get quotes from verified garages in Qatar
                                </Text>
                            </View>
                            <View style={styles.ctaIconContainer}>
                                <Text style={styles.ctaIcon}>+</Text>
                            </View>
                        </View>

                        <View style={styles.ctaFooter}>
                            <View style={styles.ctaFooterDot} />
                            <Text style={styles.ctaFooterText}>
                                Average response time: 2 hours
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Your Activity</Text>
            <View style={styles.statsRow}>
                <StatCard
                    index={0}
                    emoji="🔍"
                    value={stats?.active_requests || 0}
                    label="Active Requests"
                    colors={['#FFF9E6', '#FFF3CC']}
                    onPress={onRequestsPress}
                />
                <StatCard
                    index={1}
                    emoji="🚚"
                    value={stats?.pending_deliveries || 0}
                    label="In Progress"
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
                        style={styles.statCardWideInner}
                    >
                        <View style={styles.wideCardLeft}>
                            <Text style={styles.wideCardEmoji}>📦</Text>
                            <View>
                                <AnimatedNumber value={stats?.total_orders || 0} delay={700} />
                                <Text style={[styles.wideCardLabel, { color: colors.textSecondary }]}>Total Orders Completed</Text>
                            </View>
                        </View>
                        <View style={[styles.wideCardBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.wideCardBadgeText, { color: colors.primary }]}>View All →</Text>
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
                    <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{label}</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Animated.View style={[
            styles.actionsSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>⚡ Quick Actions</Text>
            <View style={styles.actionsGrid}>
                <ActionButton
                    emoji="📋"
                    label="My Requests"
                    bgColor="#FFF3E0"
                    onPress={() => navigation.navigate('Main', { screen: 'Requests' })}
                />
                <ActionButton
                    emoji="📦"
                    label="My Orders"
                    bgColor="#E3F2FD"
                    onPress={() => navigation.navigate('Main', { screen: 'Orders' })}
                />
                <ActionButton
                    emoji="💬"
                    label="Support"
                    bgColor="#E8F5E9"
                    onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=Hi%20QScrap%20Support`)}
                />
            </View>
        </Animated.View>
    );
};

// ============================================
// PRO TIP CARD
// ============================================
const ProTipCard = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: 900,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.proTipCard, { opacity: fadeAnim, backgroundColor: colors.surface }]}>
            <Text style={styles.proTipIcon}>💡</Text>
            <View style={styles.proTipContent}>
                <Text style={[styles.proTipTitle, { color: colors.text }]}>Pro Tip</Text>
                <Text style={[styles.proTipText, { color: colors.textSecondary }]}>
                    Add your VIN number for faster & more accurate quotes
                </Text>
            </View>
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
// UNIFIED ACTIVITY FEED (Quick Services + Spare Parts)
// ============================================
const ActivityFeed = ({
    activities,
    onPressQuickService,
    onPressOrder,
    onLoadMore,
    isLoadingMore
}: {
    activities: any[];
    onPressQuickService: (requestId: string) => void;
    onPressOrder: (orderId: string) => void;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}) => {
    const { colors } = useTheme();

    if (!activities || activities.length === 0) return null;

    const getStatusColor = (status: string, type: string) => {
        if (type === 'quick_service') {
            const colors: Record<string, string> = {
                pending: '#F59E0B', assigned: '#10B981', quoted: Colors.primary,
                accepted: '#3B82F6', en_route: '#8B5CF6', in_progress: '#EC4899',
                completed: '#059669', cancelled: '#EF4444'
            };
            return colors[status] || '#6B7280';
        } else {
            const colors: Record<string, string> = {
                pending: '#F59E0B', confirmed: '#3B82F6', processing: '#8B5CF6',
                ready: '#10B981', shipped: '#EC4899', delivered: '#059669',
                cancelled: '#EF4444'
            };
            return colors[status] || '#6B7280';
        }
    };

    const getIcon = (iconKey: string, type: string) => {
        if (type === 'quick_service') {
            const icons: Record<string, string> = {
                battery: '🔋', oil: '🛢️', wash: '🚿', tire: '🛞',
                ac: '❄️', breakdown: '🔧'
            };
            return icons[iconKey] || '⚙️';
        }
        return '📦';
    };

    return (
        <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Activity</Text>
                {isLoadingMore && (
                    <ActivityIndicator size="small" color={Colors.primary} />
                )}
            </View>
            {activities.slice(0, 5).map((item, index) => {
                const statusColor = getStatusColor(item.status, item.type);
                const icon = getIcon(item.icon_key, item.type);
                const onPress = item.type === 'quick_service'
                    ? () => onPressQuickService(item.id)
                    : () => onPressOrder(item.id);

                return (
                    <TouchableOpacity
                        key={`${item.type}_${item.id}`}
                        onPress={onPress}
                        style={[styles.quickServiceCard, { backgroundColor: colors.surface }]}
                    >
                        <Text style={{ fontSize: 28 }}>{icon}</Text>
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{
                                    backgroundColor: item.type === 'quick_service' ? `${Colors.primary}15` : '#F5901015',
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 4
                                }}>
                                    <Text style={{
                                        fontSize: 10,
                                        fontWeight: '600',
                                        color: item.type === 'quick_service' ? Colors.primary : '#F59010'
                                    }}>
                                        {item.type === 'quick_service' ? '⚡ Quick' : '📦 Order'}
                                    </Text>
                                </View>
                                <View style={{
                                    backgroundColor: `${statusColor}15`,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: statusColor }}>
                                        {item.status.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[{ fontWeight: '600', fontSize: FontSizes.md, marginTop: 4 }, { color: colors.text }]}>
                                {item.title}
                            </Text>
                            <Text style={{ fontSize: FontSizes.sm, color: colors.textMuted, marginTop: 2 }}>
                                {item.subtitle}
                            </Text>
                        </View>
                        {item.price > 0 && (
                            <Text style={{ fontWeight: '700', fontSize: FontSizes.lg, color: Colors.primary }}>
                                {item.price} QAR
                            </Text>
                        )}
                        <Text style={{ fontSize: 18, color: colors.textMuted, marginLeft: Spacing.sm }}>→</Text>
                    </TouchableOpacity>
                );
            })}
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
    const { newBids, orderUpdates } = useSocketContext();
    const toast = useToast();
    const [stats, setStats] = useState<Stats | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const loadData = useCallback(async (reset = true) => {
        try {
            const ITEMS_PER_PAGE = 10;
            const currentPage = reset ? 0 : page;

            // Load stats and unified activity in parallel
            const [statsData, activityData] = await Promise.all([
                api.getStats(),
                api.getCustomerActivity(ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
            ]);

            setStats(statsData.stats);

            if (reset) {
                setActivities(activityData.activities || []);
                setPage(0);
            } else {
                setActivities(prev => [...prev, ...(activityData.activities || [])]);
            }

            // Check if there are more items
            setHasMore((activityData.activities || []).length === ITEMS_PER_PAGE);
        } catch (error) {
            console.log('Failed to load data:', error);
            toast.error('Error', 'Failed to load data');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, [page]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    useEffect(() => {
        if (newBids.length > 0 || orderUpdates.length > 0) {
            loadData();
        }
    }, [newBids, orderUpdates, loadData]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadData(true);
    }, [loadData]);

    const loadMore = useCallback(() => {
        if (!isLoadingMore && hasMore && !isLoading) {
            setIsLoadingMore(true);
            setPage(prev => prev + 1);
            loadData(false);
        }
    }, [isLoadingMore, hasMore, isLoading, loadData]);

    const handleNewRequest = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('NewRequest');
    };

    if (isLoading) {
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
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Hero Welcome */}
                <HeroWelcome
                    user={user}
                    colors={colors}
                    onNotificationPress={() => navigation.navigate('Notifications' as any)}
                />

                {/* Signature CTA */}
                <SignatureCTA onPress={handleNewRequest} />

                {/* Quick Services Banner */}
                <QuickServicesBanner
                    onServicePress={(serviceId, serviceName, icon, priceRange, duration) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        (navigation as any).navigate('QuickServiceBooking', {
                            service: {
                                type: serviceId,
                                name: serviceName,
                                icon: icon,
                                priceRange: priceRange,
                                duration: duration,
                            }
                        });
                    }}
                    onViewAll={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.getParent()?.navigate('QuickServices');
                    }}
                />

                {/* Unified Activity Feed */}
                <ActivityFeed
                    activities={activities}
                    onPressQuickService={(requestId) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        (navigation as any).navigate('QuickServiceTracking', { requestId });
                    }}
                    onPressOrder={(orderId) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('OrderDetails', { orderId });
                    }}
                    onLoadMore={loadMore}
                    isLoadingMore={isLoadingMore}
                />

                {/* Featured Products */}
                <FeaturedProductsSection
                    onProductPress={(product) => {
                        console.log('Product pressed:', product.title);
                    }}
                />

                {/* Animated Stats */}
                <AnimatedStats
                    stats={stats}
                    onRequestsPress={() => navigation.navigate('Main', { screen: 'Requests' } as any)}
                    onOrdersPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                />

                {/* Quick Actions */}
                <QuickActions navigation={navigation} />

                {/* Pro Tip */}
                <ProTipCard />

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },

    // Hero Section
    heroSection: { marginBottom: Spacing.lg },
    heroGradient: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderBottomLeftRadius: BorderRadius.xl * 1.5,
        borderBottomRightRadius: BorderRadius.xl * 1.5,
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    logoContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: Spacing.md,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        ...Shadows.md,
    },
    logo: { width: 52, height: 52 },
    heroTextContainer: { flex: 1 },
    heroGreeting: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    heroName: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    notificationBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationIcon: { fontSize: 22 },
    notificationBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    goldAccent: {
        height: 3,
        borderRadius: 2,
        marginTop: Spacing.lg,
        width: 60,
        alignSelf: 'center',
    },

    // CTA Card
    ctaWrapper: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    ctaCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    ctaGlow: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: BorderRadius.xl + 20,
    },
    ctaGradient: { padding: Spacing.lg },
    ctaContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ctaTextContainer: { flex: 1 },
    ctaTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    ctaSubtitle: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    ctaIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    ctaIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
    ctaFooter: {
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    ctaFooterDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        marginRight: Spacing.sm,
    },
    ctaFooterText: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.9)' },

    // Stats Section
    statsSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        // color set dynamically via colors.text
        marginBottom: Spacing.md,
    },
    quickServiceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    statCardWrapper: { width: cardWidth },
    statCardInner: {
        padding: Spacing.md,
        alignItems: 'center',
        minHeight: 130,
        justifyContent: 'center',
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    statEmoji: { fontSize: 32, marginBottom: Spacing.sm },
    statValue: { fontSize: 36, fontWeight: '800' }, // color set dynamically
    statLabel: { fontSize: FontSizes.sm, marginTop: 4 }, // color set dynamically
    statCardWide: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: Colors.primary,
        ...Shadows.sm,
    },
    statCardWideInner: {
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wideCardLeft: { flexDirection: 'row', alignItems: 'center' },
    wideCardEmoji: { fontSize: 36, marginRight: Spacing.md },
    wideCardLabel: { fontSize: FontSizes.sm }, // color set dynamically
    wideCardBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    wideCardBadgeText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },

    // Quick Actions
    actionsSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    actionCard: {
        width: cardWidth,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    actionIconBg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    actionEmoji: { fontSize: 28 },
    actionLabel: { fontSize: FontSizes.sm, fontWeight: '600' }, // color set dynamically

    // Pro Tip
    proTipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        marginHorizontal: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.secondary,
    },
    proTipIcon: { fontSize: 24, marginRight: Spacing.md },
    proTipContent: { flex: 1 },
    proTipTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.secondary, marginBottom: 2 },
    proTipText: { fontSize: FontSizes.sm }, // color set dynamically

    // Skeleton
    skeletonContainer: { padding: Spacing.lg },
    skeletonBox: { backgroundColor: '#E8E8E8', borderRadius: BorderRadius.xl, overflow: 'hidden' },
    skeletonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' },
    skeletonHero: { height: 140, marginBottom: Spacing.lg, borderRadius: 0, borderBottomLeftRadius: BorderRadius.xl * 1.5, borderBottomRightRadius: BorderRadius.xl * 1.5 },
    skeletonCTA: { height: 120, marginBottom: Spacing.lg },
    skeletonStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    skeletonStatCard: { width: cardWidth, height: 130 },
});
