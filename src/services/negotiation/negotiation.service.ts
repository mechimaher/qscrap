/**
 * NegotiationService - Counter-Offer Management
 * Handles bid negotiation rounds between customers and garages
 */

import { Pool, PoolClient } from 'pg';
import { CounterOfferData, CounterOfferResponse, NegotiationHistory } from './types';
import { NegotiationLimitReachedError, BidNotPendingError } from './errors';
import { createNotification } from '../notification.service';
import { getDeliveryFeeForLocation } from '../../controllers/delivery.controller';
import logger from '../../utils/logger';

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
            const bid = await this.getBidById(offer.bid_id, client);
            this.verifyGarageOwnership(offer, garageId);

            let order = null;
            if (response.action === 'accept') {
                // Garage accepts customer's counter-offer - get customer_id from bid
                order = await this.acceptOffer(offer, bid, bid.customer_id, client);
            } else if (response.action === 'decline' || response.action === 'reject') {
                await this.declineOffer(offer, bid, client);
            } else if (response.action === 'counter' && response.counter_price) {
                await this.createGarageCounter(offer, garageId, response.counter_price, response.notes, client);
            }

            await client.query('COMMIT');
            return { action: response.action, order };
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

            let order = null;
            if (response.action === 'accept') {
                order = await this.acceptOffer(offer, bid, customerId, client);
            } else if (response.action === 'decline' || response.action === 'reject') {
                await this.declineOffer(offer, bid, client);
            } else if (response.action === 'counter' && response.counter_price) {
                await this.createCustomerCounter(offer, customerId, response.counter_price, response.notes, client);
            }

            await client.query('COMMIT');
            return { action: response.action, order };
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
                   COALESCE(b.original_bid_amount, b.bid_amount) as original_bid_amount,
                   (
                       SELECT proposed_amount 
                       FROM counter_offers 
                       WHERE bid_id = co.bid_id 
                       AND offered_by_type = 'garage' 
                       AND round_number < co.round_number
                       ORDER BY round_number DESC 
                       LIMIT 1
                   ) as garage_last_offer,
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

            // Get the last garage offer
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

            // Get the bid with customer_id
            const bid = await this.getBidById(bidId, client);

            // Verify customer ownership
            this.verifyCustomerOwnership(bid, customerId);

            const order = await this.acceptOffer(lastOffer.rows[0], bid, customerId, client);
            await client.query('COMMIT');
            return { message: 'Offer accepted', order };
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
        if (result.rows.length === 0) {throw new Error('Bid not found');}
        return result.rows[0];
    }

    private async getBidById(bidId: string, client: PoolClient): Promise<any> {
        const result = await client.query(`
            SELECT b.*, pr.customer_id 
            FROM bids b 
            JOIN part_requests pr ON b.request_id = pr.request_id 
            WHERE b.bid_id = $1
            `, [bidId]);
        if (result.rows.length === 0) {throw new Error('Bid not found');}
        return result.rows[0];
    }

    private verifyCustomerOwnership(bid: any, customerId: string): void {
        if (bid.customer_id !== customerId) {throw new Error('Access denied');}
    }

    private verifyGarageOwnership(offer: any, garageId: string): void {
        if (offer.garage_id !== garageId) {throw new Error('Access denied');}
    }

    private verifyBidStatus(bid: any): void {
        if (bid.status !== 'pending') {throw new BidNotPendingError(bid.bid_id, bid.status);}
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
        if (result.rows.length > 0) {throw new Error('Pending counter-offer exists');}
    }

    private async getCounterOfferForUpdate(counterOfferId: string, client: PoolClient): Promise<any> {
        const result = await client.query(
            'SELECT co.*, b.garage_id FROM counter_offers co JOIN bids b ON co.bid_id = b.bid_id WHERE co.counter_offer_id = $1 FOR UPDATE',
            [counterOfferId]
        );
        if (result.rows.length === 0) {throw new Error('Counter-offer not found');}
        return result.rows[0];
    }

    private async acceptOffer(offer: any, bid: any, customerId: string, client: PoolClient): Promise<any> {
        // 1. Update counter-offer status
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['accepted', offer.counter_offer_id]);

        // 2. Update bid - preserve original price in original_bid_amount, update bid_amount to negotiated price
        await client.query(`
            UPDATE bids 
            SET original_bid_amount = COALESCE(original_bid_amount, bid_amount),
            bid_amount = $1,
            status = $2 
            WHERE bid_id = $3
            `, [offer.proposed_amount, 'accepted', offer.bid_id]);

        // 3. Get request details for order creation
        const reqResult = await client.query('SELECT * FROM part_requests WHERE request_id = $1', [bid.request_id]);
        if (reqResult.rows.length === 0) {throw new Error('Request not found');}
        const request = reqResult.rows[0];

        // 4. Calculate commission
        const garageRateResult = await client.query(`
            SELECT g.approval_status, sp.commission_rate
            FROM garages g
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN('active', 'trial')
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE g.garage_id = $1
            ORDER BY gs.created_at DESC LIMIT 1
            `, [bid.garage_id]);

        let commissionRate = 0.15;
        if (garageRateResult.rows[0]?.approval_status === 'demo') {
            commissionRate = 0;
        } else if (garageRateResult.rows[0]?.commission_rate) {
            commissionRate = parseFloat(garageRateResult.rows[0].commission_rate);
        }

        // 5. Calculate prices
        const partPrice = parseFloat(offer.proposed_amount);

        // Calculate delivery fee from zone (NOT hardcoded) - platform_positioning_cost excluded
        let deliveryFee = 10; // Zone 1 fallback
        if (request.delivery_lat && request.delivery_lng) {
            const zoneInfo = await getDeliveryFeeForLocation(
                parseFloat(request.delivery_lat),
                parseFloat(request.delivery_lng)
            );
            deliveryFee = zoneInfo.fee;
        }

        const platformFee = Math.round(partPrice * commissionRate * 100) / 100;
        const totalAmount = partPrice + deliveryFee;
        const garagePayout = partPrice - platformFee;

        // 6. Create order
        const orderResult = await client.query(`
            INSERT INTO orders
            (request_id, bid_id, customer_id, garage_id, part_price, commission_rate,
                platform_fee, delivery_fee, total_amount, garage_payout_amount,
                payment_method, delivery_address)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING order_id, order_number
            `, [bid.request_id, offer.bid_id, customerId, bid.garage_id, partPrice, commissionRate,
            platformFee, deliveryFee, totalAmount, garagePayout, 'cash',
        request.delivery_address_text || 'To be confirmed']);

        const order = orderResult.rows[0];

        // 7. Update request status
        await client.query("UPDATE part_requests SET status = 'accepted', updated_at = NOW() WHERE request_id = $1", [bid.request_id]);

        // 8. Reject other bids
        await client.query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE request_id = $1 AND bid_id != $2 AND status = 'pending'",
            [bid.request_id, offer.bid_id]
        );

        // 9. Log order history
        await client.query(`
            INSERT INTO order_status_history
            (order_id, old_status, new_status, changed_by, changed_by_type, reason)
        VALUES($1, NULL, 'confirmed', $2, 'customer', 'Order created from accepted counter-offer')
        `, [order.order_id, customerId]);

        // 10. Notify both parties about accepted counter-offer
        const { emitToUser, emitToGarage } = await import('../../utils/socketIO');

        // Notify CUSTOMER (their counter-offer was accepted!)
        await createNotification({
            userId: customerId,
            type: 'counter_offer_accepted',
            title: '🎉 Counter-Offer Accepted!',
            message: `Your counter - offer of ${offer.proposed_amount} QAR was accepted! Order #${order.order_number} created.`,
            data: {
                order_id: order.order_id,
                order_number: order.order_number,
                bid_id: offer.bid_id,
                counter_offer_id: offer.counter_offer_id,
                final_price: offer.proposed_amount
            },
            target_role: 'customer'
        });

        // Emit WebSocket to customer
        emitToUser(customerId, 'counter_offer_accepted', {
            order_id: order.order_id,
            order_number: order.order_number,
            bid_id: offer.bid_id,
            final_price: offer.proposed_amount,
            notification: `Counter - offer accepted! Order #${order.order_number} created.`
        });

        // Notify GARAGE (confirmation they accepted the counter)
        await createNotification({
            userId: bid.garage_id,
            type: 'counter_offer_accepted',
            title: '✅ Counter-Offer Accepted',
            message: `Order #${order.order_number} created at ${offer.proposed_amount} QAR`,
            data: {
                order_id: order.order_id,
                order_number: order.order_number,
                bid_id: offer.bid_id,
                counter_offer_id: offer.counter_offer_id
            },
            target_role: 'garage'
        });

        // Emit WebSocket to garage
        emitToGarage(bid.garage_id, 'counter_offer_accepted', {
            order_id: order.order_id,
            order_number: order.order_number,
            bid_id: offer.bid_id,
            notification: `Order #${order.order_number} created`
        });

        return order;
    }

    private async declineOffer(offer: any, bid: any, client: PoolClient): Promise<void> {
        // Only reject the counter-offer, NOT the entire bid
        // The bid stays 'pending' so customer can still accept garage's last offer
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['rejected', offer.counter_offer_id]);

        // NOTE: We do NOT reject the bid here - garage's previous offer is still valid
        // Customer can use "Accept Last Garage Offer" to accept it

        // Get customer_id from bid to notify them
        const customerId = bid.customer_id;
        if (customerId) {
            // Get garage's last offer to include in notification
            const lastGarageOffer = await client.query(`
                SELECT proposed_amount FROM counter_offers 
                WHERE bid_id = $1 AND offered_by_type = 'garage' 
                ORDER BY round_number DESC LIMIT 1
            `, [offer.bid_id]);

            const garageLastPrice = lastGarageOffer.rows[0]?.proposed_amount;
            const acceptMessage = garageLastPrice
                ? ` You can still accept the garage's offer of ${garageLastPrice} QAR.`
                : '';

            // Create database notification for customer
            await createNotification({
                userId: customerId,
                type: 'counter_offer_rejected',
                title: '❌ Counter-Offer Declined',
                message: `Your counter-offer of ${offer.proposed_amount} QAR was declined.${acceptMessage}`,
                data: {
                    bid_id: offer.bid_id,
                    counter_offer_id: offer.counter_offer_id,
                    proposed_amount: offer.proposed_amount,
                    garage_last_offer: garageLastPrice
                },
                target_role: 'customer'
            });

            // Send push notification
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    customerId,
                    '❌ Counter-Offer Declined',
                    `Your offer was declined.${acceptMessage}`,
                    { type: 'counter_offer_rejected', bid_id: offer.bid_id },
                    { channelId: 'bids', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to customer failed', { error: pushErr });
            }

            // Emit WebSocket event to customer app
            const { emitToUser } = await import('../../utils/socketIO');
            emitToUser(customerId, 'counter_offer_rejected', {
                bid_id: offer.bid_id,
                counter_offer_id: offer.counter_offer_id,
                proposed_amount: offer.proposed_amount,
                garage_last_offer: garageLastPrice,
                can_accept_last_offer: !!garageLastPrice,
                notification: `Your counter-offer was declined.${acceptMessage}`
            });
            // Also emit bid_updated to trigger UI refresh
            emitToUser(customerId, 'bid_updated', { bid_id: offer.bid_id, request_id: offer.request_id });
        }
    }

    private async createGarageCounter(offer: any, garageId: string, counterPrice: number, notes: string | undefined, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['countered', offer.counter_offer_id]);
        const round = offer.round_number + 1;
        const result = await client.query(`
            INSERT INTO counter_offers(bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
        VALUES($1, $2, 'garage', $3, $4, $5, $6)
            RETURNING counter_offer_id
        `, [offer.bid_id, offer.request_id, garageId, counterPrice, notes, round]);

        // ALWAYS notify customer when garage sends counter-offer
        const bid = await client.query('SELECT b.bid_amount, pr.customer_id FROM bids b JOIN part_requests pr ON b.request_id = pr.request_id WHERE b.bid_id = $1', [offer.bid_id]);

        if (bid.rows.length > 0) {
            const customerId = bid.rows[0].customer_id;
            const priceDifference = Math.abs(offer.proposed_amount - counterPrice);
            const counterOfferId = result.rows[0].counter_offer_id;

            // Determine notification message based on price change
            let title: string;
            let message: string;
            let notificationType: string;

            if (counterPrice < offer.proposed_amount) {
                // Price dropped - great news!
                title = '🎉 Price Dropped!';
                message = `Garage lowered price by ${priceDifference} QAR! Now ${counterPrice} QAR`;
                notificationType = 'price_dropped';
            } else if (counterPrice > offer.proposed_amount) {
                // Price increased
                title = '💰 Counter-Offer Received';
                message = `Garage counter - offered ${counterPrice} QAR(was ${offer.proposed_amount} QAR)`;
                notificationType = 'counter_offer_received';
            } else {
                // Same price with note/message
                title = '💬 Counter-Offer Received';
                message = `Garage responded to your offer: ${counterPrice} QAR`;
                notificationType = 'counter_offer_received';
            }

            // Create notification (includes push notification)
            await createNotification({
                userId: customerId,
                type: notificationType,
                title,
                message,
                data: {
                    bid_id: offer.bid_id,
                    counter_offer_id: counterOfferId,
                    proposed_amount: counterPrice,
                    previous_amount: offer.proposed_amount,
                    round
                },
                target_role: 'customer'
            });

            // PUSH: Customer - garage counter-offer received
            try {
                const { pushService } = await import('../push.service');
                await pushService.sendToUser(
                    customerId,
                    title,
                    message,
                    { type: notificationType, bid_id: offer.bid_id, counter_offer_id: counterOfferId },
                    { channelId: 'bids', sound: true }
                );
            } catch (pushErr) {
                logger.error('Push to customer failed', { error: pushErr });
            }

            // Emit real-time WebSocket event - emit BOTH event names for mobile compatibility
            const { emitToUser } = await import('../../utils/socketIO');
            const eventData = {
                counter_offer_id: counterOfferId,
                bid_id: offer.bid_id,
                request_id: offer.request_id,
                proposed_amount: counterPrice,
                previous_amount: offer.proposed_amount,
                round,
                notification: message
            };
            // Primary event for mobile app (RequestDetailScreen listens for this)
            emitToUser(customerId, 'garage_counter_offer', eventData);
            // Also emit bid_updated for any screens tracking bid changes
            emitToUser(customerId, 'bid_updated', { bid_id: offer.bid_id, request_id: offer.request_id });
            // Keep legacy event for backward compatibility
            emitToUser(customerId, 'counter_offer_received', eventData);
        }
    }

    private async createCustomerCounter(offer: any, customerId: string, counterPrice: number, notes: string | undefined, client: PoolClient): Promise<void> {
        await client.query('UPDATE counter_offers SET status = $1 WHERE counter_offer_id = $2', ['countered', offer.counter_offer_id]);
        const round = offer.round_number + 1;
        const result = await client.query(`
            INSERT INTO counter_offers(bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
        VALUES($1, $2, 'customer', $3, $4, $5, $6)
            RETURNING counter_offer_id
        `, [offer.bid_id, offer.request_id, customerId, counterPrice, notes, round]);

        // Get garage_id from the bid to notify them
        const bid = await client.query('SELECT garage_id, bid_amount FROM bids WHERE bid_id = $1', [offer.bid_id]);

        if (bid.rows.length > 0) {
            const garageId = bid.rows[0].garage_id;
            const counterOfferId = result.rows[0].counter_offer_id;

            // Create database notification
            await createNotification({
                userId: garageId,
                type: 'counter_offer_received',
                title: 'Counter-Offer Received 💰',
                message: `Customer counter-offered ${counterPrice} QAR (was ${offer.proposed_amount} QAR)`,
                data: { counter_offer_id: counterOfferId, bid_id: offer.bid_id, proposed_amount: counterPrice, round },
                target_role: 'garage'
            });

            // Emit real-time WebSocket event to garage dashboard
            const { emitToGarage } = await import('../../utils/socketIO');
            emitToGarage(garageId, 'counter_offer_received', {
                counter_offer_id: counterOfferId,
                bid_id: offer.bid_id,
                proposed_amount: counterPrice,
                original_amount: offer.proposed_amount,
                round,
                notification: `Customer counter-offered ${counterPrice} QAR (was ${offer.proposed_amount} QAR)`
            });
        }
    }

    private async notifyCounterOffer(garageId: string, bidId: string, counterOfferId: string, proposed: number, original: number, round: number): Promise<void> {
        // Create database notification
        await createNotification({
            userId: garageId,
            type: 'counter_offer_received',
            title: 'Counter-Offer Received 💰',
            message: `Customer counter - offered ${proposed} QAR(was ${original} QAR)`,
            data: { counter_offer_id: counterOfferId, bid_id: bidId, proposed_amount: proposed, round },
            target_role: 'garage'
        });

        // PUSH: Garage - counter-offer received
        try {
            const { pushService } = await import('../push.service');
            await pushService.sendToUser(
                garageId,
                'Counter-Offer Received 💰',
                `Customer offered ${proposed} QAR (was ${original} QAR)`,
                { type: 'counter_offer_received', bid_id: bidId, counter_offer_id: counterOfferId },
                { channelId: 'bids', sound: true }
            );
        } catch (pushErr) {
            logger.error('Push to garage failed', { error: pushErr });
        }

        // Emit real-time WebSocket event to garage dashboard
        const { emitToGarage } = await import('../../utils/socketIO');
        emitToGarage(garageId, 'counter_offer_received', {
            counter_offer_id: counterOfferId,
            bid_id: bidId,
            proposed_amount: proposed,
            original_amount: original,
            round,
            notification: `Customer counter - offered ${proposed} QAR(was ${original} QAR)`
        });
    }
}
