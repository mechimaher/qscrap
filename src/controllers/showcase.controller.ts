/**
 * Showcase Controller - Refactored to use Service Layer
 * Delegates to ShowcaseQueryService, ShowcaseManagementService, and ShowcaseOrderService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import {
    ShowcaseQueryService,
    ShowcaseManagementService,
    ShowcaseOrderService,
    isShowcaseError,
    getHttpStatusForError
} from '../services/showcase';

import logger from '../utils/logger';
// Initialize services
const showcaseQueryService = new ShowcaseQueryService(pool);
const showcaseManagementService = new ShowcaseManagementService(pool);
const showcaseOrderService = new ShowcaseOrderService(pool);

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/showcase/parts - Browse active showcase parts
 */
export const getShowcaseParts = async (req: AuthRequest, res: Response) => {
    try {
        const { car_make, car_model, search, limit, offset } = req.query;

        const parts = await showcaseQueryService.getShowcaseParts({
            car_make: car_make as string,
            car_model: car_model as string,
            search: search as string,
            limit: limit ? parseInt(limit as string) : undefined,
            offset: offset ? parseInt(offset as string) : undefined
        });

        res.json({ parts });
    } catch (err) {
        logger.error('getShowcaseParts error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/showcase/parts/featured - Get featured parts for home carousel
 */
export const getFeaturedParts = async (req: AuthRequest, res: Response) => {
    try {
        const parts = await showcaseQueryService.getFeaturedParts(10);
        res.json({ parts });
    } catch (err) {
        logger.error('getFeaturedParts error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/showcase/parts/:id - Get part detail and track view
 */
export const getPartDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const part = await showcaseQueryService.getPartDetail(id, userId);
        res.json({ part });
    } catch (err) {
        logger.error('getPartDetail error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GARAGE ENDPOINTS (Enterprise Only)
// ============================================

/**
 * GET /api/garage/showcase - Get garage's own parts
 */
export const getMyShowcaseParts = async (req: AuthRequest, res: Response) => {
    try {
        const garageId = req.user!.userId;
        const { status } = req.query;

        const parts = await showcaseManagementService.getMyShowcaseParts(
            garageId,
            status as string
        );

        // Calculate analytics from parts
        const analytics = {
            total_parts: parts.length,
            active_parts: parts.filter((p: any) => p.status === 'active').length,
            total_views: parts.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0),
            total_orders: parts.reduce((sum: number, p: any) => sum + (p.order_count || 0), 0)
        };

        res.json({ parts, analytics });
    } catch (err) {
        logger.error('getMyShowcaseParts error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/garage/showcase - Add new part (multipart/form-data)
 */
export const addGaragePart = async (req: AuthRequest, res: Response) => {
    try {
        const garageId = req.user!.userId;
        const {
            title,
            part_description,
            car_make,
            car_model,
            car_year,
            price,
            quantity,
            is_negotiable
        } = req.body;

        // Handle uploaded images
        const files = req.files as Express.Multer.File[];
        const image_urls = files ? files.map(file => `/uploads/${file.filename}`) : [];

        if (!title || !car_make || !price) {
            return res.status(400).json({
                error: 'Title, car make, and price are required'
            });
        }

        const part = await showcaseManagementService.addGaragePart(garageId, {
            title,
            part_description,
            car_make,
            car_model,
            car_year,
            price: parseFloat(price),
            quantity: parseInt(quantity) || 1,
            is_negotiable: is_negotiable === 'true' || is_negotiable === true,
            image_urls
        });

        res.status(201).json({ message: 'Part added to showcase', part });
    } catch (err) {
        logger.error('addGaragePart error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * PUT /api/garage/showcase/:id - Update part
 */
export const updateGaragePart = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const garageId = req.user!.userId;
        const { images_to_remove, ...updates } = req.body;

        // Handle new uploaded images
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
            const newImageUrls = files.map(file => `/uploads/${file.filename}`);
            // Note: This would need to merge with existing images in the service
        }

        const part = await showcaseManagementService.updateGaragePart(id, garageId, {
            ...updates,
            images_to_remove: images_to_remove ? JSON.parse(images_to_remove) : undefined
        });

        res.json({ message: 'Part updated successfully', part });
    } catch (err) {
        logger.error('updateGaragePart error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * DELETE /api/garage/showcase/:id - Remove part
 */
export const deleteGaragePart = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const garageId = req.user!.userId;

        await showcaseManagementService.deleteGaragePart(id, garageId);
        res.json({ message: 'Part deleted successfully' });
    } catch (err) {
        logger.error('deleteGaragePart error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/garage/showcase/:id/toggle - Toggle active/hidden
 */
export const togglePartStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const garageId = req.user!.userId;

        const part = await showcaseManagementService.togglePartStatus(id, garageId);
        res.json({
            message: `Part ${part.status === 'active' ? 'activated' : 'hidden'}`,
            status: part.status
        });
    } catch (err) {
        logger.error('togglePartStatus error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// CUSTOMER ORDER ENDPOINTS
// ============================================

/**
 * POST /api/showcase/quick-order - Order part directly (fixed price)
 */
export const quickOrderFromShowcase = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user!.userId;
        const {
            part_id,
            quantity,
            delivery_address_text,
            delivery_lat,
            delivery_lng,
            payment_method,
            delivery_notes
        } = req.body;

        if (!part_id || !delivery_address_text) {
            return res.status(400).json({
                error: 'Part ID and delivery address are required'
            });
        }

        const result = await showcaseOrderService.quickOrderFromShowcase(customerId, {
            part_id,
            quantity: parseInt(quantity) || 1,
            delivery_address_text,
            delivery_lat: delivery_lat ? parseFloat(delivery_lat) : undefined,
            delivery_lng: delivery_lng ? parseFloat(delivery_lng) : undefined,
            payment_method: payment_method || 'cash',
            delivery_notes
        });

        res.status(201).json({
            message: 'Order created successfully',
            ...result
        });
    } catch (err) {
        logger.error('quickOrderFromShowcase error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/showcase/request-quote - Request quote for negotiable part
 */
export const requestQuoteFromShowcase = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user!.userId;
        const {
            part_id,
            quantity,
            delivery_address_text,
            delivery_lat,
            delivery_lng,
            customer_notes
        } = req.body;

        if (!part_id || !delivery_address_text) {
            return res.status(400).json({
                error: 'Part ID and delivery address are required'
            });
        }

        const result = await showcaseOrderService.requestQuoteFromShowcase(customerId, {
            part_id,
            quantity: parseInt(quantity) || 1,
            delivery_address_text,
            delivery_lat: delivery_lat ? parseFloat(delivery_lat) : undefined,
            delivery_lng: delivery_lng ? parseFloat(delivery_lng) : undefined,
            customer_notes
        });

        res.status(201).json(result);
    } catch (err) {
        logger.error('requestQuoteFromShowcase error', { error: (err as Error).message });
        if (isShowcaseError(err)) {
            return res.status(getHttpStatusForError(err))
                .json({ error: (err as Error).message });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
