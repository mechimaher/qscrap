import { initializeSentry } from './config/sentry';
// Initialize Sentry as early as possible
initializeSentry();

import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import pool, { closeAllPools, getPoolStats } from './config/db';
import jobs from './config/jobs';
import { closeRedis, initializeRedis } from './config/redis';
import { initializeSocketAdapter, getGlobalSocketCount } from './config/socketAdapter';
import { initializeJobQueues, closeJobQueues, createJobWorker, scheduleRecurringJob } from './config/jobQueue';
import { performStartupSecurityChecks, getJwtSecret } from './config/security';
import { initializeSocketIO } from './utils/socketIO';
import logger from './utils/logger';
import { startAutoCompleteJob } from './jobs/auto-complete-orders';
import { startDeliveryReminderJob } from './jobs/delivery-reminders';
import jwt, { JwtPayload } from 'jsonwebtoken';

const PORT = process.env.PORT || 3000;
const NODE_ID = process.env.NODE_ID || `node-${process.pid}`;

const server = http.createServer(app);

// ============================================
// SOCKET.IO SETUP (Multi-node ready)
// ============================================
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://qscrap.qa',
        'https://www.qscrap.qa'
    ];

// ============================================
// SOCKET.IO SETUP (Multi-node ready)
// ============================================
export const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
        methods: ["GET", "POST"],
        credentials: true
    },
    // Optimized settings for scale
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    // Allow larger payloads for chat messages
    maxHttpBufferSize: 1e6
});

// Initialize Socket.IO singleton for type-safe access throughout the app
initializeSocketIO(io);

// ============================================
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ============================================
type SocketUser = {
    id: string;
    userType: string;
    staffRole?: string;
    garageId?: string;
};

type AuthTokenClaims = JwtPayload & {
    userId?: string;
    user_id?: string;
    userType?: string;
    user_type?: string;
    staffRole?: string;
    staff_role?: string;
    garageId?: string;
    garage_id?: string;
};

const PRIVILEGED_STAFF_ROLES = new Set(['admin', 'superadmin', 'operations', 'support', 'cs_admin']);
const SUPPORT_STAFF_ROLES = new Set(['support', 'cs_admin', 'customer_service']);
const ADMIN_STAFF_ROLES = new Set(['admin', 'superadmin']);

const normalizeClaim = (value: unknown): string | undefined => {
    if (typeof value !== 'string') { return undefined; }
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
};

const parseSocketUser = (decoded: AuthTokenClaims): SocketUser | null => {
    const id = decoded.userId || decoded.user_id;
    if (!id || typeof id !== 'string') {
        return null;
    }

    return {
        id,
        userType: normalizeClaim(decoded.userType || decoded.user_type) || 'unknown',
        staffRole: normalizeClaim(decoded.staffRole || decoded.staff_role),
        garageId: typeof (decoded.garageId || decoded.garage_id) === 'string'
            ? (decoded.garageId || decoded.garage_id)
            : undefined
    };
};

const getGarageRoomId = (user: SocketUser): string | undefined => {
    if (user.garageId) { return user.garageId; }
    if (user.userType === 'garage') { return user.id; }
    return undefined;
};

const isPrivilegedSocketUser = (user: SocketUser): boolean => {
    if (user.userType === 'admin' || user.userType === 'operations' || user.userType === 'support') {
        return true;
    }

    return user.userType === 'staff' && !!user.staffRole && PRIVILEGED_STAFF_ROLES.has(user.staffRole);
};

const getRequestIdFromPayload = (payload: unknown): string | null => {
    if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
    }

    if (
        payload &&
        typeof payload === 'object' &&
        'request_id' in payload &&
        typeof (payload as { request_id?: unknown }).request_id === 'string'
    ) {
        const requestId = (payload as { request_id: string }).request_id.trim();
        return requestId || null;
    }

    return null;
};

const getOrderIdFromPayload = (payload: unknown): string | null => {
    if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
    }

    if (
        payload &&
        typeof payload === 'object' &&
        'order_id' in payload &&
        typeof (payload as { order_id?: unknown }).order_id === 'string'
    ) {
        const orderId = (payload as { order_id: string }).order_id.trim();
        return orderId || null;
    }

    return null;
};

const canTrackRequest = async (requestId: string, user: SocketUser): Promise<boolean> => {
    if (isPrivilegedSocketUser(user)) {
        return true;
    }

    const requestResult = await pool.query(
        `SELECT customer_id, status
         FROM part_requests
         WHERE request_id = $1
           AND deleted_at IS NULL
         LIMIT 1`,
        [requestId]
    );

    if (requestResult.rows.length === 0) {
        return false;
    }

    const request = requestResult.rows[0] as { customer_id?: string; status?: string };

    if (user.userType === 'customer') {
        return request.customer_id === user.id;
    }

    if (user.userType !== 'garage') {
        return false;
    }

    if (request.status === 'active') {
        return true;
    }

    const garageRoomId = getGarageRoomId(user);
    if (!garageRoomId) {
        return false;
    }

    const bidResult = await pool.query(
        `SELECT 1
         FROM bids
         WHERE request_id = $1
           AND garage_id = $2
         LIMIT 1`,
        [requestId, garageRoomId]
    );

    return bidResult.rows.length > 0;
};

const canTrackOrder = async (orderId: string, user: SocketUser): Promise<boolean> => {
    if (isPrivilegedSocketUser(user)) {
        return true;
    }

    const orderResult = await pool.query(
        `SELECT
            o.customer_id,
            o.garage_id,
            o.driver_id,
            EXISTS (
                SELECT 1
                FROM delivery_assignments da
                JOIN drivers d ON d.driver_id = da.driver_id
                WHERE da.order_id = o.order_id
                  AND d.user_id = $2
            ) AS matches_driver_user,
            EXISTS (
                SELECT 1
                FROM delivery_assignments da
                WHERE da.order_id = o.order_id
                  AND da.driver_id::text = $2
            ) AS matches_driver_id
         FROM orders o
         WHERE o.order_id = $1
           AND o.deleted_at IS NULL
         LIMIT 1`,
        [orderId, user.id]
    );

    if (orderResult.rows.length === 0) {
        return false;
    }

    const order = orderResult.rows[0] as {
        customer_id?: string;
        garage_id?: string;
        driver_id?: string;
        matches_driver_user?: boolean;
        matches_driver_id?: boolean;
    };

    if (user.userType === 'customer') {
        return order.customer_id === user.id;
    }

    if (user.userType === 'garage') {
        const garageRoomId = getGarageRoomId(user);
        return !!garageRoomId && order.garage_id === garageRoomId;
    }

    if (user.userType === 'driver') {
        return order.driver_id === user.id || !!order.matches_driver_user || !!order.matches_driver_id;
    }

    return false;
};

// Track viewers per request for real-time viewer count (Institutional Logic)
const requestViewers = new Map<string, Set<string>>();

io.use((socket, next) => {
    // Standard approach: token in auth. For legacy/mobile fallback: check headers
    const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];

    if (!token) {
        // INSTITUTIONAL MANDATE: No unauthenticated WebSocket connections allowed in any environment.
        return next(new Error('Authentication error: Token required'));
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenClaims;
        const user = parseSocketUser(decoded);

        if (!user) {
            return next(new Error('Authentication error: Missing user identity claims'));
        }

        // Derived identity - aligns with both camelCase and snake_case JWT claims
        socket.data.user = user;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    const user = socket.data.user;

    if (user) {
        logger.socket('Authorized connection', {
            socketId: socket.id,
            userId: user.id,
            userType: user.userType,
            staffRole: user.staffRole
        });
    }

    // ============================================
    // SECURE ROOM AUTHORIZATION
    // Rooms are assigned based on verified Token Claims ONLY
    // ============================================
    if (user?.id) {
        // 1. Personal User Room (Canonical)
        socket.join(`user_${user.id}`);

        // 2. Garage Room (garage_id claim, fallback to userId)
        const garageRoomId = getGarageRoomId(user);
        if (garageRoomId) {
            socket.join(`garage_${garageRoomId}`);
        }

        // 3. Administrative / Operations / Support Rooms
        if (user.userType === 'admin') {
            socket.join('admin');
            socket.join('operations');
            socket.join('support');
        } else if (user.userType === 'operations') {
            socket.join('operations');
        } else if (user.userType === 'support') {
            socket.join('support');
        } else if (user.userType === 'staff') {
            if (user.staffRole && ADMIN_STAFF_ROLES.has(user.staffRole)) {
                socket.join('admin');
                socket.join('operations');
                socket.join('support');
            } else if (user.staffRole === 'operations') {
                socket.join('operations');
            } else if (user.staffRole && SUPPORT_STAFF_ROLES.has(user.staffRole)) {
                socket.join('support');
            }
        }

        // 4. Driver Rooms
        if (user.userType === 'driver') {
            socket.join(`driver_${user.id}`);
        }
    }

    // ============================================
    // VERIFIED INTERACTION HANDLERS
    // ============================================

    // Real-time Request Tracking (server-side authorization enforced)
    socket.on('track_request_view', async (payload: unknown) => {
        const user = socket.data.user as SocketUser | undefined;
        if (!user) { return; }

        try {
            const request_id = getRequestIdFromPayload(payload);
            if (!request_id) { return; }

            const allowed = await canTrackRequest(request_id, user);
            if (!allowed) {
                logger.warn('Blocked unauthorized request tracking attempt', { socketId: socket.id, userId: user.id, requestId: request_id });
                socket.emit('tracking_denied', { resource: 'request', request_id });
                return;
            }

            if (!requestViewers.has(request_id)) {
                requestViewers.set(request_id, new Set());
            }
            requestViewers.get(request_id)!.add(socket.id);
            socket.join(`request_${request_id}`);

            const count = requestViewers.get(request_id)!.size;
            io.to(`request_${request_id}`).emit('viewer_count_update', { request_id, count });
        } catch (err: unknown) {
            logger.error('Failed to authorize request tracking', {
                socketId: socket.id,
                userId: user.id,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });

    socket.on('untrack_request_view', (payload: unknown) => {
        const request_id = getRequestIdFromPayload(payload);
        if (request_id && requestViewers.has(request_id)) {
            requestViewers.get(request_id)!.delete(socket.id);
            socket.leave(`request_${request_id}`);

            const count = requestViewers.get(request_id)!.size;
            io.to(`request_${request_id}`).emit('viewer_count_update', { request_id, count });
            if (count === 0) { requestViewers.delete(request_id); }
        }
    });

    // Tracking for specific order (server-side authorization enforced)
    socket.on('track_order', async (data: unknown) => {
        const user = socket.data.user as SocketUser | undefined;
        if (!user) { return; }

        try {
            const orderId = getOrderIdFromPayload(data);
            if (!orderId) { return; }

            const allowed = await canTrackOrder(orderId, user);
            if (!allowed) {
                logger.warn('Blocked unauthorized order tracking attempt', { socketId: socket.id, userId: user.id, orderId });
                socket.emit('tracking_denied', { resource: 'order', order_id: orderId });
                return;
            }

            socket.join(`tracking_${orderId}`);

            // Send last known driver location
            const result = await pool.query(`
                SELECT d.current_lat, d.current_lng, dl.heading, dl.speed, d.updated_at
                FROM orders o
                JOIN delivery_assignments da ON o.order_id = da.order_id
                JOIN drivers d ON da.driver_id = d.driver_id
                LEFT JOIN driver_locations dl ON d.driver_id = dl.driver_id
                WHERE o.order_id = $1 AND da.status IN ('assigned', 'picked_up', 'in_transit')
            `, [orderId]);

            if (result.rows.length > 0) {
                const loc = result.rows[0];
                if (loc.current_lat && loc.current_lng) {
                    socket.emit('driver_location_update', {
                        order_id: orderId,
                        latitude: parseFloat(loc.current_lat),
                        longitude: parseFloat(loc.current_lng),
                        heading: parseFloat(loc.heading || '0'),
                        speed: parseFloat(loc.speed || '0'),
                        timestamp: loc.updated_at
                    });
                }
            }
        } catch (err: unknown) {
            logger.error('Failed to process order tracking subscription', {
                socketId: socket.id,
                userId: user.id,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });

    socket.on('disconnect', () => {
        // Cleanup tracking
        requestViewers.forEach((viewers, requestId) => {
            if (viewers.has(socket.id)) {
                viewers.delete(socket.id);
                const count = viewers.size;
                io.to(`request_${requestId}`).emit('viewer_count_update', { request_id: requestId, count });
                if (count === 0) { requestViewers.delete(requestId); }
            }
        });
    });
});

// ============================================
// SCHEDULED JOBS (Distributed with fallback)
// ============================================
const JOB_INTERVAL = 1000 * 60 * 60; // 1 hour
let useDistributedJobs = false;

async function runScheduledJobs() {
    logger.info('Running scheduled jobs', { nodeId: NODE_ID });
    try {
        await jobs.runAllJobs();
    } catch (err: any) {
        logger.error('Scheduled job run failed', { nodeId: NODE_ID, error: err.message });
    }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
async function gracefulShutdown(signal: string) {
    logger.shutdown(`${signal} received, closing server gracefully`);

    server.close(async () => {
        logger.shutdown('HTTP server closed');

        try {
            // Close in order: jobs -> redis -> database
            await closeJobQueues();
            await closeRedis();
            await closeAllPools();
            logger.shutdown('All connections closed');
            process.exit(0);
        } catch (err: any) {
            logger.error('Shutdown error', { error: err.message });
            process.exit(1);
        }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after 30s timeout');
        process.exit(1);
    }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// SERVER STARTUP
// ============================================
server.listen(PORT, async () => {
    logger.startup(`QScrap Server ${NODE_ID} starting on port ${PORT} (${process.env.NODE_ENV || 'development'}, PID: ${process.pid})`);

    // Perform security validation before anything else
    performStartupSecurityChecks();

    // Initialize Redis (for caching)
    const redisClient = await initializeRedis();
    if (redisClient) {
        logger.startup('Redis connected (caching enabled)');
    }

    // Initialize Socket.IO Redis adapter (for multi-node)
    const socketAdapterReady = await initializeSocketAdapter(io);
    if (socketAdapterReady) {
        logger.startup('Socket.IO Redis adapter (multi-node ready)');
    }

    // Initialize job queues (for distributed jobs)
    useDistributedJobs = await initializeJobQueues();
    if (useDistributedJobs) {
        logger.startup('BullMQ job queues initialized');

        // Schedule recurring jobs via queue
        await scheduleRecurringJob('scheduled', 'hourly-jobs', {}, '0 * * * *');

        // Create worker for this node
        createJobWorker('scheduled', async (job) => {
            if (job.name === 'hourly-jobs') {
                await runScheduledJobs();
            }
        });
    } else {
        // Fallback to setInterval for single-node
        logger.info('Using setInterval scheduler (single-node)');
        setInterval(runScheduledJobs, JOB_INTERVAL);
    }

    // Database pool stats
    const dbStats = getPoolStats();
    logger.startup(`Database pool: ${dbStats.primary.total} connections`);
    if (dbStats.replica) {
        logger.startup(`Read replica: ${dbStats.replica.total} connections`);
    }

    // Start auto-complete cron job
    startAutoCompleteJob();
    logger.startup('Auto-complete job scheduled (daily 2:00 AM)');

    // Start delivery reminder job  
    startDeliveryReminderJob();
    logger.startup('Delivery reminders scheduled (hourly)');

    // Run initial job sweep (after 10 second delay)
    setTimeout(async () => {
        if (!useDistributedJobs) {
            logger.info('Running initial job sweep', { nodeId: NODE_ID });
            await runScheduledJobs();
        }
    }, 10000);

    // Periodic stats logging (every 5 minutes in production)
    if (process.env.NODE_ENV === 'production') {
        setInterval(async () => {
            const socketCount = await getGlobalSocketCount(io);
            const db = getPoolStats();
            logger.info('Server stats', { nodeId: NODE_ID, sockets: socketCount, dbConnections: db.primary.total, dbIdle: db.primary.idle });
        }, 5 * 60 * 1000);
    }
});
