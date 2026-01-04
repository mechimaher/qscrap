// QScrap Driver App - Assignments Screen
// Full list of assignments with filtering

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { api, Assignment } from '../../services/api';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig } from '../../constants/theme';

type FilterType = 'active' | 'completed' | 'all';

export default function AssignmentsScreen() {
    const { colors } = useTheme();

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [filter, setFilter] = useState<FilterType>('active');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAssignments();
    }, [filter]);

    const loadAssignments = async () => {
        try {
            setIsLoading(true);
            const result = await api.getAssignments(filter);
            setAssignments(result.assignments || []);
        } catch (err) {
            console.error('[Assignments] Load error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadAssignments();
        setIsRefreshing(false);
    }, [filter]);

    const renderAssignment = ({ item }: { item: Assignment }) => {
        const statusConfig = AssignmentStatusConfig[item.status as keyof typeof AssignmentStatusConfig];
        const typeConfig = AssignmentTypeConfig[item.assignment_type as keyof typeof AssignmentTypeConfig];

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface }]}
                activeOpacity={0.8}
            >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <Text style={[styles.orderNumber, { color: colors.text }]}>
                            #{item.order_number}
                        </Text>
                        <View style={[styles.typeBadge, { backgroundColor: typeConfig?.color + '15' }]}>
                            <Text>{typeConfig?.icon}</Text>
                            <Text style={[styles.typeText, { color: typeConfig?.color }]}>
                                {typeConfig?.label}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig?.color + '20' }]}>
                        <Text style={styles.statusIcon}>{statusConfig?.icon}</Text>
                        <Text style={[styles.statusText, { color: statusConfig?.color }]}>
                            {statusConfig?.label}
                        </Text>
                    </View>
                </View>

                {/* Part Info */}
                <Text style={[styles.partDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.part_description}
                </Text>

                {/* Locations */}
                <View style={styles.locationsContainer}>
                    <View style={styles.locationItem}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.primary }]} />
                        <View style={styles.locationContent}>
                            <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Pickup</Text>
                            <Text style={[styles.locationAddress, { color: colors.text }]} numberOfLines={1}>
                                {item.garage_name}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.locationLine, { backgroundColor: colors.border }]} />
                    <View style={styles.locationItem}>
                        <View style={[styles.locationDot, { backgroundColor: Colors.success }]} />
                        <View style={styles.locationContent}>
                            <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Delivery</Text>
                            <Text style={[styles.locationAddress, { color: colors.text }]} numberOfLines={1}>
                                {item.customer_name}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Time */}
                <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {formatDate(item.created_at)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Assignments</Text>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {(['active', 'completed', 'all'] as FilterType[]).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[
                            styles.filterTab,
                            filter === f && { backgroundColor: Colors.primary },
                        ]}
                        onPress={() => setFilter(f)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                { color: filter === f ? '#fff' : colors.textSecondary },
                            ]}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            <FlatList
                data={assignments}
                renderItem={renderAssignment}
                keyExtractor={(item) => item.assignment_id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>
                            {filter === 'active' ? '📭' : filter === 'completed' ? '✅' : '📋'}
                        </Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No {filter} assignments
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    // Check for invalid date
    if (isNaN(date.getTime())) return 'N/A';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 8,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '700',
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    typeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    statusIcon: {
        fontSize: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    partDescription: {
        fontSize: 14,
        marginBottom: 16,
    },
    locationsContainer: {
        marginBottom: 12,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    locationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    locationLine: {
        width: 2,
        height: 16,
        marginLeft: 4,
        marginVertical: 2,
    },
    locationContent: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 11,
    },
    locationAddress: {
        fontSize: 14,
        fontWeight: '500',
    },
    timeText: {
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
