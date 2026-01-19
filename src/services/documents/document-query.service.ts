/**
 * Document Query Service
 * Handles document retrieval and verification
 */
import { Pool } from 'pg';
import { DocumentRecord } from './types';
import { DocumentNotFoundError } from './errors';

export class DocumentQueryService {
    constructor(private pool: Pool) { }

    /**
     * Get a single document by ID
     */
    async getDocument(documentId: string, userId: string, userType: string): Promise<DocumentRecord> {
        const result = await this.pool.query(`
            SELECT d.*, o.order_number, g.garage_name, u.full_name as customer_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            LEFT JOIN users u ON d.customer_id = u.user_id
            WHERE d.document_id = $1
        `, [documentId]);

        if (result.rows.length === 0) {
            throw new DocumentNotFoundError(documentId);
        }

        const doc = result.rows[0];

        // Authorization check
        if (userType === 'customer' && doc.customer_id !== userId) {
            throw new Error('Not authorized');
        }
        if (userType === 'garage' && doc.garage_id !== userId) {
            throw new Error('Not authorized');
        }

        // Update viewed status if not already viewed
        if (!doc.viewed_at) {
            await this.pool.query(`
                UPDATE documents SET viewed_at = CURRENT_TIMESTAMP, status = 'viewed'
                WHERE document_id = $1 AND viewed_at IS NULL
            `, [documentId]);
        }

        return doc;
    }

    /**
     * Get all documents for an order
     */
    async getOrderDocuments(orderId: string, userId: string, userType: string): Promise<DocumentRecord[]> {
        // Verify access to order
        const orderCheck = await this.pool.query(`
            SELECT customer_id, garage_id FROM orders WHERE order_id = $1
        `, [orderId]);

        if (orderCheck.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderCheck.rows[0];
        if (userType === 'customer' && order.customer_id !== userId) {
            throw new Error('Not authorized');
        }
        if (userType === 'garage' && order.garage_id !== userId) {
            throw new Error('Not authorized');
        }

        const result = await this.pool.query(`
            SELECT * FROM documents 
            WHERE order_id = $1 AND status != 'voided'
            ORDER BY generated_at DESC
        `, [orderId]);

        return result.rows;
    }

    /**
     * Get my documents (customer/garage)
     */
    async getMyDocuments(userId: string, userType: string, filters: { type?: string; limit?: number }) {
        const { type, limit = 50 } = filters;

        let whereClause = '';
        if (userType === 'customer') {
            whereClause = 'd.customer_id = $1';
        } else if (userType === 'garage') {
            whereClause = 'd.garage_id = $1';
        } else {
            // Admin/Operations can see all
            whereClause = '1=1';
        }

        let query = `
            SELECT d.*, o.order_number, g.garage_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            WHERE ${whereClause} AND d.status != 'voided'
        `;

        const params: any[] = userType !== 'admin' && userType !== 'operations' ? [userId] : [];

        if (type) {
            query += ` AND d.document_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ` ORDER BY d.generated_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Verify document by verification code (public)
     */
    async verifyDocument(code: string) {
        const result = await this.pool.query(`
            SELECT 
                d.*,
                o.order_number,
                o.order_status,
                g.garage_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            WHERE d.verification_code = $1
        `, [code]);

        if (result.rows.length === 0) {
            return {
                verified: false,
                message: 'Invalid verification code'
            };
        }

        const doc = result.rows[0];
        const docData = typeof doc.document_data === 'string'
            ? JSON.parse(doc.document_data)
            : doc.document_data;

        return {
            verified: true,
            document: {
                type: doc.document_type,
                number: doc.document_number,
                date: doc.generated_at,
                order_number: doc.order_number,
                garage: doc.garage_name,
                status: doc.status,
                digital_signature: doc.digital_signature?.substring(0, 16) + '...',
                signature_timestamp: doc.signature_timestamp,
            },
            item: docData?.item || {},
            pricing: docData?.pricing || {},
            // Additional info for verification display
            vehicle: docData?.item?.vehicle || 'N/A',
            total_amount: docData?.pricing?.total || docData?.pricing?.net_payout || 0,
        };
    }
}
