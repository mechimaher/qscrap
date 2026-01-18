import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { BidQueryService, BidManagementService } from '../services/bid';
import { getReadPool, getWritePool } from '../config/db';
import { getErrorMessage } from '../types';
import { catchAsync } from '../utils/catchAsync';
import { submitBid as serviceSubmitBid } from '../services/bid.service';
import { pricingService } from '../services/pricing.service';

const bidQueryService = new BidQueryService(getReadPool());
const bidManagementService = new BidManagementService(getWritePool());

// ============================================
// BID CONTROLLERS
// ============================================

export const submitBid = catchAsync(async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const { request_id: bodyRequestId, bid_amount, warranty_days, notes, part_condition, brand_name, part_number } = req.body;
    const garageId = req.user!.userId;

    const targetRequestId = request_id || bodyRequestId;

    const result = await serviceSubmitBid({
        requestId: targetRequestId,
        garageId,
        bidAmount: bid_amount,
        warrantyDays: warranty_days,
        notes,
        partCondition: part_condition,
        brandName: brand_name,
        partNumber: part_number,
        files: req.files as Express.Multer.File[]
    });

    res.status(201).json({
        message: result.message,
        bid_id: result.bid.bid_id
    });
});

export const getMyBids = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { page, limit, status } = req.query;

    try {
        const result = await bidQueryService.getMyBids(garageId, {
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined,
            status: status as string
        });

        res.json(result);
    } catch (err) {
        console.error('[BID] GetMyBids error:', err);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
};

export const getBidById = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const garageId = req.user!.userId;

    try {
        const bid = await bidQueryService.getBidById(bid_id, garageId);
        res.json(bid);
    } catch (err) {
        console.error('[BID] GetBidById error:', err);
        if (err instanceof Error && err.message === 'Bid not found') {
            return res.status(404).json({ error: 'Bid not found' });
        }
        res.status(500).json({ error: 'Failed to fetch bid' });
    }
};

export const rejectBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const userId = req.user!.userId;

    try {
        const result = await bidManagementService.rejectBid(bid_id, userId);
        res.json(result);
    } catch (err) {
        console.error('[BID] Reject error:', getErrorMessage(err));
        if (err instanceof Error && err.message.includes('Not authorized')) {
            return res.status(403).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Cannot reject')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to reject bid' });
    }
};

export const updateBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const { bid_amount, warranty_days, notes, part_condition, brand_name } = req.body;
    const garageId = req.user!.userId;

    try {
        const result = await bidManagementService.updateBid(bid_id, garageId, {
            bid_amount,
            warranty_days,
            notes,
            part_condition,
            brand_name
        });

        res.json(result);
    } catch (err) {
        console.error('[BID] Update error:', getErrorMessage(err));
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(403).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Cannot update')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const withdrawBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const garageId = req.user!.userId;

    try {
        const result = await bidManagementService.withdrawBid(bid_id, garageId);
        res.json(result);
    } catch (err) {
        console.error('[BID] Withdraw error:', getErrorMessage(err));
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(403).json({ error: err.message });
        }
        if (err instanceof Error && err.message.includes('Cannot withdraw')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to withdraw bid' });
    }
};

export const getFairPriceEstimate = async (req: AuthRequest, res: Response) => {
    const { part_name, car_make, car_model, car_year } = req.query;

    if (!part_name || !car_make || !car_model) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const estimate = await pricingService.getFairPriceEstimate(
            String(part_name),
            String(car_make),
            String(car_model),
            Number(car_year) || 0
        );

        res.json({ estimate });
    } catch (err) {
        console.error('[BID] Estimate error:', err);
        res.status(500).json({ error: 'Failed to get estimate' });
    }
};
