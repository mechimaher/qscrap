import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants';

let socket: Socket | null = null;

export const initSocket = async (): Promise<Socket | null> => {
    if (socket?.connected) return socket;

    const token = await AsyncStorage.getItem('token');
    if (!token) return null;

    socket = io(API_CONFIG.SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', async () => {
        console.log('Socket connected:', socket?.id);
        // Join user room
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
            const user = JSON.parse(userJson);
            socket?.emit('join_user_room', user.user_id);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
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

// Event listeners
export const onNewBid = (callback: (data: any) => void) => {
    socket?.on('new_bid', callback);
    return () => socket?.off('new_bid', callback);
};

export const onBidAccepted = (callback: (data: any) => void) => {
    socket?.on('bid_accepted', callback);
    return () => socket?.off('bid_accepted', callback);
};

export const onOrderCreated = (callback: (data: any) => void) => {
    socket?.on('order_created', callback);
    return () => socket?.off('order_created', callback);
};

export const onOrderStatusUpdated = (callback: (data: any) => void) => {
    socket?.on('order_status_updated', callback);
    return () => socket?.off('order_status_updated', callback);
};

export const onCounterOfferReceived = (callback: (data: any) => void) => {
    socket?.on('counter_offer_response', callback);
    return () => socket?.off('counter_offer_response', callback);
};

export const onNewMessage = (callback: (data: any) => void) => {
    socket?.on('new_message', callback);
    return () => socket?.off('new_message', callback);
};

export const onGarageCounterOffer = (callback: (data: any) => void) => {
    socket?.on('garage_counter_offer', callback);
    return () => socket?.off('garage_counter_offer', callback);
};

export const onCounterOfferAccepted = (callback: (data: any) => void) => {
    socket?.on('counter_offer_accepted', callback);
    return () => socket?.off('counter_offer_accepted', callback);
};

export const onCounterOfferRejected = (callback: (data: any) => void) => {
    socket?.on('counter_offer_rejected', callback);
    return () => socket?.off('counter_offer_rejected', callback);
};

export const joinTicketRoom = (ticketId: string) => {
    socket?.emit('join_ticket', ticketId);
};

export const joinUserRoom = (userId: string) => {
    socket?.emit('join_user_room', userId);
};

export const leaveTicketRoom = (ticketId: string) => {
    socket?.emit('leave_ticket', ticketId);
};
