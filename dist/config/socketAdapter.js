"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketAdapter = initializeSocketAdapter;
exports.getGlobalSocketCount = getGlobalSocketCount;
exports.emitToRoom = emitToRoom;
exports.emitToUser = emitToUser;
exports.emitToGarage = emitToGarage;
exports.emitToOperations = emitToOperations;
exports.emitToDriver = emitToDriver;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
// ============================================
// SOCKET.IO REDIS ADAPTER
// For multi-node Socket.IO scaling
// ============================================
/**
 * Initialize Redis adapter for Socket.IO
 * Enables Socket.IO to work across multiple server nodes
 */
async function initializeSocketAdapter(io) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.log('ℹ️ [Socket.IO] No REDIS_URL - single-node mode');
        return false;
    }
    try {
        // Create Redis clients for pub/sub
        const pubClient = (0, redis_1.createClient)({ url: redisUrl });
        const subClient = pubClient.duplicate();
        // Error handlers
        pubClient.on('error', (err) => {
            console.error('[Socket.IO] Redis pub error:', err.message);
        });
        subClient.on('error', (err) => {
            console.error('[Socket.IO] Redis sub error:', err.message);
        });
        // Connect both clients
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);
        // Set the adapter
        io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
        console.log('✅ [Socket.IO] Redis adapter connected - multi-node ready');
        return true;
    }
    catch (err) {
        console.error('[Socket.IO] Failed to initialize Redis adapter:', err.message);
        console.log('[Socket.IO] Falling back to single-node mode');
        return false;
    }
}
/**
 * Get connected socket count across all nodes
 */
async function getGlobalSocketCount(io) {
    try {
        const sockets = await io.fetchSockets();
        return sockets.length;
    }
    catch (err) {
        return 0;
    }
}
/**
 * Emit to all nodes in a room
 * Works the same whether using Redis adapter or not
 */
function emitToRoom(io, room, event, data) {
    io.to(room).emit(event, data);
}
/**
 * Emit to specific user across all nodes
 */
function emitToUser(io, userId, event, data) {
    io.to(`user_${userId}`).emit(event, data);
}
/**
 * Emit to specific garage across all nodes
 */
function emitToGarage(io, garageId, event, data) {
    io.to(`garage_${garageId}`).emit(event, data);
}
/**
 * Emit to operations room across all nodes
 */
function emitToOperations(io, event, data) {
    io.to('operations').emit(event, data);
}
/**
 * Emit to driver across all nodes
 */
function emitToDriver(io, driverId, event, data) {
    io.to(`driver_${driverId}`).emit(event, data);
}
