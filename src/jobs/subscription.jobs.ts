/**
 * Subscription Jobs
 * Handles subscription expiration, warnings, and auto-renewal
 */

import { Pool } from 'pg';
import logger from '../utils/logger';
import { emitToGarage } from '../utils/socketIO';

export async function checkSubscriptions(pool: Pool): Promise<{ expired: number; warnings: number }> {
    const client = await pool.connect();
    try {
        // 1. Expire subscriptions past billing_cycle_end
        const expiredResult = await client.query(`
            UPDATE garage_subscriptions 
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active' 
              AND billing_cycle_end < CURRENT_DATE
              AND auto_renew = false
            RETURNING subscription_id, garage_id
        `);

        const expiredCount = expiredResult.rowCount || 0;
        if (expiredCount > 0) {
            logger.jobComplete('checkSubscriptions:expired', { count: expiredCount });
        }

        // 2. Find subscriptions expiring in 3 days (for warning)
        const warningResult = await client.query(`
            SELECT gs.subscription_id, gs.garage_id, gs.billing_cycle_end,
                   sp.plan_name, g.garage_name
            FROM garage_subscriptions gs
            JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            JOIN garages g ON gs.garage_id = g.garage_id
            WHERE gs.status = 'active'
              AND gs.billing_cycle_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
              AND gs.auto_renew = false
        `);

        const warningCount = warningResult.rowCount || 0;
        if (warningCount > 0) {
            logger.info('Subscriptions expiring soon', { count: warningCount, daysUntilExpiry: 3 });

            warningResult.rows.forEach(row => {
                emitToGarage(row.garage_id, 'subscription_warning', {
                    message: `Your ${row.plan_name} subscription expires on ${new Date(row.billing_cycle_end).toLocaleDateString()}. Please renew to continue bidding.`,
                    expires_at: row.billing_cycle_end
                });
            });
        }

        // 3. Auto-renew subscriptions
        const renewResult = await client.query(`
            UPDATE garage_subscriptions 
            SET billing_cycle_start = billing_cycle_end,
                billing_cycle_end = billing_cycle_end + INTERVAL '30 days',
                bids_used_this_cycle = 0,
                updated_at = NOW()
            WHERE status = 'active'
              AND billing_cycle_end <= CURRENT_DATE
              AND auto_renew = true
            RETURNING subscription_id, garage_id
        `);

        if ((renewResult.rowCount || 0) > 0) {
            logger.jobComplete('checkSubscriptions:autoRenew', { count: renewResult.rowCount });
        }

        return { expired: expiredCount, warnings: warningCount };
    } catch (err) {
        logger.error('checkSubscriptions failed', { error: (err as Error).message });
        return { expired: 0, warnings: 0 };
    } finally {
        client.release();
    }
}
