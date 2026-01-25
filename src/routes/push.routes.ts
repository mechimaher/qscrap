/**
 * Push Notification Routes
 * 
 * Endpoints for registering and unregistering push tokens.
 * Used by mobile apps to enable push notifications.
 * 
 * @module routes/push.routes
 */

import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { pushService } from '../services/push.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

const router = Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

/**
 * POST /notifications/register
 * Register a push token for the authenticated user
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
    console.log('[PushToken] Registration attempt received');
    try {
        const { token, platform, device_id } = req.body;
        const userId = req.user!.userId;
        const userType = req.user!.userType;

        console.log('[PushToken] Registration details:', {
            userId: userId?.substring(0, 8),
            userType,
            platform,
            hasToken: !!token,
            tokenPrefix: token?.substring(0, 20),
            device_id
        });

        if (!token) {
            console.error('[PushToken] ❌ Missing token in request');
            return res.status(400).json({ error: 'Push token is required' });
        }

        if (!platform || !['ios', 'android'].includes(platform)) {
            console.error('[PushToken] ❌ Invalid platform:', platform);
            return res.status(400).json({ error: 'Platform must be ios or android' });
        }

        // Determine app type based on user type
        const appType = userType === 'driver' ? 'driver' : 'customer';
        console.log('[PushToken] Determined app_type:', appType, 'from userType:', userType);

        await pushService.registerToken(userId, token, platform, appType, device_id);

        console.log('[PushToken] ✅ Token registered successfully for', userType, 'as', appType);
        res.json({
            success: true,
            message: 'Push token registered successfully'
        });
    } catch (err) {
        console.error('[PushToken] ❌ Registration failed:', err);
        res.status(500).json({ error: 'Failed to register push token' });
    }
});

/**
 * DELETE /notifications/unregister
 * Unregister push token(s) for the authenticated user
 */
router.delete('/unregister', async (req: AuthRequest, res: Response) => {
    try {
        const { token } = req.body;
        const userId = req.user!.userId;

        await pushService.unregisterToken(userId, token);

        res.json({
            success: true,
            message: 'Push token unregistered successfully'
        });
    } catch (err) {
        console.error('Push unregister error:', err);
        res.status(500).json({ error: 'Failed to unregister push token' });
    }
});

/**
 * POST /notifications/test
 * Send a test push notification to the authenticated user (dev only)
 */
if (process.env.NODE_ENV !== 'production') {
    router.post('/test', async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.userId;
            const { title, body } = req.body;

            const results = await pushService.sendToUser(
                userId,
                title || '🔔 Test Notification',
                body || 'This is a test push notification from QScrap',
                { type: 'test', timestamp: new Date().toISOString() }
            );

            res.json({
                success: true,
                results,
                message: `Sent to ${results.length} device(s)`
            });
        } catch (err) {
            console.error('Push test error:', err);
            res.status(500).json({ error: 'Failed to send test notification' });
        }
    });
}

export default router;
