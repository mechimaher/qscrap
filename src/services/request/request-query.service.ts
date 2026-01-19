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

        let whereClause = "WHERE status = 'active'";
        const params: unknown[] = [];
        let paramIndex = 1;

        // Smart routing: Filter by supplier type
        if (!filters.showAll && garage) {
            if (garage.supplier_type === 'new') {
                whereClause += ` AND condition_required IN ('new', 'any')`;
            } else if (garage.supplier_type === 'used') {
                whereClause += ` AND condition_required IN ('used', 'any')`;
            }

            // Smart routing: Filter by brand specialization
            if (!garage.all_brands && garage.specialized_brands && garage.specialized_brands.length > 0) {
                whereClause += ` AND UPPER(car_make) = ANY($${paramIndex++}::text[])`;
                params.push(garage.specialized_brands.map((b: string) => b.toUpperCase()));
            }
        }

        // Apply urgency filter based on age
        if (filters.urgency === 'high') {
            whereClause += ` AND created_at > NOW() - INTERVAL '12 hours'`;
        } else if (filters.urgency === 'medium') {
            whereClause += ` AND created_at BETWEEN NOW() - INTERVAL '36 hours' AND NOW() - INTERVAL '12 hours'`;
        } else if (filters.urgency === 'low') {
            whereClause += ` AND created_at < NOW() - INTERVAL '36 hours'`;
        }

        // Apply condition filter (manual override)
        if (filters.condition && filters.condition !== 'all') {
            whereClause += ` AND condition_required = $${paramIndex++}`;
            params.push(filters.condition);
        }

        // Determine sort order
        let orderClause = 'ORDER BY created_at DESC'; // Default: newest
        switch (filters.sortBy) {
            case 'oldest':
                orderClause = 'ORDER BY created_at ASC';
                break;
            case 'bids_low':
                orderClause = 'ORDER BY bid_count ASC NULLS FIRST, created_at DESC';
                break;
            case 'bids_high':
                orderClause = 'ORDER BY bid_count DESC NULLS LAST, created_at DESC';
                break;
            case 'newest':
            default:
                orderClause = 'ORDER BY created_at DESC';
        }

        // Get total count with filters
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM part_requests ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Get paginated results with filters
        const result = await this.pool.query(
            `SELECT *, 
                    (SELECT COUNT(*) FROM bids WHERE request_id = part_requests.request_id) as bid_count
             FROM part_requests 
             ${whereClause} 
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

        // Get Bids with latest counter-offer info
        const bidsResult = await this.pool.query(
            `WITH LatestCounters AS (
                SELECT *, 
                       ROW_NUMBER() OVER (PARTITION BY bid_id, offered_by_type ORDER BY created_at DESC) as rn
                FROM counter_offers
                WHERE created_at IS NOT NULL
             )
             SELECT b.*, 
                    g.garage_name, 
                    g.logo_url as garage_photo_url,
                    g.rating_average as garage_rating, 
                    g.rating_count as garage_review_count, 
                    g.total_transactions,
                    COALESCE(sp.plan_code, 'starter') as plan_code,
                    b.bid_amount as original_bid_amount,
                    
                    -- Aggregate bid images
                    COALESCE(
                        ARRAY_AGG(DISTINCT bi.image_url ORDER BY bi.image_url) FILTER (WHERE bi.image_type = 'bid'),
                        ARRAY[]::text[]
                    ) as image_urls,
                    
                    -- Aggregate condition photos
                    COALESCE(
                        ARRAY_AGG(DISTINCT bic.image_url ORDER BY bic.image_url) FILTER (WHERE bic.image_type = 'condition'),
                        ARRAY[]::text[]
                    ) as condition_photos,
                    
                    -- Garage Last Offer (Pending)
                    lc_gp.proposed_amount as garage_counter_amount,
                    lc_gp.message as garage_counter_message,
                    lc_gp.counter_offer_id as garage_counter_id,
                    
                    -- Garage Last Offer (Any Status)
                    lc_g.proposed_amount as last_garage_offer_amount,
                    lc_g.counter_offer_id as last_garage_offer_id,
                    
                    -- Customer Last Counter
                    lc_c.proposed_amount as customer_counter_amount,
                    lc_c.status as customer_counter_status,
                    
                    -- Negotiation Stats
                    (SELECT COUNT(*) FROM counter_offers co WHERE co.bid_id = b.bid_id) as negotiation_rounds,
                    (SELECT COUNT(*) > 0 FROM counter_offers co WHERE co.bid_id = b.bid_id AND co.status = 'pending') as has_pending_negotiation

             FROM bids b
             JOIN garages g ON b.garage_id = g.garage_id
             LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             LEFT JOIN bid_images bi ON b.bid_id = bi.bid_id
             LEFT JOIN bid_images bic ON b.bid_id = bic.bid_id
             
             -- Join for Garage Pending Offer
             LEFT JOIN LatestCounters lc_gp ON b.bid_id = lc_gp.bid_id 
                                           AND lc_gp.offered_by_type = 'garage' 
                                           AND lc_gp.status = 'pending' 
                                           AND lc_gp.rn = 1
                                           
             -- Join for Garage Last Offer (Any)
             LEFT JOIN LatestCounters lc_g ON b.bid_id = lc_g.bid_id 
                                          AND lc_g.offered_by_type = 'garage' 
                                          AND lc_g.rn = 1
                                          
             -- Join for Customer Last Counter
             LEFT JOIN LatestCounters lc_c ON b.bid_id = lc_c.bid_id 
                                          AND lc_c.offered_by_type = 'customer' 
                                          AND lc_c.rn = 1

             WHERE b.request_id = $1 AND b.status IN ('pending', 'accepted')
             GROUP BY b.bid_id, g.garage_name, g.logo_url, g.rating_average, g.rating_count, g.total_transactions,
                      sp.plan_code, lc_gp.proposed_amount, lc_gp.message, lc_gp.counter_offer_id,
                      lc_g.proposed_amount, lc_g.counter_offer_id, lc_c.proposed_amount, lc_c.status
             ORDER BY 
                 CASE WHEN b.status = 'accepted' THEN 0 ELSE 1 END,
                 CASE sp.plan_code WHEN 'enterprise' THEN 0 WHEN 'professional' THEN 1 ELSE 2 END,
                 b.bid_amount ASC`,
            [requestId]
        );

        let bids = bidsResult.rows;

        // Anonymize for customer (keep garage_id for reviews, anonymize name)
        if (userType === 'customer') {
            bids = bids.map((bid: Record<string, unknown>, i: number) => ({
                ...bid,
                garage_name: `Garage ${i + 1}`,
                garage_rating: bid.garage_rating,
                garage_review_count: bid.garage_review_count,
                total_transactions: bid.total_transactions,
                plan_code: bid.plan_code
            }));
        }

        return { request, bids };
    }
}
