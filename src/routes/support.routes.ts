import { Router } from 'express';
import {
    createTicket,
    getTickets,
    getTicketMessages,
    sendMessage,
    updateTicketStatus,
    getStats,
    getUrgent,
    getActivity,
    getTicketDetail
} from '../controllers/support.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';

const router = Router();

// ==========================================
// DASHBOARD ENDPOINTS (Operations/Support)
// ==========================================

// Stats for dashboard overview
router.get('/stats', authenticate, authorizeOperations, getStats);

// Urgent items requiring immediate action
router.get('/urgent', authenticate, authorizeOperations, getUrgent);

// Recent activity feed
router.get('/activity', authenticate, authorizeOperations, getActivity);

// ==========================================
// TICKET MANAGEMENT
// ==========================================

// Customer & Operations: Get my tickets / All tickets
router.get('/tickets', authenticate, getTickets);

// Customer: Create a new ticket
router.post('/tickets', authenticate, createTicket);

// Get single ticket with messages (for Support dashboard chat view)
router.get('/tickets/:ticket_id', authenticate, getTicketDetail);

// Both: Get messages for a ticket
router.get('/tickets/:ticket_id/messages', authenticate, getTicketMessages);

// Both: Send a message in a ticket (alias for reply)
router.post('/tickets/:ticket_id/messages', authenticate, sendMessage);
router.post('/tickets/:ticket_id/reply', authenticate, sendMessage);

// Operations: Update status (close/resolve)
router.patch('/tickets/:ticket_id/status', authenticate, authorizeOperations, updateTicketStatus);

export default router;
