import pool from '../config/db';

interface RewardsSummary {
    points_balance: number;
    lifetime_points: number;
    current_tier: string;
    discount_percentage: string;
    priority_support: boolean;
    tier_badge_color: string;
    next_tier: string;
    points_to_next_tier: number;
}

interface RewardTransaction {
    transaction_id: string;
    points_change: number;
    transaction_type: string;
    order_id?: string;
    description: string;
    balance_after: number;
    created_at: string;
}

interface RedemptionResult {
    success: boolean;
    discount_amount: string;
    new_balance: number;
    message: string;
}

export class LoyaltyService {
    /**
     * Get customer rewards summary
     */
    static async getCustomerSummary(customerId: string): Promise<RewardsSummary | null> {
        try {
            const result = await pool.query(
                'SELECT * FROM get_customer_rewards_summary($1)',
                [customerId]
            );

            if (result.rows.length === 0) {
                // Initialize rewards account if it doesn't exist
                await this.initializeCustomerRewards(customerId);
                return await this.getCustomerSummary(customerId);
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error fetching customer rewards:', error);
            throw new Error('Failed to fetch rewards summary');
        }
    }

    /**
     * Initialize rewards account for new customer
     */
    static async initializeCustomerRewards(customerId: string): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points)
                 VALUES ($1, 0, 0)
                 ON CONFLICT (customer_id) DO NOTHING`,
                [customerId]
            );
        } catch (error) {
            console.error('Error initializing customer rewards:', error);
            throw new Error('Failed to initialize rewards account');
        }
    }

    /**
     * Add points to customer account
     */
    static async addPoints(
        customerId: string,
        points: number,
        transactionType: string,
        orderId?: string,
        description?: string
    ): Promise<{ new_balance: number; new_tier: string }> {
        try {
            const result = await pool.query(
                `SELECT new_balance, new_tier 
                 FROM add_customer_points($1, $2, $3, $4, $5)`,
                [customerId, points, transactionType, orderId, description]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error adding points:', error);
            throw new Error('Failed to add points');
        }
    }

    /**
     * Redeem points for discount
     */
    static async redeemPoints(
        customerId: string,
        pointsToRedeem: number
    ): Promise<RedemptionResult> {
        try {
            const result = await pool.query(
                'SELECT * FROM redeem_points_for_discount($1, $2)',
                [customerId, pointsToRedeem]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error redeeming points:', error);
            throw new Error('Failed to redeem points');
        }
    }

    /**
     * Get transaction history
     */
    static async getTransactionHistory(
        customerId: string,
        limit: number = 50
    ): Promise<RewardTransaction[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    transaction_id,
                    points_change,
                    transaction_type,
                    order_id,
                    description,
                    balance_after,
                    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
                 FROM reward_transactions
                 WHERE customer_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [customerId, limit]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            throw new Error('Failed to fetch transaction history');
        }
    }

    /**
     * Calculate points earned from amount
     */
    static calculatePointsFromAmount(amount: number): number {
        // 1 point per 10 QAR
        return Math.floor(amount / 10);
    }

    /**
     * Calculate discount from points
     */
    static calculateDiscountFromPoints(points: number): number {
        // 100 points = 10 QAR
        return (points / 100) * 10;
    }

    /**
     * Get tier benefits
     */
    static async getTierBenefits(): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    tier_name,
                    min_points,
                    discount_percentage,
                    priority_support,
                    tier_badge_color
                 FROM reward_tiers
                 ORDER BY min_points ASC`
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching tier benefits:', error);
            throw new Error('Failed to fetch tier benefits');
        }
    }

    /**
     * Get loyalty statistics (for admin)
     */
    static async getLoyaltyStats(): Promise<{
        total_members: number;
        total_points_issued: number;
        total_points_redeemed: number;
        tier_distribution: any[];
        avg_points_per_customer: number;
    }> {
        try {
            const [membersResult, pointsResult, tierDistResult] = await Promise.all([
                // Total members
                pool.query('SELECT COUNT(*) as total FROM customer_rewards'),

                // Points issued vs redeemed
                pool.query(
                    `SELECT 
                        SUM(CASE WHEN points_change > 0 THEN points_change ELSE 0 END) as issued,
                        SUM(CASE WHEN points_change < 0 THEN ABS(points_change) ELSE 0 END) as redeemed,
                        AVG(CASE WHEN points_change > 0 THEN points_change ELSE NULL END) as avg_earned
                     FROM reward_transactions`
                ),

                // Tier distribution
                pool.query(
                    `SELECT 
                        current_tier,
                        COUNT(*) as customer_count,
                        AVG(points_balance) as avg_balance
                     FROM customer_rewards
                     GROUP BY current_tier
                     ORDER BY MIN(
                         CASE current_tier
                             WHEN 'bronze' THEN 1
                             WHEN 'silver' THEN 2
                             WHEN 'gold' THEN 3
                             WHEN 'platinum' THEN 4
                             ELSE 5
                         END
                     )`
                )
            ]);

            return {
                total_members: parseInt(membersResult.rows[0]?.total) || 0,
                total_points_issued: parseInt(pointsResult.rows[0]?.issued) || 0,
                total_points_redeemed: parseInt(pointsResult.rows[0]?.redeemed) || 0,
                tier_distribution: tierDistResult.rows,
                avg_points_per_customer: parseFloat(pointsResult.rows[0]?.avg_earned) || 0
            };
        } catch (error) {
            console.error('Error fetching loyalty stats:', error);
            throw new Error('Failed to fetch loyalty statistics');
        }
    }

    /**
     * Award bonus points (admin action)
     */
    static async awardBonusPoints(
        customerId: string,
        points: number,
        reason: string
    ): Promise<{ new_balance: number; new_tier: string }> {
        try {
            return await this.addPoints(
                customerId,
                points,
                'bonus',
                undefined,
                `Admin bonus: ${reason}`
            );
        } catch (error) {
            console.error('Error awarding bonus points:', error);
            throw new Error('Failed to award bonus points');
        }
    }

    /**
     * Check if customer has enough points for redemption
     */
    static async canRedeem(
        customerId: string,
        pointsRequired: number
    ): Promise<{ can_redeem: boolean; current_balance: number }> {
        try {
            const result = await pool.query(
                `SELECT points_balance as current_balance
                 FROM customer_rewards
                 WHERE customer_id = $1`,
                [customerId]
            );

            if (result.rows.length === 0) {
                return { can_redeem: false, current_balance: 0 };
            }

            const currentBalance = result.rows[0].current_balance;
            return {
                can_redeem: currentBalance >= pointsRequired,
                current_balance: currentBalance
            };
        } catch (error) {
            console.error('Error checking redemption eligibility:', error);
            throw new Error('Failed to check redemption eligibility');
        }
    }
}
