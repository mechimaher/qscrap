/**
 * ReviewService - Order Reviews & Ratings
 * Handles customer review submission and garage review display
 */

import { Pool, PoolClient } from 'pg';
import { ReviewData, ReviewsWithStats } from './types';
import { OrderNotCompletedError, InvalidRatingError } from './errors';
import { createNotification } from '../notification.service';

export class ReviewService {
    constructor(private pool: Pool) { }

    /**
     * Submit review for completed order
     * Reviews are pending moderation by default
     */
    async submitReview(orderId: string, customerId: string, reviewData: ReviewData): Promise<void> {
        const { overall_rating, part_quality_rating, communication_rating, delivery_rating, review_text } = reviewData;

        // Validate rating
        if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
            throw new InvalidRatingError(overall_rating);
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify order belongs to customer and is completed
            const orderCheck = await client.query(
                'SELECT garage_id, order_number FROM orders WHERE order_id = $1 AND customer_id = $2 AND order_status = $3',
                [orderId, customerId, 'completed']
            );

            if (orderCheck.rows.length === 0) {
                throw new OrderNotCompletedError(orderId);
            }

            const garageId = orderCheck.rows[0].garage_id;
            const orderNumber = orderCheck.rows[0].order_number;

            // Insert or update review (pending moderation)
            await client.query(`
                INSERT INTO order_reviews 
                (order_id, customer_id, garage_id, overall_rating, part_quality_rating, 
                 communication_rating, delivery_rating, review_text, moderation_status, is_visible)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', false)
                ON CONFLICT (order_id) DO UPDATE SET
                   overall_rating = EXCLUDED.overall_rating,
                   part_quality_rating = EXCLUDED.part_quality_rating,
                   communication_rating = EXCLUDED.communication_rating,
                   delivery_rating = EXCLUDED.delivery_rating,
                   review_text = EXCLUDED.review_text,
                   moderation_status = 'pending',
                   is_visible = false,
                   updated_at = NOW()
            `, [orderId, customerId, garageId, overall_rating, part_quality_rating,
                communication_rating, delivery_rating, review_text]);

            await client.query('COMMIT');

            // Notify operations of new review
            await this.notifyOperationsNewReview(orderId, orderNumber);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get garage reviews (public only)
     */
    async getGarageReviews(garageId: string): Promise<ReviewsWithStats> {
        const result = await this.pool.query(`
            SELECT r.*, u.full_name as customer_name
            FROM order_reviews r
            JOIN users u ON r.customer_id = u.user_id
            WHERE r.garage_id = $1 AND r.is_visible = true
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [garageId]);

        const stats = await this.pool.query(`
            SELECT 
                COUNT(*) as total_reviews,
                ROUND(AVG(overall_rating)::numeric, 2) as avg_rating,
                ROUND(AVG(part_quality_rating)::numeric, 2) as avg_part_quality,
                ROUND(AVG(communication_rating)::numeric, 2) as avg_communication,
                ROUND(AVG(delivery_rating)::numeric, 2) as avg_delivery
            FROM order_reviews
            WHERE garage_id = $1 AND is_visible = true
        `, [garageId]);

        return {
            reviews: result.rows,
            stats: stats.rows[0]
        };
    }

    /**
     * Notify operations about new review pending moderation
     */
    private async notifyOperationsNewReview(orderId: string, orderNumber: string): Promise<void> {
        await createNotification({
            userId: 'operations',
            type: 'new_review_submission',
            title: 'New Review Pending',
            message: `Review pending for Order #${orderNumber}`,
            data: { order_id: orderId },
            target_role: 'operations'
        });

        const io = (global as any).io;
        io.to('operations').emit('review_submitted', {
            order_id: orderId,
            notification: 'New review pending moderation'
        });
    }
}
