import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
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

// Download document as PDF (token via query param for browser access)
router.get('/:document_id/download', (req: AuthRequest, res: Response, next: NextFunction) => {
    // Accept token from query param (needed for Linking.openURL in mobile)
    // Falls back to standard Authorization header
    const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const payload = jwt.verify(token, getJwtSecret()) as { userId: string; userType: string };
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}, downloadDocument);

// AUTHENTICATED ROUTES (header-based token only)
// ============================================

router.use(authenticate);

// Get all documents for current user
router.get('/my', getMyDocuments);

// Get documents for a specific order
router.get('/order/:order_id', getOrderDocuments);

// Get specific document
router.get('/:document_id', getDocument);

// Note: Download route is registered above (before authenticate middleware)
// to support query-param tokens from mobile browser downloads

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
