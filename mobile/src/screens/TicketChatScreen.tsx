// QScrap Ticket Chat Screen - Customer Support Conversation
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface Message {
    message_id: string;
    sender_id: string;
    sender_type: 'customer' | 'operations' | 'staff';
    sender_name: string;
    message_text: string;
    attachments?: string[];
    created_at: string;
    is_read: boolean;
}

interface Ticket {
    ticket_id: string;
    subject: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    order_id?: string;
    created_at: string;
}

export default function TicketChatScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const { ticketId } = route.params as { ticketId: string };

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadTicketAndMessages();
        // Poll for new messages every 10 seconds
        pollInterval.current = setInterval(loadMessages, 10000);
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [ticketId]);

    const loadTicketAndMessages = async () => {
        try {
            const [ticketData, messagesData] = await Promise.all([
                api.getTicketDetail(ticketId),
                api.request(`/support/tickets/${ticketId}/messages`)
            ]);
            setTicket(ticketData.ticket || ticketData);
            setMessages((messagesData as any).messages || messagesData || []);
        } catch (error) {
            console.log('Failed to load ticket:', error);
            Alert.alert(t('common.error'), 'Failed to load ticket details');
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async () => {
        try {
            const data = await api.request(`/support/tickets/${ticketId}/messages`);
            setMessages((data as any).messages || data || []);
        } catch (error) {
            console.log('Failed to refresh messages:', error);
        }
    };

    const sendMessage = async () => {
        if (!messageText.trim()) return;

        const tempMessage = messageText.trim();
        setMessageText('');
        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            await api.sendTicketMessage(ticketId, tempMessage);
            await loadMessages();
            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message || 'Failed to send message');
            setMessageText(tempMessage); // Restore message on error
        } finally {
            setIsSending(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return Colors.info;
            case 'in_progress': return Colors.warning;
            case 'resolved': return Colors.success;
            case 'closed': return Colors.dark.textMuted;
            default: return Colors.dark.textMuted;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return t('status.open');
            case 'in_progress': return t('status.inProgress');
            case 'resolved': return t('status.resolved');
            case 'closed': return t('status.closed');
            default: return status;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isCustomer = item.sender_type === 'customer';
        return (
            <View style={[
                styles.messageContainer,
                isCustomer ? styles.customerMessage : styles.supportMessage,
                { flexDirection: isRTL && !isCustomer ? 'row-reverse' : 'row' }
            ]}>
                <View style={[
                    styles.messageBubble,
                    isCustomer ? { backgroundColor: Colors.primary } : { backgroundColor: colors.surface },
                    isCustomer ? {} : { borderWidth: 1, borderColor: colors.border }
                ]}>
                    {!isCustomer && (
                        <Text style={[styles.senderName, { color: Colors.primary }]}>
                            {item.sender_name || 'Support Team'}
                        </Text>
                    )}
                    <Text style={[
                        styles.messageText,
                        { color: isCustomer ? '#fff' : colors.text }
                    ]}>
                        {item.message_text}
                    </Text>
                    {item.attachments && item.attachments.length > 0 && (
                        <View style={styles.attachmentsContainer}>
                            {item.attachments.map((url, index) => (
                                <Image
                                    key={index}
                                    source={{ uri: url }}
                                    style={styles.attachmentImage}
                                    resizeMode="cover"
                                />
                            ))}
                        </View>
                    )}
                    <Text style={[
                        styles.messageTime,
                        { color: isCustomer ? 'rgba(255,255,255,0.7)' : colors.textMuted }
                    ]}>
                        {formatTime(item.created_at)}
                    </Text>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backButton, { backgroundColor: colors.background }]}
                >
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {ticket?.subject || 'Support Ticket'}
                    </Text>
                    {ticket && (
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                                {getStatusLabel(ticket.status)}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={{ width: 60 }} />
            </View>

            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.message_id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                        placeholder={t('chat.typeMessage')}
                        placeholderTextColor={colors.textMuted}
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                        editable={!isSending && ticket?.status !== 'closed'}
                    />
                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={!messageText.trim() || isSending || ticket?.status === 'closed'}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
                        >
                            {isSending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.sendIcon}>→</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    headerCenter: { flex: 1, marginHorizontal: Spacing.md },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
    messagesList: { padding: Spacing.lg, paddingBottom: Spacing.xl },
    messageContainer: { marginBottom: Spacing.md },
    customerMessage: { justifyContent: 'flex-end' },
    supportMessage: { justifyContent: 'flex-start' },
    messageBubble: {
        maxWidth: '75%',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    senderName: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        marginBottom: 4,
        color: Colors.primary,
    },
    messageText: { fontSize: FontSizes.md, lineHeight: 20 },
    messageTime: { fontSize: FontSizes.xs, marginTop: 4 },
    attachmentsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: Spacing.sm,
        gap: Spacing.xs,
    },
    attachmentImage: {
        width: 80,
        height: 80,
        borderRadius: BorderRadius.md,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E8E8E8',
    },
    input: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        maxHeight: 100,
        marginRight: Spacing.sm,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.sm,
    },
    sendButtonDisabled: { opacity: 0.5 },
    sendIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },
});
