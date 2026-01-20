// QScrap Driver App - Socket Service
// Real-time communication for assignments, chat, and status updates

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '../config/api';
import { scheduleLocalNotification } from './notifications';

// Get socket URL from API URL (same server)
const SOCKET_URL = API_BASE_URL.replace('/api', '');

let socket: Socket | null = null;

export const initSocket = async (): Promise<Socket | null> => {
    if (socket?.connected) return socket;

    const token = await SecureStore.getItemAsync('qscrap_driver_token');
    if (!token) {
        console.log('[Socket] No token, skipping connection');
        return null;
    }

    console.log('[Socket] Connecting to:', SOCKET_URL);

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
    });

    socket.on('connect', async () => {
        console.log('[Socket] Connected:', socket?.id);

        // Join driver room for targeted notifications
        const driverJson = await SecureStore.getItemAsync('qscrap_driver_user');
        if (driverJson) {
            try {
                const driver = JSON.parse(driverJson);
                socket?.emit('join_driver_room', driver.user_id);
                console.log('[Socket] Joined driver room:', driver.user_id);
            } catch (e) {
                console.error('[Socket] Failed to parse driver:', e);
            }
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    // ==============================
    // ASSIGNMENT EVENTS WITH NOTIFICATIONS
    // ==============================

    socket.on('new_assignment', (data: any) => {
        console.log('[Socket] New assignment received:', data.order_number);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        scheduleLocalNotification(
            '🚚 New Delivery Assignment!',
            data.pickup_address
                ? `Pickup from: ${data.pickup_address}`
                : `Order #${data.order_number || 'New'} - Tap to view details`,
            {
                type: 'new_assignment',
                assignmentId: data.assignment_id,
                orderId: data.order_id,
            }
        );
    });

    socket.on('assignment_updated', (data: any) => {
        console.log('[Socket] Assignment updated:', data.assignment_id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    socket.on('assignment_cancelled', (data: any) => {
        console.log('[Socket] Assignment cancelled:', data.assignment_id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        scheduleLocalNotification(
            '❌ Assignment Cancelled',
            data.reason || `Order #${data.order_number || 'Unknown'} has been cancelled`,
            {
                type: 'assignment_cancelled',
                assignmentId: data.assignment_id,
            }
        );
    });

    socket.on('assignment_removed', (data: any) => {
        console.log('[Socket] Assignment removed:', data.assignment_id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        scheduleLocalNotification(
            '⚠️ Assignment Reassigned',
            data.message || 'Your assignment has been reassigned to another driver',
            {
                type: 'assignment_removed',
                assignmentId: data.assignment_id,
            }
        );
    });

    // ==============================
    // CHAT EVENTS WITH NOTIFICATIONS
    // ==============================

    socket.on('new_message', (data: any) => {
        console.log('[Socket] New message:', data.message_id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    socket.on('chat_notification', (data: any) => {
        console.log('[Socket] Chat notification:', data.order_number);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        scheduleLocalNotification(
            '💬 Customer Message',
            data.message || 'You have a new message',
            {
                type: 'chat_message',
                orderId: data.order_id,
                orderNumber: data.order_number,
            }
        );
    });

    socket.on('chat_message', (data: any) => {
        console.log('[Socket] Chat message received:', data.message_id);
        if (data.sender_type === 'customer') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    });

    // ==============================
    // STATUS UPDATE LISTENERS
    // ==============================

    socket.on('driver_status_changed', (data: any) => {
        console.log('[Socket] Driver status changed:', data.status);
    });

    return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
    if (socket) {
        console.log('[Socket] Disconnecting');
        socket.disconnect();
        socket = null;
    }
};

// ==============================
// ASSIGNMENT EVENTS (legacy callbacks)
// ==============================

export const onNewAssignment = (callback: (data: any) => void) => {
    socket?.on('new_assignment', callback);
    return () => socket?.off('new_assignment', callback);
};

export const onAssignmentUpdated = (callback: (data: any) => void) => {
    socket?.on('assignment_updated', callback);
    return () => socket?.off('assignment_updated', callback);
};

export const onAssignmentCancelled = (callback: (data: any) => void) => {
    socket?.on('assignment_cancelled', callback);
    return () => socket?.off('assignment_cancelled', callback);
};

export const onAssignmentRemoved = (callback: (data: any) => void) => {
    socket?.on('assignment_removed', callback);
    return () => socket?.off('assignment_removed', callback);
};

// ==============================
// CHAT EVENTS
// ==============================

export const onNewMessage = (callback: (data: any) => void) => {
    socket?.on('new_message', callback);
    return () => socket?.off('new_message', callback);
};

export const joinChatRoom = (orderId: string) => {
    // Join via both methods to ensure we receive messages
    socket?.emit('join_order_chat', { order_id: orderId });  // Match customer app format
    socket?.emit('join_room', `order_${orderId}`);           // Direct room join
    console.log('[Socket] Joined chat room:', orderId);
};

export const leaveChatRoom = (orderId: string) => {
    socket?.emit('leave_order_chat', { order_id: orderId });
    // Note: Socket.IO auto-leaves rooms on disconnect, no need to explicitly leave
};

// sendChatMessage removed (use REST API)

// ==============================
// STATUS UPDATE LISTENERS  
// ==============================

export const onDriverStatusChanged = (callback: (data: any) => void) => {
    socket?.on('driver_status_changed', callback);
    return () => socket?.off('driver_status_changed', callback);
};

// ==============================
// NOTIFICATION HELPERS
// ==============================

export const emitLocationUpdate = (lat: number, lng: number, orderId?: string) => {
    socket?.emit('driver_location', { lat, lng, order_id: orderId });
};

