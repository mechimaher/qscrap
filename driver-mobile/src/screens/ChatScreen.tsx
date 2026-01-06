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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { API_BASE_URL } from '../config/api';
import { getSocket, joinChatRoom, leaveChatRoom, onNewMessage } from '../services/socket';
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
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { orderId, orderNumber, recipientName } = route.params || {};

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        loadMessages();
        joinChatRoom(orderId);

        // Listen for new messages
        const cleanup = onNewMessage((data) => {
            if (data.order_id === orderId && data.sender_type !== 'driver') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Vibration.vibrate(100);
                setMessages((prev) => [...prev, data]);
            }
        });

        return () => {
            cleanup();
            leaveChatRoom(orderId);
        };
    }, [orderId]);

    const loadMessages = async () => {
        try {
            // API call to get chat history
            const token = await api.getToken();
            const response = await fetch(
                `${API_BASE_URL}/chat/order/${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            const data = await response.json();
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
            // Send via socket
            // Send via REST API (Backend emits socket event)
            await api.sendChatMessage(orderId, messageText);
        } catch (err) {
            console.error('[Chat] Send error:', err);
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
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{recipientName}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Order #{orderNumber}</Text>
                </View>
                <View style={styles.headerRight}>
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
                                <Text style={styles.emptyIcon}>💬</Text>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    Start the conversation
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

                {/* Input */}
                <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textMuted}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            { backgroundColor: inputText.trim() ? Colors.primary : colors.border }
                        ]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isSending}
                    >
                        <Text style={styles.sendIcon}>➤</Text>
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
});
