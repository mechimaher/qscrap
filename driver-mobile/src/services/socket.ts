// QScrap Driver App - Socket Service
// Real-time communication for assignments, chat, and status updates

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

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
// ASSIGNMENT EVENTS
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
    socket?.emit('join_order_chat', orderId);
    console.log('[Socket] Joined chat room:', orderId);
};

export const leaveChatRoom = (orderId: string) => {
    socket?.emit('leave_order_chat', orderId);
};

export const sendChatMessage = (data: {
    order_id: string;
    message: string;
    sender_type: 'driver';
}) => {
    socket?.emit('send_message', data);
};

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
