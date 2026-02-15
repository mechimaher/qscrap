import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
import { getWritePool, getReadPool } from '../config/db';
import { getErrorMessage } from '../types';
import {
    DocumentGenerationService,
    DocumentQueryService,
    DocumentAccessService
} from '../services/documents';
import logger from '../utils/logger';

// Import template helpers (keeping these for now - can be extracted later)
import { generateBilingualCustomerInvoiceHTML, generateGaragePayoutStatementHTML } from './documents-templates';

const generationService = new DocumentGenerationService(getWritePool());
const queryService = new DocumentQueryService(getReadPool());
const accessService = new DocumentAccessService(getWritePool());

// ============================================
// INVOICE GENERATION
// ============================================

export const generateInvoice = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    const invoiceType = (req.query.type as 'customer' | 'garage') ||
        (userType === 'garage' ? 'garage' : 'customer');

    try {
        const result = await generationService.generateInvoice({
            orderId: order_id,
            userId,
            userType,
            invoiceType,
            ipAddress: req.ip
        });

        // Log access
        await accessService.logDocumentAccess(
            result.document.document_id,
            'generate',
            userId,
            userType,
            req
        );

        res.status(201).json({
            success: true,
            invoice_type: invoiceType,
            document: result.document
        });
    } catch (err) {
        logger.error('generateInvoice Error', { error: (err as Error).message });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
            return res.status(403).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET DOCUMENT
// ============================================

export const getDocument = async (req: AuthRequest, res: Response) => {
    const { document_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const document = await queryService.getDocument(document_id, userId, userType);

        // Log access
        await accessService.logDocumentAccess(document_id, 'view', userId, userType, req);

        res.json({ document });
    } catch (err) {
        logger.error('getDocument Error', { error: (err as Error).message });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET DOCUMENTS FOR ORDER
// ============================================

export const getOrderDocuments = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const documents = await queryService.getOrderDocuments(order_id, userId, userType);
        res.json({ documents });
    } catch (err) {
        logger.error('getOrderDocuments Error', { error: (err as Error).message });
        if (err instanceof Error && err.message.includes('Order not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET MY DOCUMENTS (Customer/Garage)
// ============================================

export const getMyDocuments = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    const { type, limit } = req.query;

    try {
        const documents = await queryService.getMyDocuments(userId, userType, {
            type: type as string,
            limit: limit ? parseInt(limit as string, 10) : undefined
        });

        res.json({ documents });
    } catch (err) {
        logger.error('getMyDocuments Error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DOWNLOAD DOCUMENT (PDF)
// ============================================

export const downloadDocument = async (req: AuthRequest, res: Response) => {
    const { document_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const doc = await accessService.downloadDocument(document_id, userId, userType);

        // Generate PDF
        const pdfBuffer = await generatePDFFromDocument(doc);

        // Log access
        await accessService.logDocumentAccess(document_id, 'download', userId, userType, req);

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.document_number}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        logger.error('downloadDocument Error', { error: (err as Error).message });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// VERIFY DOCUMENT (Public)
// ============================================

export const verifyDocument = async (req: Request, res: Response) => {
    const { code } = req.params;

    try {
        const result = await queryService.verifyDocument(code);

        // Log public verification
        if (result.verified && result.document) {
            // Extract document_id if available
            const docId = (result as any).document_id;
            if (docId) {
                await accessService.logDocumentAccess(docId, 'verify', undefined, undefined, req);
            }
        }

        res.json(result);
    } catch (err) {
        logger.error('verifyDocument Error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generatePDFFromDocument(doc: any): Promise<Buffer> {
    const docData = typeof doc.document_data === 'string'
        ? JSON.parse(doc.document_data)
        : doc.document_data;

    // Get logo
    const logoBase64 = generationService.getLogoBase64();

    // Select template based on invoice type
    let html: string;
    if (docData.invoice_type === 'garage') {
        html = generateGaragePayoutStatementHTML(docData, doc.qr_code_data || '', logoBase64);
    } else {
        html = generateBilingualCustomerInvoiceHTML(docData, doc.qr_code_data || '', logoBase64);
    }

    // Generate PDF using service
    return await generationService.generatePDF(html);
}
