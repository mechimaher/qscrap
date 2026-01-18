/**
 * OrderQueryService - Order Listing & Details
 * Handles paginated order lists and full order details with history
 */

import { Pool } from 'pg';
import { OrderFilters, PaginatedOrders, OrderDetail } from './types';
import { OrderNotFoundError, UnauthorizedOrderAccessError } from './errors';

export class OrderQueryService {
    constructor(private pool: Pool) { }

    /**
     * Get customer's or garage's orders with pagination
     */
    async getMyOrders(userId: string, userType: string, filters: OrderFilters): Promise<PaginatedOrders> {
        const { status, page = 1, limit = 20 } = filters;

        const pageNum = Math.max(1, page);
        const limitNum = Math.min(100, Math.max(1, limit));
        const offset = (pageNum - 1) * limitNum;

        const field = userType === 'customer' ? 'customer_id' : 'garage_id';

        // Build count query
        let countQuery = `SELECT COUNT(*) FROM orders o WHERE o.${field} = $1`;
        const countParams: any[] = [userId];
        if (status) {
            countQuery += ' AND o.order_status = $2';
            countParams.push(status);
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limitNum);

        // Build main query
        let query = `
            SELECT o.*, 
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.image_urls as request_images,
                   pr.delivery_lat::float, pr.delivery_lng::float,
                   b.warranty_days, b.part_condition, b.brand_name, b.image_urls as bid_images,
                   g.garage_name,
                   da.assignment_id, da.status as delivery_status, 
                   da.estimated_delivery, da.pickup_at, da.delivered_at,
                   d.driver_id, d.full_name as driver_name, d.phone as driver_phone,
                   d.vehicle_type, d.vehicle_plate, d.current_lat as driver_lat, d.current_lng as driver_lng,
                   r.review_id
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN bids b ON o.bid_id = b.bid_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            LEFT JOIN order_reviews r ON o.order_id = r.order_id
            WHERE o.${field} = $1
        `;

        const params: any[] = [userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND o.order_status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limitNum, offset);

        const result = await this.pool.query(query, params);

        return {
            orders: result.rows,
            pagination: { page: pageNum, limit: limitNum, total, pages: totalPages }
        };
    }

    /**
     * Get full order details with history and review
     */
    async getOrderDetails(orderId: string, userId: string): Promise<OrderDetail> {
        const result = await this.pool.query(`
            SELECT o.*, 
                    pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.image_urls as request_images,
                    pr.delivery_lat::float as delivery_lat, pr.delivery_lng::float as delivery_lng,
                    b.warranty_days, b.part_condition, b.brand_name, b.image_urls as bid_images, b.notes as bid_notes,
                    g.garage_name, g.rating_average, g.rating_count,
                    u.full_name as customer_name, u.phone_number as customer_phone,
                    d.full_name as driver_name, d.phone as driver_phone, d.vehicle_type, d.vehicle_plate,
                    d.current_lat::float as driver_lat, d.current_lng::float as driver_lng,
                    da.status as delivery_status, da.estimated_delivery
             FROM orders o
             JOIN part_requests pr ON o.request_id = pr.request_id
             JOIN bids b ON o.bid_id = b.bid_id
             JOIN garages g ON o.garage_id = g.garage_id
             JOIN users u ON o.customer_id = u.user_id
             LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
             LEFT JOIN drivers d ON da.driver_id = d.driver_id
             WHERE o.order_id = $1 AND (o.customer_id = $2 OR o.garage_id = $2)
        `, [orderId, userId]);

        if (result.rows.length === 0) {
            throw new OrderNotFoundError(orderId);
        }

        // Get status history
        const history = await this.pool.query(
            'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC',
            [orderId]
        );

        // Get review if exists
        const review = await this.pool.query(
            'SELECT * FROM order_reviews WHERE order_id = $1',
            [orderId]
        );

        return {
            order: result.rows[0],
            status_history: history.rows,
            review: review.rows[0] || null
        };
    }
}
