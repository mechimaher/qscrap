import { pool } from '../config/database';
import { getErrorMessage } from '../types';

interface Campaign {
    campaign_id: string;
    garage_id: string;
    campaign_name: string;
    campaign_type: string;
    budget_qar: string;
    status: string;
    impressions: number;
    clicks: number;
    conversions: number;
}

interface CampaignPerformance {
    ctr_percentage: string;
    conversion_rate: string;
    cost_per_conversion: string;
    spent_amount: string;
}

export class AdService {
    /**
     * Create new ad campaign
     */
    static async createCampaign(data: {
        garage_id: string;
        campaign_name: string;
        campaign_type: string;
        budget_qar: number;
        daily_limit_qar?: number;
        start_date: string;
        end_date: string;
        target_categories?: string[];
        target_brands?: string[];
    }): Promise<string> {
        try {
            const result = await pool.query(
                `INSERT INTO ad_campaigns (
                    garage_id, campaign_name, campaign_type, budget_qar,
                    daily_limit_qar, start_date, end_date,
                    target_categories, target_brands, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
                RETURNING campaign_id`,
                [
                    data.garage_id,
                    data.campaign_name,
                    data.campaign_type,
                    data.budget_qar,
                    data.daily_limit_qar || null,
                    data.start_date,
                    data.end_date,
                    data.target_categories || null,
                    data.target_brands || null
                ]
            );

            return result.rows[0].campaign_id;
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw new Error('Failed to create campaign');
        }
    }

    /**
     * Get garage campaigns
     */
    static async getGarageCampaigns(garageId: string): Promise<Campaign[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    campaign_id, garage_id, campaign_name, campaign_type,
                    budget_qar, daily_limit_qar, start_date, end_date,
                    status, spent_amount, impressions, clicks, conversions,
                    created_at
                FROM ad_campaigns
                WHERE garage_id = $1
                ORDER BY created_at DESC`,
                [garageId]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            throw new Error('Failed to fetch campaigns');
        }
    }

    /**
     * Get campaign performance
     */
    static async getCampaignPerformance(campaignId: string): Promise<any> {
        try {
            const result = await pool.query(
                `SELECT * FROM ad_campaign_analytics
                WHERE campaign_id = $1`,
                [campaignId]
            );

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching campaign performance:', error);
            throw new Error('Failed to fetch performance data');
        }
    }

    /**
     * Record ad impression
     */
    static async recordImpression(data: {
        campaign_id: string;
        placement_id?: string;
        customer_id?: string;
        ip_address: string;
        interaction_type: 'view' | 'click' | 'conversion';
    }): Promise<void> {
        try {
            await pool.query(
                'SELECT record_ad_interaction($1, $2, $3, $4, $5)',
                [
                    data.campaign_id,
                    data.placement_id || null,
                    data.customer_id || null,
                    data.ip_address,
                    data.interaction_type
                ]
            );
        } catch (error) {
            console.error('Error recording impression:', error);
            // Don't throw - impressions shouldn't break user experience
        }
    }

    /**
     * Get active ads for placement
     */
    static async getActiveAdsForPlacement(
        placementType: string,
        limit: number = 5
    ): Promise<any[]> {
        try {
            const result = await pool.query(
                'SELECT * FROM get_active_ads_for_placement($1, $2)',
                [placementType, limit]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching active ads:', error);
            return [];
        }
    }

    /**
     * Update campaign status
     */
    static async updateCampaignStatus(
        campaignId: string,
        status: 'active' | 'paused' | 'completed'
    ): Promise<void> {
        try {
            await pool.query(
                `UPDATE ad_campaigns 
                SET status = $1, updated_at = NOW()
                WHERE campaign_id = $2`,
                [status, campaignId]
            );
        } catch (error) {
            console.error('Error updating campaign status:', error);
            throw new Error('Failed to update campaign status');
        }
    }

    /**
     * Get ad pricing
     */
    static async getPricing(): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT * FROM ad_pricing ORDER BY min_daily_budget ASC`
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching pricing:', error);
            throw new Error('Failed to fetch pricing');
        }
    }

    /**
     * Admin: Approve/reject campaign
     */
    static async reviewCampaign(
        campaignId: string,
        approved: boolean,
        reviewedBy: string
    ): Promise<void> {
        try {
            await pool.query(
                `UPDATE ad_campaigns 
                SET status = $1, 
                    approved_by = $2, 
                    approved_at = NOW()
                WHERE campaign_id = $3`,
                [approved ? 'active' : 'rejected', reviewedBy, campaignId]
            );
        } catch (error) {
            console.error('Error reviewing campaign:', error);
            throw new Error('Failed to review campaign');
        }
    }

    /**
     * Get platform ad revenue stats
     */
    static async getPlatformAdStats(): Promise<{
        total_campaigns: number;
        active_campaigns: number;
        total_revenue: string;
        total_impressions: number;
        total_clicks: number;
    }> {
        try {
            const result = await pool.query(
                `SELECT 
                    COUNT(*) as total_campaigns,
                    COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
                    COALESCE(SUM(spent_amount), 0) as total_revenue,
                    COALESCE(SUM(impressions), 0) as total_impressions,
                    COALESCE(SUM(clicks), 0) as total_clicks
                FROM ad_campaigns`
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error fetching platform ad stats:', error);
            throw new Error('Failed to fetch ad stats');
        }
    }
}
