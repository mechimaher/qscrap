import { Pool } from 'pg';
import logger from '../../utils/logger';

export interface WarrantyClaimStats {
    total_claims: number;
    pending_claims: number;
    approved_claims: number;
    rejected_claims: number;
    total_refund_amount: number;
    avg_approval_time_hours: number;
    claims_by_status: ClaimStatusBreakdown[];
    claims_by_resolution: ClaimResolutionBreakdown[];
    recent_claims: RecentClaim[];
}

export interface ClaimStatusBreakdown {
    status: string;
    count: number;
    percentage: number;
}

export interface ClaimResolutionBreakdown {
    resolution_type: string;
    count: number;
    percentage: number;
    total_amount: number;
}

export interface RecentClaim {
    claim_id: string;
    order_number: string;
    customer_name: string;
    garage_name: string;
    claim_status: string;
    claim_reason: string;
    created_at: string;
    resolved_at: string | null;
}

export interface GarageQualityScore {
    garage_id: string;
    garage_name: string;
    total_orders: number;
    warranty_claims: number;
    claim_rate: number;
    quality_score: number;
    quality_tier: 'excellent' | 'good' | 'fair' | 'poor';
}

export class WarrantyClaimAnalyticsService {
    constructor(private pool: Pool) {}

    /**
     * Get comprehensive warranty claims statistics
     */
    async getWarrantyClaimStats(): Promise<WarrantyClaimStats> {
        // Get basic counts
        const countsResult = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE claim_status = 'pending_finance_review') as pending_claims,
                COUNT(*) FILTER (WHERE claim_status = 'approved') as approved_claims,
                COUNT(*) FILTER (WHERE claim_status = 'rejected') as rejected_claims,
                COUNT(*) as total_claims
            FROM warranty_claims
        `);

        const counts = countsResult.rows[0];

        // Get total refund amount from approved claims
        const refundResult = await this.pool.query(`
            SELECT COALESCE(SUM(refund_amount), 0) as total_refund_amount
            FROM warranty_claims
            WHERE claim_status = 'approved' AND refund_amount IS NOT NULL
        `);

        const totalRefundAmount = parseFloat(refundResult.rows[0].total_refund_amount) || 0;

        // Get average approval time (in hours)
        const approvalTimeResult = await this.pool.query(`
            SELECT 
                ROUND(AVG(
                    EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
                )) as avg_approval_time_hours
            FROM warranty_claims
            WHERE claim_status = 'approved' 
            AND resolved_at IS NOT NULL
        `);

        const avgApprovalTime = parseFloat(approvalTimeResult.rows[0].avg_approval_time_hours) || 0;

        // Get claims by status breakdown
        const statusBreakdownResult = await this.pool.query(`
            SELECT 
                claim_status as status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM warranty_claims), 2) as percentage
            FROM warranty_claims
            GROUP BY claim_status
            ORDER BY count DESC
        `);

        const claimsByStatus = statusBreakdownResult.rows as unknown as ClaimStatusBreakdown[];

        // Get claims by resolution type breakdown
        const resolutionBreakdownResult = await this.pool.query(`
            SELECT 
                COALESCE(resolution_type, 'not_set') as resolution_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM warranty_claims WHERE claim_status = 'approved'), 2) as percentage,
                COALESCE(SUM(refund_amount), 0) as total_amount
            FROM warranty_claims
            WHERE claim_status = 'approved'
            GROUP BY resolution_type
            ORDER BY count DESC
        `);

        const claimsByResolution = resolutionBreakdownResult.rows as unknown as ClaimResolutionBreakdown[];

        // Get recent claims (last 10)
        const recentClaimsResult = await this.pool.query(`
            SELECT 
                wc.claim_id,
                o.order_number,
                u.full_name as customer_name,
                g.garage_name,
                wc.claim_status,
                wc.claim_reason,
                wc.created_at,
                wc.resolved_at
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN users u ON u.user_id = wc.customer_id
            INNER JOIN garages g ON g.garage_id = wc.garage_id
            ORDER BY wc.created_at DESC
            LIMIT 10
        `);

        const recentClaims = recentClaimsResult.rows as unknown as RecentClaim[];

        return {
            total_claims: parseInt(counts.total_claims) || 0,
            pending_claims: parseInt(counts.pending_claims) || 0,
            approved_claims: parseInt(counts.approved_claims) || 0,
            rejected_claims: parseInt(counts.rejected_claims) || 0,
            total_refund_amount: totalRefundAmount,
            avg_approval_time_hours: avgApprovalTime,
            claims_by_status: claimsByStatus,
            claims_by_resolution: claimsByResolution,
            recent_claims: recentClaims
        };
    }

    /**
     * Get garage quality scores based on warranty claim rates
     */
    async getGarageQualityScores(): Promise<GarageQualityScore[]> {
        const result = await this.pool.query(`
            WITH garage_stats AS (
                SELECT 
                    g.garage_id,
                    g.garage_name,
                    COUNT(DISTINCT o.order_id) as total_orders,
                    COUNT(DISTINCT wc.claim_id) as warranty_claims
                FROM garages g
                LEFT JOIN orders o ON o.garage_id = g.garage_id
                LEFT JOIN warranty_claims wc ON wc.order_id = o.order_id
                WHERE o.order_status IN ('delivered', 'completed')
                GROUP BY g.garage_id, g.garage_name
                HAVING COUNT(DISTINCT o.order_id) > 0
            )
            SELECT 
                garage_id,
                garage_name,
                total_orders,
                warranty_claims,
                ROUND((warranty_claims::numeric / total_orders) * 100, 2) as claim_rate,
                ROUND(100 - ((warranty_claims::numeric / total_orders) * 100), 2) as quality_score,
                CASE 
                    WHEN (warranty_claims::numeric / total_orders) < 0.02 THEN 'excellent'
                    WHEN (warranty_claims::numeric / total_orders) < 0.05 THEN 'good'
                    WHEN (warranty_claims::numeric / total_orders) < 0.10 THEN 'fair'
                    ELSE 'poor'
                END as quality_tier
            FROM garage_stats
            ORDER BY claim_rate ASC
        `);

        return result.rows as unknown as GarageQualityScore[];
    }

    /**
     * Get quality score for a specific garage
     */
    async getGarageQualityScore(garageId: string): Promise<GarageQualityScore | null> {
        const result = await this.pool.query(`
            WITH garage_stats AS (
                SELECT 
                    g.garage_id,
                    g.garage_name,
                    COUNT(DISTINCT o.order_id) as total_orders,
                    COUNT(DISTINCT wc.claim_id) as warranty_claims
                FROM garages g
                LEFT JOIN orders o ON o.garage_id = g.garage_id
                LEFT JOIN warranty_claims wc ON wc.order_id = o.order_id
                WHERE g.garage_id = $1
                AND o.order_status IN ('delivered', 'completed')
                GROUP BY g.garage_id, g.garage_name
            )
            SELECT 
                garage_id,
                garage_name,
                total_orders,
                warranty_claims,
                ROUND((warranty_claims::numeric / total_orders) * 100, 2) as claim_rate,
                ROUND(100 - ((warranty_claims::numeric / total_orders) * 100), 2) as quality_score,
                CASE 
                    WHEN (warranty_claims::numeric / total_orders) < 0.02 THEN 'excellent'
                    WHEN (warranty_claims::numeric / total_orders) < 0.05 THEN 'good'
                    WHEN (warranty_claims::numeric / total_orders) < 0.10 THEN 'fair'
                    ELSE 'poor'
                END as quality_tier
            FROM garage_stats
        `, [garageId]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0] as unknown as GarageQualityScore;
    }

    /**
     * Get claims trend over time (last 30 days)
     */
    async getClaimsTrend(): Promise<{ date: string; count: number; status: string }[]> {
        const result = await this.pool.query(`
            SELECT 
                DATE(created_at) as date,
                claim_status as status,
                COUNT(*) as count
            FROM warranty_claims
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at), claim_status
            ORDER BY date ASC, status
        `);

        return result.rows as unknown as { date: string; count: number; status: string }[];
    }

    /**
     * Get common defect reasons (for quality insights)
     */
    async getCommonDefectReasons(): Promise<{ reason: string; count: number; percentage: number }[]> {
        const result = await this.pool.query(`
            SELECT 
                claim_reason as reason,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM warranty_claims), 2) as percentage
            FROM warranty_claims
            GROUP BY claim_reason
            ORDER BY count DESC
            LIMIT 10
        `);

        return result.rows as unknown as { reason: string; count: number; percentage: number }[];
    }

    /**
     * Get pending claims with SLA breach risk
     */
    async getClaimsAtSlaRisk(): Promise<{
        claim_id: string;
        order_number: string;
        garage_name: string;
        hours_pending: number;
        sla_breach_risk: 'low' | 'medium' | 'high';
    }[]> {
        const result = await this.pool.query(`
            SELECT 
                wc.claim_id,
                o.order_number,
                g.garage_name,
                ROUND(EXTRACT(EPOCH FROM (NOW() - wc.created_at)) / 3600, 1) as hours_pending,
                CASE 
                    WHEN EXTRACT(EPOCH FROM (NOW() - wc.created_at)) / 3600 > 72 THEN 'high'
                    WHEN EXTRACT(EPOCH FROM (NOW() - wc.created_at)) / 3600 > 48 THEN 'medium'
                    ELSE 'low'
                END as sla_breach_risk
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN garages g ON g.garage_id = wc.garage_id
            WHERE wc.claim_status = 'pending_finance_review'
            ORDER BY hours_pending DESC
        `);

        return result.rows as unknown as {
            claim_id: string;
            order_number: string;
            garage_name: string;
            hours_pending: number;
            sla_breach_risk: 'low' | 'medium' | 'high';
        }[];
    }
}

// Export singleton instance
let analyticsServiceInstance: WarrantyClaimAnalyticsService | null = null;

export const getWarrantyClaimAnalyticsService = (pool: Pool): WarrantyClaimAnalyticsService => {
    if (!analyticsServiceInstance) {
        analyticsServiceInstance = new WarrantyClaimAnalyticsService(pool);
    }
    return analyticsServiceInstance;
};
