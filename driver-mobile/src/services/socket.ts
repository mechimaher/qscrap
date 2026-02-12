// QScrap Driver App - Socket Service
// Real-time communication for assignments, chat, and status updates

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { scheduleLocalNotification } from './notifications';
import { playAssignmentAlert, initSoundService } from './SoundService';

// Get socket URL from API URL (same server)
const SOCKET_URL = API_BASE_URL.replace('/api', '');

let socket: Socket | null = null;

export const initSocket = async (): Promise<Socket | null> => {
    if (socket?.connected) return socket;

    const token = await SecureStore.getItemAsync('qscrap_driver_token');
    if (!token) {
        return null;
    }


    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
    });

    socket.on('connect', async () => {

        // Join driver room for targeted notifications
        const driverJson = await SecureStore.getItemAsync('qscrap_driver_user');
        if (driverJson) {
            try {
                const driver = JSON.parse(driverJson);
                socket?.emit('join_driver_room', driver.user_id);
            } catch (e) {
                console.error('[Socket] Failed to parse driver:', e);
            }
        }

        // Auto-join chat rooms for active assignments (FIX: receive messages when chat closed)
        const activeOrdersJson = await SecureStore.getItemAsync('qscrap_active_orders');
        if (activeOrdersJson) {
            try {
                const activeOrders = JSON.parse(activeOrdersJson);
                if (Array.isArray(activeOrders)) {
                    activeOrders.forEach((orderId: string) => {
                        socket?.emit('join_room', `order_${orderId}`);
                    });
                }
            } catch (e) {
                console.error('[Socket] Failed to parse active orders:', e);
            }
        }
    });

    socket.on('disconnect', (reason) => {
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
    });

    // ==============================
    // ASSIGNMENT EVENTS WITH NOTIFICATIONS
    // ==============================

    socket.on('new_assignment', async (data: any) => {

        // ENTERPRISE ALERT: Play assignment chime (Facebook Messenger-style)
        playAssignmentAlert();

        // Strong haptic feedback - triple notification pattern
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 200);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);

        // Play loud vibration pattern for urgent alert
        Vibration.vibrate([0, 500, 200, 500, 200, 500]); // Three long vibrations

        // Schedule high-priority push notification (visible when phone locked)
        scheduleLocalNotification(
            'NEW DELIVERY ASSIGNMENT!',
            data.order_number
                ? `Order #${data.order_number} — ${data.part_description || data.pickup_address || 'Tap to view'}`
                : `New assignment — URGENT: Tap to view!`,
            {
                type: 'new_assignment',
                assignmentId: data.assignment_id,
                orderId: data.order_id,
            }
        );
    });

    socket.on('assignment_updated', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 250, 250, 250]);

        scheduleLocalNotification(
            'Assignment Updated',
            data.message || `Order #${data.order_number || 'Unknown'} has been updated`,
            {
                type: 'assignment_updated',
                assignmentId: data.assignment_id,
            },
            'status'
        );
    });

    socket.on('assignment_cancelled', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        scheduleLocalNotification(
            'Assignment Cancelled',
            data.reason || `Order #${data.order_number || 'Unknown'} has been cancelled`,
            {
                type: 'assignment_cancelled',
                assignmentId: data.assignment_id,
            }
        );
    });

    socket.on('assignment_removed', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        scheduleLocalNotification(
            'Assignment Reassigned',
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
        // Play sound + vibration for incoming messages
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 200, 100, 200]); // Double short vibration

        // Schedule in-app notification so driver sees it even if not on chat screen
        if (data.sender_type !== 'driver') {
            playAssignmentAlert(); // Reuse chime for now (attention-grabbing)
            scheduleLocalNotification(
                'New Message',
                data.message?.substring(0, 100) || 'You have a new message',
                {
                    type: 'chat_message',
                    orderId: data.order_id,
                },
                'chat'
            );
        }
    });

    socket.on('chat_notification', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 200, 100, 200]);
        playAssignmentAlert();

        scheduleLocalNotification(
            'Customer Message',
            data.message || 'You have a new message',
            {
                type: 'chat_message',
                orderId: data.order_id,
                orderNumber: data.order_number,
            },
            'chat'
        );
    });

    socket.on('chat_message', (data: any) => {
        if (data.sender_type === 'customer') {
            // Customer sent a message — alert the driver with sound + vibration
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate([0, 200, 100, 200]);
            playAssignmentAlert();

            scheduleLocalNotification(
                'Customer Message',
                data.message?.substring(0, 100) || 'Tap to reply',
                {
                    type: 'chat_message',
                    assignmentId: data.assignment_id,
                },
                'chat'
            );
        }
    });

    // ==============================
    // ORDER STATUS EVENTS
    // ==============================

    socket.on('order_status_updated', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 200, 100, 200]);

        scheduleLocalNotification(
            'Order Status Update',
            data.message || `Order #${data.order_number || ''} status changed`,
            {
                type: 'order_status_updated',
                orderId: data.order_id,
            },
            'status'
        );
    });

    // ==============================
    // DRIVER STATUS LISTENERS
    // ==============================

    socket.on('driver_status_changed', (data: any) => {
    });

    return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
    if (socket) {
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
};

export const leaveChatRoom = (orderId: string) => {
    socket?.emit('leave_order_chat', { order_id: orderId });
    // Note: Socket.IO auto-leaves rooms on disconnect, no need to explicitly leave
};

// ==============================
// P2: TYPING INDICATORS
// ==============================

/**
 * Emit typing status to other chat participants
 */
export const emitTyping = (orderId: string, isTyping: boolean) => {
    socket?.emit('typing', {
        order_id: orderId,
        is_typing: isTyping,
        sender_type: 'driver'
    });
};

/**
 * Listen for typing events from other participants
 */
export const onTypingStatus = (callback: (data: { order_id: string; is_typing: boolean; sender_type: string; sender_name?: string }) => void) => {
    socket?.on('typing', callback);
    return () => socket?.off('typing', callback);
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

// ==============================
// ACTIVE ORDERS MANAGEMENT (for real-time chat)
// ==============================

/**
 * Update and save active order IDs, then join their chat rooms
 * Call this when assignments are loaded or updated
 */
export const updateActiveOrders = async (orderIds: string[]) => {
    try {
        // Save to secure storage for reconnection
        await SecureStore.setItemAsync('qscrap_active_orders', JSON.stringify(orderIds));

        // Join chat rooms for each order
        orderIds.forEach((orderId) => {
            socket?.emit('join_room', `order_${orderId}`);
        });
    } catch (e) {
        console.error('[Socket] Failed to update active orders:', e);
    }
};

/**
 * Clear active orders on logout
 */
export const clearActiveOrders = async () => {
    try {
        await SecureStore.deleteItemAsync('qscrap_active_orders');
    } catch (e) {
        console.error('[Socket] Failed to clear active orders:', e);
    }
};
