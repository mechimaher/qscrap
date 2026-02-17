import { Request, Response } from 'express';
import pool, { getPoolStats } from '../config/db';
import { getRedisClient } from '../config/redis';

type JobRunner = () => Promise<unknown>;
type JobsModule = {
    default: Record<string, JobRunner>;
};

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
        return err.message;
    }
    return 'Unknown error';
};

/**
 * Health Controller
 * Handles health checks and system metrics
 */

/**
 * GET /health
 * Simple health check endpoint
 */
export const getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
        const dbStats = getPoolStats();

        res.json({
            success: true,
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            database: {
                primary: {
                    connected: true,
                    ...dbStats.primary
                },
                replica: dbStats.replica ? {
                    connected: true,
                    ...dbStats.replica
                } : null
            },
            redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
            storage: process.env.S3_BUCKET ? 'S3' :
                process.env.AZURE_STORAGE_ACCOUNT ? 'Azure' : 'Local'
        });
    } catch (err: unknown) {
        res.status(503).json({
            success: false,
            status: 'ERROR',
            error: getErrorMessage(err),
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * GET /health/detailed
 * Detailed health check with all services
 */
export const getDetailedHealth = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * GET /status
 * Platform status and metrics
 */
export const getPlatformStatus = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * GET /metrics
 * Basic metrics for monitoring
 */
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
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
};
/**
 * GET /health/jobs
 * Job health check status
 */
export const getJobHealth = (req: Request, res: Response): void => {
    try {
        res.json({
            success: true,
            scheduler: 'active',
            interval: '1 hour',
            jobs: {
                expireOldRequests: { description: 'Expire requests past deadline', frequency: 'hourly' },
                expireCounterOffers: { description: 'Expire pending counter-offers after 24h', frequency: 'hourly' },
                checkSubscriptions: { description: 'Handle subscription renewals/expirations', frequency: 'hourly' },
                autoResolveDisputes: { description: 'Auto-approve disputes after 48h', frequency: 'hourly' },
                autoConfirmDeliveries: { description: 'Auto-complete orders after 24h delivery', frequency: 'hourly' },
                autoConfirmPayouts: { description: 'Auto-confirm payout receipt after 7 days', frequency: 'hourly' },
                schedulePendingPayouts: { description: 'Create payout records for completed orders', frequency: 'hourly' },
                autoProcessPayouts: { description: 'Process mature payouts, hold disputed ones', frequency: 'hourly' },
                cleanupOldData: { description: 'Remove old notifications and history', frequency: 'hourly' }
            },
            timestamp: new Date().toISOString()
        });
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};

/**
 * POST /health/jobs/:jobName/run
 * Manual job trigger (admin only)
 */
export const triggerJob = async (req: Request, res: Response): Promise<void> => {
    const { jobName } = req.params;
    const apiKey = req.headers['x-admin-key'];

    // Simple API key check (production should use proper auth)
    if (apiKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }

    try {
        // Dynamic import to avoid circular dependencies
        const jobsModule = await import('../config/jobs') as JobsModule;
        const jobFn = jobsModule.default[jobName];

        if (!jobFn || typeof jobFn !== 'function') {
            res.status(404).json({ error: `Job not found: ${jobName}` });
            return;
        }

        const result = await jobFn();
        res.json({
            success: true,
            job: jobName,
            result,
            timestamp: new Date().toISOString()
        });
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
};
