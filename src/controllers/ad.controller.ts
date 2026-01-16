import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AdService } from '../services/ad.service';
import { getErrorMessage } from '../types';

/**
 * POST /api/garage/ads/campaigns
 * Create new ad campaign
 */
export const createCampaign = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
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

    try {
        if (!campaign_name || !campaign_type || !budget_qar || !start_date || !end_date) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        const campaignId = await AdService.createCampaign({
            garage_id: garageId,
            campaign_name,
            campaign_type,
            budget_qar: parseFloat(budget_qar),
            daily_limit_qar: daily_limit_qar ? parseFloat(daily_limit_qar) : undefined,
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
        console.error('createCampaign error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/garage/ads/campaigns
 * Get garage campaigns
 */
export const getMyCampaigns = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const campaigns = await AdService.getGarageCampaigns(garageId);

        res.json({
            success: true,
            data: campaigns,
            count: campaigns.length
        });
    } catch (err) {
        console.error('getMyCampaigns error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/garage/ads/campaigns/:id/performance
 * Get campaign performance
 */
export const getCampaignPerformance = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const performance = await AdService.getCampaignPerformance(id);

        if (!performance) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({
            success: true,
            data: performance
        });
    } catch (err) {
        console.error('getCampaignPerformance error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * PUT /api/garage/ads/campaigns/:id/status
 * Update campaign status
 */
export const updateCampaignStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        if (!['active', 'paused', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await AdService.updateCampaignStatus(id, status);

        res.json({
            success: true,
            message: `Campaign ${status}`
        });
    } catch (err) {
        console.error('updateCampaignStatus error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/ads/pricing
 * Get ad pricing
 */
export const getAdPricing = async (req: AuthRequest, res: Response) => {
    try {
        const pricing = await AdService.getPricing();

        res.json({
            success: true,
            data: pricing
        });
    } catch (err) {
        console.error('getAdPricing error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/admin/ads/review
 * Admin: Review campaign
 */
export const reviewCampaign = async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { campaign_id, approved } = req.body;

    try {
        await AdService.reviewCampaign(campaign_id, approved, adminId);

        res.json({
            success: true,
            message: approved ? 'Campaign approved' : 'Campaign rejected'
        });
    } catch (err) {
        console.error('reviewCampaign error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/admin/ads/stats
 * Admin: Platform ad stats
 */
export const getAdStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await AdService.getPlatformAdStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('getAdStats error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
