import { Pool, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

// ============================================
// DATABASE CONNECTION POOL CONFIGURATION
// ============================================

const isTestEnv = process.env.NODE_ENV === 'test';

// Production-ready pool configuration with optimizations
const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432'),

    // Connection Pool Tuning for Vertical Scaling (Phase 1)
    max: parseInt(process.env.DB_POOL_MAX || (isTestEnv ? '5' : '20')),              // Max connections (increase for high load)
    min: parseInt(process.env.DB_POOL_MIN || (isTestEnv ? '0' : '5')),               // Min idle connections
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || (isTestEnv ? '1000' : '30000')),  // Close idle after 30s
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'), // Connection timeout
    // Critical for Jest workers: allows Node to exit with idle clients in test runs.
    allowExitOnIdle: isTestEnv,

    // Performance optimizations
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30s query timeout
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),

    // SSL Configuration for production
    // SECURITY: Set DB_SSL=true for cloud databases (Azure/AWS/GCP)
    // For Docker deployments with internal Postgres: DB_SSL=false (default for Docker)
    ssl: process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
        : (process.env.DB_SSL === 'false' ? false : undefined)
};

// Primary database pool (read-write)
const pool = new Pool(poolConfig);

// ============================================
// READ REPLICA SUPPORT (Phase 2)
// ============================================

// Read replica pool for dashboard queries and reports
let readReplicaPool: Pool | null = null;

if (process.env.DB_READ_REPLICA_HOST) {
    const replicaConfig: PoolConfig = {
        ...poolConfig,
        host: process.env.DB_READ_REPLICA_HOST,
        port: parseInt(process.env.DB_READ_REPLICA_PORT || process.env.DB_PORT || '5432'),
        // Read replicas can have larger pool size
        max: parseInt(process.env.DB_READ_POOL_MAX || '30'),
    };

    readReplicaPool = new Pool(replicaConfig);

    readReplicaPool.on('error', (err) => {
        logger.error('Read replica error', { error: err.message });
        // Don't exit - fall back to primary
    });

    logger.startup('Read replica pool');
}

// ============================================
// ERROR HANDLING
// ============================================

// Circuit breaker state for pool health and observability
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
const ALERT_THRESHOLD = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
let lastErrorTimestamp: string | null = null;

const getBackoffDelay = (errorCount: number): number => {
    if (errorCount <= 0) { return 0; }
    return Math.min(BASE_BACKOFF_MS * Math.pow(2, errorCount - 1), MAX_BACKOFF_MS);
};

pool.on('error', (err) => {
    consecutiveErrors++;
    lastErrorTimestamp = new Date().toISOString();
    const nextRetryDelayMs = getBackoffDelay(consecutiveErrors);

    logger.error('Database pool error', {
        error: err.message,
        stack: err.stack,
        consecutiveErrors,
        nextRetryDelayMs,
        poolStats: getPoolStats()
    });

    if (consecutiveErrors >= ALERT_THRESHOLD) {
        logger.error('CIRCUIT_BREAKER: Database error threshold reached', {
            consecutiveErrors,
            threshold: ALERT_THRESHOLD,
            nextRetryDelayMs
        });
    }
});

pool.on('connect', () => {
    if (consecutiveErrors > 0) {
        logger.info('Database pool recovered', {
            consecutiveErrors,
            lastErrorTimestamp
        });
    }

    consecutiveErrors = 0;
    lastErrorTimestamp = null;
    logger.db('Client connected to pool');
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get database pool for read operations
 * Falls back to primary if no replica configured
 */
export const getReadPool = (): Pool => {
    return readReplicaPool || pool;
};

/**
 * Get database pool for write operations
 * Always uses primary database
 */
export const getWritePool = (): Pool => {
    return pool;
};

/**
 * Get pool statistics for monitoring
 */
export const getPoolStats = () => {
    return {
        primary: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        },
        replica: readReplicaPool ? {
            total: readReplicaPool.totalCount,
            idle: readReplicaPool.idleCount,
            waiting: readReplicaPool.waitingCount
        } : null
    };
};

/**
 * Circuit breaker health for monitoring and alerting
 */
export const getPoolHealth = () => {
    return {
        healthy: consecutiveErrors < MAX_CONSECUTIVE_ERRORS,
        consecutiveErrors,
        alertThreshold: ALERT_THRESHOLD,
        maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS,
        nextRetryDelayMs: getBackoffDelay(consecutiveErrors),
        lastErrorTimestamp,
        ...getPoolStats()
    };
};

/**
 * Graceful shutdown - close all connections
 */
export const closeAllPools = async () => {
    logger.shutdown('Database pools');
    await pool.end();
    if (readReplicaPool) {
        await readReplicaPool.end();
    }
    logger.info('All database pools closed');
};

// Default export for backward compatibility
export default pool;
