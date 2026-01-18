/**
 * Reviews Service
 * Handles order reviews, moderation, and statistics
 */
import { Pool } from 'pg';

export class ReviewsService {
    constructor(private pool: Pool) { }

    async getGarageReviews(garageId: string, limit: number, offset: number) {
        const reviewsResult = await this.pool.query(`SELECT r.review_id, r.overall_rating, r.part_quality_rating, r.communication_rating, r.delivery_rating, r.review_text, r.created_at, LEFT(u.full_name, 1) || '***' as customer_initial, o.order_number FROM order_reviews r JOIN users u ON r.customer_id = u.user_id LEFT JOIN orders o ON r.order_id = o.order_id WHERE r.garage_id = $1 AND r.moderation_status = 'approved' AND r.is_visible = true ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`, [garageId, limit, offset]);
        const statsResult = await this.pool.query(`SELECT COUNT(*) as total_reviews, ROUND(AVG(overall_rating)::numeric, 1) as avg_rating, ROUND(AVG(part_quality_rating)::numeric, 1) as avg_quality, ROUND(AVG(communication_rating)::numeric, 1) as avg_communication, ROUND(AVG(delivery_rating)::numeric, 1) as avg_delivery, COUNT(*) FILTER (WHERE overall_rating = 5) as five_star, COUNT(*) FILTER (WHERE overall_rating = 4) as four_star, COUNT(*) FILTER (WHERE overall_rating = 3) as three_star, COUNT(*) FILTER (WHERE overall_rating = 2) as two_star, COUNT(*) FILTER (WHERE overall_rating = 1) as one_star FROM order_reviews WHERE garage_id = $1 AND moderation_status = 'approved' AND is_visible = true`, [garageId]);
        return { reviews: reviewsResult.rows, stats: statsResult.rows[0] };
    }

    async getMyReviews(garageId: string) {
        const result = await this.pool.query(`SELECT r.review_id, r.overall_rating, r.part_quality_rating, r.communication_rating, r.delivery_rating, r.review_text, r.created_at, r.moderation_status, LEFT(u.full_name, 1) || '***' as customer_initial, o.order_number FROM order_reviews r JOIN users u ON r.customer_id = u.user_id LEFT JOIN orders o ON r.order_id = o.order_id WHERE r.garage_id = $1 AND r.moderation_status = 'approved' ORDER BY r.created_at DESC`, [garageId]);
        const statsResult = await this.pool.query(`SELECT COUNT(*) as total_reviews, ROUND(AVG(overall_rating)::numeric, 1) as avg_rating FROM order_reviews WHERE garage_id = $1 AND moderation_status = 'approved'`, [garageId]);
        return { reviews: result.rows, stats: statsResult.rows[0] };
    }

    async getPendingReviews(limit: number, offset: number) {
        const result = await this.pool.query(`SELECT r.review_id, r.overall_rating, r.part_quality_rating, r.communication_rating, r.delivery_rating, r.review_text, r.created_at, r.moderation_status, u.full_name as customer_name, g.garage_name, o.order_number FROM order_reviews r JOIN users u ON r.customer_id = u.user_id JOIN garages g ON r.garage_id = g.garage_id LEFT JOIN orders o ON r.order_id = o.order_id WHERE r.moderation_status = 'pending' ORDER BY r.created_at ASC LIMIT $1 OFFSET $2`, [limit, offset]);
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM order_reviews WHERE moderation_status = 'pending'`);
        return { reviews: result.rows, total: parseInt(countResult.rows[0].count) };
    }

    async getAllReviews(status: string, limit: number, offset: number) {
        let whereClause = '';
        const params: unknown[] = [];
        let paramIndex = 1;
        if (status !== 'all') { whereClause = `WHERE r.moderation_status = $${paramIndex++}`; params.push(status); }
        const result = await this.pool.query(`SELECT r.review_id, r.overall_rating, r.review_text, r.created_at, r.moderation_status, r.moderated_at, r.rejection_reason, u.full_name as customer_name, g.garage_name, o.order_number, mod.full_name as moderated_by_name FROM order_reviews r JOIN users u ON r.customer_id = u.user_id JOIN garages g ON r.garage_id = g.garage_id LEFT JOIN orders o ON r.order_id = o.order_id LEFT JOIN users mod ON r.moderated_by = mod.user_id ${whereClause} ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, [...params, limit, offset]);
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM order_reviews r ${whereClause}`, params);
        return { reviews: result.rows, total: parseInt(countResult.rows[0].count) };
    }

    async moderateReview(reviewId: string, action: string, moderatorId: string, rejectionReason?: string) {
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const result = await this.pool.query(`UPDATE order_reviews SET moderation_status = $1, moderated_by = $2, moderated_at = NOW(), rejection_reason = $3, is_visible = $4 WHERE review_id = $5 RETURNING review_id, moderation_status, garage_id`, [newStatus, moderatorId, rejectionReason || null, action === 'approve', reviewId]);
        if (result.rowCount === 0) return null;
        if (action === 'approve') {
            await this.pool.query(`UPDATE garages g SET rating_average = (SELECT ROUND(AVG(overall_rating)::numeric, 2) FROM order_reviews WHERE garage_id = g.garage_id AND moderation_status = 'approved'), rating_count = (SELECT COUNT(*) FROM order_reviews WHERE garage_id = g.garage_id AND moderation_status = 'approved') WHERE g.garage_id = $1`, [result.rows[0].garage_id]);
        }
        return result.rows[0];
    }
}
