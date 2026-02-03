import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import pool, { closeAllPools, getPoolStats } from './config/db';
import jobs from './config/jobs';
import { closeRedis, initializeRedis } from './config/redis';
import { initializeSocketAdapter, getGlobalSocketCount } from './config/socketAdapter';
import { initializeJobQueues, closeJobQueues, createJobWorker, scheduleRecurringJob } from './config/jobQueue';
import { performStartupSecurityChecks } from './config/security';
import { initializeSocketIO } from './utils/socketIO';
import logger from './utils/logger';
import { startAutoCompleteJob } from './jobs/auto-complete-orders';
import { startDeliveryReminderJob } from './jobs/delivery-reminders';

const PORT = process.env.PORT || 3000;
const NODE_ID = process.env.NODE_ID || `node-${process.pid}`;

const server = http.createServer(app);

// ============================================
// SOCKET.IO SETUP (Multi-node ready)
// ============================================
export const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
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

// DEPRECATED: Remove after migrating all (global as any).io usages
// Kept temporarily for backward compatibility
(global as any).io = io;

io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
        logger.socket('User connected', { socketId: socket.id });
    }

    socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
        logger.socket('User joined room', { userId, room: `user_${userId}` });
    });

    // Mobile app customer room join - extracts user ID from auth token
    socket.on('join_customer_room', async () => {
        try {
            const token = socket.handshake.auth?.token;
            if (token) {
                const jwt = require('jsonwebtoken');
                const { getJwtSecret } = require('./config/security');
                const decoded = jwt.verify(token, getJwtSecret()) as { userId?: string; user_id?: string };
                const userId = decoded.userId || decoded.user_id;
                if (userId) {
                    socket.join(`user_${userId}`);
                    logger.socket('Customer joined room', { userId, room: `user_${userId}` });
                }
            }
        } catch (err: any) {
            logger.error('join_customer_room error', { error: err.message });
        }
    });

    socket.on('join_garage_room', (garageId) => {
        socket.join(`garage_${garageId}`);
    });

    socket.on('join_operations_room', () => {
        socket.join('operations');
    });

    socket.on('join_ticket', (ticketId) => {
        socket.join(`ticket_${ticketId}`);
    });

    socket.on('join_driver_room', (driverId) => {
        socket.join(`driver_${driverId}`);
    });

    socket.on('join_delivery_chat', (assignmentId) => {
        socket.join(`chat_${assignmentId}`);
    });

    socket.on('leave_delivery_chat', (assignmentId) => {
        socket.leave(`chat_${assignmentId}`);
    });

    // Mobile app chat handlers
    socket.on('join_order_chat', (data) => {
        const orderId = data?.order_id || data;
        socket.join(`order_${orderId}`);
        if (process.env.NODE_ENV !== 'production') {
            logger.socket('User joined order chat', { room: `order_${orderId}` });
        }
    });

    socket.on('join_room', (roomName) => {
        socket.join(roomName);
    });

    socket.on('track_order', async (data) => {
        const orderId = data?.order_id || data;
        socket.join(`tracking_${orderId}`);

        // FIX: Immediately send last known driver location
        try {
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
        } catch (err: any) {
            logger.error('Failed to fetch initial driver location', { orderId, error: err.message });
        }
    });

    socket.on('disconnect', () => {
        // Silent in production
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
