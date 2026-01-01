// QScrap Chat Screen - Real-time messaging with Driver/Garage
import React, { useState, useEffect, useRef } from 'react';
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
import QuickReplies from '../components/QuickReplies';

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

    const flatListRef = useRef<FlatList>(null);
    const socket = useRef<Socket | null>(null);

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
            console.log('Notification feedback error:', error);
        }
    };

    // Load messages and connect socket
    useEffect(() => {
        loadMessages();
        connectSocket();

        return () => {
            socket.current?.disconnect();
        };
    }, []);

    const loadMessages = async () => {
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
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.log('Failed to load messages:', error);
        } finally {
            setIsLoading(false);
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
                // Join order-specific chat room
                socket.current?.emit('join_order_chat', { order_id: orderId });
                // Also join general order room for messages
                socket.current?.emit('join_room', `order_${orderId}`);
            });

            socket.current.on('disconnect', () => {
                setIsConnected(false);
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
            console.log('Socket connection error:', error);
        }
    };

    const sendMessage = async () => {
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === userId;

        return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                {!isMe && (
                    <Text style={styles.senderName}>{item.sender_name}</Text>
                )}
                <Text style={[styles.messageText, isMe && styles.myMessageText]}>
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
                <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
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
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{recipientName}</Text>
                    <Text style={styles.headerSubtitle}>
                        Order #{orderNumber} • {isConnected ? '🟢 Online' : '⚪ Connecting...'}
                    </Text>
                </View>
                <View style={styles.headerIcon}>
                    <Text style={styles.avatarEmoji}>
                        {recipientType === 'driver' ? '🚗' : '🔧'}
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
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
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
                                <Text style={styles.emptyIcon}>💬</Text>
                                <Text style={styles.emptyText}>No messages yet</Text>
                                <Text style={styles.emptyHint}>
                                    Send a message to {recipientName}
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
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor={Colors.dark.textMuted}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!newMessage.trim() || isSending) && styles.sendButtonDisabled
                        ]}
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#16a34a'] as const}
                            style={styles.sendGradient}
                        >
                            {isSending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.sendIcon}>➤</Text>
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
        color: Colors.dark.text,
    },
    headerInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    headerTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    headerSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
        color: Colors.dark.text,
    },
    emptyHint: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
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
        color: Colors.dark.text,
        lineHeight: 22,
    },
    myMessageText: {
        color: '#fff',
    },
    messageTime: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
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
        color: Colors.dark.text,
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
        color: Colors.dark.text,
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
