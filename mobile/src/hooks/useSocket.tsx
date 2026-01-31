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

                // Check if bid is too old (ghost notification from reconnect)
                // If bid is older than 5 minutes, ignore it for alerts
                const bidTime = new Date(data.created_at).getTime();
                const now = new Date().getTime();
                const isOld = (now - bidTime) > 5 * 60 * 1000; // 5 minutes

                if (isOld) {
                    console.log('[Socket] Skipping old bid notification:', data.bid_id);
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Schedule rich local notification for background/locked phone
                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const conditionLabel = data.part_condition
                        ?.replace('used_', 'Used ')
                        ?.replace('_', ' ')
                        ?.replace(/\b\w/g, c => c.toUpperCase()) || 'Used';

                    scheduleLocalNotification(
                        `💰 New Bid: ${data.bid_amount} QAR`,
                        `${data.garage_name} • ${conditionLabel}${data.warranty_days ? ` • ${data.warranty_days} days warranty` : ''}`,
                        {
                            type: 'new_bid',
                            bidId: data.bid_id,
                            requestId: data.request_id,
                            garageName: data.garage_name,
                            bidAmount: data.bid_amount,
                        }
                    );
                });

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
            socket.current.on('bid_updated', (data: { bid_id: string; bid_amount?: number; request_id?: string }) => {
                console.log('[Socket] Bid updated:', data.bid_id, data.bid_amount);

                // Only show notification if bid_amount is provided (actual price change)
                // Skip notification when bid_updated is used as just a refresh trigger
                if (data.bid_amount !== undefined && data.bid_amount !== null) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        scheduleLocalNotification(
                            '💰 Bid Updated',
                            `A garage revised their offer to ${data.bid_amount} QAR`,
                            {
                                type: 'bid_updated',
                                bidId: data.bid_id,
                                requestId: data.request_id,
                                bidAmount: data.bid_amount,
                            }
                        );
                    });

                    setNewBids(prev =>
                        prev.map(bid =>
                            bid.bid_id === data.bid_id
                                ? { ...bid, bid_amount: data.bid_amount! }
                                : bid
                        ).sort((a, b) => a.bid_amount - b.bid_amount)
                    );
                }
                // If no bid_amount, this is just a refresh trigger - no notification needed
            });

            // === COUNTER-OFFER EVENTS ===

            // Garage sent a counter-offer
            socket.current.on('garage_counter_offer', (data: any) => {
                console.log('[Socket] Garage counter-offer:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '🔄 Counter-Offer Received',
                        data.notification || `Garage proposed ${data.proposed_amount} QAR`,
                        {
                            type: 'counter_offer',
                            bidId: data.bid_id,
                            proposedAmount: data.proposed_amount,
                        }
                    );
                });
            });

            // Counter-offer accepted by garage
            socket.current.on('counter_offer_accepted', (data: any) => {
                console.log('[Socket] Counter-offer accepted:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '✅ Offer Accepted!',
                        data.notification || `Your offer of ${data.agreed_amount} QAR was accepted`,
                        {
                            type: 'counter_offer_accepted',
                            bidId: data.bid_id,
                            agreedAmount: data.agreed_amount,
                        }
                    );
                });
            });

            // Counter-offer rejected by garage
            socket.current.on('counter_offer_rejected', (data: any) => {
                console.log('[Socket] Counter-offer rejected:', data);

                if (data.is_final_round) {
                    // Final round rejection - more urgent notification
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                    // Show rich notification guiding customer to accept or decline
                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        scheduleLocalNotification(
                            '⚠️ Final Offer Decision Needed',
                            data.notification || `Your offer was declined. Accept ${data.original_bid_amount} QAR or choose another bid.`,
                            {
                                type: 'counter_offer_final',
                                bidId: data.bid_id,
                                isFinalRound: true,
                                originalBidAmount: data.original_bid_amount,
                            }
                        );
                    });
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            });

            // === ORDER EVENTS ===

            // Order status changed - Show rich notification with garage branding
            socket.current.on('order_status_updated', (data: OrderStatusUpdate & { garage_name?: string; part_description?: string }) => {
                console.log('[Socket] Order status updated:', data.order_number, data.new_status);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Schedule rich local notification for background/locked phone
                const statusMessages: Record<string, { emoji: string; title: string; body: string }> = {
                    'preparing': {
                        emoji: '🔧',
                        title: 'Part Being Prepared',
                        body: `${data.garage_name || 'Garage'} is preparing your part`
                    },
                    'ready_for_pickup': {
                        emoji: '📦',
                        title: 'Part Ready',
                        body: `Your part from ${data.garage_name || 'the garage'} is ready for collection`
                    },
                    'collected': {
                        emoji: '✅',
                        title: 'Part Collected',
                        body: 'QScrap has collected your part for quality check'
                    },
                    'qc_passed': {
                        emoji: '✨',
                        title: 'Quality Check Passed!',
                        body: 'Your part passed inspection - Ready for delivery'
                    },
                    'in_transit': {
                        emoji: '🚗',
                        title: 'Out for Delivery',
                        body: data.driver_name
                            ? `${data.driver_name} is on the way with your part`
                            : 'Your part is on its way!'
                    },
                    'delivered': {
                        emoji: '🎉',
                        title: 'Part Delivered!',
                        body: 'Your order has been delivered. Enjoy!'
                    },
                };

                const statusInfo = statusMessages[data.new_status];
                if (statusInfo) {
                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        scheduleLocalNotification(
                            `${statusInfo.emoji} QScrap | ${statusInfo.title}`,
                            statusInfo.body,
                            {
                                type: 'order_update',
                                orderId: data.order_id,
                                orderNumber: data.order_number,
                                status: data.new_status,
                                garageName: data.garage_name,
                            }
                        );
                    });
                }

                setOrderUpdates(prev => {
                    // Replace if exists, otherwise add
                    const filtered = prev.filter(u => u.order_id !== data.order_id);
                    return [data, ...filtered];
                });
            });

            // Driver assigned to your order
            socket.current.on('driver_assigned', (data: {
                order_id: string;
                order_number: string;
                driver: { name: string; phone: string; vehicle_type?: string; vehicle_plate?: string };
                estimated_delivery?: string;
                notification: string;
            }) => {
                console.log('[Socket] Driver assigned:', data.driver?.name);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '🚗 Driver Assigned!',
                        data.driver?.name
                            ? `${data.driver.name} is heading to pick up your order`
                            : 'A driver has been assigned to your order',
                        {
                            type: 'driver_assigned',
                            orderId: data.order_id,
                            orderNumber: data.order_number,
                            driverName: data.driver?.name,
                        }
                    );
                });
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

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '🎉 Package Delivered!',
                        `Order #${data.order_number} has arrived. Please confirm receipt.`,
                        {
                            type: 'order_delivered',
                            orderId: data.order_id,
                            orderNumber: data.order_number,
                        }
                    );
                });
            });

            // === ADDITIONAL CRITICAL EVENTS ===

            // Request expired (no bids received in time)
            socket.current.on('request_expired', (data: { request_id: string; part_description?: string }) => {
                console.log('[Socket] Request expired:', data.request_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '⏰ Request Expired',
                        data.part_description
                            ? `Your request for "${data.part_description}" has expired`
                            : 'Your part request has expired. Create a new one to get quotes.',
                        {
                            type: 'request_expired',
                            requestId: data.request_id,
                        }
                    );
                });
            });

            // Garage withdrew their bid
            socket.current.on('bid_withdrawn', (data: { request_id: string; message?: string }) => {
                console.log('[Socket] Bid withdrawn:', data.request_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '📤 Bid Withdrawn',
                        data.message || 'A garage has withdrawn their bid on your request',
                        {
                            type: 'bid_withdrawn',
                            requestId: data.request_id,
                        }
                    );
                });
            });

            // Support team replied to your ticket
            socket.current.on('support_reply', (data: { ticket_id: string; message?: any }) => {
                console.log('[Socket] Support reply:', data.ticket_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        '💬 Support Reply',
                        data.message?.content || 'QScrap support has replied to your ticket',
                        {
                            type: 'support_reply',
                            ticketId: data.ticket_id,
                        }
                    );
                });
            });

            // Order was cancelled
            socket.current.on('order_cancelled', (data: { order_id: string; order_number?: string; reason?: string; cancelled_by?: string }) => {
                console.log('[Socket] Order cancelled:', data.order_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const cancelledBy = data.cancelled_by === 'garage' ? 'The garage' : 'Your order';
                    scheduleLocalNotification(
                        '❌ Order Cancelled',
                        data.reason
                            ? `${cancelledBy} cancelled: ${data.reason}`
                            : `Order #${data.order_number || 'N/A'} has been cancelled`,
                        {
                            type: 'order_cancelled',
                            orderId: data.order_id,
                            orderNumber: data.order_number,
                        }
                    );
                });
            });

            // Chat message notification (when not in chat screen)
            socket.current.on('chat_notification', (data: {
                order_id: string;
                order_number: string;
                sender_type: string;
                message: string;
                notification: string;
            }) => {
                console.log('[Socket] Chat notification:', data.order_number);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const senderLabel = data.sender_type === 'driver' ? '🚗 Driver' : '🔧 Garage';
                    scheduleLocalNotification(
                        `${senderLabel} Message`,
                        data.message || 'You have a new message',
                        {
                            type: 'chat_message',
                            orderId: data.order_id,
                            orderNumber: data.order_number,
                        }
                    );
                });
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

    // Handle app state changes (reconnect when app becomes active, disconnect if logged out)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // Check if user is still logged in
                const token = await api.getToken();
                if (!token) {
                    // User logged out - disconnect socket and clear notifications
                    console.log('[Socket] No token on app active - disconnecting...');
                    disconnect();
                    clearAllNotifications();
                    return;
                }

                // User still logged in - reconnect if needed
                if (!socket.current?.connected) {
                    console.log('[Socket] App active, reconnecting...');
                    connect();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [connect, disconnect, clearAllNotifications]);

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
    connect: () => Promise<void>;
    disconnect: () => void;
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
