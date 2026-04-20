"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheUserData = exports.cachePublic = exports.cacheReports = exports.cacheDashboard = void 0;
exports.cacheResponse = cacheResponse;
exports.invalidateCache = invalidateCache;
exports.getCacheStats = getCacheStats;
const redis_1 = require("../config/redis");
/**
 * Cache API responses in Redis for improved performance
 * Falls back gracefully if Redis is not available
 */
function cacheResponse(options = {}) {
    const { ttl = 60, keyPrefix = 'cache', varyByUser = false, varyByQuery = true } = options;
    return async (req, res, next) => {
        const redis = (0, redis_1.getRedisClient)();
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
        if (varyByUser && req.user?.userId) {
            cacheKey += `:user:${req.user.userId}`;
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
            res.json = (body) => {
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
        }
        catch (err) {
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
async function invalidateCache(pattern) {
    const redis = (0, redis_1.getRedisClient)();
    if (!redis)
        return;
    try {
        const keys = await redis.keys(`cache:${pattern}*`);
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[Cache] Invalidated ${keys.length} keys matching: ${pattern}`);
        }
    }
    catch (err) {
        console.error('[Cache] Invalidation error:', err.message);
    }
}
/**
 * Cache statistics for monitoring
 */
async function getCacheStats() {
    const redis = (0, redis_1.getRedisClient)();
    if (!redis)
        return null;
    try {
        const info = await redis.info('stats');
        const keys = await redis.dbSize();
        const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
        const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
        return { hits, misses, keys };
    }
    catch (err) {
        return null;
    }
}
// ============================================
// PRE-CONFIGURED CACHE MIDDLEWARE
// ============================================
// Dashboard stats - cache for 30 seconds
exports.cacheDashboard = cacheResponse({ ttl: 30, keyPrefix: 'dashboard', varyByUser: true });
// Reports - cache for 5 minutes
exports.cacheReports = cacheResponse({ ttl: 300, keyPrefix: 'reports' });
// Public data - cache for 10 minutes
exports.cachePublic = cacheResponse({ ttl: 600, keyPrefix: 'public' });
// User-specific data - cache for 1 minute
exports.cacheUserData = cacheResponse({ ttl: 60, keyPrefix: 'user', varyByUser: true });
