"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeAllPools = exports.getPoolStats = exports.getWritePool = exports.getReadPool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ============================================
// DATABASE CONNECTION POOL CONFIGURATION
// ============================================
// Production-ready pool configuration with optimizations
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Connection Pool Tuning for Vertical Scaling (Phase 1)
    max: parseInt(process.env.DB_POOL_MAX || '20'), // Max connections (increase for high load)
    min: parseInt(process.env.DB_POOL_MIN || '5'), // Min idle connections
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Close idle after 30s
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'), // Connection timeout
    // Performance optimizations
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30s query timeout
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    // SSL Configuration for production
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false } // For managed databases (Azure/AWS)
        : undefined
};
// Primary database pool (read-write)
const pool = new pg_1.Pool(poolConfig);
// ============================================
// READ REPLICA SUPPORT (Phase 2)
// ============================================
// Read replica pool for dashboard queries and reports
let readReplicaPool = null;
if (process.env.DB_READ_REPLICA_HOST) {
    const replicaConfig = {
        ...poolConfig,
        host: process.env.DB_READ_REPLICA_HOST,
        port: parseInt(process.env.DB_READ_REPLICA_PORT || process.env.DB_PORT || '5432'),
        // Read replicas can have larger pool size
        max: parseInt(process.env.DB_READ_POOL_MAX || '30'),
    };
    readReplicaPool = new pg_1.Pool(replicaConfig);
    readReplicaPool.on('error', (err) => {
        console.error('[DB] Read replica error:', err.message);
        // Don't exit - fall back to primary
    });
    console.log('✅ [DB] Read replica pool initialized');
}
// ============================================
// ERROR HANDLING
// ============================================
pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
    // In production, log to monitoring service instead of exiting
    if (process.env.NODE_ENV === 'production') {
        console.error('[DB] Critical error - monitoring should alert');
    }
    else {
        process.exit(-1);
    }
});
pool.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[DB] New client connected to pool');
    }
});
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Get database pool for read operations
 * Falls back to primary if no replica configured
 */
const getReadPool = () => {
    return readReplicaPool || pool;
};
exports.getReadPool = getReadPool;
/**
 * Get database pool for write operations
 * Always uses primary database
 */
const getWritePool = () => {
    return pool;
};
exports.getWritePool = getWritePool;
/**
 * Get pool statistics for monitoring
 */
const getPoolStats = () => {
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
exports.getPoolStats = getPoolStats;
/**
 * Graceful shutdown - close all connections
 */
const closeAllPools = async () => {
    console.log('[DB] Closing all database pools...');
    await pool.end();
    if (readReplicaPool) {
        await readReplicaPool.end();
    }
    console.log('[DB] All pools closed');
};
exports.closeAllPools = closeAllPools;
// Default export for backward compatibility
exports.default = pool;
