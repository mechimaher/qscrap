import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getChatMessages, sendChatMessage, getUnreadCount } from '../controllers/chat.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get chat messages for an assignment
router.get('/assignment/:assignment_id', getChatMessages);

// Send a chat message
router.post('/assignment/:assignment_id', sendChatMessage);

// Get unread message count for current user
router.get('/unread', getUnreadCount);

export default router;
