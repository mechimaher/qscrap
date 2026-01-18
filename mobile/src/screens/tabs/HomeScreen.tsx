// QScrap Home Screen - Smart Priority-Based Dashboard (2026)
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { Colors, Spacing } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { useSocketContext } from '../../hooks/useSocket';
import { useToast } from '../../components/Toast';

// Import new smart components
import UrgentActionCard from '../../components/UrgentActionCard';
import InsightsCard from '../../components/InsightsCard';
import LiveTrackingCard from '../../components/LiveTrackingCard';
import BidReviewCard from '../../components/BidReviewCard';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { user } = useAuth();
    const { colors } = useTheme();
    const { newBids, orderUpdates } = useSocketContext();
    const toast = useToast();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [urgentActions, setUrgentActions] = useState<any[]>([]);
    const [contextualData, setContextualData] = useState<any>(null);
    const [activeTracking, setActiveTracking] = useState<any[]>([]);
    const [unreadBids, setUnreadBids] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    // Load all data in parallel
    const loadData = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setIsLoading(true);

            const [urgentRes, contextualRes, activityRes] = await Promise.all([
                api.getUrgentActions().catch(() => ({ urgent_actions: [] })),
                api.getContextualData().catch(() => ({ contextual_data: {} })),
                api.getCustomerActivity(3, 0).catch(() => ({ activities: [] })),
            ]);

            setUrgentActions(urgentRes.urgent_actions || []);
            setContextualData(contextualRes.contextual_data || {});
            setRecentActivity(activityRes.activities || []);

            // TODO: Fetch active tracking and unread bids
            // For now, using empty arrays
            setActiveTracking([]);
            setUnreadBids([]);

        } catch (error) {
            console.error('[HomeScreen] Load data error:', error);
            toast.error('Error', 'Failed to load dashboard');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [toast]);

    // Load on mount and focus
    useFocusEffect(useCallback(() => {
        loadData();
    }, [loadData]));

    // Refresh on socket events
    useEffect(() => {
        if (newBids.length > 0 || orderUpdates.length > 0) {
            loadData(false);
        }
    }, [newBids, orderUpdates, loadData]);

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadData(false);
    }, [loadData]);

    // Get time-based greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return { text: 'Good Morning', emoji: '🌅' };
        if (hour < 17) return { text: 'Good Afternoon', emoji: '☀️' };
        return { text: 'Good Evening', emoji: '🌙' };
    };

    const greeting = getGreeting();
    const firstName = user?.name?.split(' ')[0] || 'there';

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Loading your dashboard...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section - Personalized Greeting */}
                <View style={styles.heroSection}>
                    <Text style={[styles.greeting, { color: colors.text }]}>
                        {greeting.emoji} {greeting.text}
                    </Text>
                    <Text style={[styles.userName, { color: Colors.primary }]}>
                        {firstName}
                    </Text>
                </View>

                {/* Section 1: Urgent Actions (Priority 1 & 2) */}
                {urgentActions.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                🔥 Needs Your Attention
                            </Text>
                            {urgentActions.length > 1 && (
                                <View style={styles.countBadge}>
                                    <Text style={styles.countText}>{urgentActions.length}</Text>
                                </View>
                            )}
                        </View>
                        {urgentActions.map((action, index) => (
                            <UrgentActionCard
                                key={`urgent-${action.type}-${index}`}
                                type={action.type}
                                data={action}
                                onPress={() => {
                                    // Navigate based on action type
                                    if (action.type === 'payment_pending') {
                                        navigation.navigate('OrderDetails', { orderId: action.order_id });
                                    } else if (action.type === 'delivery_confirmation') {
                                        navigation.navigate('OrderDetails', { orderId: action.order_id });
                                    } else if (action.type === 'bid_expiring') {
                                        navigation.navigate('RequestDetails', { requestId: action.request_id });
                                    } else if (action.type === 'technician_arriving') {
                                        navigation.navigate('QuickServiceTracking', { requestId: action.request_id });
                                    } else if (action.type === 'counter_offer_pending') {
                                        navigation.navigate('RequestDetails', { requestId: action.request_id });
                                    }
                                }}
                            />
                        ))}
                    </View>
                )}

                {/* Section 2: Active Tracking (Orders & Services) */}
                {activeTracking.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            📍 Active Tracking
                        </Text>
                        {activeTracking.map((item, index) => (
                            <LiveTrackingCard
                                key={`tracking-${item.type}-${item.id}-${index}`}
                                type={item.type}
                                data={item}
                                onPress={() => {
                                    if (item.type === 'quick_service') {
                                        navigation.navigate('QuickServiceTracking', { requestId: item.id });
                                    } else {
                                        navigation.navigate('OrderDetails', { orderId: item.id });
                                    }
                                }}
                            />
                        ))}
                    </View>
                )}

                {/* Section 3: Insights Card (Always show if data available) */}
                {contextualData && (
                    <InsightsCard
                        moneySaved={contextualData.money_saved_this_month || 0}
                        loyaltyPoints={contextualData.loyalty_points || 0}
                        ordersCompleted={contextualData.orders_this_month || 0}
                    />
                )}

                {/* Section 4: Unread Bids (Only if > 0) */}
                {unreadBids.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                💰 New Bids
                            </Text>
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{unreadBids.length}</Text>
                            </View>
                        </View>
                        {unreadBids.map((bid, index) => (
                            <BidReviewCard
                                key={`bid-${bid.bid_id}-${index}`}
                                bid={bid}
                                isLowestBid={index === 0} // Assuming sorted by price
                                onAccept={() => {
                                    // TODO: Accept bid logic
                                    toast.success('Success', 'Bid accepted!');
                                }}
                                onCounter={() => {
                                    // TODO: Counter offer logic
                                    navigation.navigate('CounterOffer', {
                                        bidId: bid.bid_id,
                                        garageName: bid.garage_name,
                                        currentAmount: bid.amount,
                                        partDescription: '',
                                    });
                                }}
                                onReject={() => {
                                    // TODO: Reject bid logic
                                    toast.success('Success', 'Bid rejected');
                                }}
                            />
                        ))}
                    </View>
                )}

                {/* Section 5: Quick Actions */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        ⚡ Quick Actions
                    </Text>
                    <View style={styles.quickActionsGrid}>
                        <QuickActionButton
                            icon="🔋"
                            label="Battery"
                            onPress={() => navigation.navigate('QuickServices')}
                        />
                        <QuickActionButton
                            icon="🛢️"
                            label="Oil Change"
                            onPress={() => navigation.navigate('QuickServices')}
                        />
                        <QuickActionButton
                            icon="🔧"
                            label="Workshop Repair"
                            onPress={() => navigation.navigate('RepairRequest')}
                        />
                        <QuickActionButton
                            icon="📦"
                            label="Find Parts"
                            onPress={() => navigation.navigate('NewRequest')}
                        />
                    </View>
                </View>

                {/* Section 6: Recent Activity (Compact, max 3) */}
                {recentActivity.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                📋 Recent Activity
                            </Text>
                        </View>
                        {recentActivity.map((item, index) => (
                            <View key={`activity-${item.id}-${index}`} style={styles.activityItem}>
                                <View style={styles.activityDot} />
                                <View style={styles.activityContent}>
                                    <Text style={[styles.activityTitle, { color: colors.text }]}>
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.activitySubtitle, { color: colors.textSecondary }]}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                            style={styles.viewAllButton}
                        >
                            <Text style={styles.viewAllText}>View All Activity →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Bottom Padding */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// Quick Action Button Component
const QuickActionButton = ({ icon, label, onPress }: any) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            style={[styles.quickActionButton, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
        >
            <Text style={styles.quickActionIcon}>{icon}</Text>
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: 16,
        fontWeight: '600',
    },
    heroSection: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    greeting: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    userName: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
        marginTop: 4,
    },
    section: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    countBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    quickActionButton: {
        width: '48%',
        aspectRatio: 1.5,
        borderRadius: 16,
        padding: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    quickActionIcon: {
        fontSize: 36,
        marginBottom: 8,
    },
    quickActionLabel: {
        fontSize: 14,
        fontWeight: '700',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    activityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        marginTop: 6,
        marginRight: Spacing.sm,
    },
    activityContent: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    activitySubtitle: {
        fontSize: 13,
        fontWeight: '500',
    },
    viewAllButton: {
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
    },
});

export default HomeScreen;
