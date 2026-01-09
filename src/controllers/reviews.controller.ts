import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';

// ============================================
// PUBLIC/CUSTOMER: Get Garage Reviews
// ============================================

export const getGarageReviews = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
        // Get approved reviews only
        const reviewsResult = await pool.query(`
            SELECT 
                r.review_id,
                r.overall_rating,
                r.part_quality_rating,
                r.communication_rating,
                r.delivery_rating,
                r.review_text,
                r.created_at,
                LEFT(u.full_name, 1) || '***' as customer_initial,
                o.order_number
            FROM order_reviews r
            JOIN users u ON r.customer_id = u.user_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE r.garage_id = $1 
            AND r.moderation_status = 'approved'
            AND r.is_visible = true
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3
        `, [garage_id, limit, offset]);

        // Get summary stats
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_reviews,
                ROUND(AVG(overall_rating)::numeric, 1) as avg_rating,
                ROUND(AVG(part_quality_rating)::numeric, 1) as avg_quality,
                ROUND(AVG(communication_rating)::numeric, 1) as avg_communication,
                ROUND(AVG(delivery_rating)::numeric, 1) as avg_delivery,
                COUNT(*) FILTER (WHERE overall_rating = 5) as five_star,
                COUNT(*) FILTER (WHERE overall_rating = 4) as four_star,
                COUNT(*) FILTER (WHERE overall_rating = 3) as three_star,
                COUNT(*) FILTER (WHERE overall_rating = 2) as two_star,
                COUNT(*) FILTER (WHERE overall_rating = 1) as one_star
            FROM order_reviews
            WHERE garage_id = $1 
            AND moderation_status = 'approved'
            AND is_visible = true
        `, [garage_id]);

        res.json({
            reviews: reviewsResult.rows,
            stats: statsResult.rows[0],
            pagination: {
                limit,
                offset,
                total: parseInt(statsResult.rows[0]?.total_reviews || '0')
            }
        });
    } catch (err) {
        console.error('getGarageReviews error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GARAGE: Get My Reviews
// ============================================

export const getMyReviews = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(`
            SELECT 
                r.review_id,
                r.overall_rating,
                r.part_quality_rating,
                r.communication_rating,
                r.delivery_rating,
                r.review_text,
                r.created_at,
                r.moderation_status,
                LEFT(u.full_name, 1) || '***' as customer_initial,
                o.order_number
            FROM order_reviews r
            JOIN users u ON r.customer_id = u.user_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE r.garage_id = $1 
            AND r.moderation_status = 'approved'
            ORDER BY r.created_at DESC
        `, [garageId]);

        // Get stats
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_reviews,
                ROUND(AVG(overall_rating)::numeric, 1) as avg_rating
            FROM order_reviews
            WHERE garage_id = $1 AND moderation_status = 'approved'
        `, [garageId]);

        res.json({
            reviews: result.rows,
            stats: statsResult.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// OPERATIONS: Get Pending Reviews for Moderation
// ============================================

export const getPendingReviews = async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(`
            SELECT 
                r.review_id,
                r.overall_rating,
                r.part_quality_rating,
                r.communication_rating,
                r.delivery_rating,
                r.review_text,
                r.created_at,
                r.moderation_status,
                u.full_name as customer_name,
                g.garage_name,
                o.order_number
            FROM order_reviews r
            JOIN users u ON r.customer_id = u.user_id
            JOIN garages g ON r.garage_id = g.garage_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE r.moderation_status = 'pending'
            ORDER BY r.created_at ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM order_reviews WHERE moderation_status = 'pending'
        `);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            pending_reviews: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// Placeholder until file verifiedws (with filters)
// ============================================

export const getAllReviews = async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string || 'all';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        let whereClause = '';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (status !== 'all') {
            whereClause = `WHERE r.moderation_status = $${paramIndex++}`;
            params.push(status);
        }

        const result = await pool.query(`
            SELECT 
                r.review_id,
                r.overall_rating,
                r.review_text,
                r.created_at,
                r.moderation_status,
                r.moderated_at,
                r.rejection_reason,
                u.full_name as customer_name,
                g.garage_name,
                o.order_number,
                mod.full_name as moderated_by_name
            FROM order_reviews r
            JOIN users u ON r.customer_id = u.user_id
            JOIN garages g ON r.garage_id = g.garage_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            LEFT JOIN users mod ON r.moderated_by = mod.user_id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...params, limit, offset]);

        // Get count
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM order_reviews r
            ${whereClause}
        `, params);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            reviews: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// OPERATIONS: Moderate Review (Approve/Reject)
// ============================================

export const moderateReview = async (req: AuthRequest, res: Response) => {
    const { review_id } = req.params;
    const { action, rejection_reason } = req.body;
    const moderatorId = req.user!.userId;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' });
    }

    if (action === 'reject' && !rejection_reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
    }

    try {
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const result = await pool.query(`
            UPDATE order_reviews SET
                moderation_status = $1,
                moderated_by = $2,
                moderated_at = NOW(),
                rejection_reason = $3,
                is_visible = $4
            WHERE review_id = $5
            RETURNING review_id, moderation_status, garage_id
        `, [newStatus, moderatorId, rejection_reason || null, action === 'approve', review_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = result.rows[0];

        // If approved, trigger garage rating update
        if (action === 'approve') {
            // The trigger should handle this, but let's be safe
            await pool.query(`
                UPDATE garages g SET
                    rating_average = (
                        SELECT ROUND(AVG(overall_rating)::numeric, 2)
                        FROM order_reviews 
                        WHERE garage_id = g.garage_id AND moderation_status = 'approved'
                    ),
                    rating_count = (
                        SELECT COUNT(*)
                        FROM order_reviews 
                        WHERE garage_id = g.garage_id AND moderation_status = 'approved'
                    )
                WHERE g.garage_id = $1
            `, [review.garage_id]);

            // Notify Garage (Persistent)
            await createNotification({
                userId: review.garage_id,
                type: 'new_review',
                title: 'New Review Received! ⭐',
                message: 'A customer review has been approved and is now visible.',
                data: { review_id: review.review_id },
                target_role: 'garage'
            });
        }

        res.json({
            message: `Review ${action}d successfully`,
            review: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
