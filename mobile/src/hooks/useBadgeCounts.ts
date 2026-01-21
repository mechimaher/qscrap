/**
 * useBadgeCounts Hook
 * Real-time badge counts for tab bar like Talabat/Keeta
 * 
 * Features:
 * - Fetches badge counts on mount
 * - Real-time updates via WebSocket
 * - Auto-refresh on app focus
 */
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../services/api';
import { useSocketContext } from './useSocket';

export interface BadgeCounts {
    requests: {
        active: number;
        with_bids: number;
        pending_action: number;
    };
    orders: {
        active: number;
        pending_payment: number;
        in_transit: number;
        pending_confirmation: number;
    };
    notifications: {
        unread: number;
    };
    total_badge: number;
}

const DEFAULT_COUNTS: BadgeCounts = {
    requests: { active: 0, with_bids: 0, pending_action: 0 },
    orders: { active: 0, pending_payment: 0, in_transit: 0, pending_confirmation: 0 },
    notifications: { unread: 0 },
    total_badge: 0,
};

export function useBadgeCounts() {
    const [counts, setCounts] = useState<BadgeCounts>(DEFAULT_COUNTS);
    const [isLoading, setIsLoading] = useState(true);
    const { socket } = useSocketContext();

    const fetchBadgeCounts = useCallback(async () => {
        try {
            const response = await api.request<any>('/notifications/badge-counts');
            if (response.success) {
                setCounts({
                    requests: response.requests || DEFAULT_COUNTS.requests,
                    orders: response.orders || DEFAULT_COUNTS.orders,
                    notifications: response.notifications || DEFAULT_COUNTS.notifications,
                    total_badge: response.total_badge || 0,
                });
            }
        } catch (error) {
            console.log('[BadgeCounts] Failed to fetch:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchBadgeCounts();
    }, [fetchBadgeCounts]);

    // Refresh on app focus (coming back from background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                fetchBadgeCounts();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [fetchBadgeCounts]);

    // Real-time updates via WebSocket
    useEffect(() => {
        if (!socket) return;

        const handleNewBid = () => {
            // Increment requests badge
            setCounts(prev => ({
                ...prev,
                requests: {
                    ...prev.requests,
                    with_bids: prev.requests.with_bids + 1,
                },
                total_badge: prev.total_badge + 1,
            }));
        };

        const handleOrderUpdate = () => {
            // Refresh counts on order status change
            fetchBadgeCounts();
        };

        const handleCounterOffer = () => {
            // Increment pending action
            setCounts(prev => ({
                ...prev,
                requests: {
                    ...prev.requests,
                    pending_action: prev.requests.pending_action + 1,
                },
                total_badge: prev.total_badge + 1,
            }));
        };

        const handleNotification = () => {
            // Increment notification badge
            setCounts(prev => ({
                ...prev,
                notifications: {
                    unread: prev.notifications.unread + 1,
                },
                total_badge: prev.total_badge + 1,
            }));
        };

        socket.on('new_bid', handleNewBid);
        socket.on('order_status_update', handleOrderUpdate);
        socket.on('garage_counter_offer', handleCounterOffer);
        socket.on('notification', handleNotification);

        return () => {
            socket.off('new_bid', handleNewBid);
            socket.off('order_status_update', handleOrderUpdate);
            socket.off('garage_counter_offer', handleCounterOffer);
            socket.off('notification', handleNotification);
        };
    }, [socket, fetchBadgeCounts]);

    // Calculate individual tab badges
    const requestsBadge = counts.requests.with_bids + counts.requests.pending_action;
    const ordersBadge = counts.orders.pending_payment + counts.orders.pending_confirmation;
    const profileBadge = counts.notifications.unread;

    return {
        counts,
        isLoading,
        refresh: fetchBadgeCounts,
        // Tab-specific badges
        requestsBadge: requestsBadge > 0 ? requestsBadge : undefined,
        ordersBadge: ordersBadge > 0 ? ordersBadge : undefined,
        profileBadge: profileBadge > 0 ? profileBadge : undefined,
    };
}

export default useBadgeCounts;
