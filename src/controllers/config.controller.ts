import { Request, Response } from 'express';

/**
 * Config Controller
 * Handles public configuration endpoints
 */

/**
 * GET /config/public
 * Get public configuration (safe keys only)
 */
export const getPublicConfig = (req: Request, res: Response): void => {
    res.json({
        success: true,
        config: {
            // Safe to expose (restricted by HTTP Referrer in Google Cloud Console)
            googleMapsKey: process.env.GOOGLE_MAPS_KEY || '',
            // Safe to expose (DSN is public)
            sentryDsn: process.env.SENTRY_DSN || '',
            // Environment context
            environment: process.env.NODE_ENV || 'development'
        },
        timestamp: new Date().toISOString()
    });
};
