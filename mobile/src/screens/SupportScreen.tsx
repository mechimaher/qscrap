import { log, warn, error as logError } from '../utils/logger';
// QScrap Support Screen - WhatsApp-First Support (Qatar Market Optimized)
// Now includes "My Tickets" section for customer ticket visibility
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { api } from '../services/api';
import { CONTACT } from '../constants/contacts';


interface SupportOption {
    id: string;
    icon: string;
    titleKey: string;
    descriptionKey: string;
    messagePrefix: string;
}

interface Ticket {
    ticket_id: string;
    subject: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    category?: string;
    priority?: string;
    created_at: string;
    last_message_at?: string;
}

const SUPPORT_OPTIONS: SupportOption[] = [
    {
        id: 'general',
        icon: '💬',
        titleKey: 'support.generalInquiry',
        descriptionKey: 'support.generalDesc',
        messagePrefix: 'Hi QScrap! I have a question: ',
    },
    {
        id: 'order',
        icon: '📦',
        titleKey: 'support.orderHelp',
        descriptionKey: 'support.orderHelpDesc',
        messagePrefix: 'Hi QScrap! I need help with my order: ',
    },
    {
        id: 'payment',
        icon: '💳',
        titleKey: 'support.paymentIssue',
        descriptionKey: 'support.paymentDesc',
        messagePrefix: 'Hi QScrap! I have a payment issue: ',
    },
    {
        id: 'complaint',
        icon: '⚠️',
        titleKey: 'support.fileComplaint',
        descriptionKey: 'support.complaintDesc',
        messagePrefix: 'Hi QScrap! I would like to report an issue: ',
    },
];

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'open': return '#f59e0b';
        case 'in_progress': return '#3b82f6';
        case 'resolved': return '#10b981';
        case 'closed': return '#6b7280';
        default: return '#6b7280';
    }
};

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

export default function SupportScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [ticketsExpanded, setTicketsExpanded] = useState(true);

    const fetchTickets = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            const response = await api.getTickets();
            // Filter to show only open/in_progress tickets prominently
            const allTickets = response.tickets || [];
            setTickets(allTickets);
        } catch (error) {
            logError('[Support] Failed to load tickets:', error);
        } finally {
            setLoadingTickets(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    // Refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchTickets();
        }, [fetchTickets])
    );

    const onRefresh = () => {
        fetchTickets(true);
    };

    const openWhatsApp = (messagePrefix: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const message = encodeURIComponent(messagePrefix);
        const url = `whatsapp://send?phone=${CONTACT.SUPPORT_PHONE}&text=${message}`;

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(url);
                } else {
                    // Fallback to web WhatsApp
                    const webUrl = `https://wa.me/${CONTACT.SUPPORT_PHONE.replace('+', '')}?text=${message}`;
                    return Linking.openURL(webUrl);
                }
            })
            .catch((err) => {
                logError('WhatsApp open error:', err);
                Alert.alert(
                    t('common.error'),
                    t('support.whatsappNotInstalled'),
                    [{ text: t('common.ok') }]
                );
            });
    };

    const openTicketWhatsApp = (ticket: Ticket) => {
        const message = `Hi QScrap! I have a follow-up on my support ticket "${ticket.subject}" (ID: ${ticket.ticket_id.slice(0, 8)}): `;
        openWhatsApp(message);
    };

    const renderTicketCard = (ticket: Ticket) => {
        const statusColor = getStatusColor(ticket.status);
        const statusLabel = ticket.status.replace('_', ' ').toUpperCase();
        const isActive = ticket.status === 'open' || ticket.status === 'in_progress';

        return (
            <TouchableOpacity
                key={ticket.ticket_id}
                style={[
                    styles.ticketCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: isActive ? statusColor : colors.border,
                        borderLeftWidth: isActive ? 4 : 1,
                    }
                ]}
                onPress={() => openTicketWhatsApp(ticket)}
                activeOpacity={0.7}
            >
                <View style={[styles.ticketHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text
                        style={[styles.ticketSubject, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                        numberOfLines={1}
                    >
                        {ticket.subject}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {statusLabel}
                        </Text>
                    </View>
                </View>
                <View style={[styles.ticketMeta, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                        {formatTimeAgo(ticket.last_message_at || ticket.created_at)}
                    </Text>
                    {ticket.category && (
                        <Text style={[styles.ticketCategory, { color: colors.textSecondary }]}>
                            • {ticket.category}
                        </Text>
                    )}
                </View>
                <View style={[styles.ticketAction, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text style={styles.whatsappIcon}>💬</Text>
                    <Text style={[styles.ticketActionText, { color: Colors.primary }]}>
                        {t('support.followUpWhatsApp') || 'Follow up on WhatsApp'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderTicketsSection = () => {
        const activeTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
        const hasActiveTickets = activeTickets.length > 0;

        if (loadingTickets) {
            return (
                <View style={[styles.ticketsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                </View>
            );
        }

        if (!hasActiveTickets) {
            return null; // Don't show section if no active tickets
        }

        return (
            <View style={[styles.ticketsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.ticketsSectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}
                    onPress={() => setTicketsExpanded(!ticketsExpanded)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.ticketsSectionTitleRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={styles.ticketsSectionIcon}>🎫</Text>
                        <Text style={[styles.ticketsSectionTitle, { color: colors.text }]}>
                            {t('support.myTickets') || 'My Support Tickets'}
                        </Text>
                        <View style={[styles.ticketCountBadge, { backgroundColor: '#f59e0b' }]}>
                            <Text style={styles.ticketCountText}>{activeTickets.length}</Text>
                        </View>
                    </View>
                    <Text style={[styles.expandIcon, { color: colors.textSecondary }]}>
                        {ticketsExpanded ? '▼' : (isRTL ? '◀' : '▶')}
                    </Text>
                </TouchableOpacity>

                {ticketsExpanded && (
                    <View style={styles.ticketsList}>
                        <Text style={[styles.ticketsHint, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.ticketsHint') || 'Tap a ticket to follow up on WhatsApp'}
                        </Text>
                        {activeTickets.map(renderTicketCard)}
                    </View>
                )}
            </View>
        );
    };

    const renderSupportOption = (option: SupportOption) => (
        <TouchableOpacity
            key={option.id}
            style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openWhatsApp(option.messagePrefix)}
            activeOpacity={0.7}
        >
            <View style={[styles.optionContent, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.iconContainer}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.optionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t(option.titleKey)}
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t(option.descriptionKey)}
                    </Text>
                </View>
                <Text style={[styles.arrow, { color: Colors.primary }]}>{isRTL ? '←' : '→'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('support.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={['#25D366', '#128C7E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        <Text style={styles.heroIcon}>💬</Text>
                        <Text style={[styles.heroTitle, { textAlign: 'center' }]}>{t('support.whatsappTitle')}</Text>
                        <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>{t('support.whatsappSubtitle')}</Text>

                        <TouchableOpacity
                            style={styles.mainChatButton}
                            onPress={() => openWhatsApp('Hi QScrap! ')}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.mainChatIcon}>📱</Text>
                            <Text style={styles.mainChatText}>{t('support.startChat')}</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                {/* My Tickets Section - Shows above Quick Help if customer has open tickets */}
                {renderTicketsSection()}

                {/* Quick Help Options */}
                <View style={styles.optionsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('support.quickHelp')}
                    </Text>
                    {SUPPORT_OPTIONS.map(renderSupportOption)}
                </View>

                {/* Business Hours Info */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.infoIcon}>🕐</Text>
                    <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.businessHours')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.hoursDetail')}
                        </Text>
                    </View>
                </View>

                {/* Response Time Promise */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.infoIcon}>⚡</Text>
                    <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.fastResponse')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.responseTime')}
                        </Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
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
    scrollView: { flex: 1 },
    heroSection: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    heroGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    heroIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    heroTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
        marginBottom: Spacing.sm,
    },
    heroSubtitle: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: Spacing.lg,
    },
    mainChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        ...Shadows.md,
    },
    mainChatIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    mainChatText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#25D366',
    },
    // Tickets Section
    ticketsSection: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    ticketsSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
    },
    ticketsSectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    ticketsSectionIcon: {
        fontSize: 20,
    },
    ticketsSectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    ticketCountBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    ticketCountText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '700',
    },
    expandIcon: {
        fontSize: 12,
    },
    ticketsList: {
        padding: Spacing.md,
        paddingTop: 0,
    },
    ticketsHint: {
        fontSize: FontSizes.xs,
        marginBottom: Spacing.sm,
        fontStyle: 'italic',
    },
    ticketCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
    },
    ticketHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    ticketSubject: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        flex: 1,
        marginRight: Spacing.sm,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    ticketMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    ticketTime: {
        fontSize: FontSizes.xs,
    },
    ticketCategory: {
        fontSize: FontSizes.xs,
        marginLeft: Spacing.xs,
    },
    ticketAction: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Spacing.xs,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    whatsappIcon: {
        fontSize: 14,
        marginRight: Spacing.xs,
    },
    ticketActionText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    // Existing styles
    optionsSection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    optionCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    optionIcon: {
        fontSize: 24,
    },
    textContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
    arrow: {
        fontSize: 20,
        fontWeight: '700',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    infoIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    infoText: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
});
