/**
 * Redis Cache Service
 * Provides caching for slow database queries
 * 
 * Cached entities:
 * - Garage profiles (1 hour TTL)
 * - Delivery zones (6 hours TTL)
 * - Subscription plans (24 hours TTL)
 */

import Redis from 'ioredis';
import logger from '../../utils/logger';

export class CacheService {
    private redis: Redis | null = null;
    private enabled: boolean = false;

    // TTL in seconds
    private readonly TTL = {
        GARAGE_PROFILE: 3600,       // 1 hour
        DELIVERY_ZONES: 21600,      // 6 hours
        SUBSCRIPTION_PLANS: 86400,  // 24 hours
        USER_PROFILE: 1800,         // 30 minutes
        DEFAULT: 300                // 5 minutes
    };

    constructor() {
        this.initialize();
    }

    private async initialize() {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            logger.info('[Cache] Redis not configured - caching disabled');
            return;
        }

        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                retryDelayOnFailover: 100
            });

            await this.redis.connect();
            this.enabled = true;
            logger.info('[Cache] Redis connected - caching enabled');
        } catch (error) {
            logger.warn('[Cache] Redis connection failed - caching disabled', error);
            this.enabled = false;
        }
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.enabled || !this.redis) return null;

        try {
            const data = await this.redis.get(key);
            if (data) {
                return JSON.parse(data) as T;
            }
            return null;
        } catch (error) {
            logger.warn('[Cache] Get error:', key, error);
            return null;
        }
    }

    /**
     * Set value in cache
     */
    async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
        if (!this.enabled || !this.redis) return false;

        try {
            const ttl = ttlSeconds || this.TTL.DEFAULT;
            await this.redis.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.warn('[Cache] Set error:', key, error);
            return false;
        }
    }

    /**
     * Delete from cache
     */
    async delete(key: string): Promise<boolean> {
        if (!this.enabled || !this.redis) return false;

        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            logger.warn('[Cache] Delete error:', key, error);
            return false;
        }
    }

    /**
     * Delete by pattern (e.g., "garage:*")
     */
    async deletePattern(pattern: string): Promise<number> {
        if (!this.enabled || !this.redis) return 0;

        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            return keys.length;
        } catch (error) {
            logger.warn('[Cache] DeletePattern error:', pattern, error);
            return 0;
        }
    }

    // ============================================
    // SPECIFIC CACHE METHODS
    // ============================================

    /**
     * Cache garage profile
     */
    async getGarageProfile(garageId: string): Promise<any | null> {
        return this.get(`garage:${garageId}`);
    }

    async setGarageProfile(garageId: string, profile: any): Promise<boolean> {
        return this.set(`garage:${garageId}`, profile, this.TTL.GARAGE_PROFILE);
    }

    async invalidateGarageProfile(garageId: string): Promise<boolean> {
        return this.delete(`garage:${garageId}`);
    }

    /**
     * Cache delivery zones (rarely change)
     */
    async getDeliveryZones(): Promise<any[] | null> {
        return this.get('delivery:zones');
    }

    async setDeliveryZones(zones: any[]): Promise<boolean> {
        return this.set('delivery:zones', zones, this.TTL.DELIVERY_ZONES);
    }

    async invalidateDeliveryZones(): Promise<boolean> {
        return this.delete('delivery:zones');
    }

    /**
     * Cache subscription plans (rarely change)
     */
    async getSubscriptionPlans(): Promise<any[] | null> {
        return this.get('subscription:plans');
    }

    async setSubscriptionPlans(plans: any[]): Promise<boolean> {
        return this.set('subscription:plans', plans, this.TTL.SUBSCRIPTION_PLANS);
    }

    async invalidateSubscriptionPlans(): Promise<boolean> {
        return this.delete('subscription:plans');
    }

    /**
     * Cache user rewards/loyalty info
     */
    async getUserRewards(userId: string): Promise<any | null> {
        return this.get(`rewards:${userId}`);
    }

    async setUserRewards(userId: string, rewards: any): Promise<boolean> {
        return this.set(`rewards:${userId}`, rewards, this.TTL.USER_PROFILE);
    }

    async invalidateUserRewards(userId: string): Promise<boolean> {
        return this.delete(`rewards:${userId}`);
    }

    /**
     * Get cache stats
     */
    async getStats(): Promise<{ enabled: boolean; keys?: number }> {
        if (!this.enabled || !this.redis) {
            return { enabled: false };
        }

        try {
            const info = await this.redis.dbsize();
            return { enabled: true, keys: info };
        } catch {
            return { enabled: true };
        }
    }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
    if (!cacheServiceInstance) {
        cacheServiceInstance = new CacheService();
    }
    return cacheServiceInstance;
}
