import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    generateInvoice,
    getDocument,
    getOrderDocuments,
    getMyDocuments,
    downloadDocument,
    verifyDocument
} from '../controllers/documents.controller';

const router = Router();

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

// Public verification endpoint (QR code scanning)
router.get('/verify/:code', verifyDocument);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

router.use(authenticate);

// Get all documents for current user
router.get('/my', getMyDocuments);

// Get documents for a specific order
router.get('/order/:order_id', getOrderDocuments);

// Get specific document
router.get('/:document_id', getDocument);

// Download document as PDF
router.get('/:document_id/download', downloadDocument);

// ============================================
// DOCUMENT GENERATION
// ============================================

// Generate invoice for an order (Customer, Garage, or Operations)
router.post('/invoice/:order_id', generateInvoice);

// Generate warranty card for an order
// router.post('/warranty/:order_id', generateWarrantyCard);

// ============================================
// OPERATIONS ONLY ROUTES
// ============================================

// Future: Bulk document generation, template management, etc.

export default router;
