// QScrap Driver App - Premium Chat Screen
// Real-time messaging with customer during delivery
// Now with premium animations and QuickReplies component

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Vibration,
    Animated,
    Easing,
    Linking,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { api, API_ENDPOINTS } from '../services/api';
import { API_BASE_URL } from '../config/api';
import { getSocket, joinChatRoom, leaveChatRoom, onNewMessage, emitTyping, onTypingStatus } from '../services/socket';
import { offlineQueue } from '../services/OfflineQueue';
import { Colors, BorderRadius, Spacing, FontSize, Shadows } from '../constants/theme';
import { QuickReplies, SkeletonLoader } from '../components';

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



export default function ChatScreen() {
    const { colors } = useTheme();
    const { driver } = useAuth();
    const { t } = useI18n();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { orderId, orderNumber, recipientName, customerPhone } = route.params || {};

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(true);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [typingUser, setTypingUser] = useState<string>('');
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        loadMessages();
        joinChatRoom(orderId);

        // Listen for new messages
        const cleanupMessages = onNewMessage((data) => {
            if (data.order_id === orderId && data.sender_type !== 'driver') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Vibration.vibrate(100);
                setMessages((prev) => [...prev, data]);
                // Clear typing indicator when message received
                setIsOtherTyping(false);
            }
        });

        // P2: Listen for typing indicators
        const cleanupTyping = onTypingStatus((data) => {
            if (data.order_id === orderId && data.sender_type !== 'driver') {
                setIsOtherTyping(data.is_typing);
                setTypingUser(data.sender_name || 'Customer');

                // Auto-clear typing after 3 seconds (in case stop event missed)
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
                if (data.is_typing) {
                    typingTimeoutRef.current = setTimeout(() => {
                        setIsOtherTyping(false);
                    }, 3000);
                }
            }
        });

        return () => {
            cleanupMessages();
            cleanupTyping();
            leaveChatRoom(orderId);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [orderId]);

    const loadMessages = async () => {
        try {
            // Use centralized API service (timeouts, error handling, token management)
            const data = await api.request<{ messages?: Message[] }>(`/chat/order/${orderId}`);
            if (data.messages) {
                setMessages(data.messages);
            }

            // Entrance animation
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    easing: Easing.out(Easing.back(1.1)),
                    useNativeDriver: true,
                }),
            ]).start();
        } catch (err) {
            console.error('[Chat] Load messages error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = useCallback(async () => {
        if (!inputText.trim() || isSending) return;

        const messageText = inputText.trim();
        setInputText('');
        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Optimistic update
        const tempMessage: Message = {
            message_id: `temp_${Date.now()}`,
            order_id: orderId,
            sender_id: driver?.user_id || '',
            sender_type: 'driver',
            sender_name: driver?.full_name || 'Driver',
            message: messageText,
            created_at: new Date().toISOString(),
            is_read: false,
        };
        setMessages((prev) => [...prev, tempMessage]);

        try {
            // Send via REST API (Backend emits socket event)
            await api.sendChatMessage(orderId, messageText);
        } catch (err) {
            console.error('[Chat] Send error, queueing for retry:', err);
            // P0 IMPROVEMENT: Queue message for offline retry
            // This ensures messages are never lost even in poor network conditions
            await offlineQueue.enqueue(
                `/chat/order/${orderId}/message`,
                'POST',
                { message: messageText }
            );
        } finally {
            setIsSending(false);
        }
    }, [inputText, orderId, driver, isSending]);

    const handleQuickReply = (text: string) => {
        setInputText(text);
        setShowQuickReplies(false); // Hide after selection
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwnMessage = item.sender_type === 'driver';

        return (
            <View style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownMessage : styles.otherMessage,
                { backgroundColor: isOwnMessage ? Colors.primary : colors.surface }
            ]}>
                {!isOwnMessage && (
                    <Text style={[styles.senderName, { color: Colors.primary }]}>
                        {item.sender_name}
                    </Text>
                )}
                <Text style={[
                    styles.messageText,
                    { color: isOwnMessage ? '#fff' : colors.text }
                ]}>
                    {item.message}
                </Text>
                <Text style={[
                    styles.messageTime,
                    { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textMuted }
                ]}>
                    {formatTime(item.created_at)}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{recipientName}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Order #{orderNumber}</Text>
                </View>
                <View style={styles.headerRight}>
                    {customerPhone && (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                Linking.openURL(`tel:${customerPhone}`).catch(() =>
                                    Alert.alert('Error', 'Could not make call')
                                );
                            }}
                            style={{ padding: 12 }}
                        >
                            <Ionicons name="call" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.onlineIndicator, { backgroundColor: getSocket()?.connected ? Colors.success : colors.textMuted }]} />
                </View>
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                style={styles.chatContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <SkeletonLoader width={200} height={40} borderRadius={20} />
                        <SkeletonLoader width={250} height={40} borderRadius={20} style={{ marginTop: 12, alignSelf: 'flex-end' }} />
                        <SkeletonLoader width={180} height={40} borderRadius={20} style={{ marginTop: 12 }} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.message_id}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    {t('start_conversation')}
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Quick Replies */}
                {showQuickReplies && (
                    <QuickReplies
                        onSelectReply={handleQuickReply}
                        recipientType="customer"
                    />
                )}

                {/* P2: Typing Indicator */}
                {isOtherTyping && (
                    <View style={[styles.typingIndicator, { backgroundColor: colors.surface }]}>
                        <View style={styles.typingDots}>
                            <View style={[styles.typingDot, { backgroundColor: Colors.primary }]} />
                            <View style={[styles.typingDot, styles.typingDotDelayed, { backgroundColor: Colors.primary }]} />
                            <View style={[styles.typingDot, styles.typingDotDelayed2, { backgroundColor: Colors.primary }]} />
                        </View>
                        <Text style={[styles.typingText, { color: colors.textMuted }]}>
                            {t('user_typing', { user: typingUser })}
                        </Text>
                    </View>
                )}

                {/* Input */}
                <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder={t('type_message')}
                        placeholderTextColor={colors.textMuted}
                        value={inputText}
                        onChangeText={(text) => {
                            setInputText(text);
                            // P2: Emit typing status
                            emitTyping(orderId, text.length > 0);
                        }}
                        onBlur={() => emitTyping(orderId, false)}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            { backgroundColor: inputText.trim() ? Colors.primary : colors.border }
                        ]}
                        onPress={() => {
                            emitTyping(orderId, false); // Stop typing when sending
                            handleSend();
                        }}
                        disabled={!inputText.trim() || isSending}
                    >
                        <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    backIcon: { fontSize: 24 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    headerSubtitle: { fontSize: 12 },
    headerRight: { width: 40, alignItems: 'flex-end' },
    onlineIndicator: { width: 10, height: 10, borderRadius: 5 },

    chatContainer: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    messagesList: { padding: 16, paddingBottom: 8 },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
    },
    ownMessage: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    otherMessage: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    senderName: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    messageText: { fontSize: 15, lineHeight: 20 },
    messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyIcon: { fontSize: 48 },
    emptyText: { marginTop: 12, fontSize: 14 },

    quickRepliesContainer: { paddingVertical: 8 },
    quickRepliesList: { paddingHorizontal: 16, gap: 8 },
    quickReplyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        marginRight: 8,
    },
    quickReplyText: { fontSize: 13 },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        paddingBottom: 24,
        borderTopWidth: 1,
        gap: 8,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        fontSize: 15,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendIcon: { color: '#fff', fontSize: 18 },

    // P2: Typing indicator styles
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        opacity: 0.6,
    },
    typingDotDelayed: {
        opacity: 0.4,
    },
    typingDotDelayed2: {
        opacity: 0.2,
    },
    typingText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
});
