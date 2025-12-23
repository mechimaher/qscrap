import { Router } from 'express';
import {
    createTicket,
    getTickets,
    getTicketMessages,
    sendMessage,
    updateTicketStatus
} from '../controllers/support.controller';
import { authenticate, authorizeOperations } from '../middleware/auth.middleware';

const router = Router();

// Customer & Operations: Get my tickets / All tickets
router.get('/tickets', authenticate, getTickets);

// Customer: Create a new ticket
router.post('/tickets', authenticate, createTicket);

// Both: Get messages for a ticket
router.get('/tickets/:ticket_id/messages', authenticate, getTicketMessages);

// Both: Send a message in a ticket
router.post('/tickets/:ticket_id/messages', authenticate, sendMessage);

// Operations: Update status (close/resolve)
router.patch('/tickets/:ticket_id/status', authenticate, authorizeOperations, updateTicketStatus);

export default router;
