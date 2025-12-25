import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getChatMessages, sendChatMessage, getUnreadCount, getOrderChatMessages, sendOrderChatMessage } from '../controllers/chat.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// ORDER-BASED ROUTES (for mobile app)
// =============================================================================

// Get chat messages for an order (mobile app uses this)
router.get('/messages/:order_id', getOrderChatMessages);

// Send a chat message for an order (mobile app uses this)
router.post('/messages', sendOrderChatMessage);

// =============================================================================
// ASSIGNMENT-BASED ROUTES (for web dashboard)
// =============================================================================

// Get chat messages for an assignment
router.get('/assignment/:assignment_id', getChatMessages);

// Send a chat message
router.post('/assignment/:assignment_id', sendChatMessage);

// Get unread message count for current user
router.get('/unread', getUnreadCount);

export default router;
