import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

// ============================================
// RESPONSE CACHING MIDDLEWARE
// For read-heavy endpoints that don't change frequently
// ============================================

interface CacheOptions {
    ttl?: number;           // Time to live in seconds (default: 60)
    keyPrefix?: string;     // Cache key prefix
    varyByUser?: boolean;   // Different cache per user
    varyByQuery?: boolean;  // Include query params in key
}

/**
 * Cache API responses in Redis for improved performance
 * Falls back gracefully if Redis is not available
 */
export function cacheResponse(options: CacheOptions = {}) {
    const { ttl = 60, keyPrefix = 'cache', varyByUser = false, varyByQuery = true } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        const redis = getRedisClient();

        // Skip caching if Redis not available or non-GET request
        if (!redis || req.method !== 'GET') {
            return next();
        }

        // Build cache key
        let cacheKey = `${keyPrefix}:${req.baseUrl}${req.path}`;

        if (varyByQuery && Object.keys(req.query).length > 0) {
            const sortedQuery = Object.keys(req.query)
                .sort()
                .map(k => `${k}=${req.query[k]}`)
                .join('&');
            cacheKey += `?${sortedQuery}`;
        }

        if (varyByUser && (req as any).user?.userId) {
            cacheKey += `:user:${(req as any).user.userId}`;
        }

        try {
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json');
                return res.send(cached);
            }

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json to cache the response
            res.json = (body: any) => {
                // Cache successful responses only
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.setEx(cacheKey, ttl, JSON.stringify(body)).catch(err => {
                        console.error('[Cache] Failed to set cache:', err.message);
                    });
                }
                res.setHeader('X-Cache', 'MISS');
                return originalJson(body);
            };

            next();
        } catch (err) {
            // Redis error - continue without caching
            console.error('[Cache] Cache middleware error:', err);
            next();
        }
    };
}

/**
 * Invalidate cache for specific patterns
 * Call this after mutations (POST, PUT, DELETE)
 */
export async function invalidateCache(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
        const keys = await redis.keys(`cache:${pattern}*`);
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[Cache] Invalidated ${keys.length} keys matching: ${pattern}`);
        }
    } catch (err: any) {
        console.error('[Cache] Invalidation error:', err.message);
    }
}

/**
 * Cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{ hits: number; misses: number; keys: number } | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
        const info = await redis.info('stats');
        const keys = await redis.dbSize();

        const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
        const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');

        return { hits, misses, keys };
    } catch (err) {
        return null;
    }
}

// ============================================
// PRE-CONFIGURED CACHE MIDDLEWARE
// ============================================

// Dashboard stats - cache for 30 seconds
export const cacheDashboard = cacheResponse({ ttl: 30, keyPrefix: 'dashboard', varyByUser: true });

// Reports - cache for 5 minutes
export const cacheReports = cacheResponse({ ttl: 300, keyPrefix: 'reports' });

// Public data - cache for 10 minutes
export const cachePublic = cacheResponse({ ttl: 600, keyPrefix: 'public' });

// User-specific data - cache for 1 minute
export const cacheUserData = cacheResponse({ ttl: 60, keyPrefix: 'user', varyByUser: true });
