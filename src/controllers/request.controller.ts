import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';
import { catchAsync } from '../utils/catchAsync';
import { createRequest as createRequestService } from '../services/request.service';

// ============================================
// REQUEST CONTROLLERS
// ============================================

export const createRequest = catchAsync(async (req: AuthRequest, res: Response) => {
    let {
        car_make,
        car_model,
        car_year,
        vin_number,
        part_description,
        part_number,
        part_category,
        condition_required,
        delivery_address_text,
        delivery_lat,
        delivery_lng
    } = req.body;
    const userId = req.user!.userId;

    const result = await createRequestService({
        userId,
        carMake: car_make,
        carModel: car_model,
        carYear: car_year,
        vinNumber: vin_number,
        partDescription: part_description,
        partNumber: part_number,
        partCategory: part_category,
        conditionRequired: condition_required,
        deliveryAddressText: delivery_address_text,
        deliveryLat: delivery_lat ? parseFloat(delivery_lat) : undefined,
        deliveryLng: delivery_lng ? parseFloat(delivery_lng) : undefined,
        files: req.files as { [fieldname: string]: Express.Multer.File[] }
    });

    res.status(201).json({ message: result.message, request_id: result.request.request_id });
});

export const getActiveRequests = async (req: AuthRequest, res: Response) => {
    // For Garages - with pagination and filtering
    const garageId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Filtering parameters
    const urgency = req.query.urgency as string; // 'high', 'medium', 'low'
    const condition = req.query.condition as string; // 'new', 'used', 'any'
    const sortBy = req.query.sort as string || 'newest'; // 'newest', 'oldest', 'bids_low', 'bids_high'
    const showAll = req.query.showAll === 'true'; // Override smart routing

    try {
        // ============================================
        // SMART ROUTING: Get garage profile for filtering
        // ============================================
        const garageResult = await pool.query(
            `SELECT supplier_type, specialized_brands, all_brands FROM garages WHERE garage_id = $1`,
            [garageId]
        );
        const garage = garageResult.rows[0];

        let whereClause = "WHERE status = 'active'";
        const params: unknown[] = [];
        let paramIndex = 1;

        // ============================================
        // SMART ROUTING: Filter by supplier type
        // ============================================
        if (!showAll && garage) {
            if (garage.supplier_type === 'new') {
                // New-only dealers see requests for 'new' or 'any' condition
                whereClause += ` AND condition_required IN ('new', 'any')`;
            } else if (garage.supplier_type === 'used') {
                // Used-only garages see requests for 'used' or 'any' condition
                whereClause += ` AND condition_required IN ('used', 'any')`;
            }
            // 'both' sees all requests

            // ============================================
            // SMART ROUTING: Filter by brand specialization
            // ============================================
            if (!garage.all_brands && garage.specialized_brands && garage.specialized_brands.length > 0) {
                whereClause += ` AND UPPER(car_make) = ANY($${paramIndex++}::text[])`;
                params.push(garage.specialized_brands.map((b: string) => b.toUpperCase()));
            }
        }

        // Apply urgency filter based on age
        if (urgency === 'high') {
            whereClause += ` AND created_at > NOW() - INTERVAL '12 hours'`;
        } else if (urgency === 'medium') {
            whereClause += ` AND created_at BETWEEN NOW() - INTERVAL '36 hours' AND NOW() - INTERVAL '12 hours'`;
        } else if (urgency === 'low') {
            whereClause += ` AND created_at < NOW() - INTERVAL '36 hours'`;
        }

        // Apply condition filter (manual override)
        if (condition && condition !== 'all') {
            whereClause += ` AND condition_required = $${paramIndex++}`;
            params.push(condition);
        }

        // Determine sort order
        let orderClause = 'ORDER BY created_at DESC'; // Default: newest
        switch (sortBy) {
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
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM part_requests ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Get paginated results with filters
        const result = await pool.query(
            `SELECT *, 
                    (SELECT COUNT(*) FROM bids WHERE request_id = part_requests.request_id) as bid_count
             FROM part_requests 
             ${whereClause} 
             ${orderClause}
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, limit, offset]
        );

        res.json({
            requests: result.rows,
            pagination: { page, limit, total, pages: totalPages },
            filters: { urgency: urgency || 'all', condition: condition || 'all', sort: sortBy }
        });
    } catch (err) {
        console.error('[REQUEST] getActiveRequests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getMyRequests = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM part_requests WHERE customer_id = $1`,
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        // Get paginated results
        const result = await pool.query(
            `SELECT * FROM part_requests WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        res.json({
            requests: result.rows,
            pagination: { page, limit, total, pages: totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const getRequestDetails = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const requestResult = await pool.query(
            'SELECT * FROM part_requests WHERE request_id = $1',
            [request_id]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requestResult.rows[0];

        // Access Check
        if (userType === 'customer' && request.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get Bids with latest counter-offer info
        // IMPORTANT: Include last garage offer even if negotiation ended (for customer to accept final price)
        const bidsResult = await pool.query(
            `WITH LatestCounters AS (
                SELECT *, 
                       ROW_NUMBER() OVER (PARTITION BY bid_id, offered_by_type ORDER BY created_at DESC) as rn
                FROM counter_offers
                WHERE created_at IS NOT NULL
             )
             SELECT b.*, 
                    g.garage_name, 
                    g.rating_average as garage_rating, 
                    g.rating_count as garage_review_count, 
                    g.total_transactions,
                    COALESCE(sp.plan_code, 'starter') as plan_code,
                    b.bid_amount as original_bid_amount,
                    
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
             ORDER BY 
                 CASE WHEN b.status = 'accepted' THEN 0 ELSE 1 END,
                 CASE sp.plan_code WHEN 'enterprise' THEN 0 WHEN 'professional' THEN 1 ELSE 2 END,
                 b.bid_amount ASC`,
            [request_id]
        );

        let bids = bidsResult.rows;
        // Anonymize for customer (keep garage_id for reviews, anonymize name)
        if (userType === 'customer') {
            bids = bids.map((bid: Record<string, unknown>, i: number) => ({
                ...bid,
                garage_name: `Garage ${i + 1}`,
                // Keep garage_id for reviews modal
                garage_rating: bid.garage_rating,
                garage_review_count: bid.garage_review_count,
                total_transactions: bid.total_transactions,
                plan_code: bid.plan_code // Keep plan_code for badge
            }));
        }

        res.json({ request, bids });
    } catch (err) {
        console.error('[REQUEST] Get request details error:', err);
        res.status(500).json({ error: 'Failed to fetch request details' });
    }
};

// ============================================
// CUSTOMER: CANCEL REQUEST
// ============================================

/**
 * Cancel a request - only the owner can cancel their own active request
 */
export const cancelRequest = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { request_id } = req.params;

    try {
        // Verify ownership and status
        const requestResult = await pool.query(
            'SELECT * FROM part_requests WHERE request_id = $1 AND customer_id = $2',
            [request_id, userId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'active') {
            return res.status(400).json({ error: 'Only active requests can be cancelled' });
        }

        // Update status to cancelled
        await pool.query(
            `UPDATE part_requests SET status = 'cancelled', updated_at = NOW() WHERE request_id = $1`,
            [request_id]
        );

        res.json({ success: true, message: 'Request cancelled successfully' });
    } catch (err) {
        console.error('[REQUEST] Cancel request error:', err);
        res.status(500).json({ error: 'Failed to cancel request' });
    }
};

// ============================================
// CUSTOMER: DELETE REQUEST (permanent)
// ============================================

/**
 * Permanently delete a request - only allowed if NO orders exist
 * This is different from cancel - it removes all data including bids
 */
export const deleteRequest = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { request_id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership
        const requestResult = await client.query(
            'SELECT * FROM part_requests WHERE request_id = $1 AND customer_id = $2 FOR UPDATE',
            [request_id, userId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found or access denied' });
        }

        const request = requestResult.rows[0];

        // Check if any orders exist for this request
        const orderCheck = await client.query(
            'SELECT order_id FROM orders WHERE request_id = $1 LIMIT 1',
            [request_id]
        );

        if (orderCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Cannot delete request with existing orders',
                hint: 'Orders exist for this request. You can only cancel, not delete.'
            });
        }

        // Get garage IDs for notification before deletion
        const bidsResult = await client.query(
            'SELECT DISTINCT garage_id FROM bids WHERE request_id = $1',
            [request_id]
        );
        const garageIds = bidsResult.rows.map(r => r.garage_id);

        // Delete counter-offers first (foreign key constraint)
        await client.query('DELETE FROM counter_offers WHERE request_id = $1', [request_id]);

        // Delete bids (foreign key constraint)
        await client.query('DELETE FROM bids WHERE request_id = $1', [request_id]);

        // Delete from garage ignored requests
        await client.query('DELETE FROM garage_ignored_requests WHERE request_id = $1', [request_id]);

        // Finally delete the request
        await client.query('DELETE FROM part_requests WHERE request_id = $1', [request_id]);

        await client.query('COMMIT');

        // Notify all garages that had bids that the request is gone
        const io = (global as any).io;

        // Persist notifications for affected bidders
        for (const garageId of garageIds) {
            await createNotification({
                userId: garageId,
                type: 'request_deleted',
                title: 'Request Deleted',
                message: 'A request you bid on has been deleted by the customer',
                data: { request_id },
                target_role: 'garage'
            });
        }

        // Also broadcast to all garages that this request no longer exists
        io.emit('request_removed', { request_id });

        res.json({
            success: true,
            message: 'Request permanently deleted',
            deleted: {
                request_id,
                car: `${request.car_make} ${request.car_model}`,
                part: request.part_description
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[REQUEST] Delete request error:', err);
        res.status(500).json({ error: 'Failed to delete request' });
    } finally {
        client.release();
    }
};

// ============================================
// GARAGE: IGNORE REQUEST (per-garage)
// ============================================

/**
 * Ignore a request - only hides for THIS garage, still visible to others
 */
export const ignoreRequest = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { request_id } = req.params;

    try {
        // Insert ignore (ON CONFLICT = already ignored, just update timestamp)
        await pool.query(`
            INSERT INTO garage_ignored_requests (garage_id, request_id)
            VALUES ($1, $2)
            ON CONFLICT (garage_id, request_id) DO UPDATE SET created_at = NOW()
        `, [garageId, request_id]);

        res.json({ success: true, message: 'Request ignored' });
    } catch (err) {
        console.error('[REQUEST] Ignore request error:', err);
        res.status(500).json({ error: 'Failed to ignore request' });
    }
};

/**
 * Get list of ignored request IDs for this garage
 */
export const getIgnoredRequests = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(`
            SELECT request_id FROM garage_ignored_requests WHERE garage_id = $1
        `, [garageId]);

        const ignoredIds = result.rows.map(row => row.request_id);
        res.json({ ignored: ignoredIds });
    } catch (err) {
        console.error('[REQUEST] Get ignored requests error:', err);
        res.status(500).json({ error: 'Failed to fetch ignored requests' });
    }
};

/**
 * Undo ignore - removes a request from the ignored list (for undo functionality)
 */
export const unignoreRequest = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { request_id } = req.params;

    try {
        await pool.query(`
            DELETE FROM garage_ignored_requests 
            WHERE garage_id = $1 AND request_id = $2
        `, [garageId, request_id]);

        res.json({ success: true, message: 'Request restored' });
    } catch (err) {
        console.error('[REQUEST] Unignore request error:', err);
        res.status(500).json({ error: 'Failed to restore request' });
    }
};
