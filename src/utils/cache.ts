/**
 * QScrap Cache Utility
 * 
 * Provides type-safe caching operations with automatic JSON serialization.
 * Falls back gracefully when Redis is not available.
 * 
 * ENTERPRISE FEATURE: Cache versioning ensures stale data is never served
 * when schema changes. Increment version when adding/removing cached fields.
 */

import { getRedisClient } from '../config/redis';
import logger from './logger';

// ============================================
// CACHE VERSIONING (Increment when schema changes)
// ============================================

/**
 * CACHE VERSION - Increment this when cached data structure changes
 * This ensures old cache is automatically invalidated on deploy
 * 
 * Version History:
 * v1 - Initial cache structure
 * v2 - Added loyalty_discount fields to dashboard stats (2026-01-26)
 */
const CACHE_VERSION = 'v2';

// ============================================
// CACHE CONFIGURATION
// ============================================

/** Default TTL values in seconds */
export const CacheTTL = {
    SHORT: 60,           // 1 minute - for rapidly changing data
    MEDIUM: 300,         // 5 minutes - for dashboard stats
    LONG: 3600,          // 1 hour - for reference data
    DAY: 86400,          // 24 hours - for rarely changing data
} as const;

/** Cache key prefixes for organization - all include version */
export const CachePrefix = {
    DASHBOARD: `${CACHE_VERSION}:dash:`,
    GARAGE: `${CACHE_VERSION}:garage:`,
    USER: `${CACHE_VERSION}:user:`,
    REQUEST: `${CACHE_VERSION}:req:`,
    ORDER: `${CACHE_VERSION}:order:`,
    STATS: `${CACHE_VERSION}:stats:`,
} as const;

// ============================================
// CORE CACHE OPERATIONS
// ============================================

/**
 * Get a cached value, with automatic JSON parsing
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const value = await client.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
    } catch (err) {
        logger.warn('Cache get failed', { key, error: (err as Error).message });
        return null;
    }
}

/**
 * Set a cached value with TTL (default: 5 minutes)
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = CacheTTL.MEDIUM): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.setEx(key, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (err) {
        logger.warn('Cache set failed', { key, error: (err as Error).message });
        return false;
    }
}

/**
 * Delete a cached value
 */
export async function cacheDel(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.del(key);
        return true;
    } catch (err) {
        logger.warn('Cache del failed', { key, error: (err as Error).message });
        return false;
    }
}

/**
 * Delete all keys matching a pattern (e.g., "dash:*")
 * Use carefully - KEYS command can be slow on large datasets
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
    const client = getRedisClient();
    if (!client) return 0;

    try {
        const keys = await client.keys(pattern);
        if (keys.length === 0) return 0;

        await client.del(keys);
        logger.debug('Cache pattern invalidated', { pattern, count: keys.length });
        return keys.length;
    } catch (err) {
        logger.warn('Cache pattern invalidate failed', { pattern, error: (err as Error).message });
        return 0;
    }
}

// ============================================
// CACHE-ASIDE PATTERN (STALE-WHILE-REVALIDATE)
// ============================================

/**
 * Get cached value, or compute and cache if missing
 * This is the primary caching pattern for most use cases
 */
export async function cacheGetOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
    // Try cache first
    const cached = await cacheGet<T>(key);
    if (cached !== null) {
        return cached;
    }

    // Cache miss - fetch fresh data
    const freshData = await fetchFn();

    // Cache in background (don't await)
    cacheSet(key, freshData, ttlSeconds).catch(() => {
        // Errors already logged in cacheSet
    });

    return freshData;
}

// ============================================
// SPECIALIZED CACHE HELPERS
// ============================================

/**
 * Cache key builder for dashboard stats
 */
export function dashboardStatsKey(userId?: string): string {
    return `${CachePrefix.DASHBOARD}stats${userId ? `:${userId}` : ''}`;
}

/**
 * Cache key builder for garage profile
 */
export function garageProfileKey(garageId: string): string {
    return `${CachePrefix.GARAGE}profile:${garageId}`;
}

/**
 * Cache key builder for user profile
 */
export function userProfileKey(userId: string): string {
    return `${CachePrefix.USER}profile:${userId}`;
}

/**
 * Invalidate all dashboard caches (call after order/request changes)
 */
export async function invalidateDashboardCache(): Promise<void> {
    await cacheInvalidatePattern(`${CachePrefix.DASHBOARD}*`);
}

/**
 * Invalidate garage-specific caches
 */
export async function invalidateGarageCache(garageId: string): Promise<void> {
    await cacheDel(garageProfileKey(garageId));
}
