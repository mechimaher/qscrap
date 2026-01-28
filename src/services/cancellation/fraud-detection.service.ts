/**
 * Fraud Detection Service
 * Handles customer abuse limits and garage accountability
 * 
 * Source: Cancellation-Refund-BRAIN.md v3.0 (Section: Fraud Prevention)
 */

import { Pool } from 'pg';
import { CustomerAbuseStatus, GarageAccountability } from './types';
import {
    CUSTOMER_LIMITS,
    GARAGE_THRESHOLDS,
    FRAUD_FLAG_LEVELS
} from './cancellation.constants';

export class FraudDetectionService {
    constructor(private pool: Pool) { }

    /**
     * Get current month in YYYY-MM format
     */
    private getCurrentMonthYear(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Get or create customer abuse tracking record for current month
     */
    async getCustomerAbuseStatus(customerId: string): Promise<CustomerAbuseStatus> {
        const monthYear = this.getCurrentMonthYear();

        // Get or create tracking record
        const result = await this.pool.query(
            `INSERT INTO customer_abuse_tracking (customer_id, month_year)
             VALUES ($1, $2)
             ON CONFLICT (customer_id, month_year) DO UPDATE SET last_updated = NOW()
             RETURNING *`,
            [customerId, monthYear]
        );

        const record = result.rows[0];

        return {
            customer_id: customerId,
            month_year: monthYear,
            returns_count: record.returns_count,
            defective_claims_count: record.defective_claims_count,
            cancellations_count: record.cancellations_count,
            flag_level: record.flag_level,
            can_return: record.returns_count < CUSTOMER_LIMITS.MAX_RETURNS_PER_MONTH,
            can_claim_defective: record.defective_claims_count < CUSTOMER_LIMITS.MAX_DEFECTIVE_CLAIMS_PER_MONTH,
            remaining_returns: Math.max(0, CUSTOMER_LIMITS.MAX_RETURNS_PER_MONTH - record.returns_count),
            remaining_claims: Math.max(0, CUSTOMER_LIMITS.MAX_DEFECTIVE_CLAIMS_PER_MONTH - record.defective_claims_count),
        };
    }

    /**
     * Increment return count and update flag level
     */
    async incrementReturnCount(customerId: string): Promise<{ allowed: boolean; newCount: number }> {
        const monthYear = this.getCurrentMonthYear();

        const result = await this.pool.query(
            `INSERT INTO customer_abuse_tracking (customer_id, month_year, returns_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (customer_id, month_year) DO UPDATE 
             SET returns_count = customer_abuse_tracking.returns_count + 1,
                 flag_level = CASE 
                     WHEN customer_abuse_tracking.returns_count + 1 >= 4 THEN 'yellow'
                     ELSE customer_abuse_tracking.flag_level
                 END,
                 last_updated = NOW()
             RETURNING returns_count, flag_level`,
            [customerId, monthYear]
        );

        const newCount = result.rows[0].returns_count;
        const allowed = newCount <= CUSTOMER_LIMITS.MAX_RETURNS_PER_MONTH;

        if (!allowed) {
            console.log(`[FraudDetection] Customer ${customerId} exceeded return limit (${newCount}/${CUSTOMER_LIMITS.MAX_RETURNS_PER_MONTH})`);
        }

        return { allowed, newCount };
    }

    /**
     * Increment defective claim count and update flag level
     */
    async incrementDefectiveClaimCount(customerId: string): Promise<{ allowed: boolean; newCount: number }> {
        const monthYear = this.getCurrentMonthYear();

        const result = await this.pool.query(
            `INSERT INTO customer_abuse_tracking (customer_id, month_year, defective_claims_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (customer_id, month_year) DO UPDATE 
             SET defective_claims_count = customer_abuse_tracking.defective_claims_count + 1,
                 flag_level = CASE 
                     WHEN customer_abuse_tracking.defective_claims_count + 1 >= 4 THEN 'orange'
                     ELSE customer_abuse_tracking.flag_level
                 END,
                 last_updated = NOW()
             RETURNING defective_claims_count, flag_level`,
            [customerId, monthYear]
        );

        const newCount = result.rows[0].defective_claims_count;
        const allowed = newCount <= CUSTOMER_LIMITS.MAX_DEFECTIVE_CLAIMS_PER_MONTH;

        if (!allowed) {
            console.log(`[FraudDetection] Customer ${customerId} exceeded defective claim limit - requires investigation`);
        }

        return { allowed, newCount };
    }

    /**
     * Increment cancellation count (for review flagging at 5+)
     */
    async incrementCancellationCount(customerId: string): Promise<{ count: number; flagged: boolean }> {
        const monthYear = this.getCurrentMonthYear();

        const result = await this.pool.query(
            `INSERT INTO customer_abuse_tracking (customer_id, month_year, cancellations_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (customer_id, month_year) DO UPDATE 
             SET cancellations_count = customer_abuse_tracking.cancellations_count + 1,
                 last_updated = NOW()
             RETURNING cancellations_count`,
            [customerId, monthYear]
        );

        const count = result.rows[0].cancellations_count;
        const flagged = count >= CUSTOMER_LIMITS.CANCELLATION_REVIEW_THRESHOLD;

        if (flagged) {
            console.log(`[FraudDetection] Customer ${customerId} flagged for cancellation review (${count} this month)`);
        }

        return { count, flagged };
    }

    /**
     * Check if customer can make a return (within limits)
     */
    async canCustomerReturn(customerId: string): Promise<{ allowed: boolean; reason?: string }> {
        const status = await this.getCustomerAbuseStatus(customerId);

        if (status.flag_level === FRAUD_FLAG_LEVELS.BLACK) {
            return { allowed: false, reason: 'Account suspended due to abuse' };
        }

        if (status.flag_level === FRAUD_FLAG_LEVELS.RED) {
            return { allowed: false, reason: 'Account under review' };
        }

        if (!status.can_return) {
            return {
                allowed: false,
                reason: `Maximum returns reached (${CUSTOMER_LIMITS.MAX_RETURNS_PER_MONTH}/month). Contact support for assistance.`
            };
        }

        return { allowed: true };
    }

    /**
     * Set customer flag level (for manual ops override)
     */
    async setCustomerFlagLevel(
        customerId: string,
        flagLevel: string,
        reason: string,
        operatorId: string
    ): Promise<void> {
        const monthYear = this.getCurrentMonthYear();

        await this.pool.query(
            `INSERT INTO customer_abuse_tracking (customer_id, month_year, flag_level)
             VALUES ($1, $2, $3)
             ON CONFLICT (customer_id, month_year) DO UPDATE 
             SET flag_level = $3,
                 last_updated = NOW()`,
            [customerId, monthYear, flagLevel]
        );

        // Create audit log
        await this.pool.query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, details)
             VALUES ('customer_fraud_flag', $1, 'flag_updated', $2, $3)`,
            [customerId, operatorId, JSON.stringify({ new_flag: flagLevel, reason })]
        );

        console.log(`[FraudDetection] Customer ${customerId} flag set to ${flagLevel} by ${operatorId}: ${reason}`);
    }

    // =========================================
    // GARAGE ACCOUNTABILITY
    // =========================================

    /**
     * Get garage accountability status
     */
    async getGarageAccountability(garageId: string): Promise<GarageAccountability> {
        // Get cancellation count this month
        const cancellationResult = await this.pool.query(
            `SELECT cancellations_this_month, last_cancellation_reset
             FROM garages WHERE garage_id = $1`,
            [garageId]
        );

        const garage = cancellationResult.rows[0];
        let cancellationsThisMonth = garage?.cancellations_this_month || 0;

        // Reset if new month
        const lastReset = garage?.last_cancellation_reset ? new Date(garage.last_cancellation_reset) : null;
        const now = new Date();
        if (lastReset && (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear())) {
            // Reset counter for new month
            await this.pool.query(
                `UPDATE garages SET cancellations_this_month = 0, last_cancellation_reset = NOW()
                 WHERE garage_id = $1`,
                [garageId]
            );
            cancellationsThisMonth = 0;
        }

        // Get pending penalties
        const penaltyResult = await this.pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
             FROM garage_penalties 
             WHERE garage_id = $1 AND status = 'pending'`,
            [garageId]
        );

        const pendingPenalties = parseInt(penaltyResult.rows[0].count);
        const totalPenaltiesAmount = parseFloat(penaltyResult.rows[0].total);

        // Determine status based on thresholds
        let status: GarageAccountability['status'] = 'good_standing';
        if (cancellationsThisMonth >= GARAGE_THRESHOLDS.PERMANENT_REVIEW_CANCELLATIONS) {
            status = 'suspended';
        } else if (cancellationsThisMonth >= GARAGE_THRESHOLDS.REVIEW_CANCELLATIONS) {
            status = 'review';
        } else if (cancellationsThisMonth >= GARAGE_THRESHOLDS.WARNING_CANCELLATIONS) {
            status = 'warning';
        }

        return {
            garage_id: garageId,
            cancellations_this_month: cancellationsThisMonth,
            pending_penalties: pendingPenalties,
            total_penalties_amount: totalPenaltiesAmount,
            status,
        };
    }

    /**
     * Increment garage cancellation count and determine penalty
     */
    async incrementGarageCancellation(garageId: string): Promise<{
        count: number;
        penaltyAmount: number;
        action: string;
    }> {
        // Increment count
        const result = await this.pool.query(
            `UPDATE garages 
             SET cancellations_this_month = cancellations_this_month + 1,
                 updated_at = NOW()
             WHERE garage_id = $1
             RETURNING cancellations_this_month`,
            [garageId]
        );

        const count = result.rows[0].cancellations_this_month;
        let penaltyAmount = 0;
        let action = 'warning';

        // Apply accountability ladder
        if (count >= GARAGE_THRESHOLDS.PERMANENT_REVIEW_CANCELLATIONS) {
            penaltyAmount = 50;
            action = 'permanent_review';
        } else if (count >= GARAGE_THRESHOLDS.SUSPEND_CANCELLATIONS) {
            penaltyAmount = 50;
            action = 'suspend_7_days';
        } else if (count >= GARAGE_THRESHOLDS.REVIEW_CANCELLATIONS) {
            penaltyAmount = 50;
            action = 'review_48h';
        } else if (count >= GARAGE_THRESHOLDS.PENALTY_CANCELLATIONS) {
            penaltyAmount = 50;
            action = 'repeat_offender_penalty';
        } else if (count >= GARAGE_THRESHOLDS.WARNING_CANCELLATIONS) {
            penaltyAmount = 30;
            action = 'first_cancellation_penalty';
        }

        console.log(`[FraudDetection] Garage ${garageId} cancellation #${count}: action=${action}, penalty=${penaltyAmount} QAR`);

        return { count, penaltyAmount, action };
    }

    /**
     * Check if garage is suspended
     */
    async isGarageSuspended(garageId: string): Promise<boolean> {
        const accountability = await this.getGarageAccountability(garageId);
        return accountability.status === 'suspended';
    }
}

// Export singleton instance
let fraudDetectionServiceInstance: FraudDetectionService | null = null;

export const getFraudDetectionService = (pool: Pool): FraudDetectionService => {
    if (!fraudDetectionServiceInstance) {
        fraudDetectionServiceInstance = new FraudDetectionService(pool);
    }
    return fraudDetectionServiceInstance;
};
