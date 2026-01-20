import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markRead, getUnreadNotificationCount, getBadgeCounts } from '../controllers/notification.controller';
import { pushService } from '../services/push.service';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadNotificationCount);
router.get('/badge-counts', authenticate, getBadgeCounts);  // Tab bar badges
router.post('/mark-read', authenticate, markRead);

// Push Notification Registration (Moved from deprecated push.routes.ts)
router.post('/register-token', authenticate, async (req: any, res: any) => {
    try {
        const { token, platform, device_id } = req.body;
        const userId = req.user!.userId;
        const userType = req.user!.userType;

        if (!token) return res.status(400).json({ error: 'Push token is required' });

        const appType = userType === 'driver' ? 'driver' : 'customer';
        await pushService.registerToken(userId, token, platform || 'android', appType, device_id);

        res.json({ success: true, message: 'Push token registered' });
    } catch (err) {
        console.error('Push register error:', err);
        res.status(500).json({ error: 'Failed to register token' });
    }
});

export default router;
