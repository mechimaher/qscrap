import { RedisClientType, createClient } from 'redis';
import logger from '../utils/logger';

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
        logger.info('No REDIS_URL configured - Redis features disabled');
        logger.info('For multi-server deployment: Set REDIS_URL in .env, see CLUSTER_DEPLOYMENT.md');
        return null;
    }

    try {
        redisClient = createClient({
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries: number) => {
                    if (retries > 10) {
                        logger.error('Redis max retries reached');
                        return new Error('Redis connection failed');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err: Error) => {
            logger.error('Redis client error', { error: err.message });
        });

        redisClient.on('connect', () => {
            logger.startup('Redis client connected');
        });

        redisClient.on('ready', () => {
            logger.info('Redis client ready for caching');
        });

        redisClient.on('reconnecting', () => {
            logger.warn('Redis reconnecting...');
        });

        await redisClient.connect();
        logger.startup('Redis available for caching');

        return redisClient;

    } catch (err: any) {
        logger.error('Redis connection failed', { error: err.message });
        logger.warn('Application will work without Redis');
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
        logger.shutdown('Redis connection');
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
