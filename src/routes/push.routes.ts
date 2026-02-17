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
import {
    registerPushToken,
    unregisterPushToken,
    sendTestPushNotification
} from '../controllers/push.controller';

const router = Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

/**
 * @route   POST /notifications/register
 * @desc    Register a push token for the authenticated user
 * @access  Private
 */
router.post('/register', registerPushToken);

/**
 * @route   DELETE /notifications/unregister
 * @desc    Unregister push token(s) for the authenticated user
 * @access  Private
 */
router.delete('/unregister', unregisterPushToken);

/**
 * @route   POST /notifications/test
 * @desc    Send a test push notification (dev only)
 * @access  Private (dev only)
 */
if (process.env.NODE_ENV !== 'production') {
    router.post('/test', sendTestPushNotification);
}

export default router;

