// QScrap Socket Service - Real-time Updates for Bids, Orders, Tracking
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SOCKET_URL } from '../config/api';
import { api, Bid, Order } from '../services/api';

// Event Types
interface BidNotification {
    bid_id: string;
    request_id: string;
    garage_name: string;
    bid_amount: number;
    part_condition: string;
    warranty_days: number;
    created_at: string;
}

interface OrderStatusUpdate {
    order_id: string;
    order_number: string;
    old_status: string;
    new_status: string;
    driver_name?: string;
    driver_phone?: string;
}

interface DriverLocationUpdate {
    order_id: string;
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    timestamp: string;
}

// Socket Hook
export function useSocket() {
    const socket = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [newBids, setNewBids] = useState<BidNotification[]>([]);
    const [orderUpdates, setOrderUpdates] = useState<OrderStatusUpdate[]>([]);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const hasShownInitialNotification = useRef(false);

    // Connect to socket server
    const connect = useCallback(async () => {
        try {
            const token = await api.getToken();
            if (!token) {
                console.log('[Socket] No token, skipping connection');
                return;
            }

            // Disconnect existing connection
            if (socket.current?.connected) {
                socket.current.disconnect();
            }

            socket.current = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });

            // Connection events
            socket.current.on('connect', () => {
                console.log('[Socket] Connected:', socket.current?.id);
                setIsConnected(true);
                reconnectAttempts.current = 0;

                // Join customer room for personalized notifications
                socket.current?.emit('join_customer_room');
            });

            socket.current.on('disconnect', (reason) => {
                console.log('[Socket] Disconnected:', reason);
                setIsConnected(false);
                // Clear notifications on disconnect to prevent ghost notifications on re-login
                setNewBids([]);
                setOrderUpdates([]);
                hasShownInitialNotification.current = false;
            });

            socket.current.on('connect_error', (error) => {
                console.log('[Socket] Connection error:', error.message);
                reconnectAttempts.current++;
            });

            // New bid received on your request
            socket.current.on('new_bid', (data: BidNotification) => {
                console.log('[Socket] New bid received:', data.garage_name, data.bid_amount);

                // Validate the bid has required fields before showing
                if (!data.bid_id || !data.request_id || !data.garage_name) {
                    console.log('[Socket] Invalid bid data, skipping notification');
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Add to queue, sorted by amount (lowest first)
                setNewBids(prev => {
                    // Prevent duplicate bids
                    if (prev.some(b => b.bid_id === data.bid_id)) {
                        return prev;
                    }
                    const updated = [...prev, data];
                    return updated.sort((a, b) => a.bid_amount - b.bid_amount);
                });
            });

            // Bid was updated
            socket.current.on('bid_updated', (data: { bid_id: string; bid_amount: number }) => {
                console.log('[Socket] Bid updated:', data.bid_id);
                setNewBids(prev =>
                    prev.map(bid =>
                        bid.bid_id === data.bid_id
                            ? { ...bid, bid_amount: data.bid_amount }
                            : bid
                    ).sort((a, b) => a.bid_amount - b.bid_amount)
                );
            });

            // === COUNTER-OFFER EVENTS ===

            // Garage sent a counter-offer
            socket.current.on('garage_counter_offer', (data: any) => {
                console.log('[Socket] Garage counter-offer:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });

            // Counter-offer accepted by garage
            socket.current.on('counter_offer_accepted', (data: any) => {
                console.log('[Socket] Counter-offer accepted:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });

            // Counter-offer rejected by garage
            socket.current.on('counter_offer_rejected', (data: any) => {
                console.log('[Socket] Counter-offer rejected:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            });

            // === ORDER EVENTS ===

            // Order status changed
            socket.current.on('order_status_updated', (data: OrderStatusUpdate) => {
                console.log('[Socket] Order status updated:', data.order_number, data.new_status);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                setOrderUpdates(prev => {
                    // Replace if exists, otherwise add
                    const filtered = prev.filter(u => u.order_id !== data.order_id);
                    return [data, ...filtered];
                });
            });

            // Driver assigned to your order
            socket.current.on('driver_assigned', (data: { order_id: string; driver_name: string; driver_phone: string }) => {
                console.log('[Socket] Driver assigned:', data.driver_name);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });

            // === TRACKING EVENTS ===

            socket.current.on('driver_location_update', (data: DriverLocationUpdate) => {
                // This is handled by TrackingScreen directly
                console.log('[Socket] Driver location update:', data.order_id);
            });

            // Order delivered
            socket.current.on('order_delivered', (data: { order_id: string; order_number: string }) => {
                console.log('[Socket] Order delivered:', data.order_number);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });

        } catch (error) {
            console.error('[Socket] Setup error:', error);
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (socket.current) {
            socket.current.disconnect();
            socket.current = null;
        }
        setIsConnected(false);
    }, []);

    // Track specific order for location updates
    const trackOrder = useCallback((orderId: string) => {
        if (socket.current?.connected) {
            socket.current.emit('track_order', { order_id: orderId });
        }
    }, []);

    // Stop tracking order
    const stopTrackingOrder = useCallback((orderId: string) => {
        if (socket.current?.connected) {
            socket.current.emit('stop_tracking_order', { order_id: orderId });
        }
    }, []);

    // Clear bid notifications for a request
    const clearBidsForRequest = useCallback((requestId: string) => {
        setNewBids(prev => prev.filter(bid => bid.request_id !== requestId));
    }, []);

    // Clear order update notification
    const clearOrderUpdate = useCallback((orderId: string) => {
        setOrderUpdates(prev => prev.filter(update => update.order_id !== orderId));
    }, []);

    // Dismiss a specific bid notification
    const dismissBid = useCallback((bidId: string) => {
        setNewBids(prev => prev.filter(bid => bid.bid_id !== bidId));
    }, []);

    // Clear all notifications (for logout)
    const clearAllNotifications = useCallback(() => {
        setNewBids([]);
        setOrderUpdates([]);
        hasShownInitialNotification.current = false;
    }, []);

    // Handle app state changes (reconnect when app becomes active)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && !socket.current?.connected) {
                console.log('[Socket] App active, reconnecting...');
                connect();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [connect]);

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        socket: socket.current,
        isConnected,
        newBids,
        orderUpdates,
        connect,
        disconnect,
        trackOrder,
        stopTrackingOrder,
        clearBidsForRequest,
        clearOrderUpdate,
        dismissBid,
        clearAllNotifications,
    };
}

// Socket Context for app-wide access
import React, { createContext, useContext, ReactNode } from 'react';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    newBids: BidNotification[];
    orderUpdates: OrderStatusUpdate[];
    trackOrder: (orderId: string) => void;
    stopTrackingOrder: (orderId: string) => void;
    clearBidsForRequest: (requestId: string) => void;
    clearOrderUpdate: (orderId: string) => void;
    dismissBid: (bidId: string) => void;
    clearAllNotifications: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
    const socketState = useSocket();

    return (
        <SocketContext.Provider value={socketState}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocketContext() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocketContext must be used within a SocketProvider');
    }
    return context;
}
