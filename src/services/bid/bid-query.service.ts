/**
 * Bid Query Service
 * Handles bid retrieval operations
 */
import { Pool } from 'pg';

export class BidQueryService {
    constructor(private pool: Pool) { }

    /**
     * Get all bids for a garage with filtering and pagination
     */
    async getMyBids(
        garageId: string,
        filters: {
            page?: number;
            limit?: number;
            status?: string;
        }
    ) {
        const pageNum = Math.max(1, parseInt(String(filters.page || 1), 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(String(filters.limit || 20), 10)));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = 'WHERE b.garage_id = $1';
        const params: unknown[] = [garageId];
        let paramIndex = 2;

        if (filters.status && ['pending', 'accepted', 'rejected', 'withdrawn'].includes(filters.status)) {
            whereClause += ` AND b.status = $${paramIndex++}`;
            params.push(filters.status);
        }

        // Join with orders to get final accepted amount for accepted bids
        const result = await this.pool.query(
            `SELECT b.*, 
                    CONCAT(pr.car_make, ' ', pr.car_model, ' ', pr.car_year) as car_summary, 
                    pr.part_description,
                    pr.request_id,
                    pr.status as request_status,
                    o.part_price as final_accepted_amount,
                    o.order_number,
                    o.order_id
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             LEFT JOIN orders o ON b.bid_id = o.bid_id
             ${whereClause}
             ORDER BY b.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, limitNum, offset]
        );

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM bids b ${whereClause}`,
            params
        );

        return {
            bids: result.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
            }
        };
    }

    /**
     * Get a single bid by ID for a garage
     */
    async getBidById(bidId: string, garageId: string) {
        const result = await this.pool.query(
            `SELECT b.*, 
                    pr.car_make, pr.car_model, pr.car_year, 
                    pr.part_description,
                    pr.request_id
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bidId, garageId]
        );

        if (result.rows.length === 0) {
            throw new Error('Bid not found');
        }

        return result.rows[0];
    }
}
