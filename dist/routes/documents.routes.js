"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const documents_controller_1 = require("../controllers/documents.controller");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================
// Public verification endpoint (QR code scanning)
router.get('/verify/:code', documents_controller_1.verifyDocument);
// ============================================
// AUTHENTICATED ROUTES
// ============================================
router.use(auth_middleware_1.authenticate);
// Get all documents for current user
router.get('/my', documents_controller_1.getMyDocuments);
// Get documents for a specific order
router.get('/order/:order_id', documents_controller_1.getOrderDocuments);
// Get specific document
router.get('/:document_id', documents_controller_1.getDocument);
// Download document as PDF
router.get('/:document_id/download', documents_controller_1.downloadDocument);
// ============================================
// DOCUMENT GENERATION
// ============================================
// Generate invoice for an order (Customer, Garage, or Operations)
router.post('/invoice/:order_id', documents_controller_1.generateInvoice);
// Generate warranty card for an order
// router.post('/warranty/:order_id', generateWarrantyCard);
// ============================================
// OPERATIONS ONLY ROUTES
// ============================================
// Future: Bulk document generation, template management, etc.
exports.default = router;
