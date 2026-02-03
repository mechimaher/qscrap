/**
 * DocumentService - Invoice & Document Generation Business Logic
 * 
 * Extracted from documents.controller.ts (1,470 lines) to enable:
 * - Testability
 * - Reusability  
 * - Consistent error handling
 */

import pool from '../config/db';
import { ApiError, ErrorCode } from '../middleware/errorHandler.middleware';
import logger from '../utils/logger';

// ============================================
// TYPES
// ============================================

export interface DocumentData {
    document_type: 'invoice' | 'payout_statement' | 'receipt';
    order_id: string;
    order_number: string;
    invoice_number: string;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string;
    garage_name: string;
    garage_phone?: string;
    parts: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        total: number;
    }>;
    subtotal: number;
    delivery_fee: number;
    platform_fee: number;
    total: number;
    created_at: string;
}

export interface DocumentRecord {
    document_id: string;
    document_type: string;
    order_id: string;
    document_number: string;
    document_data: DocumentData;
    qr_code_data?: string;
    verification_code: string;
    created_at: string;
    accessed_by?: string;
}

// ============================================
// DOCUMENT SERVICE
// ============================================

export class DocumentService {

    /**
     * Get document by ID with verification
     */
    static async getDocument(document_id: string, user_id?: string): Promise<DocumentRecord> {
        const result = await pool.query(
            `SELECT * FROM documents WHERE document_id = $1`,
            [document_id]
        );

        if (result.rows.length === 0) {
            throw ApiError.notFound('Document not found');
        }

        // Log access
        if (user_id) {
            await this.logDocumentAccess(document_id, 'view', user_id, 'user');
        }

        return result.rows[0];
    }

    /**
     * Get all documents for an order
     */
    static async getOrderDocuments(order_id: string): Promise<DocumentRecord[]> {
        const result = await pool.query(`
            SELECT document_id, document_type, document_number, 
                   created_at, verification_code
            FROM documents 
            WHERE order_id = $1
            ORDER BY created_at DESC
        `, [order_id]);

        return result.rows;
    }

    /**
     * Get documents for a user (customer or garage)
     */
    static async getUserDocuments(params: {
        user_id: string;
        user_type: 'customer' | 'garage';
        page?: number;
        limit?: number;
    }): Promise<{ documents: DocumentRecord[]; pagination: { page: number; total: number; pages: number } }> {
        const { user_id, user_type, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        // Build query based on user type
        const joinCondition = user_type === 'customer'
            ? 'JOIN orders o ON d.order_id = o.order_id AND o.customer_id = $1'
            : 'JOIN orders o ON d.order_id = o.order_id AND o.garage_id = $1';

        // Count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM documents d ${joinCondition}`,
            [user_id]
        );
        const total = parseInt(countResult.rows[0].count);

        // Data
        const result = await pool.query(`
            SELECT d.document_id, d.document_type, d.document_number,
                   d.created_at, d.verification_code, o.order_number
            FROM documents d
            ${joinCondition}
            ORDER BY d.created_at DESC
            LIMIT $2 OFFSET $3
        `, [user_id, limit, offset]);

        return {
            documents: result.rows,
            pagination: {
                page,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Verify document by verification code
     */
    static async verifyDocument(verification_code: string): Promise<{
        valid: boolean;
        document?: Partial<DocumentRecord>;
    }> {
        const result = await pool.query(`
            SELECT d.document_id, d.document_type, d.document_number,
                   d.created_at, d.verification_code,
                   o.order_number, o.order_status
            FROM documents d
            JOIN orders o ON d.order_id = o.order_id
            WHERE d.verification_code = $1
        `, [verification_code]);

        if (result.rows.length === 0) {
            return { valid: false };
        }

        // Log verification
        await this.logDocumentAccess(result.rows[0].document_id, 'verify', null, 'public');

        return {
            valid: true,
            document: {
                document_id: result.rows[0].document_id,
                document_type: result.rows[0].document_type,
                document_number: result.rows[0].document_number,
                created_at: result.rows[0].created_at
            }
        };
    }

    /**
     * Generate invoice number
     */
    static async generateInvoiceNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const result = await pool.query(`
            SELECT COUNT(*) + 1 as next_number 
            FROM documents 
            WHERE document_type = 'invoice' 
            AND EXTRACT(YEAR FROM created_at) = $1
        `, [year]);

        const nextNumber = result.rows[0].next_number;
        return `INV-${year}-${String(nextNumber).padStart(6, '0')}`;
    }

    /**
     * Log document access for audit trail
     */
    private static async logDocumentAccess(
        document_id: string,
        action: string,
        actor_id: string | null,
        actor_type: string
    ): Promise<void> {
        try {
            await pool.query(`
                INSERT INTO document_access_log (document_id, action, actor_id, actor_type, accessed_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [document_id, action, actor_id, actor_type]);
        } catch (err) {
            // Non-critical - don't fail main operation
            logger.error('Failed to log document access', { error: err });
        }
    }
}

export default DocumentService;
