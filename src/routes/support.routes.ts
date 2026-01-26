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
    getTicketDetail,
    getSLAStats,
    assignTicket,
    reopenTicket,
    // Customer Resolution Center
    getCustomer360,
    addCustomerNote,
    executeQuickAction,
    getResolutionLogs
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

// Customer: Reopen a closed ticket (within 7 days)
router.post('/tickets/:ticket_id/reopen', authenticate, reopenTicket);

// Operations: Update status (close/resolve)
router.patch('/tickets/:ticket_id/status', authenticate, authorizeOperations, updateTicketStatus);

// Operations: Assign ticket to agent
router.patch('/tickets/:ticket_id/assign', authenticate, authorizeOperations, assignTicket);

// SLA statistics (30-day rolling)
router.get('/sla-stats', authenticate, authorizeOperations, getSLAStats);

// ==========================================
// CUSTOMER RESOLUTION CENTER
// ==========================================

// Customer 360 lookup - search by phone, name, email, order#
router.get('/customer-360/:query', authenticate, authorizeOperations, getCustomer360);
router.get('/customer-360', authenticate, authorizeOperations, getCustomer360);

// Add internal note about customer
router.post('/notes', authenticate, authorizeOperations, addCustomerNote);

// Execute quick action (refund, reassign, escalate, etc.)
router.post('/quick-action', authenticate, authorizeOperations, executeQuickAction);

// Get resolution logs
router.get('/resolution-logs', authenticate, authorizeOperations, getResolutionLogs);

export default router;
