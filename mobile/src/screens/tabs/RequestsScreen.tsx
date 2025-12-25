// QScrap Requests Screen - View and manage part requests
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { api, Request } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';

type RequestsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RequestsScreen() {
    const navigation = useNavigation<RequestsScreenNavigationProp>();
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return Colors.success;
            case 'accepted': return Colors.info;
            case 'expired': return Colors.dark.textMuted;
            default: return Colors.dark.textSecondary;
        }
    };

    const renderRequest = ({ item }: { item: Request }) => (
        <TouchableOpacity
            style={styles.requestCard}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('RequestDetail', { requestId: item.request_id });
            }}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.carInfo}>
                    <Text style={styles.carName}>{item.car_make} {item.car_model}</Text>
                    <Text style={styles.carYear}>{item.car_year}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.replace('_', ' ')}
                    </Text>
                </View>
            </View>

            <Text style={styles.partDescription} numberOfLines={2}>
                {item.part_description}
            </Text>

            <View style={styles.cardFooter}>
                <View style={styles.bidCount}>
                    <Text style={styles.bidIcon}>💬</Text>
                    <Text style={styles.bidCountText}>{item.bid_count} bids</Text>
                </View>
                <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Requests Yet</Text>
            <Text style={styles.emptyText}>Create your first part request to get started</Text>
            <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('NewRequest')}
            >
                <Text style={styles.emptyButtonText}>+ New Request</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Requests</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('NewRequest')}
                >
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
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
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: 24,
        color: '#fff',
        fontWeight: '300',
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: 0,
    },
    requestCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    carInfo: {
        flex: 1,
    },
    carName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    carYear: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    partDescription: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.md,
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
    bidIcon: {
        fontSize: 14,
        marginRight: Spacing.xs,
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
        paddingVertical: Spacing.xxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: Spacing.md,
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
        marginBottom: Spacing.lg,
    },
    emptyButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
});
