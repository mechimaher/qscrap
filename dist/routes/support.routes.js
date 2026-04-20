"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const support_controller_1 = require("../controllers/support.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const router = (0, express_1.Router)();
// Customer & Operations: Get my tickets / All tickets
router.get('/tickets', auth_middleware_1.authenticate, support_controller_1.getTickets);
// Customer: Create a new ticket
router.post('/tickets', auth_middleware_1.authenticate, support_controller_1.createTicket);
// Both: Get messages for a ticket
router.get('/tickets/:ticket_id/messages', auth_middleware_1.authenticate, support_controller_1.getTicketMessages);
// Both: Send a message in a ticket
router.post('/tickets/:ticket_id/messages', auth_middleware_1.authenticate, support_controller_1.sendMessage);
// Operations: Update status (close/resolve)
router.patch('/tickets/:ticket_id/status', auth_middleware_1.authenticate, authorize_middleware_1.authorizeOperations, support_controller_1.updateTicketStatus);
exports.default = router;
