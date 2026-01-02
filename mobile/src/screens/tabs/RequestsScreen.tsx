// QScrap Requests Screen - Premium VIP Design with Active Card Highlights
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { api, Request } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { LoadingList } from '../../components/SkeletonLoading';

type RequestsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// Premium Active Card Component with Pulsing Glow
const ActiveRequestCard = ({
    item,
    colors,
    onPress,
    onDelete
}: {
    item: Request;
    colors: any;
    onPress: () => void;
    onDelete: (closeSwipeable: () => void) => void;
}) => {
    const glowAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    let swipeableRef: Swipeable | null = null;

    useEffect(() => {
        // Pulsing glow animation for active cards
        if (item.status === 'active') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: false,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: false,
                    }),
                ])
            ).start();
        }
    }, [item.status]);

    const closeSwipeable = () => {
        if (swipeableRef) swipeableRef.close();
    };

    // Calculate time remaining
    const getTimeRemaining = () => {
        if (!item.expires_at) return null;
        const now = new Date();
        const expires = new Date(item.expires_at);
        const diff = expires.getTime() - now.getTime();

        if (diff <= 0) return { text: 'Expired', urgency: 'expired' };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        let urgency = 'normal';
        if (hours <= 6) urgency = 'critical';
        else if (hours <= 24) urgency = 'warning';

        if (days > 0) {
            return { text: `${days}d ${remainingHours}h left`, urgency };
        }
        return { text: `${hours}h left`, urgency };
    };

    const timeRemaining = item.status === 'active' ? getTimeRemaining() : null;
    const isActive = item.status === 'active';
    const hasNewBids = item.bid_count > 0 && item.status === 'active';

    // Animated glow color
    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(34, 197, 94, 0.0)', 'rgba(34, 197, 94, 0.25)'],
    });

    const borderColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0.8)'],
    });

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return { color: '#22C55E', bg: '#DCFCE7', icon: '🟢', label: 'Active' };
            case 'accepted': return { color: '#3B82F6', bg: '#DBEAFE', icon: '✓', label: 'Accepted' };
            case 'expired': return { color: '#9CA3AF', bg: '#F3F4F6', icon: '⏰', label: 'Expired' };
            case 'cancelled': return { color: '#EF4444', bg: '#FEE2E2', icon: '✕', label: 'Cancelled' };
            default: return { color: '#6B7280', bg: '#F3F4F6', icon: '•', label: status };
        }
    };

    const statusConfig = getStatusConfig(item.status);

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'critical': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#22C55E';
        }
    };

    const renderRightActions = () => {
        if (item.status === 'accepted') return null;
        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => onDelete(closeSwipeable)}
            >
                <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.deleteGradient}
                >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                    <Text style={styles.deleteText}>Delete</Text>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable
            ref={(ref) => { swipeableRef = ref; }}
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={2}
            rightThreshold={40}
            onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                onPressIn={() => {
                    Animated.spring(scaleAnim, {
                        toValue: 0.98,
                        useNativeDriver: true,
                    }).start();
                }}
                onPressOut={() => {
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        useNativeDriver: true,
                    }).start();
                }}
            >
                <Animated.View
                    style={[
                        styles.cardWrapper,
                        { transform: [{ scale: scaleAnim }] },
                        isActive && {
                            shadowColor: '#22C55E',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            elevation: 8,
                        },
                    ]}
                >
                    {/* Animated glow background for active cards */}
                    {isActive && (
                        <Animated.View
                            style={[
                                styles.glowBackground,
                                { backgroundColor: glowColor },
                            ]}
                        />
                    )}

                    <Animated.View
                        style={[
                            styles.requestCard,
                            { backgroundColor: colors.surface },
                            isActive && {
                                borderWidth: 2,
                                borderColor: borderColor as any,
                            },
                        ]}
                    >
                        {/* Green accent bar for active */}
                        {isActive && (
                            <LinearGradient
                                colors={['#22C55E', '#16A34A', '#22C55E']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.accentBar}
                            />
                        )}

                        {/* Accepted accent bar */}
                        {item.status === 'accepted' && (
                            <View style={[styles.accentBar, { backgroundColor: '#3B82F6' }]} />
                        )}

                        <View style={styles.cardContent}>
                            {/* Header with Status */}
                            <View style={styles.cardHeader}>
                                <View style={styles.carInfo}>
                                    <Text style={styles.carEmoji}>🚗</Text>
                                    <View>
                                        <Text style={[styles.carName, { color: colors.text }]}>
                                            {item.car_make} {item.car_model}
                                        </Text>
                                        <Text style={[styles.carYear, { color: colors.textSecondary }]}>
                                            {item.car_year}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                        {statusConfig.icon} {statusConfig.label}
                                    </Text>
                                </View>
                            </View>

                            {/* Part Description */}
                            <Text
                                style={[styles.partDescription, { color: colors.textSecondary }]}
                                numberOfLines={2}
                            >
                                {item.part_description}
                            </Text>

                            {/* Active Card: Time Remaining & New Bids */}
                            {isActive && (
                                <View style={styles.activeIndicators}>
                                    {/* Countdown Timer */}
                                    {timeRemaining && (
                                        <View style={[
                                            styles.timerBadge,
                                            { backgroundColor: getUrgencyColor(timeRemaining.urgency) + '15' }
                                        ]}>
                                            <Text style={styles.timerIcon}>⏱</Text>
                                            <Text style={[
                                                styles.timerText,
                                                { color: getUrgencyColor(timeRemaining.urgency) }
                                            ]}>
                                                {timeRemaining.text}
                                            </Text>
                                        </View>
                                    )}

                                    {/* New Bids Badge */}
                                    {hasNewBids && (
                                        <View style={styles.newBidsBadge}>
                                            <Text style={styles.fireIcon}>🔥</Text>
                                            <Text style={styles.newBidsText}>
                                                {item.bid_count} {item.bid_count === 1 ? 'bid' : 'bids'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                            {/* Footer with Best Bid & Date */}
                            <View style={styles.cardFooter}>
                                <View style={styles.bidInfo}>
                                    {item.lowest_bid_price ? (
                                        <View style={styles.bestBid}>
                                            <Text style={styles.bestBidLabel}>Best offer</Text>
                                            <Text style={styles.bestBidPrice}>
                                                QAR {item.lowest_bid_price.toLocaleString()}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.bidCount}>
                                            <View style={styles.bidIconBg}>
                                                <Text style={styles.bidIcon}>💬</Text>
                                            </View>
                                            <Text style={styles.bidCountText}>
                                                {item.bid_count} bids received
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.dateText}>
                                    {new Date(item.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                </Animated.View>
            </TouchableOpacity>
        </Swipeable>
    );
};

export default function RequestsScreen() {
    const navigation = useNavigation<RequestsScreenNavigationProp>();
    const { colors } = useTheme();
    const [requests, setRequests] = useState<Request[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadRequests = useCallback(async () => {
        try {
            const data = await api.getMyRequests();
            setRequests(data.requests || []);
        } catch (error) {
            console.log('Failed to load requests:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadRequests();
        }, [loadRequests])
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadRequests();
    }, []);

    const handleDeleteRequest = async (request: Request, closeSwipeable: () => void) => {
        if (request.status === 'accepted') {
            Alert.alert('Cannot Delete', 'This request has been accepted and cannot be deleted.');
            closeSwipeable();
            return;
        }

        Alert.alert(
            'Delete Request',
            `Delete request for ${request.car_make} ${request.car_model}?\n\nThis will remove all bids and cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel', onPress: closeSwipeable },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            await api.deleteRequest(request.request_id);
                            setRequests(prev => prev.filter(r => r.request_id !== request.request_id));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete request');
                        }
                    },
                },
            ]
        );
    };

    const renderRequest = ({ item }: { item: Request }) => (
        <ActiveRequestCard
            item={item}
            colors={colors}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('RequestDetail', { requestId: item.request_id });
            }}
            onDelete={(close) => handleDeleteRequest(item, close)}
        />
    );

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>No Requests Yet</Text>
            <Text style={styles.emptyText}>
                Create your first part request and get quotes from verified garages
            </Text>
            <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('NewRequest')}
            >
                <LinearGradient
                    colors={[Colors.primary, '#B31D4A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyButtonGradient}
                >
                    <Text style={styles.emptyButtonText}>+ Create Request</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    // Count active requests for header
    const activeCount = requests.filter(r => r.status === 'active').length;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Premium Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>My Requests</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {activeCount > 0 ? `${activeCount} active` : ''}
                        {activeCount > 0 && requests.length > activeCount ? ' • ' : ''}
                        {requests.length} total
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('NewRequest')}
                >
                    <LinearGradient
                        colors={[Colors.primary, '#B31D4A']}
                        style={styles.addButtonGradient}
                    >
                        <Text style={styles.addButtonText}>+</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <LoadingList count={4} />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item) => item.request_id}
                    renderItem={renderRequest}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={EmptyState}
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={7}
                    removeClippedSubviews={true}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.dark.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    addButton: {
        borderRadius: 24,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    addButtonGradient: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: 28,
        color: '#fff',
        fontWeight: '300',
    },
    loadingContainer: {
        padding: Spacing.lg,
    },
    listContent: {
        padding: Spacing.lg,
    },
    // Card Wrapper with glow support
    cardWrapper: {
        marginBottom: Spacing.md,
        borderRadius: BorderRadius.xl,
        overflow: 'visible',
    },
    glowBackground: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: BorderRadius.xl + 4,
    },
    requestCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        flexDirection: 'row',
        ...Shadows.sm,
    },
    accentBar: {
        width: 5,
        backgroundColor: '#22C55E',
    },
    cardContent: {
        flex: 1,
        padding: Spacing.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    carInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    carEmoji: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    carName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    carYear: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    partDescription: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.sm,
    },
    // Active indicators row
    activeIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    timerIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    timerText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
    },
    newBidsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    fireIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    newBidsText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#D97706',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: Spacing.sm,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bidInfo: {
        flex: 1,
    },
    bestBid: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    bestBidLabel: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
    },
    bestBidPrice: {
        fontSize: FontSizes.md,
        fontWeight: '800',
        color: '#22C55E',
    },
    bidCount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bidIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    bidIcon: {
        fontSize: 14,
    },
    bidCountText: {
        fontSize: FontSizes.sm,
        color: Colors.primary,
        fontWeight: '600',
    },
    dateText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textMuted,
    },
    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl * 2,
        paddingHorizontal: Spacing.xl,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyIcon: {
        fontSize: 48,
    },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    emptyButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    emptyButtonGradient: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    // Delete action
    deleteAction: {
        marginLeft: -Spacing.md,
        marginVertical: Spacing.xs,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    deleteGradient: {
        width: 80,
        height: '90%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
    },
    deleteIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    deleteText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
});

