/**
 * Socket.IO Singleton Module
 * 
 * Provides type-safe access to the Socket.IO server instance
 * throughout the application without using global type casting.
 */

import { Server } from 'socket.io';
import logger from './logger';

let ioInstance: Server | null = null;

// Track viewers per request for real-time viewer count
const requestViewers = new Map<string, Set<string>>();

/**
 * Initialize the Socket.IO singleton
 * Called once during server startup
 */
export function initializeSocketIO(io: Server): void {
    if (ioInstance) {
        throw new Error('Socket.IO already initialized');
    }
    ioInstance = io;

    io.on('connection', (socket) => {
        logger.socket('Client connected', { socketId: socket.id });

        socket.on('track_request_view', ({ request_id }: { request_id: string }) => {
            if (!requestViewers.has(request_id)) {
                requestViewers.set(request_id, new Set());
            }
            requestViewers.get(request_id)!.add(socket.id);
            socket.join(`request_${request_id}`);

            // Broadcast updated count to all viewers
            const count = requestViewers.get(request_id)!.size;
            io.to(`request_${request_id}`).emit('viewer_count_update', {
                request_id,
                count
            });

            logger.socket('User tracking request', { socketId: socket.id, requestId: request_id, viewerCount: count });
        });

        socket.on('untrack_request_view', ({ request_id }: { request_id: string }) => {
            if (requestViewers.has(request_id)) {
                requestViewers.get(request_id)!.delete(socket.id);
                socket.leave(`request_${request_id}`);

                const count = requestViewers.get(request_id)!.size;
                io.to(`request_${request_id}`).emit('viewer_count_update', {
                    request_id,
                    count
                });

                if (count === 0) {
                    requestViewers.delete(request_id);
                }
            }
        });

        // Driver room - CRITICAL for real-time assignment delivery
        socket.on('join_driver_room', (driverId: string) => {
            if (driverId) {
                socket.join(`driver_${driverId}`);
                logger.socket('Driver joined room', { socketId: socket.id, driverId });
            }
        });

        // Generic room join (used by driver app for chat rooms)
        socket.on('join_room', (room: string) => {
            if (room) {
                socket.join(room);
                logger.socket('Client joined room', { socketId: socket.id, room });
            }
        });

        // Admin dashboard room - for real-time pending counts
        socket.on('join_admin_room', () => {
            socket.join('admin');
            logger.socket('Admin client joined admin room', { socketId: socket.id });
        });

        socket.on('disconnect', () => {
            logger.socket('Client disconnected', { socketId: socket.id });

            // Remove from all tracked requests
            requestViewers.forEach((viewers, requestId) => {
                if (viewers.has(socket.id)) {
                    viewers.delete(socket.id);
                    const count = viewers.size;
                    io.to(`request_${requestId}`).emit('viewer_count_update', {
                        request_id: requestId,
                        count
                    });

                    if (count === 0) {
                        requestViewers.delete(requestId);
                    }
                }
            });
        });
    });
}

/**
 * Get the Socket.IO server instance
 * Returns null if not initialized (safe for use in jobs/services)
 */
export function getIO(): Server | null {
    return ioInstance;
}

/**
 * Emit to a specific room if Socket.IO is available
 * Safely handles the case where socket is not initialized
 */
export function emitToRoom(room: string, event: string, data: unknown): boolean {
    if (!ioInstance) return false;
    ioInstance.to(room).emit(event, data);
    return true;
}

/**
 * Emit to user room helper
 */
export function emitToUser(userId: string, event: string, data: unknown): boolean {
    return emitToRoom(`user_${userId}`, event, data);
}

/**
 * Emit to garage room helper
 */
export function emitToGarage(garageId: string, event: string, data: unknown): boolean {
    return emitToRoom(`garage_${garageId}`, event, data);
}

/**
 * Emit to operations room helper
 */
export function emitToOperations(event: string, data: unknown): boolean {
    return emitToRoom('operations', event, data);
}

/**
 * Emit to driver room helper
 */
export function emitToDriver(driverId: string, event: string, data: unknown): boolean {
    return emitToRoom(`driver_${driverId}`, event, data);
}

/**
 * Emit to admin room helper
 * Used for real-time admin dashboard updates
 */
export function emitToAdmin(event: string, data: unknown): boolean {
    return emitToRoom('admin', event, data);
}

/**
 * Cleanup for testing purposes
 */
export function resetSocketIO(): void {
    ioInstance = null;
}

