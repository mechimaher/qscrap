import { log, warn, error as logError } from '../utils/logger';
// QScrap Notifications Screen - Premium Notification Center with Full i18n Support
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import * as Haptics from 'expo-haptics';
import { api, Notification as AppNotification } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign, rtlChevron } from '../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { LoadingList } from '../components/SkeletonLoading';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const { refresh: refreshBadges } = useBadgeCounts();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadNotifications = async () => {
        try {
            const data = await api.getNotifications();
            setNotifications(data.notifications || []);
        } catch (error) {
            log('Failed to load notifications:', error);
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

    const handleNotificationPress = async (notification: AppNotification) => {
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
                log('Failed to mark notification as read:', error);
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
            // Refresh badge counts to update Profile tab badge
            refreshBadges();
        } catch (error) {
            log('Failed to mark all as read:', error);
        }
    };

    const handleClearAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            t('common.clear'),
            t('alerts.confirmAction'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.clear'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.clearAllNotifications();
                            setNotifications([]);
                            // Refresh badge counts to update Profile tab badge
                            refreshBadges();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error) {
                            log('Failed to clear notifications:', error);
                        }
                    }
                }
            ]
        );
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

        // Use localized time labels
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    };

    const renderNotification = ({ item }: { item: AppNotification }) => (
        <TouchableOpacity
            style={[
                styles.notificationCard,
                { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rtlFlexDirection(isRTL) },
                !item.is_read && styles.unreadCard
            ]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, !item.is_read && styles.unreadIcon, isRTL && { marginRight: 0, marginLeft: Spacing.md }]}>
                <Text style={styles.icon}>{getNotificationIcon(item.type)}</Text>
            </View>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text, textAlign: rtlTextAlign(isRTL) }, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                <Text style={[styles.message, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={2}>{item.message || item.body}</Text>
                <Text style={[styles.time, { color: colors.textMuted, textAlign: rtlTextAlign(isRTL) }]}>{formatTime(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifications.title')}</Text>
                <View style={[styles.headerActions, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton} accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead')}>
                            <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
                        </TouchableOpacity>
                    )}
                    {notifications.length > 0 && (
                        <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton} accessibilityRole="button" accessibilityLabel={t('common.clear')}>
                            <Text style={styles.clearAllText}>{t('common.clear')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <LoadingList count={5} />
            ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔔</Text>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.noNotifications')}</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('notifications.allCaughtUp')}</Text>
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
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a' },
    markAllButton: {
        padding: Spacing.sm,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.md,
        marginRight: Spacing.xs,
    },
    markAllText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    clearAllButton: {
        padding: Spacing.sm,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.md,
    },
    clearAllText: { color: '#DC2626', fontSize: FontSizes.sm, fontWeight: '600' },
    list: { padding: Spacing.lg, paddingTop: Spacing.md },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    unreadCard: {
        backgroundColor: '#fff',
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
        borderColor: Colors.primary + '30',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    unreadIcon: {
        backgroundColor: Colors.primary + '15',
    },
    icon: { fontSize: 24 },
    content: { flex: 1 },
    title: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    unreadTitle: { fontWeight: '700' },
    message: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginBottom: 4,
    },
    time: {
        fontSize: FontSizes.xs,
        color: '#737373',
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
        color: '#1a1a1a',
        marginBottom: Spacing.sm,
    },
    emptySubtitle: {
        fontSize: FontSizes.md,
        color: '#525252',
    },
});
