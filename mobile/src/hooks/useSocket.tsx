import { log, warn, error as logError } from '../utils/logger';
// QScrap Socket Service - Real-time Updates for Bids, Orders, Tracking
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SOCKET_URL } from '../config/api';
import { api, Bid, Order } from '../services/api';
import { t } from '../utils/i18nHelper';

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
                log('[Socket] No token, skipping connection');
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
                log('[Socket] Connected:', socket.current?.id);
                setIsConnected(true);
                reconnectAttempts.current = 0;

                // Join customer room for personalized notifications
                socket.current?.emit('join_customer_room');
            });

            socket.current.on('disconnect', (reason) => {
                log('[Socket] Disconnected:', reason);
                setIsConnected(false);
                // Clear notifications on disconnect to prevent ghost notifications on re-login
                setNewBids([]);
                setOrderUpdates([]);
                hasShownInitialNotification.current = false;
            });

            socket.current.on('connect_error', (error) => {
                log('[Socket] Connection error:', error.message);
                reconnectAttempts.current++;
            });

            // New bid received on your request
            socket.current.on('new_bid', (data: BidNotification) => {
                log('[Socket] New bid received:', data.garage_name, data.bid_amount);

                // Validate the bid has required fields before showing
                if (!data.bid_id || !data.request_id || !data.garage_name) {
                    log('[Socket] Invalid bid data, skipping notification');
                    return;
                }

                // Check if bid is too old (ghost notification from reconnect)
                // If bid is older than 5 minutes, ignore it for alerts
                const bidTime = new Date(data.created_at).getTime();
                const now = new Date().getTime();
                const isOld = (now - bidTime) > 5 * 60 * 1000; // 5 minutes

                if (isOld) {
                    log('[Socket] Skipping old bid notification:', data.bid_id);
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Schedule rich local notification for background/locked phone
                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const conditionLabel = data.part_condition
                        ?.replace('used_', 'Used ')
                        ?.replace('_', ' ')
                        ?.replace(/\b\w/g, c => c.toUpperCase()) || 'Used';

                    const currency = t('common.currency');
                    const body = data.warranty_days
                        ? t('notifications.push.newBidBodyWarranty', { garage: data.garage_name, condition: conditionLabel, days: data.warranty_days })
                        : t('notifications.push.newBidBody', { garage: data.garage_name, condition: conditionLabel });

                    scheduleLocalNotification(
                        `${t('notifications.push.newBidTitle', { amount: data.bid_amount, currency })}`,
                        body,
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
                log('[Socket] Bid updated:', data.bid_id, data.bid_amount);

                // Only show notification if bid_amount is provided (actual price change)
                // Skip notification when bid_updated is used as just a refresh trigger
                if (data.bid_amount !== undefined && data.bid_amount !== null) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        const currency = t('common.currency');
                        scheduleLocalNotification(
                            `${t('notifications.push.bidUpdatedTitle')}`,
                            t('notifications.push.bidUpdatedBody', { amount: data.bid_amount ?? 0, currency }),
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
                log('[Socket] Garage counter-offer:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const currency = t('common.currency');
                    scheduleLocalNotification(
                        `${t('notifications.push.counterOfferTitle')}`,
                        data.notification || t('notifications.push.counterOfferBody', { amount: data.proposed_amount, currency }),
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
                log('[Socket] Counter-offer accepted:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const currency = t('common.currency');
                    scheduleLocalNotification(
                        `${t('notifications.push.offerAcceptedTitle')}`,
                        data.notification || t('notifications.push.offerAcceptedBody', { amount: data.agreed_amount, currency }),
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
                log('[Socket] Counter-offer rejected:', data);

                if (data.is_final_round) {
                    // Final round rejection - more urgent notification
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                    // Show rich notification guiding customer to accept or decline
                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        const currency = t('common.currency');
                        scheduleLocalNotification(
                            `${t('notifications.push.finalOfferTitle')}`,
                            data.notification || t('notifications.push.finalOfferBody', { amount: data.original_bid_amount, currency }),
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
                log('[Socket] Order status updated:', data.order_number, data.new_status);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Schedule rich local notification for background/locked phone
                const garageName = data.garage_name || 'Garage';
                const statusMessages: Record<string, { title: string; body: string }> = {
                    'preparing': {
                        title: t('notifications.push.preparingTitle'),
                        body: t('notifications.push.preparingBody', { garage: garageName })
                    },
                    'ready_for_pickup': {
                        title: t('notifications.push.readyTitle'),
                        body: t('notifications.push.readyBody', { garage: garageName })
                    },
                    'collected': {
                        title: t('notifications.push.collectedTitle'),
                        body: t('notifications.push.collectedBody')
                    },
                    'qc_passed': {
                        title: t('notifications.push.qcPassedTitle'),
                        body: t('notifications.push.qcPassedBody')
                    },
                    'in_transit': {
                        title: t('notifications.push.inTransitTitle'),
                        body: data.driver_name
                            ? t('notifications.push.inTransitBodyDriver', { driver: data.driver_name })
                            : t('notifications.push.inTransitBody')
                    },
                    'delivered': {
                        title: t('notifications.push.deliveredTitle'),
                        body: t('notifications.push.deliveredBody')
                    },
                };

                const statusInfo = statusMessages[data.new_status];
                if (statusInfo) {
                    import('../services/notifications').then(({ scheduleLocalNotification }) => {
                        scheduleLocalNotification(
                            `QScrap | ${statusInfo.title}`,
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
                log('[Socket] Driver assigned:', data.driver?.name);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        `${t('notifications.push.driverAssignedTitle')}`,
                        data.driver?.name
                            ? t('notifications.push.driverAssignedBodyDriver', { driver: data.driver.name })
                            : t('notifications.push.driverAssignedBody'),
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
                log('[Socket] Driver location update:', data.order_id);
            });

            // Order delivered
            socket.current.on('order_delivered', (data: { order_id: string; order_number: string }) => {
                log('[Socket] Order delivered:', data.order_number);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        `${t('notifications.push.packageDeliveredTitle')}`,
                        t('notifications.push.packageDeliveredBody', { orderNumber: data.order_number }),
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
                log('[Socket] Request expired:', data.request_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        `${t('notifications.push.requestExpiredTitle')}`,
                        data.part_description
                            ? t('notifications.push.requestExpiredBodyPart', { part: data.part_description })
                            : t('notifications.push.requestExpiredBody'),
                        {
                            type: 'request_expired',
                            requestId: data.request_id,
                        }
                    );
                });
            });

            // Garage withdrew their bid
            socket.current.on('bid_withdrawn', (data: { request_id: string; message?: string }) => {
                log('[Socket] Bid withdrawn:', data.request_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        `${t('notifications.push.bidWithdrawnTitle')}`,
                        data.message || t('notifications.push.bidWithdrawnBody'),
                        {
                            type: 'bid_withdrawn',
                            requestId: data.request_id,
                        }
                    );
                });
            });

            // Support team replied to your ticket
            socket.current.on('support_reply', (data: { ticket_id: string; message?: any }) => {
                log('[Socket] Support reply:', data.ticket_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    scheduleLocalNotification(
                        `${t('notifications.push.supportReplyTitle')}`,
                        data.message?.content || t('notifications.push.supportReplyBody'),
                        {
                            type: 'support_reply',
                            ticketId: data.ticket_id,
                        }
                    );
                });
            });

            // Order was cancelled
            socket.current.on('order_cancelled', (data: { order_id: string; order_number?: string; reason?: string; cancelled_by?: string }) => {
                log('[Socket] Order cancelled:', data.order_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const cancelledBy = data.cancelled_by === 'garage'
                        ? t('notifications.push.theGarage')
                        : t('notifications.push.yourOrder');
                    scheduleLocalNotification(
                        `${t('notifications.push.orderCancelledTitle')}`,
                        data.reason
                            ? t('notifications.push.orderCancelledBodyReason', { cancelledBy, reason: data.reason })
                            : t('notifications.push.orderCancelledBody', { orderNumber: data.order_number || 'N/A' }),
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
                log('[Socket] Chat notification:', data.order_number);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Vibrate so user notices even with phone on desk
                import('react-native').then(({ Vibration }) => {
                    Vibration.vibrate([0, 200, 100, 200]);
                });

                import('../services/notifications').then(({ scheduleLocalNotification }) => {
                    const senderLabel = data.sender_type === 'driver'
                        ? `${t('notifications.push.chatDriverLabel')}`
                        : `${t('notifications.push.chatGarageLabel')}`;
                    scheduleLocalNotification(
                        senderLabel,
                        data.message || t('notifications.push.chatDefaultBody'),
                        {
                            type: 'chat_message',
                            orderId: data.order_id,
                            orderNumber: data.order_number,
                        },
                        undefined,
                        'messages'
                    );
                });
            });

        } catch (error) {
            logError('[Socket] Setup error:', error);
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
                    log('[Socket] No token on app active - disconnecting...');
                    disconnect();
                    clearAllNotifications();
                    return;
                }

                // User still logged in - reconnect if needed
                if (!socket.current?.connected) {
                    log('[Socket] App active, reconnecting...');
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
