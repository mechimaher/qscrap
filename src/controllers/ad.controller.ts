import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AdService } from '../services/ad.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';

interface CreateCampaignBody {
    campaign_name?: string;
    campaign_type?: string;
    budget_qar?: number | string;
    daily_limit_qar?: number | string;
    start_date?: string;
    end_date?: string;
    target_categories?: string[];
    target_brands?: string[];
}

interface CampaignStatusBody {
    status?: string;
}

interface ReviewCampaignBody {
    campaign_id?: string;
    approved?: boolean;
}

type TypedAuthRequest<
    Body = Record<string, never>,
    Params extends Record<string, string> = Record<string, string>
> = Omit<AuthRequest, 'body' | 'params'> & {
    body: Body;
    params: Params;
};

type CreateCampaignRequest = TypedAuthRequest<CreateCampaignBody>;
type CampaignStatusRequest = TypedAuthRequest<CampaignStatusBody, { id: string }>;
type CampaignParamRequest = TypedAuthRequest<Record<string, never>, { id: string }>;
type ReviewCampaignRequest = TypedAuthRequest<ReviewCampaignBody>;
type BasicAuthRequest = TypedAuthRequest;

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const toNumber = (value: number | string | undefined): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const isCampaignStatus = (value: string): value is 'active' | 'paused' | 'completed' =>
    ['active', 'paused', 'completed'].includes(value);

/**
 * POST /api/garage/ads/campaigns
 * Create new ad campaign
 */
export const createCampaign = async (req: CreateCampaignRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {return res.status(401).json({ error: 'Unauthorized' });}

    const {
        campaign_name,
        campaign_type,
        budget_qar,
        daily_limit_qar,
        start_date,
        end_date,
        target_categories,
        target_brands
    } = req.body;

    const budget = toNumber(budget_qar);
    const dailyLimit = toNumber(daily_limit_qar);

    try {
        if (!campaign_name || !campaign_type || budget === null || !start_date || !end_date) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        const campaignId = await AdService.createCampaign({
            garage_id: garageId,
            campaign_name,
            campaign_type,
            budget_qar: budget,
            daily_limit_qar: dailyLimit ?? undefined,
            start_date,
            end_date,
            target_categories,
            target_brands
        });

        res.json({
            success: true,
            campaign_id: campaignId,
            message: 'Campaign created and pending approval'
        });
    } catch (err) {
        logger.error('createCampaign error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/garage/ads/campaigns
 * Get garage campaigns
 */
export const getMyCampaigns = async (req: BasicAuthRequest, res: Response) => {
    const garageId = getUserId(req);
    if (!garageId) {return res.status(401).json({ error: 'Unauthorized' });}

    try {
        const campaigns = await AdService.getGarageCampaigns(garageId);

        res.json({
            success: true,
            data: campaigns,
            count: campaigns.length
        });
    } catch (err) {
        logger.error('getMyCampaigns error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/garage/ads/campaigns/:id/performance
 * Get campaign performance
 */
export const getCampaignPerformance = async (req: CampaignParamRequest, res: Response) => {
    const { id } = req.params;
    if (!id) {return res.status(400).json({ error: 'Campaign ID is required' });}

    try {
        const performance = await AdService.getCampaignPerformance(id) as unknown as Record<string, unknown> | null;

        if (!performance) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({
            success: true,
            data: performance
        });
    } catch (err) {
        logger.error('getCampaignPerformance error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * PUT /api/garage/ads/campaigns/:id/status
 * Update campaign status
 */
export const updateCampaignStatus = async (req: CampaignStatusRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        if (!status || !isCampaignStatus(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await AdService.updateCampaignStatus(id, status);

        res.json({
            success: true,
            message: `Campaign ${status}`
        });
    } catch (err) {
        logger.error('updateCampaignStatus error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/ads/pricing
 * Get ad pricing
 */
export const getAdPricing = async (req: BasicAuthRequest, res: Response) => {
    try {
        const pricing = await AdService.getPricing();

        res.json({
            success: true,
            data: pricing
        });
    } catch (err) {
        logger.error('getAdPricing error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/admin/ads/review
 * Admin: Review campaign
 */
export const reviewCampaign = async (req: ReviewCampaignRequest, res: Response) => {
    const adminId = getUserId(req);
    if (!adminId) {return res.status(401).json({ error: 'Unauthorized' });}

    const { campaign_id, approved } = req.body;

    try {
        if (!campaign_id || typeof approved !== 'boolean') {
            return res.status(400).json({ error: 'campaign_id and approved are required' });
        }

        await AdService.reviewCampaign(campaign_id, approved, adminId);

        res.json({
            success: true,
            message: approved ? 'Campaign approved' : 'Campaign rejected'
        });
    } catch (err) {
        logger.error('reviewCampaign error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/admin/ads/stats
 * Admin: Platform ad stats
 */
export const getAdStats = async (req: BasicAuthRequest, res: Response) => {
    try {
        const stats = await AdService.getPlatformAdStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        logger.error('getAdStats error', { error: (err as Error).message });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
