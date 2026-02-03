import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

/**
 * Cache Service - High-level caching abstraction
 * Compatible with existing redis client
 */
export class CacheService {
    private static readonly TTL = {
        GARAGE_PROFILE: 3600,        // 1 hour
        ACTIVE_REQUESTS: 300,        // 5 minutes
        POPULAR_PARTS: 900,          // 15 minutes
        USER_SESSION: 86400,         // 24 hours
        ANALYTICS: 900,              // 15 minutes
        BID_LIST: 180,               // 3 minutes
        SEARCH_RESULTS: 600,         // 10 minutes
    };

    /**
     * Get value from cache
     */
    static async get<T>(key: string): Promise<T | null> {
        const redis = getRedisClient();
        if (!redis) return null;

        try {
            const value = await redis.get(key);
            if (!value) return null;

            return JSON.parse(value) as T;
        } catch (error) {
            logger.error('Cache get error', { key, error });
            return null;
        }
    }

    /**
     * Set value in cache with TTL
     */
    static async set(key: string, value: any, ttl?: number): Promise<boolean> {
        const redis = getRedisClient();
        if (!redis) return false;

        try {
            const serialized = JSON.stringify(value);

            if (ttl) {
                await redis.setEx(key, ttl, serialized);
            } else {
                await redis.set(key, serialized);
            }

            return true;
        } catch (error) {
            logger.error('Cache set error', { key, error });
            return false;
        }
    }

    /**
     * Delete key from cache
     */
    static async del(key: string): Promise<boolean> {
        const redis = getRedisClient();
        if (!redis) return false;

        try {
            await redis.del(key);
            return true;
        } catch (error) {
            logger.error('Cache delete error', { key, error });
            return false;
        }
    }

    /**
     * Delete multiple keys matching pattern
     */
    static async delPattern(pattern: string): Promise<number> {
        const redis = getRedisClient();
        if (!redis) return 0;

        try {
            const keys = await redis.keys(pattern);
            if (keys.length === 0) return 0;

            await redis.del(keys);
            return keys.length;
        } catch (error) {
            logger.error('Cache pattern delete error', { pattern, error });
            return 0;
        }
    }

    // ==================== Domain-Specific Caching ====================

    /**
     * Cache garage profile
     */
    static async cacheGarage(garageId: string, data: any): Promise<void> {
        await this.set(`garage:${garageId}`, data, this.TTL.GARAGE_PROFILE);
    }

    /**
     * Get cached garage profile
     */
    static async getGarage(garageId: string): Promise<any | null> {
        return await this.get(`garage:${garageId}`);
    }

    /**
     * Invalidate garage cache
     */
    static async invalidateGarage(garageId: string): Promise<void> {
        await this.del(`garage:${garageId}`);
    }

    /**
     * Cache active part requests
     */
    static async cacheActiveRequests(data: any[]): Promise<void> {
        await this.set('requests:active', data, this.TTL.ACTIVE_REQUESTS);
    }

    /**
     * Get cached active requests
     */
    static async getActiveRequests(): Promise<any[] | null> {
        return await this.get('requests:active');
    }

    /**
     * Cache analytics data
     */
    static async cacheAnalytics(garageId: string, period: string, data: any): Promise<void> {
        await this.set(`analytics:${garageId}:${period}`, data, this.TTL.ANALYTICS);
    }

    /**
     * Get cached analytics
     */
    static async getAnalytics(garageId: string, period: string): Promise<any | null> {
        return await this.get(`analytics:${garageId}:${period}`);
    }

    /**
     * Cache search results
     */
    static async cacheSearchResults(query: string, filters: any, results: any): Promise<void> {
        const key = `search:${this.hashQuery(query, filters)}`;
        await this.set(key, results, this.TTL.SEARCH_RESULTS);
    }

    /**
     * Get cached search results
     */
    static async getSearchResults(query: string, filters: any): Promise<any | null> {
        const key = `search:${this.hashQuery(query, filters)}`;
        return await this.get(key);
    }

    /**
     * Cache bids for a request
     */
    static async cacheBids(requestId: string, bids: any[]): Promise<void> {
        await this.set(`bids:request:${requestId}`, bids, this.TTL.BID_LIST);
    }

    /**
     * Get cached bids
     */
    static async getBids(requestId: string): Promise<any[] | null> {
        return await this.get(`bids:request:${requestId}`);
    }

    /**
     * Invalidate bids for a request
     */
    static async invalidateBids(requestId: string): Promise<void> {
        await this.del(`bids:request:${requestId}`);
    }

    // ==================== Helper Methods ====================

    /**
     * Create consistent hash for query + filters
     */
    private static hashQuery(query: string, filters: any): string {
        const normalized = JSON.stringify({ query, filters });
        return Buffer.from(normalized).toString('base64').substring(0, 32);
    }

    /**
     * Get cache statistics
     */
    static async getStats(): Promise<{
        connected: boolean;
        keys_count: number;
    }> {
        const redis = getRedisClient();
        if (!redis) {
            return { connected: false, keys_count: 0 };
        }

        try {
            const dbSize = await redis.dbSize();
            return {
                connected: true,
                keys_count: dbSize
            };
        } catch (error) {
            return { connected: false, keys_count: 0 };
        }
    }
}
