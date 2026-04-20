/**
 * useLoyalty - Centralized loyalty data hook
 * 
 * Eliminates duplicate loyalty API calls across HomeScreen, PaymentScreen, etc.
 * Caches data in memory so re-renders don't trigger new fetches.
 * Provides refresh capability for manual updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { log } from '../utils/logger';

// Tier discount percentages
const TIER_DISCOUNTS: Record<string, number> = {
    bronze: 0,
    silver: 5,
    gold: 10,
    platinum: 15,
};

export interface LoyaltyData {
    points: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    lifetime_points: number;
    points_to_next_tier: number;
    discountPercentage: number;
}

// Module-level cache to prevent duplicate fetches across components
let cachedData: LoyaltyData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

const isCacheValid = (): boolean => {
    return cachedData !== null && (Date.now() - cacheTimestamp) < CACHE_TTL;
};

export const useLoyalty = () => {
    const [data, setData] = useState<LoyaltyData | null>(cachedData);
    const [loading, setLoading] = useState(!isCacheValid());
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchLoyalty = useCallback(async (force = false) => {
        // Use cache if valid and not forced
        if (!force && isCacheValid() && cachedData) {
            setData(cachedData);
            setLoading(false);
            return cachedData;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.getLoyaltyBalance();
            const tierKey = response.tier.toLowerCase();
            const loyaltyData: LoyaltyData = {
                points: response.points,
                tier: response.tier,
                lifetime_points: response.lifetime_points,
                points_to_next_tier: response.points_to_next_tier,
                discountPercentage: TIER_DISCOUNTS[tierKey] || 0,
            };

            // Update module-level cache
            cachedData = loyaltyData;
            cacheTimestamp = Date.now();

            if (isMounted.current) {
                setData(loyaltyData);
                setLoading(false);
            }

            return loyaltyData;
        } catch (err) {
            log('[Loyalty] Failed to fetch:', err);
            const fallback: LoyaltyData = {
                points: 0,
                tier: 'bronze',
                lifetime_points: 0,
                points_to_next_tier: 100,
                discountPercentage: 0,
            };

            if (isMounted.current) {
                setData(fallback);
                setError('Failed to load loyalty data');
                setLoading(false);
            }

            return fallback;
        }
    }, []);

    // Auto-fetch on mount
    useEffect(() => {
        fetchLoyalty();
    }, [fetchLoyalty]);

    return {
        /** Loyalty data (null while loading for first time) */
        loyalty: data,
        /** Whether data is currently being fetched */
        loading,
        /** Error message if fetch failed */
        error,
        /** Force refresh loyalty data from API */
        refresh: () => fetchLoyalty(true),
        /** Invalidate cache (call after redeeming points) */
        invalidate: () => {
            cachedData = null;
            cacheTimestamp = 0;
        },
    };
};

export default useLoyalty;
