// QScrap Requests Screen - Premium VIP Design
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { api, Request } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { LoadingList } from '../../components/SkeletonLoading';

type RequestsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

export default function RequestsScreen() {
    const navigation = useNavigation<RequestsScreenNavigationProp>();
    const { colors } = useTheme();
    const [requests, setRequests] = useState<Request[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadRequests = async () => {
        try {
            const data = await api.getMyRequests();
            setRequests(data.requests || []);
        } catch (error) {
            console.log('Failed to load requests:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadRequests();
    }, []);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return { color: '#22C55E', bg: '#DCFCE7', icon: '🟢', label: 'Active' };
            case 'accepted': return { color: '#3B82F6', bg: '#DBEAFE', icon: '✓', label: 'Accepted' };
            case 'expired': return { color: '#9CA3AF', bg: '#F3F4F6', icon: '⏰', label: 'Expired' };
            case 'cancelled': return { color: '#EF4444', bg: '#FEE2E2', icon: '✕', label: 'Cancelled' };
            default: return { color: '#6B7280', bg: '#F3F4F6', icon: '•', label: status };
        }
    };

    const renderRequest = ({ item }: { item: Request }) => {
        const statusConfig = getStatusConfig(item.status);

        return (
            <TouchableOpacity
                style={[styles.requestCard, { backgroundColor: colors.surface }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('RequestDetail', { requestId: item.request_id });
                }}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.carInfo}>
                        <Text style={styles.carEmoji}>🚗</Text>
                        <View>
                            <Text style={[styles.carName, { color: colors.text }]}>{item.car_make} {item.car_model}</Text>
                            <Text style={[styles.carYear, { color: colors.textSecondary }]}>{item.car_year}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.icon} {statusConfig.label}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.partDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.part_description}
                </Text>

                <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                <View style={styles.cardFooter}>
                    <View style={styles.bidCount}>
                        <View style={styles.bidIconBg}>
                            <Text style={styles.bidIcon}>💬</Text>
                        </View>
                        <Text style={styles.bidCountText}>{item.bid_count} bids received</Text>
                    </View>
                    <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>No Requests Yet</Text>
            <Text style={styles.emptyText}>Create your first part request and get quotes from verified garages</Text>
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Premium Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>My Requests</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{requests.length} total requests</Text>
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
    requestCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
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
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: Spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
});
