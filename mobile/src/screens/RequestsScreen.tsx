import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts';
import { requestApi, onNewBid } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import { SkeletonCard, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { useRefresh } from '../hooks';

interface Request {
    request_id: string;
    car_make: string;
    car_model: string;
    car_year: string;
    part_description: string;
    status: string;
    bid_count: number;
    created_at: string;
}

const RequestsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const loadRequests = useCallback(async () => {
        try {
            const response = await requestApi.getMyRequests();
            setRequests(response.data.requests || []);
        } catch (error) {
            console.error('Failed to load requests:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Use custom refresh hook with haptic feedback
    const { refreshing, onRefresh } = useRefresh({
        onRefresh: loadRequests,
        hapticFeedback: true,
    });

    useEffect(() => {
        loadRequests();
        // Listen for new bids
        const unsubscribe = onNewBid(() => loadRequests());
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [loadRequests]);

    const handleFilterChange = async (newFilter: string) => {
        await Haptics.selectionAsync();
        setFilter(newFilter);
    };

    const handleRequestPress = async (requestId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('RequestDetails', { requestId });
    };

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'primary' | 'muted' => {
        switch (status) {
            case 'active': return 'success';
            case 'expired': return 'muted';
            case 'accepted': return 'primary';
            case 'cancelled': return 'danger';
            default: return 'muted';
        }
    };

    const filteredRequests = requests.filter(r => {
        if (filter === 'all') return true;
        if (filter === 'active') return r.status === 'active';
        if (filter === 'with_bids') return r.bid_count > 0;
        if (filter === 'expired') return r.status === 'expired';
        return true;
    });

    const renderRequest = ({ item }: { item: Request }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }, Shadows.sm]}
            onPress={() => handleRequestPress(item.request_id)}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <Badge
                    label={item.status.toUpperCase()}
                    variant={getStatusVariant(item.status)}
                    size="small"
                />
                {item.bid_count > 0 && (
                    <Badge
                        label={`${item.bid_count} bids`}
                        variant="primary"
                        size="small"
                    />
                )}
            </View>

            <Text style={[styles.partName, { color: colors.text }]} numberOfLines={2}>
                {item.part_description}
            </Text>

            <View style={styles.vehicle}>
                <Ionicons name="car-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.vehicleText, { color: colors.textSecondary }]}>
                    {item.car_make} {item.car_model} {item.car_year}
                </Text>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.date, { color: colors.textMuted }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
        </TouchableOpacity>
    );

    const renderFilters = () => (
        <View style={styles.filters}>
            {['all', 'active', 'with_bids', 'expired'].map(f => (
                <TouchableOpacity
                    key={f}
                    style={[
                        styles.filterBtn,
                        { backgroundColor: filter === f ? colors.primary : colors.surfaceSecondary },
                    ]}
                    onPress={() => handleFilterChange(f)}
                >
                    <Text style={[
                        styles.filterText,
                        { color: filter === f ? '#fff' : colors.textSecondary },
                    ]}>
                        {f === 'with_bids' ? 'With Bids' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderEmpty = () => (
        <EmptyState
            variant={filter === 'all' ? 'default' : 'search'}
            icon={filter === 'all' ? 'document-outline' : 'filter-outline'}
            title={filter === 'all' ? 'No Requests Yet' : 'No Matching Requests'}
            message={
                filter === 'all'
                    ? 'Create your first part request and get bids from verified garages'
                    : 'Try adjusting your filters to see more results'
            }
            actionLabel={filter === 'all' ? 'Create Request' : 'Clear Filters'}
            onAction={() => {
                if (filter === 'all') {
                    navigation.navigate('Home');
                } else {
                    setFilter('all');
                }
            }}
        />
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>My Requests</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {requests.length} request{requests.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {renderFilters()}

            {loading ? (
                <View style={styles.list}>
                    <SkeletonList count={4} />
                </View>
            ) : (
                <FlatList
                    data={filteredRequests}
                    renderItem={renderRequest}
                    keyExtractor={item => item.request_id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={renderEmpty}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    title: { fontSize: FontSize.xxl, fontWeight: '700' },
    subtitle: { fontSize: FontSize.md, marginTop: Spacing.xs },
    filters: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
    filterBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    filterText: { fontSize: FontSize.sm, fontWeight: '600' },
    list: { padding: Spacing.lg, flexGrow: 1 },
    card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
    partName: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.sm },
    vehicle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    vehicleText: { fontSize: FontSize.sm },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    date: { fontSize: FontSize.sm },
});

export default RequestsScreen;
