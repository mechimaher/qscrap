// QScrap Notifications Screen - Premium Notification Center
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
import { RootStackParamList } from '../../App';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface Notification {
    notification_id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    related_id?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadNotifications = async () => {
        try {
            const data = await api.getNotifications();
            setNotifications(data.notifications || []);
        } catch (error) {
            console.log('Failed to load notifications:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadNotifications();
    }, []);

    const handleNotificationPress = async (notification: Notification) => {
        Haptics.selectionAsync();

        // Mark as read
        if (!notification.is_read) {
            try {
                await api.markNotificationRead(notification.notification_id);
                setNotifications(prev =>
                    prev.map(n =>
                        n.notification_id === notification.notification_id
                            ? { ...n, is_read: true }
                            : n
                    )
                );
            } catch (error) {
                console.log('Failed to mark notification as read:', error);
            }
        }

        // Navigate based on type
        if (notification.type === 'bid' && notification.related_id) {
            navigation.navigate('RequestDetail', { requestId: notification.related_id });
        } else if (notification.type === 'order' && notification.related_id) {
            navigation.navigate('OrderDetail', { orderId: notification.related_id });
        }
    };

    const handleMarkAllRead = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await api.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.log('Failed to mark all as read:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'bid': return '💰';
            case 'order': return '📦';
            case 'delivery': return '🚚';
            case 'counter_offer': return '🤝';
            default: return '🔔';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const renderNotification = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, !item.is_read && styles.unreadIcon]}>
                <Text style={styles.icon}>{getNotificationIcon(item.type)}</Text>
            </View>
            <View style={styles.content}>
                <Text style={[styles.title, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                        <Text style={styles.markAllText}>Read All</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 60 }} />
                )}
            </View>

            {isLoading ? (
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔔</Text>
                    <Text style={styles.emptyTitle}>No Notifications</Text>
                    <Text style={styles.emptySubtitle}>You're all caught up!</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.notification_id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: { padding: Spacing.sm },
    backText: { color: Colors.primary, fontSize: FontSizes.lg, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.dark.text },
    markAllButton: { padding: Spacing.sm },
    markAllText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },
    list: { padding: Spacing.lg, paddingTop: 0 },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        ...Shadows.sm,
    },
    unreadCard: {
        backgroundColor: Colors.dark.surfaceElevated,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    unreadIcon: {
        backgroundColor: Colors.primaryGlow,
    },
    icon: { fontSize: 24 },
    content: { flex: 1 },
    title: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    unreadTitle: { fontWeight: '700' },
    message: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginBottom: 4,
    },
    time: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
        alignSelf: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    emptyIcon: { fontSize: 64, marginBottom: Spacing.lg, opacity: 0.5 },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    emptySubtitle: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
});
