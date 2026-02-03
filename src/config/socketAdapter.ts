import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import logger from '../utils/logger';

// ============================================
// SOCKET.IO REDIS ADAPTER
// For multi-node Socket.IO scaling
// ============================================

/**
 * Initialize Redis adapter for Socket.IO
 * Enables Socket.IO to work across multiple server nodes
 */
export async function initializeSocketAdapter(io: Server): Promise<boolean> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        logger.info('Socket.IO: No REDIS_URL - single-node mode');
        return false;
    }

    try {
        // Create Redis clients for pub/sub
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();

        // Error handlers
        pubClient.on('error', (err) => {
            logger.error('Socket.IO Redis pub error', { error: err.message });
        });

        subClient.on('error', (err) => {
            logger.error('Socket.IO Redis sub error', { error: err.message });
        });

        // Connect both clients
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);

        // Set the adapter
        io.adapter(createAdapter(pubClient, subClient));

        logger.startup('Socket.IO Redis adapter connected - multi-node ready');
        return true;
    } catch (err: any) {
        logger.error('Socket.IO: Failed to initialize Redis adapter', { error: err.message });
        logger.info('Socket.IO: Falling back to single-node mode');
        return false;
    }
}

/**
 * Get connected socket count across all nodes
 */
export async function getGlobalSocketCount(io: Server): Promise<number> {
    try {
        const sockets = await io.fetchSockets();
        return sockets.length;
    } catch (err) {
        return 0;
    }
}

/**
 * Emit to all nodes in a room
 * Works the same whether using Redis adapter or not
 */
export function emitToRoom(io: Server, room: string, event: string, data: any): void {
    io.to(room).emit(event, data);
}

/**
 * Emit to specific user across all nodes
 */
export function emitToUser(io: Server, userId: string, event: string, data: any): void {
    io.to(`user_${userId}`).emit(event, data);
}

/**
 * Emit to specific garage across all nodes
 */
export function emitToGarage(io: Server, garageId: string, event: string, data: any): void {
    io.to(`garage_${garageId}`).emit(event, data);
}

/**
 * Emit to operations room across all nodes
 */
export function emitToOperations(io: Server, event: string, data: any): void {
    io.to('operations').emit(event, data);
}

/**
 * Emit to driver across all nodes
 */
export function emitToDriver(io: Server, driverId: string, event: string, data: any): void {
    io.to(`driver_${driverId}`).emit(event, data);
}
