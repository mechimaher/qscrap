/**
 * NegotiationService - Counter-Offer Management
 * Handles bid negotiation rounds between customers and garages
 */

import { Pool, PoolClient } from 'pg';
import { CounterOfferData, CounterOfferResponse, NegotiationHistory } from './types';
import { NegotiationLimitReachedError, BidNotPendingError } from './errors';
import { createNotification } from '../notification.service';

const MAX_NEGOTIATION_ROUNDS = 3;

export class NegotiationService {
    constructor(private pool: Pool) { }

    async createCounterOffer(customerId: string, bidId: string, proposedAmount: number, message?: string): Promise<any> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const bid = await this.getBidForNegotiation(bidId, client);
            this.verifyCustomerOwnership(bid, customerId);
            this.verifyBidStatus(bid);

            const currentRound = await this.getCurrentRound(bidId, client);
            if (currentRound > MAX_NEGOTIATION_ROUNDS) {
                throw new NegotiationLimitReachedError(bidId);
            }

            await this.checkNoPendingOffer(bidId, client);

            const result = await client.query(`
                INSERT INTO counter_offers 
                (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
                VALUES ($1, $2, 'customer', $3, $4, $5, $6)
                RETURNING counter_offer_id
            `, [bidId, bid.request_id, customerId, proposedAmount, message, currentRound]);

            await client.query('COMMIT');

            await this.notifyCounterOffer(bid.garage_id, bidId, result.rows[0].counter_offer_id, proposedAmount, bid.bid_amount, currentRound);

            return { counter_offer_id: result.rows[0].counter_offer_id, round: currentRound };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async respondToCounterOffer(garageId: string, counterOfferId: string, response: CounterOfferResponse): Promise<any> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const offer = await this.getCounterOfferForUpdate(counterOfferId, client);
            this.verifyGarageOwnership(offer, garageId);

            if (response.action === 'accept') {
                await this.acceptOffer(offer, client);
            } else if (response.action === 'decline') {
                await this.declineOffer(offer, client);
            } else if (response.action === 'counter' && response.counter_price) {
                await this.createGarageCounter(offer, garageId, response.counter_price, response.notes, client);
            }

            await client.query('COMMIT');
            return { action: response.action };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async customerRespondToCounter(customerId: string, counterOfferId: string, response: CounterOfferResponse): Promise<any> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const offer = await this.getCounterOfferForUpdate(counterOfferId, client);
            const bid = await this.getBidById(offer.bid_id, client);
            this.verifyCustomerOwnership(bid, customerId);

            if (response.action === 'accept') {
                await this.acceptOffer(offer, client);
            } else if (response.action === 'decline') {
                await this.declineOffer(offer, client);
            } else if (response.action === 'counter' && response.counter_price) {
                await this.createCustomerCounter(offer, customerId, response.counter_price, response.notes, client);
            }

            await client.query('COMMIT');
            return { action: response.action };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getNegotiationHistory(bidId: string): Promise<NegotiationHistory[]> {
        const result = await this.pool.query(`
            SELECT * FROM counter_offers 
            WHERE bid_id = $1 
            ORDER BY round_number ASC, created_at ASC
        `, [bidId]);
        return result.rows;
    }

    async getPendingCounterOffers(garageId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT co.*, 
                   b.bid_amount as original_amount,
                   pr.part_description,
                   pr.car_make || ' ' || pr.car_model || ' ' || pr.car_year as car_summary
            FROM counter_offers co
            JOIN bids b ON co.bid_id = b.bid_id
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE b.garage_id = $1 AND co.status = 'pending' AND co.offered_by_type = 'customer'
            ORDER BY co.created_at DESC
        `, [garageId]);
        return result.rows;
    }

    async acceptLastGarageOffer(customerId: string, bidId: string): Promise<any> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const lastOffer = await client.query(`
                SELECT co.*, b.garage_id
                FROM counter_offers co
                JOIN bids b ON co.bid_id = b.bid_id
                WHERE co.bid_id = $1 AND co.offered_by_type = 'garage'
                ORDER BY co.round_number DESC LIMIT 1
            `, [bidId]);

            if (lastOffer.rows.length === 0) {
                throw new Error('No garage offer found');
            }

            await this.acceptOffer(lastOffer.rows[0], client);
            await client.query('COMMIT');
            return { message: 'Offer accepted' };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    private async getBidForNegotiation(bidId: string, client: PoolClient): Promise<any> {
        const result = await client.query(`
            SELECT b.*, pr.customer_id 
            FROM bids b 
            JOIN part_requests pr ON b.request_id = pr.request_id 
            WHERE b.bid_id = $1
        `, [bidId]);
        if (result.rows.length === 0) throw new Error('Bid not found');
        return result.rows[0];
    }

    private async getBidById(bidId: string, client: PoolClient): Promise<any> {
        const result = await client.query('SELECT * FROM bids WHERE bid_id = $1', [bidId]);
        if (result.rows.length === 0) throw new Error('Bid not found');
        return result.rows[0];
    }

    private verifyCustomerOwnership(bid: any, customerId: string): void {
        if (bid.customer_id !== customerId) throw new Error('Access denied');
    }

    private verifyGarageOwnership(offer: any, garageId: string): void {
        if (offer.garage_id !== garageId) throw new Error('Access denied');
    }

    private verifyBidStatus(bid: any): void {
        if (bid.status !== 'pending') throw new BidNotPendingError(bid.bid_id, bid.status);
    }

    private async getCurrentRound(bidId: string, client: PoolClient): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM counter_offers WHERE bid_id = $1', [bidId]);
        return parseInt(result.rows[0].count) + 1;
    }

    private async checkNoPendingOffer(bidId: string, client: PoolClient): Promise<void> {
        const result = await client.query(
            'SELECT counter_offer_id FROM counter_offers WHERE bid_id = $1 AND status = $2',
            [bidId, 'pending']
        );
        if (result.rows.length > 0) throw new Error('Pending counter-offer exists');
    }

    private async getCounterOfferForUpdate(counterOfferId: string, client: PoolClient): Promise<any> {
        const result = await client.query(
            'SELECT co.*, b.garage_id FROM counter_offers co JOIN bids b ON co.bid_id = b.bid_id WHERE co.counter_offer_id = $1 FOR UPDATE',
            [counterOfferId]
        );
        if (result.rows.length === 0) throw new Error('Counter-offer not found');
        return result.rows[0];
    }

    private async acceptOffer(offer: any, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['accepted', offer.counter_offer_id]);
        await client.query('UPDATE bids SET price = $1, status = $2 WHERE bid_id = $3', [offer.proposed_amount, 'accepted', offer.bid_id]);
    }

    private async declineOffer(offer: any, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['declined', offer.counter_offer_id]);
        await client.query('UPDATE bids SET status = $1 WHERE bid_id = $2', ['declined', offer.bid_id]);
    }

    private async createGarageCounter(offer: any, garageId: string, counterPrice: number, notes: string | undefined, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['countered', offer.counter_offer_id]);
        const round = offer.round_number + 1;
        const result = await client.query(`
            INSERT INTO counter_offers (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
            VALUES ($1, $2, 'garage', $3, $4, $5, $6)
            RETURNING counter_offer_id
        `, [offer.bid_id, offer.request_id, garageId, counterPrice, notes, round]);

        // 🔥 NEW: Notify customer if garage lowered price (price drop alert!)
        const bid = await client.query('SELECT b.bid_amount, pr.customer_id FROM bids b JOIN part_requests pr ON b.request_id = pr.request_id WHERE b.bid_id = $1', [offer.bid_id]);
        if (bid.rows.length > 0 && counterPrice < offer.proposed_amount) {
            const priceDrop = offer.proposed_amount - counterPrice;
            await createNotification({
                userId: bid.rows[0].customer_id,
                type: 'price_dropped',
                title: '🎉 Price Dropped!',
                message: `Garage lowered price by ${priceDrop} QAR! Now ${counterPrice} QAR`,
                data: { bid_id: offer.bid_id, counter_offer_id: result.rows[0].counter_offer_id, old_price: offer.proposed_amount, new_price: counterPrice, savings: priceDrop },
                target_role: 'customer'
            });
        }
    }

    private async createCustomerCounter(offer: any, customerId: string, counterPrice: number, notes: string | undefined, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['countered', offer.counter_offer_id]);
        const round = offer.round_number + 1;
        await client.query(`
            INSERT INTO counter_offers (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
            VALUES ($1, $2, 'customer', $3, $4, $5, $6)
        `, [offer.bid_id, offer.request_id, customerId, counterPrice, notes, round]);
    }

    private async notifyCounterOffer(garageId: string, bidId: string, counterOfferId: string, proposed: number, original: number, round: number): Promise<void> {
        await createNotification({
            userId: garageId,
            type: 'counter_offer_received',
            title: 'Counter-Offer Received 💰',
            message: `Customer counter-offered ${proposed} QAR (was ${original} QAR)`,
            data: { counter_offer_id: counterOfferId, bid_id: bidId, proposed_amount: proposed, round },
            target_role: 'garage'
        });
    }
}
