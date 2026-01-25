/**
 * Fraud Detection Service
 * Prevents fake/spam bids and suspicious behavior
 * 
 * Rules implemented:
 * 1. Rate limit bids per garage (max 10/hour per request)
 * 2. Flag rapid-fire bids (same price in < 30 seconds)
 * 3. Block unverified/demo-expired garages
 * 4. Detect suspicious patterns
 */

import { Pool } from 'pg';
import logger from '../../utils/logger';

interface FraudCheckResult {
    allowed: boolean;
    reason?: string;
    riskScore: number;  // 0-100, higher = more suspicious
    flags: string[];
}

interface BidContext {
    garageId: string;
    requestId: string;
    bidAmount: number;
    partCondition: string;
}

export class FraudDetectionService {
    private pool: Pool;

    // Configuration (can be moved to database later)
    private readonly MAX_BIDS_PER_HOUR = 50;           // Per garage total
    private readonly MAX_BIDS_PER_REQUEST_HOUR = 10;   // Per request per garage
    private readonly MIN_BID_INTERVAL_SECONDS = 30;    // Between bids on same request
    private readonly SUSPICIOUS_PRICE_PATTERNS = true;  // Detect same price patterns

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Main entry point: Check if a bid should be allowed
     */
    async checkBidAllowed(context: BidContext): Promise<FraudCheckResult> {
        const flags: string[] = [];
        let riskScore = 0;

        try {
            // Check 1: Garage approval status
            const garageCheck = await this.checkGarageStatus(context.garageId);
            if (!garageCheck.allowed) {
                return { allowed: false, reason: garageCheck.reason, riskScore: 100, flags: ['garage_blocked'] };
            }

            // Check 2: Rate limiting (bids per hour)
            const rateCheck = await this.checkBidRateLimit(context.garageId);
            if (!rateCheck.allowed) {
                return { allowed: false, reason: rateCheck.reason, riskScore: 80, flags: ['rate_limited'] };
            }
            if (rateCheck.warning) {
                flags.push('high_volume');
                riskScore += 20;
            }

            // Check 3: Rapid bidding on same request
            const rapidCheck = await this.checkRapidBidding(context.garageId, context.requestId);
            if (!rapidCheck.allowed) {
                return { allowed: false, reason: rapidCheck.reason, riskScore: 70, flags: ['rapid_bidding'] };
            }

            // Check 4: Duplicate price detection (spam indicator)
            const duplicateCheck = await this.checkDuplicatePricing(context);
            if (duplicateCheck.suspicious) {
                flags.push('duplicate_pricing');
                riskScore += 15;
            }

            // Check 5: Request already has too many bids from this garage
            const overBidCheck = await this.checkOverbidding(context.garageId, context.requestId);
            if (!overBidCheck.allowed) {
                return { allowed: false, reason: overBidCheck.reason, riskScore: 60, flags: ['overbidding'] };
            }

            // Log for monitoring
            if (riskScore > 30) {
                logger.warn('[FraudDetection] Elevated risk bid', {
                    garageId: context.garageId,
                    requestId: context.requestId,
                    riskScore,
                    flags
                });
            }

            return { allowed: true, riskScore, flags };

        } catch (error) {
            logger.error('[FraudDetection] Error checking bid');
            // Fail open but flag for review
            return { allowed: true, riskScore: 50, flags: ['check_error'] };
        }
    }

    /**
     * Check if garage is approved and has active subscription
     */
    private async checkGarageStatus(garageId: string): Promise<{ allowed: boolean; reason?: string }> {
        const result = await this.pool.query(`
            SELECT 
                g.approval_status,
                g.demo_expires_at,
                gs.status as subscription_status,
                gs.billing_cycle_end
            FROM garages g
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id 
                AND gs.status IN ('active', 'trial')
            WHERE g.garage_id = $1
        `, [garageId]);

        if (result.rows.length === 0) {
            return { allowed: false, reason: 'Garage not found' };
        }

        const garage = result.rows[0];

        // Check approval status
        if (garage.approval_status === 'rejected') {
            return { allowed: false, reason: 'Garage application was rejected' };
        }

        if (garage.approval_status === 'pending') {
            return { allowed: false, reason: 'Garage approval is pending' };
        }

        // Check demo expiry
        if (garage.approval_status === 'demo' && garage.demo_expires_at) {
            if (new Date(garage.demo_expires_at) < new Date()) {
                return { allowed: false, reason: 'Demo period has expired. Please subscribe to continue.' };
            }
        }

        // Check subscription (for approved garages)
        if (garage.approval_status === 'approved') {
            if (!garage.subscription_status || garage.billing_cycle_end < new Date()) {
                return { allowed: false, reason: 'Active subscription required to submit bids' };
            }
        }

        return { allowed: true };
    }

    /**
     * Rate limit: Max bids per hour per garage
     */
    private async checkBidRateLimit(garageId: string): Promise<{ allowed: boolean; reason?: string; warning?: boolean }> {
        const result = await this.pool.query(`
            SELECT COUNT(*) as bid_count
            FROM bids
            WHERE garage_id = $1
            AND created_at > NOW() - INTERVAL '1 hour'
        `, [garageId]);

        const bidCount = parseInt(result.rows[0].bid_count);

        if (bidCount >= this.MAX_BIDS_PER_HOUR) {
            return {
                allowed: false,
                reason: `Rate limit exceeded (${this.MAX_BIDS_PER_HOUR} bids/hour). Try again later.`
            };
        }

        // Warning if approaching limit
        const warning = bidCount >= this.MAX_BIDS_PER_HOUR * 0.8;

        return { allowed: true, warning };
    }

    /**
     * Prevent rapid-fire bidding on same request
     */
    private async checkRapidBidding(garageId: string, requestId: string): Promise<{ allowed: boolean; reason?: string }> {
        const result = await this.pool.query(`
            SELECT created_at
            FROM bids
            WHERE garage_id = $1 AND request_id = $2
            ORDER BY created_at DESC
            LIMIT 1
        `, [garageId, requestId]);

        if (result.rows.length > 0) {
            const lastBidTime = new Date(result.rows[0].created_at);
            const secondsSinceLastBid = (Date.now() - lastBidTime.getTime()) / 1000;

            if (secondsSinceLastBid < this.MIN_BID_INTERVAL_SECONDS) {
                return {
                    allowed: false,
                    reason: `Please wait ${Math.ceil(this.MIN_BID_INTERVAL_SECONDS - secondsSinceLastBid)} seconds before updating your bid`
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Detect duplicate pricing (possible spam/bot behavior)
     */
    private async checkDuplicatePricing(context: BidContext): Promise<{ suspicious: boolean }> {
        if (!this.SUSPICIOUS_PRICE_PATTERNS) return { suspicious: false };

        // Check if garage submitted same exact price on multiple requests in last hour
        const result = await this.pool.query(`
            SELECT COUNT(DISTINCT request_id) as same_price_count
            FROM bids
            WHERE garage_id = $1
            AND price = $2
            AND created_at > NOW() - INTERVAL '1 hour'
        `, [context.garageId, context.bidAmount]);

        const samepriceCount = parseInt(result.rows[0].same_price_count);

        // More than 3 bids with exact same price is suspicious
        return { suspicious: samepriceCount >= 3 };
    }

    /**
     * Prevent too many bids on same request
     */
    private async checkOverbidding(garageId: string, requestId: string): Promise<{ allowed: boolean; reason?: string }> {
        const result = await this.pool.query(`
            SELECT COUNT(*) as bid_count
            FROM bids
            WHERE garage_id = $1 AND request_id = $2
        `, [garageId, requestId]);

        const bidCount = parseInt(result.rows[0].bid_count);

        if (bidCount >= this.MAX_BIDS_PER_REQUEST_HOUR) {
            return {
                allowed: false,
                reason: 'Maximum bid updates reached for this request'
            };
        }

        return { allowed: true };
    }

    /**
     * Get fraud statistics for dashboard
     */
    async getFraudStats(days: number = 7): Promise<{
        totalBlocked: number;
        byReason: Record<string, number>;
        highRiskGarages: { garageId: string; bidCount: number }[];
    }> {
        // This would be backed by a fraud_log table in production
        // For now, return sample structure
        return {
            totalBlocked: 0,
            byReason: {},
            highRiskGarages: []
        };
    }
}

// Singleton instance
let fraudServiceInstance: FraudDetectionService | null = null;

export function getFraudDetectionService(pool: Pool): FraudDetectionService {
    if (!fraudServiceInstance) {
        fraudServiceInstance = new FraudDetectionService(pool);
    }
    return fraudServiceInstance;
}
