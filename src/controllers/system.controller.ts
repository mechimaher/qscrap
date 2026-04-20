import { Request, Response } from 'express';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { getIO } from '../utils/socketIO';

/**
 * System Controller
 * Handles global configuration and system-level diagnostics.
 */

export const getPublicConfig = async (req: Request, res: Response) => {
    try {
        // Return public-facing configuration
        // This avoids hardcoding sensitive keys in the frontend source code
        res.json({
            google_maps_key: process.env.GOOGLE_MAPS_KEY || 'AIzaSyBtetLMBqtW1TNNsBFWi5Xa4LTy1GEbwYw', // Fallback to current hardcoded key if not in .env
            support_phone: '+974 5026 7974',
            support_email: 'support@qscrap.qa',
            app_version: '2.4.1',
            maintenance_mode: process.env.MAINTENANCE_MODE === 'true'
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};


export const getSystemStatus = async (req: Request, res: Response) => {
    try {
        const startTime = Date.now();
        
        // 1. DB Health & Brokerage Pulse
        const dbCheck = await pool.query('SELECT COUNT(*) as count FROM part_requests WHERE status = \'active\'');
        const activeRequests = parseInt(dbCheck.rows[0].count);

        const bidCheck = await pool.query('SELECT COUNT(*) as count FROM bids WHERE created_at > NOW() - INTERVAL \'24 hours\'');
        const bidsLast24h = parseInt(bidCheck.rows[0].count);

        // 2. Socket Liquidity (Connected Garages)
        const io = getIO();
        let connectedClients = 0;
        if (io) {
            connectedClients = io.engine.clientsCount;
        }

        res.json({
            status: 'operational',
            environment: process.env.NODE_ENV || 'production',
            latency_ms: Date.now() - startTime,
            brokerage: {
                active_requests: activeRequests,
                bids_last_24h: bidsLast24h,
                live_liquidity: connectedClients,
                market_velocity: activeRequests > 0 ? (bidsLast24h / activeRequests).toFixed(2) : 0
            },
            timestamp: new Date().toISOString(),
            version: '2.4.1'
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'degraded',
            error: getErrorMessage(err),
            timestamp: new Date().toISOString()
        });
    }
};
