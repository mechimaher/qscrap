
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markRead } from '../controllers/notification.controller';

const router = Router();

router.get('/', authenticate, getNotifications);
router.post('/mark-read', authenticate, markRead);

export default router;
