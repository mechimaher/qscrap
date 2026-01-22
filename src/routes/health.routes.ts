import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { getRedisClient } from '../config/redis';

const router = Router();

/**
 * GET /health
 * Simple health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * GET /health/detailed
 * Detailed health check with all services
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
    const health: any = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {}
    };

    // Check PostgreSQL
    try {
        await pool.query('SELECT 1');
        health.services.database = { status: 'healthy', type: 'postgresql' };
    } catch (error) {
        health.services.database = { status: 'unhealthy', error: 'Connection failed' };
        health.status = 'degraded';
    }

    // Check Redis
    const redis = getRedisClient();
    if (redis) {
        try {
            await redis.ping();
            health.services.redis = { status: 'healthy', type: 'redis' };
        } catch (error) {
            health.services.redis = { status: 'unhealthy', error: 'Connection failed' };
            health.status = 'degraded';
        }
    } else {
        health.services.redis = { status: 'not_configured' };
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024)
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * GET /status
 * Platform status and metrics
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const [
            garagesResult,
            requestsResult,
            ordersResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM garages WHERE approval_status = $1', ['approved']),
            pool.query('SELECT COUNT(*) as count FROM part_requests WHERE status = $1', ['active']),
            pool.query(`SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE order_status IN ('confirmed', 'preparing', 'in_transit')) as active
                FROM orders WHERE created_at >= NOW() - INTERVAL '24 hours'`)
        ]);

        res.json({
            platform: 'QScrap/Motar',
            version: '2.0',
            status: 'operational',
            timestamp: new Date().toISOString(),
            metrics: {
                active_garages: parseInt(garagesResult.rows[0].count),
                active_requests: parseInt(requestsResult.rows[0].count),
                orders_24h: parseInt(ordersResult.rows[0].total),
                active_orders: parseInt(ordersResult.rows[0].active)
            },
            features: {
                analytics: 'enabled',
                loyalty: 'enabled',
                ad_marketplace: 'enabled',
                subscriptions: 'enabled',
                escrow_protection: 'enabled',
                parts_marketplace: 'enabled'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch platform status'
        });
    }
});

/**
 * GET /metrics
 * Basic metrics for monitoring
 */
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            process: {
                uptime_seconds: Math.floor(process.uptime()),
                memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                cpu_usage: process.cpuUsage()
            }
        };

        // Database connection pool stats
        const poolStats = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        };

        res.json({
            ...metrics,
            database_pool: poolStats
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

export default router;
