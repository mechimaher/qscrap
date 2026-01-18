/**
 * Request Filtering Service
 * Handles garage-specific request filtering (ignore/unignore)
 */
import { Pool } from 'pg';

export class RequestFilteringService {
    constructor(private pool: Pool) { }

    /**
     * Ignore a request (hide for this garage only)
     */
    async ignoreRequest(garageId: string, requestId: string): Promise<void> {
        await this.pool.query(`
            INSERT INTO garage_ignored_requests (garage_id, request_id)
            VALUES ($1, $2)
            ON CONFLICT (garage_id, request_id) DO UPDATE SET created_at = NOW()
        `, [garageId, requestId]);
    }

    /**
     * Get list of ignored request IDs for a garage
     */
    async getIgnoredRequests(garageId: string): Promise<string[]> {
        const result = await this.pool.query(`
            SELECT request_id FROM garage_ignored_requests WHERE garage_id = $1
        `, [garageId]);

        return result.rows.map(row => row.request_id);
    }

    /**
     * Unignore a request (undo ignore)
     */
    async unignoreRequest(garageId: string, requestId: string): Promise<void> {
        await this.pool.query(`
            DELETE FROM garage_ignored_requests 
            WHERE garage_id = $1 AND request_id = $2
        `, [garageId, requestId]);
    }
}
