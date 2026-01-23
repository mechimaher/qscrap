import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { RequestQueryService, RequestLifecycleService, RequestFilteringService } from '../services/request';
import { getReadPool, getWritePool } from '../config/db';
import { catchAsync } from '../utils/catchAsync';
import { createRequest as createRequestService } from '../services/request.service';

const requestQueryService = new RequestQueryService(getReadPool());
const requestLifecycleService = new RequestLifecycleService(getWritePool());
const requestFilteringService = new RequestFilteringService(getWritePool());

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
        part_subcategory,
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
        partSubcategory: part_subcategory,
        conditionRequired: condition_required,
        deliveryAddressText: delivery_address_text,
        deliveryLat: delivery_lat ? parseFloat(delivery_lat) : undefined,
        deliveryLng: delivery_lng ? parseFloat(delivery_lng) : undefined,
        files: req.files as { [fieldname: string]: Express.Multer.File[] }
    });

    res.status(201).json({ message: result.message, request_id: result.request.request_id });
});

export const getActiveRequests = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const urgency = req.query.urgency as string;
    const condition = req.query.condition as string;
    const sortBy = req.query.sort as string || 'newest';
    const showAll = req.query.showAll === 'true';

    try {
        const result = await requestQueryService.getActiveRequests(garageId, {
            page,
            limit,
            urgency,
            condition,
            sortBy,
            showAll
        });

        res.json(result);
    } catch (err) {
        console.error('[REQUEST] getActiveRequests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getMyRequests = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
        const result = await requestQueryService.getMyRequests(userId, page, limit);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const getRequestDetails = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const result = await requestQueryService.getRequestDetails(request_id, userId, userType);
        res.json(result);
    } catch (err) {
        console.error('[REQUEST] Get request details error:', err);
        if (err instanceof Error && err.message === 'Request not found') {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (err instanceof Error && err.message === 'Access denied') {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.status(500).json({ error: 'Failed to fetch request details' });
    }
};

// ============================================
// CUSTOMER: CANCEL REQUEST
// ============================================

export const cancelRequest = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { request_id } = req.params;

    try {
        await requestLifecycleService.cancelRequest(request_id, userId);
        res.json({ success: true, message: 'Request cancelled successfully' });
    } catch (err) {
        console.error('[REQUEST] Cancel request error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Only active')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to cancel request' });
    }
};

// ============================================
// CUSTOMER: DELETE REQUEST (permanent)
// ============================================

export const deleteRequest = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { request_id } = req.params;

    try {
        const result = await requestLifecycleService.deleteRequest(request_id, userId);
        res.json(result);
    } catch (err) {
        console.error('[REQUEST] Delete request error:', err);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Cannot delete')) {
            return res.status(400).json({
                error: 'Cannot delete request with existing orders',
                hint: 'Orders exist for this request. You can only cancel, not delete.'
            });
        }
        res.status(500).json({ error: 'Failed to delete request' });
    }
};

// ============================================
// GARAGE: IGNORE REQUEST (per-garage)
// ============================================

export const ignoreRequest = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { request_id } = req.params;

    try {
        await requestFilteringService.ignoreRequest(garageId, request_id);
        res.json({ success: true, message: 'Request ignored' });
    } catch (err) {
        console.error('[REQUEST] Ignore request error:', err);
        res.status(500).json({ error: 'Failed to ignore request' });
    }
};

export const getIgnoredRequests = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const ignoredIds = await requestFilteringService.getIgnoredRequests(garageId);
        res.json({ ignored: ignoredIds });
    } catch (err) {
        console.error('[REQUEST] Get ignored requests error:', err);
        res.status(500).json({ error: 'Failed to fetch ignored requests' });
    }
};

export const unignoreRequest = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { request_id } = req.params;

    try {
        await requestFilteringService.unignoreRequest(garageId, request_id);
        res.json({ success: true, message: 'Request restored' });
    } catch (err) {
        console.error('[REQUEST] Unignore request error:', err);
        res.status(500).json({ error: 'Failed to restore request' });
    }
};
