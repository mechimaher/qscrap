import { log, warn, error as logError } from '../utils/logger';
/**
 * BadgeCountsContext
 * Provides shared badge counts across the entire app
 * Fixes: Profile tab badge not clearing when notifications are read
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
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

interface BadgeCountsContextValue {
    counts: BadgeCounts;
    isLoading: boolean;
    refresh: () => Promise<void>;
    requestsBadge: number | undefined;
    ordersBadge: number | undefined;
    profileBadge: number | undefined;
}

const BadgeCountsContext = createContext<BadgeCountsContextValue>({
    counts: DEFAULT_COUNTS,
    isLoading: true,
    refresh: async () => { },
    requestsBadge: undefined,
    ordersBadge: undefined,
    profileBadge: undefined,
});

export function BadgeCountsProvider({ children }: { children: ReactNode }) {
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
            log('[BadgeCounts] Failed to fetch:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBadgeCounts();
    }, [fetchBadgeCounts]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                fetchBadgeCounts();
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [fetchBadgeCounts]);

    useEffect(() => {
        if (!socket) return;

        const handleNewBid = () => {
            setCounts(prev => ({
                ...prev,
                requests: { ...prev.requests, with_bids: prev.requests.with_bids + 1 },
                total_badge: prev.total_badge + 1,
            }));
        };

        const handleOrderUpdate = () => fetchBadgeCounts();

        const handleCounterOffer = () => {
            setCounts(prev => ({
                ...prev,
                requests: { ...prev.requests, pending_action: prev.requests.pending_action + 1 },
                total_badge: prev.total_badge + 1,
            }));
        };

        const handleNotification = () => {
            setCounts(prev => ({
                ...prev,
                notifications: { unread: prev.notifications.unread + 1 },
                total_badge: prev.total_badge + 1,
            }));
        };

        // Gap 1 Fix: order_status_updated (not order_status_update)
        // Gap 2 Fix: Added bid_withdrawn listener
        const handleBidWithdrawn = () => {
            setCounts(prev => ({
                ...prev,
                requests: { ...prev.requests, with_bids: Math.max(0, prev.requests.with_bids - 1) },
            }));
        };

        socket.on('new_bid', handleNewBid);
        socket.on('order_status_updated', handleOrderUpdate); // FIXED: was order_status_update
        socket.on('garage_counter_offer', handleCounterOffer);
        socket.on('notification', handleNotification);
        socket.on('bid_withdrawn', handleBidWithdrawn); // NEW: Gap 2 fix

        return () => {
            socket.off('new_bid', handleNewBid);
            socket.off('order_status_updated', handleOrderUpdate);
            socket.off('garage_counter_offer', handleCounterOffer);
            socket.off('notification', handleNotification);
            socket.off('bid_withdrawn', handleBidWithdrawn);
        };
    }, [socket, fetchBadgeCounts]);

    const requestsBadge = counts.requests.with_bids + counts.requests.pending_action;
    const ordersBadge = counts.orders.pending_payment + counts.orders.pending_confirmation;
    const profileBadge = counts.notifications.unread;

    const value: BadgeCountsContextValue = {
        counts,
        isLoading,
        refresh: fetchBadgeCounts,
        requestsBadge: requestsBadge > 0 ? requestsBadge : undefined,
        ordersBadge: ordersBadge > 0 ? ordersBadge : undefined,
        profileBadge: profileBadge > 0 ? profileBadge : undefined,
    };

    return (
        <BadgeCountsContext.Provider value={value}>
            {children}
        </BadgeCountsContext.Provider>
    );
}

export function useBadgeCounts() {
    return useContext(BadgeCountsContext);
}

export default useBadgeCounts;
