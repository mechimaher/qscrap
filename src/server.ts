import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import pool, { closeAllPools } from './config/db';
import jobs from './config/jobs';
import { closeRedis } from './config/redis';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Socket.IO Setup
export const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make io accessible globally
(global as any).io = io;


io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined user_${userId}`);
    });

    socket.on('join_garage_room', (garageId) => {
        socket.join(`garage_${garageId}`);
        console.log(`Socket ${socket.id} joined garage_${garageId}`);
    });

    // Operations staff room
    socket.on('join_operations_room', () => {
        socket.join('operations');
        console.log(`Socket ${socket.id} joined operations room`);
    });

    // Support ticket room
    socket.on('join_ticket', (ticketId) => {
        socket.join(`ticket_${ticketId}`);
        console.log(`Socket ${socket.id} joined ticket_${ticketId}`);
    });

    // Driver room for delivery notifications
    socket.on('join_driver_room', (driverId) => {
        socket.join(`driver_${driverId}`);
        console.log(`Socket ${socket.id} joined driver_${driverId}`);
    });

    // Delivery chat room (customer-driver communication)
    socket.on('join_delivery_chat', (assignmentId) => {
        socket.join(`chat_${assignmentId}`);
        console.log(`Socket ${socket.id} joined chat_${assignmentId}`);
    });

    socket.on('leave_delivery_chat', (assignmentId) => {
        socket.leave(`chat_${assignmentId}`);
        console.log(`Socket ${socket.id} left chat_${assignmentId}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// ============================================
// SCHEDULED JOBS (Run every hour)
// ============================================
const JOB_INTERVAL = 1000 * 60 * 60; // 1 hour

async function runScheduledJobs() {
    console.log('[SCHEDULER] Running scheduled jobs...');
    try {
        await jobs.runAllJobs();
    } catch (err) {
        console.error('[SCHEDULER] Job run failed:', err);
    }
}

// Schedule recurring jobs
setInterval(runScheduledJobs, JOB_INTERVAL);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] SIGTERM received, closing server gracefully...');
    server.close(async () => {
        console.log('[SHUTDOWN] HTTP server closed');
        await closeRedis();
        await closeAllPools();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('[SHUTDOWN] SIGINT received, closing server gracefully...');
    server.close(async () => {
        console.log('[SHUTDOWN] HTTP server closed');
        await closeRedis();
        await closeAllPools();
        process.exit(0);
    });
});

// ============================================
// SERVER STARTUP
// ============================================
server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Run jobs once on startup (after 10 second delay to ensure DB is ready)
    setTimeout(async () => {
        console.log('[STARTUP] Running initial job sweep...');
        await runScheduledJobs();
    }, 10000);
});

