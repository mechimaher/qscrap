// QScrap Home Screen - Premium VIP Dashboard
import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { LoadingStats } from '../../components/SkeletonLoading';
import { useSocketContext } from '../../hooks/useSocket';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 3) / 2;

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { user } = useAuth();
    const { colors, isDarkMode } = useTheme();
    const { newBids, orderUpdates } = useSocketContext();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            const data = await api.getStats();
            setStats(data.stats);
        } catch (error) {
            console.log('Failed to load stats:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Auto-refresh stats when screen gains focus (e.g., after creating request)
    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    // Real-time: Reload stats when socket receives new bids or order updates
    useEffect(() => {
        if (newBids.length > 0 || orderUpdates.length > 0) {
            console.log('[HomeScreen] Socket event received, refreshing stats...');
            loadStats();
        }
    }, [newBids, orderUpdates, loadStats]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadStats();
    }, []);

    const handleNewRequest = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('NewRequest');
    };

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
                {/* Premium Header with Logo */}
                <View style={styles.header}>
                    <View style={styles.headerLogoContainer}>
                        <Image
                            source={require('../../../assets/logo.png')}
                            style={styles.headerLogo}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={styles.headerLeft}>
                        <Text style={[styles.greetingSmall, { color: colors.textSecondary }]}>{getTimeEmoji()} {greeting()}</Text>
                        <Text style={[styles.userName, { color: colors.text }]}>{user?.full_name || 'Customer'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.notificationBtn, { backgroundColor: colors.surface }]}
                        onPress={() => navigation.navigate('Notifications' as any)}
                    >
                        <Text style={styles.notificationIcon}>🔔</Text>
                        <View style={styles.notificationBadge} />
                    </TouchableOpacity>
                </View>

                {/* Premium CTA Card */}
                <TouchableOpacity
                    style={styles.ctaCard}
                    onPress={handleNewRequest}
                    activeOpacity={0.95}
                >
                    <LinearGradient
                        colors={[Colors.primary, '#B31D4A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaGradient}
                    >
                        <View style={styles.ctaContent}>
                            <View style={styles.ctaTextContainer}>
                                <Text style={styles.ctaTitle}>Find Your Part</Text>
                                <Text style={styles.ctaSubtitle}>Get quotes from verified garages in Qatar</Text>
                            </View>
                            <View style={styles.ctaIconContainer}>
                                <Text style={styles.ctaIcon}>+</Text>
                            </View>
                        </View>
                        <View style={styles.ctaFooter}>
                            <Text style={styles.ctaFooterText}>🚀 Average response time: 2 hours</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Stats Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>📊 Your Activity</Text>
                </View>

                {isLoading ? (
                    <LoadingStats />
                ) : (
                    <View style={styles.statsContainer}>
                        {/* Row 1: Two cards */}
                        <View style={styles.statsRow}>
                            <TouchableOpacity
                                style={styles.statCard}
                                onPress={() => navigation.navigate('Main', { screen: 'Requests' } as any)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#FFF9E6', '#FFF3CC']}
                                    style={styles.statCardInner}
                                >
                                    <View style={styles.statIconContainer}>
                                        <Text style={styles.statEmoji}>🔍</Text>
                                    </View>
                                    <Text style={styles.statValue}>{stats?.active_requests || 0}</Text>
                                    <Text style={styles.statLabel}>Active Requests</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.statCard}
                                onPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#E6F7FF', '#CCF0FF']}
                                    style={styles.statCardInner}
                                >
                                    <View style={styles.statIconContainer}>
                                        <Text style={styles.statEmoji}>🚚</Text>
                                    </View>
                                    <Text style={styles.statValue}>{stats?.pending_deliveries || 0}</Text>
                                    <Text style={styles.statLabel}>In Progress</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Row 2: Full width card */}
                        <TouchableOpacity
                            style={styles.statCardWide}
                            onPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#8A153815', '#8A153825']}
                                style={styles.statCardWideInner}
                            >
                                <View style={styles.wideCardLeft}>
                                    <Text style={styles.wideCardEmoji}>📦</Text>
                                    <View>
                                        <Text style={styles.wideCardValue}>{stats?.total_orders || 0}</Text>
                                        <Text style={styles.wideCardLabel}>Total Orders Completed</Text>
                                    </View>
                                </View>
                                <View style={styles.wideCardBadge}>
                                    <Text style={styles.wideCardBadgeText}>View All →</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Requests' } as any)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#FFF3E0' }]}>
                            <Text style={styles.actionEmoji}>📋</Text>
                        </View>
                        <Text style={styles.actionLabel}>Requests</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#E3F2FD' }]}>
                            <Text style={styles.actionEmoji}>📦</Text>
                        </View>
                        <Text style={styles.actionLabel}>Orders</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => Linking.openURL('https://wa.me/97412345678?text=Hi%20QScrap%20Support')}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#E8F5E9' }]}>
                            <Text style={styles.actionEmoji}>💬</Text>
                        </View>
                        <Text style={styles.actionLabel}>Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Profile' } as any)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: '#F3E5F5' }]}>
                            <Text style={styles.actionEmoji}>⚙️</Text>
                        </View>
                        <Text style={styles.actionLabel}>Settings</Text>
                    </TouchableOpacity>
                </View>

                {/* Pro Tip Card */}
                <View style={styles.proTipCard}>
                    <Text style={styles.proTipIcon}>💡</Text>
                    <View style={styles.proTipContent}>
                        <Text style={styles.proTipTitle}>Pro Tip</Text>
                        <Text style={styles.proTipText}>Add your VIN number for faster & more accurate quotes</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    scrollView: {
        flex: 1,
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    headerLogoContainer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        overflow: 'hidden',
        marginRight: Spacing.md,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    headerLogo: {
        width: 42,
        height: 42,
        borderRadius: 12,
    },
    greetingSmall: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginBottom: 4,
    },
    userName: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.dark.text,
        letterSpacing: -0.5,
    },
    notificationBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    notificationIcon: {
        fontSize: 22,
    },
    notificationBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
        borderWidth: 2,
        borderColor: '#fff',
    },
    // CTA Card
    ctaCard: {
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        ...Shadows.lg,
    },
    ctaGradient: {
        padding: Spacing.lg,
    },
    ctaContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ctaTextContainer: {
        flex: 1,
    },
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
    },
    ctaIcon: {
        fontSize: 32,
        color: '#fff',
        fontWeight: '300',
    },
    ctaFooter: {
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    ctaFooterText: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.9)',
    },
    // Section Header
    sectionHeader: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    // Stats
    statsContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    statCard: {
        width: cardWidth,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    statCardInner: {
        padding: Spacing.md,
        alignItems: 'center',
        minHeight: 120,
        justifyContent: 'center',
    },
    statIconContainer: {
        marginBottom: Spacing.sm,
    },
    statEmoji: {
        fontSize: 28,
    },
    statValue: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.dark.text,
    },
    statLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    statCardWide: {
        width: '100%',
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
    wideCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    wideCardEmoji: {
        fontSize: 36,
        marginRight: Spacing.md,
    },
    wideCardValue: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.primary,
    },
    wideCardLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    wideCardBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    wideCardBadgeText: {
        fontSize: FontSizes.xs,
        color: Colors.primary,
        fontWeight: '600',
    },
    // Actions Grid
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
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
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    actionEmoji: {
        fontSize: 24,
    },
    actionLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    // Pro Tip
    proTipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        marginHorizontal: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    proTipIcon: {
        fontSize: 24,
        marginRight: Spacing.md,
    },
    proTipContent: {
        flex: 1,
    },
    proTipTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#F57C00',
        marginBottom: 2,
    },
    proTipText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
});
