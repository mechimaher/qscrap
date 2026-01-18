/**
 * Document Access Service
 * Handles document downloads and access logging
 */
import { Pool, PoolClient } from 'pg';
import { Request } from 'express';
import { DocumentRecord } from './types';
import { DocumentNotFoundError, DocumentAccessDeniedError } from './errors';

export class DocumentAccessService {
    constructor(private pool: Pool) { }

    /**
     * Download document (returns document data for PDF generation)
     */
    async downloadDocument(documentId: string, userId: string, userType: string): Promise<DocumentRecord> {
        const result = await this.pool.query(`
            SELECT * FROM documents WHERE document_id = $1
        `, [documentId]);

        if (result.rows.length === 0) {
            throw new DocumentNotFoundError(documentId);
        }

        const doc = result.rows[0];

        // Authorization
        if (userType === 'customer' && doc.customer_id !== userId) {
            throw new DocumentAccessDeniedError('Not authorized');
        }
        if (userType === 'garage' && doc.garage_id !== userId) {
            throw new DocumentAccessDeniedError('Not authorized');
        }

        // Update download status
        await this.pool.query(`
            UPDATE documents SET downloaded_at = CURRENT_TIMESTAMP, status = 'downloaded'
            WHERE document_id = $1
        `, [documentId]);

        return doc;
    }

    /**
     * Log document access
     */
    async logDocumentAccess(
        documentId: string,
        action: 'view' | 'download' | 'generate' | 'verify',
        userId?: string,
        userType?: string,
        req?: Request
    ): Promise<void> {
        await this.pool.query(`
            INSERT INTO document_access_log (
                document_id, action, actor_id, actor_type, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            documentId,
            action,
            userId || null,
            userType || 'public',
            req?.ip || null,
            req?.headers['user-agent'] || null
        ]);
    }
}
