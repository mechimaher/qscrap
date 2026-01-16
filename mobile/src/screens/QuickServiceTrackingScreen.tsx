// Quick Service Tracking Screen
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Root StackParamList } from '../../App';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParamsProp = RouteProp<RootStackParamList, 'QuickServiceTracking'>;

export default function QuickServiceTrackingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteParamsProp>();
    const { colors } = useTheme();

    const requestId = route.params?.requestId;

    const [request, setRequest] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRequestStatus();
        const interval = setInterval(fetchRequestStatus, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [requestId]);

    const fetchRequestStatus = async () => {
        try {
            const response = await api.get(`/services/quick/my-requests`);
            if (response.success && response.requests) {
                const currentRequest = response.requests.find((r: any) => r.request_id === requestId);
                if (currentRequest) {
                    setRequest(currentRequest);
                }
            }
        } catch (error) {
            console.error('Failed to fetch request status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusInfo = () => {
        if (!request) return { icon: '⏳', text: 'Loading...', color: colors.textMuted };

        switch (request.status) {
            case 'pending':
                return { icon: '🔍', text: 'Finding service provider...', color: '#F59E0B' };
            case 'assigned':
                return { icon: '✅', text: 'Service provider assigned!', color: '#10B981' };
            case 'accepted':
                return { icon: '🚗', text: 'Technician on the way', color: '#3B82F6' };
            case 'en_route':
                return { icon: '🛣️', text: 'Arriving soon', color: '#8B5CF6' };
            case 'in_progress':
                return { icon: '🔧', text: 'Service in progress', color: '#EC4899' };
            case 'completed':
                return { icon: '🎉', text: 'Service completed!', color: '#059669' };
            case 'cancelled':
                return { icon: '❌', text: 'Service cancelled', color: '#EF4444' };
            default:
                return { icon: '⏳', text: 'Processing...', color: colors.textMuted };
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Loading service details...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Service Tracking</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Status Card */}
                <View style={[styles.statusCard, { backgroundColor: colors.surface }]}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.text}
                    </Text>
                    {request?.estimated_arrival && (
                        <Text style={[styles.eta, { color: colors.textSecondary }]}>
                            ETA: {new Date(request.estimated_arrival).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>

                {/* Service Details */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                            {request?.service_type?.toUpperCase()}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Vehicle:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                            {request?.vehicle_make} {request?.vehicle_model} {request?.vehicle_year}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
                            {request?.location_address}
                        </Text>
                    </View>

                    {request?.garage_name && (
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Provider:</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>
                                {request.garage_name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress Timeline */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Progress</Text>

                    {['pending', 'assigned', 'accepted', 'in_progress', 'completed'].map((status, index) => {
                        const isCompleted = ['pending', 'assigned', 'accepted', 'in_progress', 'completed'].indexOf(request?.status) >= index;
                        const isCurrent = request?.status === status;

                        return (
                            <View key={status} style={styles.timelineItem}>
                                <View style={[
                                    styles.timelineDot,
                                    { backgroundColor: isCompleted ? Colors.primary : colors.border },
                                    isCurrent && styles.timelineDotCurrent
                                ]} />
                                <Text style={[
                                    styles.timelineText,
                                    { color: isCompleted ? colors.text : colors.textMuted },
                                    isCurrent && { fontWeight: '700' }
                                ]}>
                                    {status.replace('_', ' ').toUpperCase()}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Footer Actions */}
            {request?.garage_phone && request.status !== 'completed' && (
                <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity style={styles.callButton}>
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.callGradient}
                        >
                            <Text style={styles.callText}>📞 Call Service Provider</Text>
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
    loadingText: { marginTop: Spacing.md, fontSize: FontSizes.md },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    backText: { fontSize: 24 },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },
    statusCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    statusIcon: { fontSize: 64, marginBottom: Spacing.md },
    statusText: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'center' },
    eta: { fontSize: FontSizes.md, marginTop: Spacing.sm },
    section: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.md },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
        alignItems: 'flex-start',
    },
    detailLabel: { fontSize: FontSizes.md, fontWeight: '600', flex: 1 },
    detailValue: { fontSize: FontSizes.md, flex: 2, textAlign: 'right' },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    timelineDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: Spacing.md,
    },
    timelineDotCurrent: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    timelineText: { fontSize: FontSizes.md },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
    },
    callButton: { borderRadius: BorderRadius.xl, overflow: 'hidden' },
    callGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    callText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '700' },
});
