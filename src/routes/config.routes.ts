import express from 'express';
import { requestContext } from '../middleware/requestContext.middleware';

const router = express.Router();

/**
 * @route   GET /api/config/public
 * @desc    Get public configuration (safe keys only)
 * @access  Public
 */
router.get('/public', requestContext, (req, res) => {
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
});

export default router;
