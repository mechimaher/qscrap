import { Router } from 'express';
import {
    createTicket,
    getTickets,
    getTicketMessages,
    sendMessage,
    updateTicketStatus,
    getStats,
    getMyEscalations,
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
    getResolutionLogs,
    // Phase 3 Enhancements
    createTicketForCustomer,
    getCannedResponses,
    grantGoodwillCredit,
    getOrderDetailsForSupport
} from '../controllers/support.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';

const router = Router();

// ==========================================
// DASHBOARD ENDPOINTS (Agents only)
// ==========================================

router.get('/stats', authenticate, authorizeOperations, getStats);
router.get('/my-escalations', authenticate, authorizeOperations, getMyEscalations);
router.get('/urgent', authenticate, authorizeOperations, getUrgent);
router.get('/activity', authenticate, authorizeOperations, getActivity);
router.get('/sla-stats', authenticate, authorizeOperations, getSLAStats);

// ==========================================
// TICKET MANAGEMENT
// ==========================================

// List tickets (customer sees own, agents see all/filtered)
router.get('/tickets', authenticate, getTickets);

// Create ticket (customers & garages/drivers)
router.post('/tickets', authenticate, createTicket);

// Agent: Create ticket on behalf of customer
router.post('/tickets/create-for-customer', authenticate, authorizeOperations, createTicketForCustomer);

// Ticket detail (customers can view their own, agents can view all)
router.get('/tickets/:ticketId', authenticate, getTicketDetail);

// Messages: Get
router.get('/tickets/:ticketId/messages', authenticate, getTicketMessages);

// Messages: Send (regular or internal)
router.post('/tickets/:ticketId/messages', authenticate, sendMessage);

// Status update (agents only)
router.patch('/tickets/:ticketId/status', authenticate, authorizeOperations, updateTicketStatus);

// Assign ticket (agents only)
router.patch('/tickets/:ticketId/assign', authenticate, authorizeOperations, assignTicket);

// Customer: Reopen closed ticket (within 7 days)
router.post('/tickets/:ticketId/reopen', authenticate, reopenTicket);

// ==========================================
// CUSTOMER RESOLUTION CENTER (Agents only)
// ==========================================

// Customer 360 lookup
router.get('/customer-360/:query', authenticate, authorizeOperations, getCustomer360);
router.get('/customer-360', authenticate, authorizeOperations, getCustomer360);

// Internal customer note
router.post('/notes', authenticate, authorizeOperations, addCustomerNote);

// Quick actions (refund, cancel, reassign, escalate, etc.)
router.post('/quick-action', authenticate, authorizeOperations, executeQuickAction);

// Resolution logs (?customer_id= or ?order_id=)
router.get('/resolution-logs', authenticate, authorizeOperations, getResolutionLogs);

// ==========================================
// PHASE 3 ENHANCEMENTS (Agents only)
// ==========================================

// Canned responses (?category=optional)
router.get('/canned-responses', authenticate, authorizeOperations, getCannedResponses);

// Grant goodwill credit
router.post('/goodwill-credit', authenticate, authorizeOperations, grantGoodwillCredit);

// Full order details for decision-making
router.get('/order-details/:order_id', authenticate, authorizeOperations, getOrderDetailsForSupport);

export default router;

