"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const chat_controller_1 = require("../controllers/chat.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// =============================================================================
// ORDER-BASED ROUTES (for mobile app)
// =============================================================================
// Get chat messages for an order (mobile app uses this)
router.get('/messages/:order_id', chat_controller_1.getOrderChatMessages);
// Send a chat message for an order (mobile app uses this)
router.post('/messages', chat_controller_1.sendOrderChatMessage);
// =============================================================================
// ASSIGNMENT-BASED ROUTES (for web dashboard)
// =============================================================================
// Get chat messages for an assignment
router.get('/assignment/:assignment_id', chat_controller_1.getChatMessages);
// Send a chat message
router.post('/assignment/:assignment_id', chat_controller_1.sendChatMessage);
// Get unread message count for current user
router.get('/unread', chat_controller_1.getUnreadCount);
exports.default = router;
