import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { createNotification } from '../services/notification.service';
import { ReviewsService } from '../services/reviews';
import logger from '../utils/logger';

const reviewsService = new ReviewsService(pool);

export const getGarageReviews = async (req: AuthRequest, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;
        const result = await reviewsService.getGarageReviews(req.params.garage_id, limit, offset);
        res.json({ ...result, pagination: { limit, offset, total: parseInt(result.stats?.total_reviews || '0') } });
    } catch (err) {
        logger.error('getGarageReviews error', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getMyReviews = async (req: AuthRequest, res: Response) => {
    try {
        const result = await reviewsService.getMyReviews(req.user!.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getPendingReviews = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const result = await reviewsService.getPendingReviews(limit, offset);
        res.json({ pending_reviews: result.reviews, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getAllReviews = async (req: AuthRequest, res: Response) => {
    try {
        const status = req.query.status as string || 'all';
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const result = await reviewsService.getAllReviews(status, limit, offset);
        res.json({ reviews: result.reviews, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const moderateReview = async (req: AuthRequest, res: Response) => {
    const { action, rejection_reason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' });
    if (action === 'reject' && !rejection_reason) return res.status(400).json({ error: 'Rejection reason is required' });
    try {
        const review = await reviewsService.moderateReview(req.params.review_id, action, req.user!.userId, rejection_reason);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (action === 'approve') {
            await createNotification({ userId: review.garage_id, type: 'new_review', title: 'New Review Received! ⭐', message: 'A customer review has been approved.', data: { review_id: review.review_id }, target_role: 'garage' });
        }
        res.json({ message: `Review ${action}d successfully`, review });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
