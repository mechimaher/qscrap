/**
 * Request Expiration Job
 * Marks expired requests as 'expired' and notifies customers
 */

import { Pool } from 'pg';
import logger from '../utils/logger';
import { emitToUser } from '../utils/socketIO';

export async function expireOldRequests(pool: Pool): Promise<number> {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            UPDATE part_requests 
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active' 
              AND expires_at < NOW()
            RETURNING request_id, customer_id
        `);

        const expiredCount = result.rowCount || 0;

        if (expiredCount > 0) {
            logger.jobComplete('expireOldRequests', { count: expiredCount });

            // Expire pending bids on these requests
            const requestIds = result.rows.map(r => r.request_id);
            await client.query(`
                UPDATE bids SET status = 'expired', updated_at = NOW()
                WHERE request_id = ANY($1) AND status = 'pending'
            `, [requestIds]);

            // Notify customers
            result.rows.forEach(row => {
                emitToUser(row.customer_id, 'request_expired', {
                    request_id: row.request_id,
                    notification: 'Your part request has expired. Create a new one to continue.'
                });
            });
        }

        return expiredCount;
    } catch (err) {
        logger.error('expireOldRequests failed', { error: (err as Error).message });
        return 0;
    } finally {
        client.release();
    }
}

/**
 * Counter-Offer Expiration Job
 * Expires counter-offers after 24 hours of no response
 */
export async function expireCounterOffers(pool: Pool): Promise<number> {
    try {
        const result = await pool.query(`
            UPDATE counter_offers co
            SET status = 'expired', responded_at = NOW()
            FROM bids b
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE co.bid_id = b.bid_id
              AND co.status = 'pending' 
              AND co.expires_at < NOW()
            RETURNING co.counter_offer_id, co.bid_id, co.offered_by_id, co.offered_by_type,
                      pr.customer_id, b.garage_id, co.proposed_amount
        `);

        const expiredCount = result.rowCount || 0;

        if (expiredCount > 0) {
            logger.jobComplete('expireCounterOffers', { count: expiredCount });

            const { emitToGarage } = await import('../utils/socketIO');
            for (const co of result.rows) {
                const eventData = {
                    counter_offer_id: co.counter_offer_id,
                    bid_id: co.bid_id,
                    offered_by_type: co.offered_by_type,
                    proposed_amount: co.proposed_amount,
                    message: 'Counter offer has expired without response'
                };
                emitToUser(co.customer_id, 'counter_offer_expired', eventData);
                emitToGarage(co.garage_id, 'counter_offer_expired', eventData);
            }
        }

        return expiredCount;
    } catch (err) {
        logger.error('expireCounterOffers failed', { error: (err as Error).message });
        return 0;
    }
}
