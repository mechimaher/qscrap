import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { pushService } from '../services/push.service';
import logger from '../utils/logger';

/**
 * Push Notification Controller
 * Handles push token registration and management
 */

/**
 * POST /notifications/register
 * Register a push token for the authenticated user
 */
export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
    logger.info('Push token registration attempt received');
    try {
        const { token, platform, device_id } = req.body;
        const userId = req.user!.userId;
        const userType = req.user!.userType;

        logger.info('Push token registration details', {
            userId: userId?.substring(0, 8),
            userType,
            platform,
            hasToken: !!token,
            tokenPrefix: token?.substring(0, 20),
            device_id
        });

        if (!token) {
            logger.error('Missing token in request');
            res.status(400).json({ error: 'Push token is required' });
            return;
        }

        if (!platform || !['ios', 'android'].includes(platform)) {
            logger.error('Invalid platform', { platform });
            res.status(400).json({ error: 'Platform must be ios or android' });
            return;
        }

        // Determine app type based on user type
        const appType = userType === 'driver' ? 'driver' : 'customer';
        logger.info('Determined app_type', { appType, userType });

        await pushService.registerToken(userId, token, platform, appType, device_id);

        logger.info('Token registered successfully', { userType, appType });
        res.json({
            success: true,
            message: 'Push token registered successfully'
        });
    } catch (err) {
        logger.error('Registration failed', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to register push token' });
    }
};

/**
 * DELETE /notifications/unregister
 * Unregister push token(s) for the authenticated user
 */
export const unregisterPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { token } = req.body;
        const userId = req.user!.userId;

        await pushService.unregisterToken(userId, token);

        res.json({
            success: true,
            message: 'Push token unregistered successfully'
        });
    } catch (err) {
        logger.error('Push unregister error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to unregister push token' });
    }
};

/**
 * POST /notifications/test
 * Send a test push notification to the authenticated user (dev only)
 */
export const sendTestPushNotification = async (req: AuthRequest, res: Response): Promise<void> => {
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
        logger.error('Push test error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to send test notification' });
    }
};
