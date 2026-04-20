import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
// QScrap Chat Screen - Real-time messaging with Driver/Garage - Full i18n Support
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LoadingList } from '../components/SkeletonLoading';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Linking,
    Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { useToast } from '../components/Toast';
import QuickReplies from '../components/QuickReplies';
import { Ionicons } from '@expo/vector-icons';

interface Message {
    message_id: string;
    order_id: string;
    sender_id: string;
    sender_type: 'customer' | 'driver' | 'garage' | 'operations';
    sender_name: string;
    message: string;
    created_at: string;
    is_read: boolean;
}

interface ChatParams {
    orderId: string;
    orderNumber: string;
    recipientName: string;
    recipientType: 'driver' | 'garage';
}

export default function ChatScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { orderId, orderNumber, recipientName, recipientType } = route.params as ChatParams;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const flatListRef = useRef<FlatList>(null);
    const socket = useRef<Socket | null>(null);
    const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [userId, setUserId] = useState<string>('');

    // Play notification feedback for incoming messages (using haptics + vibration)
    const playMessageNotification = () => {
        try {
            // Strong haptic feedback for notification feel
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Short vibration pattern for additional feedback
            Vibration.vibrate([0, 100, 50, 100]);
        } catch (error) {
            log('Notification feedback error:', error);
        }
    };

    // Load messages and connect socket
    useEffect(() => {
        loadMessages();
        connectSocket();

        return () => {
            socket.current?.disconnect();
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
            }
        };
    }, []);

    const loadMessages = async (silent = false) => {
        try {
            const user = await api.getUser();
            setUserId(user?.user_id || '');

            // Fetch message history
            const response = await fetch(`${SOCKET_URL}/api/chat/messages/${orderId}`, {
                headers: {
                    Authorization: `Bearer ${await api.getToken()}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const newMessages = data.messages || [];
                setMessages(prev => {
                    // Only update if message count changed (avoids unnecessary re-renders)
                    if (prev.length !== newMessages.length) {
                        return newMessages;
                    }
                    return prev;
                });
            }
        } catch (error) {
            if (!silent) {
                handleApiError(error, toast, t('errors.loadFailed'));
            }
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    };

    const connectSocket = async () => {
        try {
            const token = await api.getToken();

            socket.current = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'],
            });

            socket.current.on('connect', () => {
                setIsConnected(true);
                // Stop polling when socket reconnects
                if (pollingInterval.current) {
                    clearInterval(pollingInterval.current);
                    pollingInterval.current = null;
                    log('[Chat] Socket reconnected, stopped polling fallback');
                }
                // Join order-specific chat room
                socket.current?.emit('join_order_chat', { order_id: orderId });
                // Also join general order room for messages
                socket.current?.emit('join_room', `order_${orderId}`);
            });

            socket.current.on('disconnect', () => {
                setIsConnected(false);
                // Start polling fallback when socket disconnects
                if (!pollingInterval.current) {
                    log('[Chat] Socket disconnected, starting polling fallback (5s)');
                    pollingInterval.current = setInterval(() => {
                        loadMessages(true);
                    }, 5000);
                }
            });

            // Listen for new messages
            socket.current.on('new_message', (data: Message) => {
                if (data.order_id === orderId) {
                    setMessages(prev => [...prev, data]);

                    // Only play sound for messages from others (not self)
                    if (data.sender_id !== userId) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        playMessageNotification();
                    } else {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }

                    // Scroll to bottom
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            });

            // Listen for typing indicator
            socket.current.on('typing', (data: { order_id: string; sender_name: string }) => {
                // Could show typing indicator here
            });

        } catch (error) {
            log('Socket connection error:', error);
        }
    };

    const sendMessage = useCallback(async () => {
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Send via API
            const response = await fetch(`${SOCKET_URL}/api/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await api.getToken()}`,
                },
                body: JSON.stringify({
                    order_id: orderId,
                    message: newMessage.trim(),
                }),
            });

            if (response.ok) {
                setNewMessage('');
                // Message will come back via socket
            } else {
                throw new Error('Failed to send');
            }
        } catch (error) {
            handleApiError(error, toast, t('chat.sendFailed'));
        } finally {
            setIsSending(false);
        }
    }, [orderId, newMessage, isSending, toast, t]);

    const formatTime = useCallback((dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === userId;

        return (
            <View style={[
                styles.messageBubble,
                isMe ? styles.myMessage : styles.theirMessage,
                isMe ? (isRTL ? { alignSelf: 'flex-start' } : { alignSelf: 'flex-end' }) :
                    (isRTL ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' })
            ]}>
                {!isMe && (
                    <Text style={[styles.senderName, { textAlign: rtlTextAlign(isRTL) }]}>{item.sender_name}</Text>
                )}
                <Text style={[styles.messageText, isMe && styles.myMessageText, { textAlign: rtlTextAlign(isRTL) }]}>
                    {item.message.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                        if (part.match(/https?:\/\/[^\s]+/)) {
                            return (
                                <Text
                                    key={index}
                                    style={{ textDecorationLine: 'underline', color: isMe ? '#fff' : Colors.primary }}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        Linking.openURL(part);
                                    }}
                                >
                                    {part}
                                </Text>
                            );
                        }
                        return <Text key={index}>{part}</Text>;
                    })}
                </Text>
                <Text style={[styles.messageTime, isMe && styles.myMessageTime, { textAlign: rtlTextAlign(isRTL) }]}>
                    {formatTime(item.created_at)}
                    {isMe && item.is_read && ' ✓✓'}
                </Text>
            </View>
        );
    };

    const handleQuickReply = (text: string) => {
        setNewMessage(text);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <View style={[styles.headerInfo, isRTL && { marginLeft: 0, marginRight: Spacing.md }]}>
                    <Text style={[styles.headerTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{recipientName}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('orders.orderNumber', { number: orderNumber })} • {isConnected ? t('chat.online') : t('chat.connecting')}
                    </Text>
                </View>
                <View style={styles.headerIcon}>
                    <Text style={styles.avatarEmoji}>
                        <Ionicons name={recipientType === 'driver' ? 'car-sport' : 'construct'} size={24} color={Colors.primary} />
                    </Text>
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {/* Messages List */}
                {isLoading ? (
                    <LoadingList count={4} />
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.message_id}
                        contentContainerStyle={styles.messagesList}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="chatbubble-outline" size={60} color="#ccc" style={{ marginBottom: Spacing.md }} />
                                <Text style={[styles.emptyText, { color: colors.text }]}>{t('chat.noMessages')}</Text>
                                <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                                    {t('chat.sendMessageTo', { name: recipientName })}
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Premium Quick Replies */}
                <QuickReplies
                    recipientType={recipientType}
                    onSelectReply={handleQuickReply}
                />

                {/* Input Area */}
                <View style={[styles.inputContainer, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TextInput
                        style={[styles.textInput, { textAlign: rtlTextAlign(isRTL) }, isRTL && { marginRight: 0, marginLeft: Spacing.sm }]}
                        placeholder={t('chat.typeMessage')}
                        placeholderTextColor="#999"
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={500}
                        accessibilityLabel={t('chat.typeMessage')}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!newMessage.trim() || isSending) && styles.sendButtonDisabled
                        ]}
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.send')}
                        accessibilityState={{ disabled: !newMessage.trim() || isSending }}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#16a34a'] as const}
                            style={styles.sendGradient}
                        >
                            {isSending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={[styles.sendIcon, isRTL && { transform: [{ scaleX: -1 }] }]}>➤</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 20,
        color: '#1a1a1a',
    },
    headerInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    headerTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginTop: 2,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 24,
    },
    keyboardView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messagesList: {
        padding: Spacing.md,
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: Spacing.md,
    },
    emptyText: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    emptyHint: {
        fontSize: FontSizes.md,
        color: '#525252',
        marginTop: Spacing.xs,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        ...Shadows.sm,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: Colors.primary,
        marginBottom: 4,
    },
    messageText: {
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        lineHeight: 22,
    },
    myMessageText: {
        color: '#fff',
    },
    messageTime: {
        fontSize: FontSizes.xs,
        color: '#737373',
        marginTop: 4,
        textAlign: 'right',
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    quickActions: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    quickAction: {
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    quickActionText: {
        fontSize: FontSizes.sm,
        color: '#1a1a1a',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: Spacing.md,
        paddingBottom: Spacing.lg,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        paddingTop: Spacing.sm,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        maxHeight: 100,
        marginRight: Spacing.sm,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendIcon: {
        fontSize: 20,
        color: '#fff',
    },
});
