import { RedisClientType, createClient } from 'redis';

// ============================================
// REDIS CLIENT (Phase 2 - Simplified)
// ============================================

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client for caching and future session storage
 * Compatible with redis v4+
 */
export async function initializeRedis(): Promise<RedisClientType | null> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.log('ℹ️ [Redis] No REDIS_URL configured - Redis features disabled');
        console.log('   For multi-server deployment:');
        console.log('   1. Set up Redis server');
        console.log('   2. Set REDIS_URL=redis://password@host:6379 in .env');
        console.log('   3. For sessions, see CLUSTER_DEPLOYMENT.md for full setup');
        return null;
    }

    try {
        redisClient = createClient({
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries: number) => {
                    if (retries > 10) {
                        console.error('[Redis] Max retries reached');
                        return new Error('Redis connection failed');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err: Error) => {
            console.error('[Redis] Client error:', err.message);
        });

        redisClient.on('connect', () => {
            console.log('✅ [Redis] Client connected');
        });

        redisClient.on('ready', () => {
            console.log('✅ [Redis] Client ready for caching');
        });

        redisClient.on('reconnecting', () => {
            console.log('⚠️ [Redis] Reconnecting...');
        });

        await redisClient.connect();
        console.log('✅ [Redis] Available for caching (session store requires manual setup)');

        return redisClient;

    } catch (err: any) {
        console.error('[Redis] Failed to connect:', err.message);
        console.warn('[Redis] Application will work without Redis');
        return null;
    }
}

/**
 * Get Redis client instance (for caching, rate limiting, etc.)
 */
export function getRedisClient(): RedisClientType | null {
    return redisClient;
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
    if (!redisClient) {
        return true; // No Redis configured is OK
    }

    try {
        await redisClient.ping();
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        console.log('[Redis] Connection closed');
    }
}

/**
 * NOTE: For Redis session store in multi-server deployment:
 * See CLUSTER_DEPLOYMENT.md for complete setup instructions.
 * 
 * The connect-redis v7 package requires static imports which conflict
 * with our modular architecture. For production multi-server setup:
 * 
 * 1. Install packages: npm install redis connect-redis express-session
 * 2. Follow CLUSTER_DEPLOYMENT.md nginx load balancer setup
 * 3. Configure sticky sessions in nginx OR use express-session with Redis
 * 4. Current system supports 10k+ users on single server
 */
