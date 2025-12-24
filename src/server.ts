import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import pool, { closeAllPools, getPoolStats } from './config/db';
import jobs from './config/jobs';
import { closeRedis, initializeRedis } from './config/redis';
import { initializeSocketAdapter, getGlobalSocketCount } from './config/socketAdapter';
import { initializeJobQueues, closeJobQueues, createJobWorker, scheduleRecurringJob } from './config/jobQueue';

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

// Make io accessible globally
(global as any).io = io;

io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${NODE_ID}] User connected: ${socket.id}`);
    }

    socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
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
    console.log(`[${NODE_ID}] Running scheduled jobs...`);
    try {
        await jobs.runAllJobs();
    } catch (err) {
        console.error(`[${NODE_ID}] Job run failed:`, err);
    }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
async function gracefulShutdown(signal: string) {
    console.log(`[${NODE_ID}] ${signal} received, closing server gracefully...`);

    server.close(async () => {
        console.log(`[${NODE_ID}] HTTP server closed`);

        try {
            // Close in order: jobs -> redis -> database
            await closeJobQueues();
            await closeRedis();
            await closeAllPools();
            console.log(`[${NODE_ID}] All connections closed`);
            process.exit(0);
        } catch (err) {
            console.error(`[${NODE_ID}] Shutdown error:`, err);
            process.exit(1);
        }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error(`[${NODE_ID}] Forced shutdown after 30s timeout`);
        process.exit(1);
    }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// SERVER STARTUP
// ============================================
server.listen(PORT, async () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🚀 QScrap Server - ${NODE_ID}`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Port: ${PORT}`);
    console.log(`   Env:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`   PID:  ${process.pid}`);
    console.log('');

    // Initialize Redis (for caching)
    const redisClient = await initializeRedis();
    if (redisClient) {
        console.log('✅ Redis connected (caching enabled)');
    }

    // Initialize Socket.IO Redis adapter (for multi-node)
    const socketAdapterReady = await initializeSocketAdapter(io);
    if (socketAdapterReady) {
        console.log('✅ Socket.IO Redis adapter (multi-node ready)');
    }

    // Initialize job queues (for distributed jobs)
    useDistributedJobs = await initializeJobQueues();
    if (useDistributedJobs) {
        console.log('✅ BullMQ job queues initialized');

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
        console.log('ℹ️  Using setInterval scheduler (single-node)');
        setInterval(runScheduledJobs, JOB_INTERVAL);
    }

    // Database pool stats
    const dbStats = getPoolStats();
    console.log(`✅ Database pool: ${dbStats.primary.total} connections`);
    if (dbStats.replica) {
        console.log(`✅ Read replica: ${dbStats.replica.total} connections`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // Run initial job sweep (after 10 second delay)
    setTimeout(async () => {
        if (!useDistributedJobs) {
            console.log(`[${NODE_ID}] Running initial job sweep...`);
            await runScheduledJobs();
        }
    }, 10000);

    // Periodic stats logging (every 5 minutes in production)
    if (process.env.NODE_ENV === 'production') {
        setInterval(async () => {
            const socketCount = await getGlobalSocketCount(io);
            const db = getPoolStats();
            console.log(`[${NODE_ID}] Stats: ${socketCount} sockets, ${db.primary.total}/${db.primary.idle} DB connections`);
        }, 5 * 60 * 1000);
    }
});
