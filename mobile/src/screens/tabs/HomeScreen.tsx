// QScrap Home Screen - Premium Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { api, Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { RootStackParamList } from '../../../App';
import { LoadingStats } from '../../components/SkeletonLoading';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { user } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadStats = async () => {
        try {
            const data = await api.getStats();
            setStats(data.stats);
        } catch (error) {
            console.log('Failed to load stats:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{greeting()}</Text>
                        <Text style={styles.userName}>{user?.full_name || 'Customer'}</Text>
                    </View>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logo}>🔧</Text>
                    </View>
                </View>

                {/* New Request Button */}
                <TouchableOpacity
                    style={styles.newRequestButton}
                    onPress={handleNewRequest}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={Colors.gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.newRequestGradient}
                    >
                        <Text style={styles.newRequestIcon}>+</Text>
                        <View style={styles.newRequestText}>
                            <Text style={styles.newRequestTitle}>New Part Request</Text>
                            <Text style={styles.newRequestSubtitle}>Find any auto part you need</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Stats Cards */}
                <Text style={styles.sectionTitle}>Your Activity</Text>

                {isLoading ? (
                    <LoadingStats />
                ) : (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <LinearGradient
                                colors={['#ffffff', '#f0f0f0']}
                                style={[styles.statCardGradient, { borderWidth: 1, borderColor: '#e0e0e0' }]}
                            >
                                <Text style={styles.statNumber}>{stats?.active_requests || 0}</Text>
                                <Text style={styles.statLabel}>Active Requests</Text>
                                <Text style={styles.statIcon}>🔍</Text>
                            </LinearGradient>
                        </View>

                        <View style={styles.statCard}>
                            <LinearGradient
                                colors={['#ffffff', '#f0f0f0']}
                                style={[styles.statCardGradient, { borderWidth: 1, borderColor: '#e0e0e0' }]}
                            >
                                <Text style={styles.statNumber}>{stats?.pending_deliveries || 0}</Text>
                                <Text style={styles.statLabel}>In Progress</Text>
                                <Text style={styles.statIcon}>🚚</Text>
                            </LinearGradient>
                        </View>

                        <View style={[styles.statCard, styles.statCardWide]}>
                            <LinearGradient
                                colors={['#8A153810', '#8A153820']}
                                style={[styles.statCardGradient, { borderWidth: 1, borderColor: Colors.primary }]}
                            >
                                <Text style={[styles.statNumber, { color: Colors.primary }]}>
                                    {stats?.total_orders || 0}
                                </Text>
                                <Text style={styles.statLabel}>Total Orders</Text>
                                <Text style={styles.statIcon}>📦</Text>
                            </LinearGradient>
                        </View>
                    </View>
                )}

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Requests' } as any)}
                    >
                        <Text style={styles.actionIcon}>📋</Text>
                        <Text style={styles.actionLabel}>My Requests</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Orders' } as any)}
                    >
                        <Text style={styles.actionIcon}>📦</Text>
                        <Text style={styles.actionLabel}>My Orders</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => Linking.openURL('https://wa.me/97412345678?text=Hi%20QScrap%20Support')}
                    >
                        <Text style={styles.actionIcon}>💬</Text>
                        <Text style={styles.actionLabel}>Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Main', { screen: 'Profile' } as any)}
                    >
                        <Text style={styles.actionIcon}>⚙️</Text>
                        <Text style={styles.actionLabel}>Settings</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    scrollView: {
        flex: 1,
        padding: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    greeting: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    userName: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    logoContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        fontSize: 28,
    },
    newRequestButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        ...Shadows.glow,
    },
    newRequestGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    newRequestIcon: {
        fontSize: 36,
        fontWeight: '300',
        color: '#fff',
        marginRight: Spacing.md,
    },
    newRequestText: {
        flex: 1,
    },
    newRequestTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#fff',
    },
    newRequestSubtitle: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    statCard: {
        width: '48%',
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    statCardWide: {
        width: '100%',
    },
    statCardGradient: {
        padding: Spacing.lg,
        minHeight: 100,
    },
    statNumber: {
        fontSize: FontSizes.xxxl,
        fontWeight: '800',
        color: Colors.dark.text,
    },
    statLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
    },
    statIcon: {
        position: 'absolute',
        right: Spacing.md,
        top: Spacing.md,
        fontSize: 28,
        opacity: 0.5,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    actionCard: {
        width: '48%',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        ...Shadows.sm,
    },
    actionIcon: {
        fontSize: 32,
        marginBottom: Spacing.sm,
    },
    actionLabel: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.dark.text,
    },
});
