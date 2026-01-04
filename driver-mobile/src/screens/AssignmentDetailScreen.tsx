// QScrap Driver App - Assignment Detail Screen
// Full assignment view with status updates, navigation, and communication

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { api, Assignment } from '../services/api';
import { Colors, AssignmentStatusConfig, AssignmentTypeConfig } from '../constants/theme';

export default function AssignmentDetailScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { assignmentId } = route.params || {};

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAssignment();
    }, [assignmentId]);

    const loadAssignment = async () => {
        try {
            const result = await api.getAssignmentDetails(assignmentId);
            setAssignment(result.assignment);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to load assignment');
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadAssignment();
        setIsRefreshing(false);
    }, [assignmentId]);

    const updateStatus = async (newStatus: 'picked_up' | 'in_transit' | 'delivered' | 'failed') => {
        if (!assignment) return;

        const statusLabels = {
            picked_up: 'Confirm Pickup',
            in_transit: 'Start Delivery',
            delivered: 'Complete Delivery',
            failed: 'Mark as Failed',
        };

        Alert.alert(
            statusLabels[newStatus],
            `Are you sure you want to update status to "${newStatus.replace('_', ' ')}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setIsUpdating(true);

                        try {
                            await api.updateAssignmentStatus(assignment.assignment_id, newStatus);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            await loadAssignment();
                        } catch (err: any) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Error', err.message || 'Failed to update status');
                        } finally {
                            setIsUpdating(false);
                        }
                    },
                },
            ]
        );
    };

    const openNavigation = (address: string, lat?: number, lng?: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Google Maps URL
        let url = '';
        if (lat && lng) {
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        } else {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        }

        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open maps');
        });
    };

    const callContact = (phone: string, name: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            `Call ${name}`,
            phone,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
            ]
        );
    };

    const openChat = () => {
        if (!assignment) return;
        navigation.navigate('Chat', {
            orderId: assignment.order_id,
            orderNumber: assignment.order_number,
            recipientName: assignment.customer_name,
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!assignment) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.text }]}>Assignment not found</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = AssignmentStatusConfig[assignment.status as keyof typeof AssignmentStatusConfig];
    const typeConfig = AssignmentTypeConfig[assignment.assignment_type as keyof typeof AssignmentTypeConfig];
    const isActive = !['delivered', 'failed'].includes(assignment.status);

    // Determine next action
    const getNextAction = () => {
        switch (assignment.status) {
            case 'assigned':
                return { status: 'picked_up' as const, label: '📦 Confirm Pickup', color: Colors.primary };
            case 'picked_up':
                return { status: 'in_transit' as const, label: '🚚 Start Delivery', color: Colors.info };
            case 'in_transit':
                return { status: 'delivered' as const, label: '✅ Complete Delivery', color: Colors.success };
            default:
                return null;
        }
    };

    const nextAction = getNextAction();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.orderNumber, { color: colors.text }]}>
                        #{assignment.order_number}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig?.color + '20' }]}>
                        <Text style={[styles.statusText, { color: statusConfig?.color }]}>
                            {statusConfig?.icon} {statusConfig?.label}
                        </Text>
                    </View>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            >
                {/* Type Badge */}
                <View style={[styles.typeCard, { backgroundColor: typeConfig?.color + '15' }]}>
                    <Text style={styles.typeIcon}>{typeConfig?.icon}</Text>
                    <View>
                        <Text style={[styles.typeLabel, { color: typeConfig?.color }]}>{typeConfig?.label}</Text>
                        <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{typeConfig?.description}</Text>
                    </View>
                </View>

                {/* Part Info */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Part Details</Text>
                    <Text style={[styles.partDescription, { color: colors.textSecondary }]}>
                        {assignment.part_description}
                    </Text>
                    {assignment.car_make && (
                        <Text style={[styles.carInfo, { color: colors.textMuted }]}>
                            {assignment.car_make} {assignment.car_model}
                        </Text>
                    )}
                </View>

                {/* Pickup Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.locationIcon}>🏪</Text>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.garage_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.pickup_address}
                    </Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
                            onPress={() => openNavigation(assignment.pickup_address, assignment.pickup_lat, assignment.pickup_lng)}
                        >
                            <Text style={[styles.actionButtonText, { color: Colors.info }]}>🧭 Navigate</Text>
                        </TouchableOpacity>
                        {assignment.garage_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.garage_phone!, assignment.garage_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}>📞 Call</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Delivery Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.locationIcon}>📍</Text>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery</Text>
                    </View>
                    <Text style={[styles.locationName, { color: colors.text }]}>{assignment.customer_name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                        {assignment.delivery_address}
                    </Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
                            onPress={() => openNavigation(assignment.delivery_address, assignment.delivery_lat, assignment.delivery_lng)}
                        >
                            <Text style={[styles.actionButtonText, { color: Colors.info }]}>🧭 Navigate</Text>
                        </TouchableOpacity>
                        {assignment.customer_phone && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                                onPress={() => callContact(assignment.customer_phone!, assignment.customer_name)}
                            >
                                <Text style={[styles.actionButtonText, { color: Colors.success }]}>📞 Call</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: Colors.primary + '20' }]}
                            onPress={openChat}
                        >
                            <Text style={[styles.actionButtonText, { color: Colors.primary }]}>💬 Chat</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action */}
            {isActive && nextAction && (
                <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={styles.failButton}
                        onPress={() => updateStatus('failed')}
                        disabled={isUpdating}
                    >
                        <Text style={styles.failButtonText}>❌ Report Issue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.mainActionButton}
                        onPress={() => updateStatus(nextAction.status)}
                        disabled={isUpdating}
                    >
                        <LinearGradient
                            colors={[nextAction.color, nextAction.color + 'cc']}
                            style={styles.mainActionGradient}
                        >
                            {isUpdating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.mainActionText}>{nextAction.label}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 40 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    backIcon: { fontSize: 24 },
    headerCenter: { flex: 1, alignItems: 'center' },
    orderNumber: { fontSize: 18, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
    statusText: { fontSize: 12, fontWeight: '600' },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, gap: 16 },

    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    typeIcon: { fontSize: 32 },
    typeLabel: { fontSize: 16, fontWeight: '700' },
    typeDesc: { fontSize: 13 },

    section: { padding: 16, borderRadius: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    partDescription: { fontSize: 15, marginTop: 4 },
    carInfo: { fontSize: 13, marginTop: 4 },

    locationIcon: { fontSize: 20 },
    locationName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    locationAddress: { fontSize: 14, lineHeight: 20 },

    actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    actionButtonText: { fontSize: 13, fontWeight: '600' },

    bottomBar: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        gap: 12,
    },
    failButton: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#fee2e2',
    },
    failButtonText: { color: Colors.danger, fontWeight: '600' },
    mainActionButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    mainActionGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
