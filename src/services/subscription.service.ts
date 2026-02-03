import pool from '../config/db';
import logger from '../utils/logger';

interface SubscriptionPlan {
    plan_code: string;
    plan_name: string;
    monthly_price_qar: string;
    annual_price_qar: string;
    max_monthly_orders: number;
    analytics_enabled: boolean;
    priority_support: boolean;
    api_access: boolean;
    ad_campaigns_allowed: boolean;
    max_team_members: number;
    features_json: any;
}

interface SubscriptionDetails {
    current_plan: string;
    plan_name: string;
    monthly_price: string;
    annual_price: string;
    billing_cycle: string;
    start_date: string;
    end_date: string;
    days_remaining: number;
    analytics_enabled: boolean;
    priority_support: boolean;
    api_access: boolean;
    ad_campaigns_allowed: boolean;
    max_team_members: number;
    features: any;
}

export class SubscriptionService {
    /**
     * Get all available plans
     */
    static async getAvailablePlans(): Promise<SubscriptionPlan[]> {
        try {
            const result = await pool.query(
                `SELECT * FROM subscription_plans 
                 WHERE active = true 
                 ORDER BY display_order`
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching plans', { error: (error as Error).message });
            throw new Error('Failed to fetch subscription plans');
        }
    }

    /**
     * Get garage subscription details
     */
    static async getGarageSubscription(garageId: string): Promise<SubscriptionDetails | null> {
        try {
            const result = await pool.query(
                'SELECT * FROM get_subscription_details($1)',
                [garageId]
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error fetching subscription', { error: (error as Error).message });
            throw new Error('Failed to fetch subscription details');
        }
    }

    /**
     * Check feature access
     */
    static async checkFeatureAccess(
        garageId: string,
        feature: string
    ): Promise<boolean> {
        try {
            const result = await pool.query(
                'SELECT check_feature_access($1, $2) as has_access',
                [garageId, feature]
            );

            return result.rows[0]?.has_access || false;
        } catch (error) {
            logger.error('Error checking feature access', { error: (error as Error).message });
            return false;
        }
    }

    /**
     * Change subscription
     */
    static async changeSubscription(
        garageId: string,
        newPlan: string,
        billingCycle: 'monthly' | 'annual',
        changedBy: string
    ): Promise<{
        success: boolean;
        message: string;
        price: string;
    }> {
        try {
            const result = await pool.query(
                'SELECT * FROM change_subscription($1, $2, $3, $4)',
                [garageId, newPlan, billingCycle, changedBy]
            );

            return result.rows[0];
        } catch (error) {
            logger.error('Error changing subscription', { error: (error as Error).message });
            throw new Error('Failed to change subscription');
        }
    }

    /**
     * Get subscription history
     */
    static async getSubscriptionHistory(garageId: string): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    sh.*,
                    old.plan_name as old_plan_name,
                    new.plan_name as new_plan_name
                FROM subscription_history sh
                LEFT JOIN subscription_plans old ON sh.old_plan = old.plan_code
                LEFT JOIN subscription_plans new ON sh.new_plan = new.plan_code
                WHERE sh.garage_id = $1
                ORDER BY sh.created_at DESC
                LIMIT 20`,
                [garageId]
            );

            return result.rows;
        } catch (error) {
            logger.error('Error fetching history', { error: (error as Error).message });
            throw new Error('Failed to fetch subscription history');
        }
    }

    /**
     * Get subscription revenue stats (admin)
     */
    static async getRevenueStats(): Promise<any[]> {
        try {
            const result = await pool.query(
                'SELECT * FROM subscription_revenue_stats'
            );

            return result.rows;
        } catch (error) {
            logger.error('Error fetching revenue stats', { error: (error as Error).message });
            throw new Error('Failed to fetch revenue stats');
        }
    }

    /**
     * Calculate upgrade/downgrade price difference
     */
    static async calculatePriceDifference(
        currentPlan: string,
        newPlan: string,
        billingCycle: 'monthly' | 'annual'
    ): Promise<{
        current_price: number;
        new_price: number;
        difference: number;
        is_upgrade: boolean;
    }> {
        try {
            const priceField = billingCycle === 'annual' ? 'annual_price_qar' : 'monthly_price_qar';

            const result = await pool.query(
                `SELECT 
                    (SELECT ${priceField} FROM subscription_plans WHERE plan_code = $1) as current_price,
                    (SELECT ${priceField} FROM subscription_plans WHERE plan_code = $2) as new_price`,
                [currentPlan, newPlan]
            );

            const currentPrice = parseFloat(result.rows[0].current_price);
            const newPrice = parseFloat(result.rows[0].new_price);
            const difference = newPrice - currentPrice;

            return {
                current_price: currentPrice,
                new_price: newPrice,
                difference: Math.abs(difference),
                is_upgrade: difference > 0
            };
        } catch (error) {
            logger.error('Error calculating price difference', { error: (error as Error).message });
            throw new Error('Failed to calculate price difference');
        }
    }
}
