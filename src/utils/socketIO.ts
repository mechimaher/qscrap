/**
 * Socket.IO Singleton Module
 * 
 * Provides type-safe access to the Socket.IO server instance
 * throughout the application without using global type casting.
 */

import { Server } from 'socket.io';

let ioInstance: Server | null = null;

/**
 * Initialize the Socket.IO singleton
 * Called once during server startup
 */
export function initializeSocketIO(io: Server): void {
    if (ioInstance) {
        throw new Error('Socket.IO already initialized');
    }
    ioInstance = io;
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
 * Cleanup for testing purposes
 */
export function resetSocketIO(): void {
    ioInstance = null;
}
