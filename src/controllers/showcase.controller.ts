/**
 * Showcase Controller - Refactored to use Service Layer
 * Delegates to ShowcaseQueryService, ShowcaseManagementService, and ShowcaseOrderService
 */

import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import {
    getHttpStatusForError,
    isShowcaseError,
    type CreatePartData,
    type QuickOrderData,
    type QuoteRequestData,
    type ShowcaseFilters,
    ShowcaseManagementService,
    ShowcaseOrderService,
    ShowcaseQueryService,
    type UpdatePartData
} from '../services/showcase';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';

const showcaseQueryService = new ShowcaseQueryService(pool);
const showcaseManagementService = new ShowcaseManagementService(pool);
const showcaseOrderService = new ShowcaseOrderService(pool);

interface PartParams {
    id: string;
}

interface AddGaragePartBody {
    title?: string;
    part_description?: string;
    car_make?: string;
    car_model?: string;
    car_year?: string;
    price?: number | string;
    quantity?: number | string;
    is_negotiable?: boolean | string;
}

interface UpdateGaragePartBody extends Partial<AddGaragePartBody> {
    images_to_remove?: string[] | string;
}

interface QuickOrderBody {
    part_id?: string;
    quantity?: number | string;
    delivery_address_text?: string;
    delivery_lat?: number | string;
    delivery_lng?: number | string;
    payment_method?: string;
    delivery_notes?: string;
}

interface RequestQuoteBody {
    part_id?: string;
    quantity?: number | string;
    delivery_address_text?: string;
    delivery_lat?: number | string;
    delivery_lng?: number | string;
    customer_notes?: string;
}

type JsonRecord = Record<string, unknown>;

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const toRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    return undefined;
};

const toOptionalStringArray = (value: unknown): string[] | undefined => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }

    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return undefined;
        }
        return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
        return undefined;
    }
};

const toCount = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const getUploadedImageUrls = (req: AuthRequest): string[] => {
    const filesValue: unknown = req.files;
    if (!Array.isArray(filesValue)) {
        return [];
    }

    return filesValue
        .filter((file): file is Express.Multer.File =>
            isRecord(file) && typeof file.filename === 'string'
        )
        .map((file) => `/uploads/${file.filename}`);
};

const logShowcaseError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

const sendShowcaseError = (res: Response, error: unknown, fallbackMessage: string): Response => {
    if (isShowcaseError(error)) {
        return res.status(getHttpStatusForError(error)).json({ error: getErrorMessage(error) });
    }
    return res.status(500).json({ error: fallbackMessage });
};

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/showcase/parts - Browse active showcase parts
 */
export const getShowcaseParts = async (req: AuthRequest, res: Response) => {
    try {
        const filters: ShowcaseFilters = {
            car_make: toQueryString(req.query.car_make),
            car_model: toQueryString(req.query.car_model),
            search: toQueryString(req.query.search),
            limit: toOptionalInt(req.query.limit),
            offset: toOptionalInt(req.query.offset)
        };

        const parts = await showcaseQueryService.getShowcaseParts(filters);

        res.json({ parts });
    } catch (error) {
        logShowcaseError('getShowcaseParts error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

/**
 * GET /api/showcase/parts/featured - Get featured parts for home carousel
 */
export const getFeaturedParts = async (_req: AuthRequest, res: Response) => {
    try {
        const parts = await showcaseQueryService.getFeaturedParts(10);
        res.json({ parts });
    } catch (error) {
        logShowcaseError('getFeaturedParts error', error);
        res.status(500).json({ error: getErrorMessage(error) });
    }
};

/**
 * GET /api/showcase/parts/:id - Get part detail and track view
 */
export const getPartDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params as unknown as PartParams;
        const userId = req.user?.userId;

        const part = await showcaseQueryService.getPartDetail(id, userId);
        res.json({ part });
    } catch (error) {
        logShowcaseError('getPartDetail error', error);
        return sendShowcaseError(res, error, 'Failed to fetch part details');
    }
};

// ============================================
// GARAGE ENDPOINTS (Enterprise Only)
// ============================================

/**
 * GET /api/garage/showcase - Get garage's own parts
 */
export const getMyShowcaseParts = async (req: AuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const status = toQueryString(req.query.status);

        const parts = await showcaseManagementService.getMyShowcaseParts(garageId, status);

        let activeParts = 0;
        let totalViews = 0;
        let totalOrders = 0;

        for (const part of parts) {
            const partRecord = part as unknown as JsonRecord;
            if (toQueryString(partRecord.status) === 'active') {
                activeParts += 1;
            }
            totalViews += toCount(partRecord.view_count);
            totalOrders += toCount(partRecord.order_count ?? partRecord.orders_count);
        }

        const analytics = {
            total_parts: parts.length,
            active_parts: activeParts,
            total_views: totalViews,
            total_orders: totalOrders
        };

        res.json({ parts, analytics });
    } catch (error) {
        logShowcaseError('getMyShowcaseParts error', error);
        return sendShowcaseError(res, error, 'Failed to fetch garage showcase');
    }
};

/**
 * POST /api/garage/showcase - Add new part (multipart/form-data)
 */
export const addGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as AddGaragePartBody;
        const title = toQueryString(body.title);
        const carMake = toQueryString(body.car_make);
        const price = toOptionalNumber(body.price);
        const imageUrls = getUploadedImageUrls(req);

        if (!title || !carMake || price === undefined) {
            return res.status(400).json({
                error: 'Title, car make, and price are required'
            });
        }

        const partData: CreatePartData = {
            title,
            part_description: toQueryString(body.part_description) ?? '',
            car_make: carMake,
            car_model: toQueryString(body.car_model) ?? '',
            car_year: toQueryString(body.car_year),
            price,
            quantity: Math.max(1, toOptionalInt(body.quantity) ?? 1),
            is_negotiable: toOptionalBoolean(body.is_negotiable) ?? false,
            image_urls: imageUrls
        };

        const part = await showcaseManagementService.addGaragePart(garageId, partData);

        res.status(201).json({ message: 'Part added to showcase', part });
    } catch (error) {
        logShowcaseError('addGaragePart error', error);
        return sendShowcaseError(res, error, 'Failed to add showcase part');
    }
};

/**
 * PUT /api/garage/showcase/:id - Update part
 */
export const updateGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { id } = req.params as unknown as PartParams;
        const body = req.body as unknown as UpdateGaragePartBody;

        const updates: UpdatePartData = {};
        const title = toQueryString(body.title);
        const partDescription = toQueryString(body.part_description);
        const carMake = toQueryString(body.car_make);
        const carModel = toQueryString(body.car_model);
        const carYear = toQueryString(body.car_year);
        const price = toOptionalNumber(body.price);
        const quantity = toOptionalInt(body.quantity);
        const isNegotiable = toOptionalBoolean(body.is_negotiable);
        const imagesToRemove = toOptionalStringArray(body.images_to_remove);

        if (title !== undefined) {
            updates.title = title;
        }
        if (partDescription !== undefined) {
            updates.part_description = partDescription;
        }
        if (carMake !== undefined) {
            updates.car_make = carMake;
        }
        if (carModel !== undefined) {
            updates.car_model = carModel;
        }
        if (carYear !== undefined) {
            updates.car_year = carYear;
        }
        if (price !== undefined) {
            updates.price = price;
        }
        if (quantity !== undefined) {
            updates.quantity = quantity;
        }
        if (isNegotiable !== undefined) {
            updates.is_negotiable = isNegotiable;
        }
        if (imagesToRemove !== undefined) {
            updates.images_to_remove = imagesToRemove;
        }

        const part = await showcaseManagementService.updateGaragePart(id, garageId, updates);

        res.json({ message: 'Part updated successfully', part });
    } catch (error) {
        logShowcaseError('updateGaragePart error', error);
        return sendShowcaseError(res, error, 'Failed to update showcase part');
    }
};

/**
 * DELETE /api/garage/showcase/:id - Remove part
 */
export const deleteGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { id } = req.params as unknown as PartParams;

        await showcaseManagementService.deleteGaragePart(id, garageId);
        res.json({ message: 'Part deleted successfully' });
    } catch (error) {
        logShowcaseError('deleteGaragePart error', error);
        return sendShowcaseError(res, error, 'Failed to delete showcase part');
    }
};

/**
 * POST /api/garage/showcase/:id/toggle - Toggle active/hidden
 */
export const togglePartStatus = async (req: AuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { id } = req.params as unknown as PartParams;

        const part = await showcaseManagementService.togglePartStatus(id, garageId);
        res.json({
            message: `Part ${part.status === 'active' ? 'activated' : 'hidden'}`,
            status: part.status
        });
    } catch (error) {
        logShowcaseError('togglePartStatus error', error);
        return sendShowcaseError(res, error, 'Failed to toggle part status');
    }
};

// ============================================
// CUSTOMER ORDER ENDPOINTS
// ============================================

/**
 * POST /api/showcase/quick-order - Order part directly (fixed price)
 */
export const quickOrderFromShowcase = async (req: AuthRequest, res: Response) => {
    const customerId = getUserId(req);
    if (!customerId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as QuickOrderBody;
        const partId = toQueryString(body.part_id);
        const deliveryAddressText = toQueryString(body.delivery_address_text);

        if (!partId || !deliveryAddressText) {
            return res.status(400).json({
                error: 'Part ID and delivery address are required'
            });
        }

        const orderData: QuickOrderData = {
            part_id: partId,
            quantity: Math.max(1, toOptionalInt(body.quantity) ?? 1),
            delivery_address_text: deliveryAddressText,
            delivery_lat: toOptionalNumber(body.delivery_lat),
            delivery_lng: toOptionalNumber(body.delivery_lng),
            payment_method: toQueryString(body.payment_method) ?? 'cash',
            delivery_notes: toQueryString(body.delivery_notes)
        };

        const resultValue: unknown = await showcaseOrderService.quickOrderFromShowcase(customerId, orderData);
        const result = toRecord(resultValue);
        if (!result) {
            return res.status(500).json({ error: 'Failed to create order' });
        }

        res.status(201).json({
            message: 'Order created successfully',
            ...result
        });
    } catch (error) {
        logShowcaseError('quickOrderFromShowcase error', error);
        return sendShowcaseError(res, error, 'Failed to create showcase order');
    }
};

/**
 * POST /api/showcase/request-quote - Request quote for negotiable part
 */
export const requestQuoteFromShowcase = async (req: AuthRequest, res: Response) => {
    const customerId = getUserId(req);
    if (!customerId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as RequestQuoteBody;
        const partId = toQueryString(body.part_id);
        const deliveryAddressText = toQueryString(body.delivery_address_text);

        if (!partId || !deliveryAddressText) {
            return res.status(400).json({
                error: 'Part ID and delivery address are required'
            });
        }

        const quoteData: QuoteRequestData = {
            part_id: partId,
            quantity: Math.max(1, toOptionalInt(body.quantity) ?? 1),
            delivery_address_text: deliveryAddressText,
            delivery_lat: toOptionalNumber(body.delivery_lat),
            delivery_lng: toOptionalNumber(body.delivery_lng),
            customer_notes: toQueryString(body.customer_notes)
        };

        const resultValue: unknown = await showcaseOrderService.requestQuoteFromShowcase(customerId, quoteData);
        const result = toRecord(resultValue);
        if (!result) {
            return res.status(500).json({ error: 'Failed to request quote' });
        }

        res.status(201).json(result);
    } catch (error) {
        logShowcaseError('requestQuoteFromShowcase error', error);
        return sendShowcaseError(res, error, 'Failed to request quote');
    }
};
