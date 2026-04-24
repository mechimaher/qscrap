/**
 * Request Query Service
 * Handles request retrieval, filtering, and smart routing
 */
import { Pool } from 'pg';

export class RequestQueryService {
    constructor(private pool: Pool) { }

    /**
     * Get active requests for garages with smart routing and filtering
     */
    async getActiveRequests(
        garageId: string,
        filters: {
            page?: number;
            limit?: number;
            urgency?: string;
            condition?: string;
            sortBy?: string;
            showAll?: boolean;
        }
    ) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        // Get garage profile for smart routing
        const garageResult = await this.pool.query(
            `SELECT supplier_type, specialized_brands, all_brands FROM garages WHERE garage_id = $1`,
            [garageId]
        );
        const garage = garageResult.rows[0];

        let whereClause = "WHERE pr.status = 'active'";
        const params: unknown[] = [];
        let paramIndex = 1;

        // Smart routing: Filter by supplier type
        if (!filters.showAll && garage) {
            if (garage.supplier_type === 'new') {
                whereClause += ` AND pr.condition_required IN ('new', 'any')`;
            } else if (garage.supplier_type === 'used') {
                whereClause += ` AND pr.condition_required IN ('used', 'any')`;
            }

            // Smart routing: Filter by brand specialization
            if (!garage.all_brands && garage.specialized_brands && garage.specialized_brands.length > 0) {
                whereClause += ` AND UPPER(pr.car_make) = ANY($${paramIndex++}::text[])`;
                params.push(garage.specialized_brands.map((b: string) => b.toUpperCase()));
            }
        }

        // Apply urgency filter based on age
        if (filters.urgency === 'high') {
            whereClause += ` AND pr.created_at > NOW() - INTERVAL '12 hours'`;
        } else if (filters.urgency === 'medium') {
            whereClause += ` AND pr.created_at BETWEEN NOW() - INTERVAL '36 hours' AND NOW() - INTERVAL '12 hours'`;
        } else if (filters.urgency === 'low') {
            whereClause += ` AND pr.created_at < NOW() - INTERVAL '36 hours'`;
        }

        // Apply condition filter (manual override)
        if (filters.condition && filters.condition !== 'all') {
            whereClause += ` AND pr.condition_required = $${paramIndex++}`;
            params.push(filters.condition);
        }

        // Determine sort order
        let orderClause = 'ORDER BY pr.created_at DESC'; // Default: newest
        switch (filters.sortBy) {
            case 'oldest':
                orderClause = 'ORDER BY pr.created_at ASC';
                break;
            case 'bids_low':
                orderClause = 'ORDER BY bid_count ASC NULLS FIRST, pr.created_at DESC';
                break;
            case 'bids_high':
                orderClause = 'ORDER BY bid_count DESC NULLS LAST, pr.created_at DESC';
                break;
            case 'newest':
            default:
                orderClause = 'ORDER BY pr.created_at DESC';
        }

        // Get total count with filters
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM part_requests pr ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Use LEFT JOIN and GROUP BY for bid_count (performance)
        const result = await this.pool.query(
            `SELECT pr.*, COALESCE(COUNT(b.bid_id), 0) AS bid_count
             FROM part_requests pr
             LEFT JOIN bids b ON b.request_id = pr.request_id
                 AND b.status IN ('pending', 'accepted')
             ${whereClause}
             GROUP BY pr.request_id
             ${orderClause}
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, limit, offset]
        );

        return {
            requests: result.rows,
            pagination: { page, limit, total, pages: totalPages },
            filters: {
                urgency: filters.urgency || 'all',
                condition: filters.condition || 'all',
                sort: filters.sortBy || 'newest'
            }
        };
    }

    /**
     * Get customer's own requests with pagination
     */
    async getMyRequests(userId: string, page: number = 1, limit: number = 20) {
        const offset = (page - 1) * limit;

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM part_requests WHERE customer_id = $1`,
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Get paginated results
        const result = await this.pool.query(
            `SELECT * FROM part_requests WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return {
            requests: result.rows,
            pagination: { page, limit, total, pages: totalPages }
        };
    }

    /**
     * Get request details with bids and anonymization for customers
     */
    async getRequestDetails(requestId: string, userId: string, userType: string) {
        const requestResult = await this.pool.query(
            'SELECT * FROM part_requests WHERE request_id = $1',
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            throw new Error('Request not found');
        }

        const request = requestResult.rows[0];

        // Access Check
        if (userType === 'customer' && request.customer_id !== userId) {
            throw new Error('Access denied');
        }

        // Get Bids with latest counter-offer info (flattened, no anonymization)
        const bidsResult = await this.pool.query(
            `SELECT b.*, 
                    g.garage_name, 
                    NULL as garage_photo_url,
                    g.rating_average as garage_rating, 
                    g.rating_count as garage_review_count, 
                    g.total_transactions,
                    COALESCE(sp.plan_code, 'starter') as plan_code,
                    COALESCE(b.original_bid_amount, b.bid_amount) as original_bid_amount,
                    COALESCE(b.image_urls, ARRAY[]::text[]) as image_urls,
                    -- Negotiation Stats
                    (SELECT COUNT(*) FROM counter_offers co WHERE co.bid_id = b.bid_id) as negotiation_rounds,
                    (SELECT COUNT(*) > 0 FROM counter_offers co WHERE co.bid_id = b.bid_id AND co.status = 'pending') as has_pending_negotiation
             FROM bids b
             JOIN garages g ON b.garage_id = g.garage_id
             LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE b.request_id = $1 AND b.status IN ('pending', 'accepted')
             ORDER BY 
                 CASE WHEN b.status = 'accepted' THEN 0 ELSE 1 END,
                 CASE sp.plan_code WHEN 'enterprise' THEN 0 WHEN 'professional' THEN 1 ELSE 2 END,
                 b.bid_amount ASC`,
            [requestId]
        );

        return { request, bids: bidsResult.rows };
    }
}
