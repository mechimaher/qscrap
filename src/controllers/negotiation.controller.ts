import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';

const MAX_NEGOTIATION_ROUNDS = 3;

// Customer sends counter-offer to a garage's bid
export const createCounterOffer = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const { proposed_amount, message } = req.body;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get the bid
        const bidResult = await client.query(
            `SELECT b.*, pr.customer_id 
             FROM bids b 
             JOIN part_requests pr ON b.request_id = pr.request_id 
             WHERE b.bid_id = $1`,
            [bid_id]
        );

        if (bidResult.rows.length === 0) {
            throw new Error('Bid not found');
        }

        const bid = bidResult.rows[0];

        // Verify customer owns the request
        if (bid.customer_id !== customerId) {
            throw new Error('Access denied');
        }

        // Check bid is still pending
        if (bid.status !== 'pending') {
            throw new Error('Cannot negotiate on a non-pending bid');
        }

        // Check round limit
        const roundResult = await client.query(
            `SELECT COUNT(*) as count FROM counter_offers WHERE bid_id = $1`,
            [bid_id]
        );
        const currentRound = parseInt(roundResult.rows[0].count) + 1;

        if (currentRound > MAX_NEGOTIATION_ROUNDS) {
            throw new Error('Maximum negotiation rounds reached');
        }

        // Check if there's a pending counter-offer
        const pendingResult = await client.query(
            `SELECT counter_offer_id FROM counter_offers 
             WHERE bid_id = $1 AND status = 'pending'`,
            [bid_id]
        );
        if (pendingResult.rows.length > 0) {
            throw new Error('A pending counter-offer already exists');
        }

        // Create counter-offer
        const result = await client.query(
            `INSERT INTO counter_offers 
             (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
             VALUES ($1, $2, 'customer', $3, $4, $5, $6)
             RETURNING counter_offer_id, created_at`,
            [bid_id, bid.request_id, customerId, proposed_amount, message, currentRound]
        );

        await client.query('COMMIT');

        // Notify garage
        const io = (global as any).io;
        console.log(`[COUNTER-OFFER] Emitting to garage_${bid.garage_id}`, {
            counter_offer_id: result.rows[0].counter_offer_id,
            proposed_amount,
            original_amount: bid.bid_amount
        });
        io.to(`garage_${bid.garage_id}`).emit('counter_offer_received', {
            counter_offer_id: result.rows[0].counter_offer_id,
            bid_id: bid_id,
            proposed_amount: proposed_amount,
            message: message,
            round: currentRound,
            original_amount: bid.bid_amount,
            notification: `💰 Customer counter-offered ${proposed_amount} QAR (was ${bid.bid_amount} QAR)`
        });

        res.status(201).json({
            message: 'Counter-offer sent',
            counter_offer_id: result.rows[0].counter_offer_id,
            round: currentRound,
            max_rounds: MAX_NEGOTIATION_ROUNDS
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Garage responds to a counter-offer
export const respondToCounterOffer = async (req: AuthRequest, res: Response) => {
    const { counter_offer_id } = req.params;
    const { action, counter_amount, message } = req.body; // action: 'accept' | 'reject' | 'counter'
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get counter-offer
        const coResult = await client.query(
            `SELECT co.*, b.garage_id, b.bid_amount, b.request_id, pr.customer_id
             FROM counter_offers co
             JOIN bids b ON co.bid_id = b.bid_id
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE co.counter_offer_id = $1`,
            [counter_offer_id]
        );

        if (coResult.rows.length === 0) {
            throw new Error('Counter-offer not found');
        }

        const co = coResult.rows[0];

        // Verify garage owns the bid
        if (co.garage_id !== garageId) {
            throw new Error('Access denied');
        }

        if (co.status !== 'pending') {
            throw new Error('Counter-offer already processed');
        }

        if (action === 'accept') {
            // Update counter-offer status
            await client.query(
                `UPDATE counter_offers SET status = 'accepted', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            // Update bid amount to the agreed price
            await client.query(
                `UPDATE bids SET bid_amount = $1, notes = COALESCE(notes, '') || ' [Negotiated from ' || bid_amount || ' QAR]', updated_at = NOW()
                 WHERE bid_id = $2`,
                [co.proposed_amount, co.bid_id]
            );

            await client.query('COMMIT');

            // Notify customer
            const io = (global as any).io;
            io.to(`user_${co.customer_id}`).emit('counter_offer_accepted', {
                bid_id: co.bid_id,
                new_amount: co.proposed_amount,
                notification: `✅ Your counter-offer of ${co.proposed_amount} QAR was accepted!`
            });

            res.json({ message: 'Counter-offer accepted', new_bid_amount: co.proposed_amount });

        } else if (action === 'reject') {
            await client.query(
                `UPDATE counter_offers SET status = 'rejected', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            await client.query('COMMIT');

            // Notify customer - different message if at final round
            const io = (global as any).io;
            const isFinalRound = co.round_number >= MAX_NEGOTIATION_ROUNDS;

            if (isFinalRound) {
                // At round 3/3, guide customer to accept or decline the original bid
                io.to(`user_${co.customer_id}`).emit('counter_offer_rejected', {
                    bid_id: co.bid_id,
                    is_final_round: true,
                    original_bid_amount: co.bid_amount,
                    notification: `❌ Final round: Your offer of ${co.proposed_amount} QAR was declined. The garage's price is ${co.bid_amount} QAR - Accept or choose another bid.`
                });
            } else {
                io.to(`user_${co.customer_id}`).emit('counter_offer_rejected', {
                    bid_id: co.bid_id,
                    is_final_round: false,
                    notification: `❌ Your counter-offer was declined. Original price: ${co.bid_amount} QAR`
                });
            }

            res.json({ message: 'Counter-offer rejected' });

        } else if (action === 'counter') {
            // Garage makes a counter-counter offer
            if (!counter_amount) {
                throw new Error('Counter amount required');
            }

            // Check round limit
            if (co.round_number >= MAX_NEGOTIATION_ROUNDS) {
                throw new Error('Maximum negotiation rounds reached');
            }

            // Mark current as countered
            await client.query(
                `UPDATE counter_offers SET status = 'countered', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            // Create new counter-offer from garage
            const newCo = await client.query(
                `INSERT INTO counter_offers 
                 (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
                 VALUES ($1, $2, 'garage', $3, $4, $5, $6)
                 RETURNING counter_offer_id`,
                [co.bid_id, co.request_id, garageId, counter_amount, message, co.round_number + 1]
            );

            await client.query('COMMIT');

            // Notify customer
            const io = (global as any).io;
            io.to(`user_${co.customer_id}`).emit('garage_counter_offer', {
                counter_offer_id: newCo.rows[0].counter_offer_id,
                bid_id: co.bid_id,
                proposed_amount: counter_amount,
                message: message,
                round: co.round_number + 1,
                notification: `🔄 Garage counter-offered ${counter_amount} QAR`
            });

            res.json({
                message: 'Counter-offer sent',
                counter_offer_id: newCo.rows[0].counter_offer_id,
                round: co.round_number + 1
            });
        } else {
            throw new Error('Invalid action');
        }
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Customer responds to garage's counter-offer
export const customerRespondToCounter = async (req: AuthRequest, res: Response) => {
    const { counter_offer_id } = req.params;
    const { action, counter_amount, message } = req.body;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const coResult = await client.query(
            `SELECT co.*, b.garage_id, b.bid_amount, b.request_id, pr.customer_id
             FROM counter_offers co
             JOIN bids b ON co.bid_id = b.bid_id
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE co.counter_offer_id = $1 AND co.offered_by_type = 'garage'`,
            [counter_offer_id]
        );

        if (coResult.rows.length === 0) {
            throw new Error('Counter-offer not found');
        }

        const co = coResult.rows[0];

        if (co.customer_id !== customerId) {
            throw new Error('Access denied');
        }

        if (co.status !== 'pending') {
            throw new Error('Counter-offer already processed');
        }

        if (action === 'accept') {
            await client.query(
                `UPDATE counter_offers SET status = 'accepted', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            // Update bid amount
            await client.query(
                `UPDATE bids SET bid_amount = $1, notes = COALESCE(notes, '') || ' [Negotiated]', updated_at = NOW()
                 WHERE bid_id = $2`,
                [co.proposed_amount, co.bid_id]
            );

            await client.query('COMMIT');

            // Notify garage
            const io = (global as any).io;
            io.to(`garage_${co.garage_id}`).emit('counter_offer_accepted', {
                bid_id: co.bid_id,
                new_amount: co.proposed_amount,
                notification: `✅ Customer accepted your counter-offer of ${co.proposed_amount} QAR!`
            });

            res.json({ message: 'Price agreed', new_bid_amount: co.proposed_amount });

        } else if (action === 'reject') {
            await client.query(
                `UPDATE counter_offers SET status = 'rejected', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            await client.query('COMMIT');

            const io = (global as any).io;
            io.to(`garage_${co.garage_id}`).emit('counter_offer_rejected', {
                bid_id: co.bid_id,
                notification: `❌ Customer rejected your counter-offer`
            });

            res.json({ message: 'Counter-offer rejected' });

        } else if (action === 'counter') {
            if (co.round_number >= MAX_NEGOTIATION_ROUNDS) {
                throw new Error('Maximum negotiation rounds reached. Please accept, reject, or choose a different bid.');
            }

            await client.query(
                `UPDATE counter_offers SET status = 'countered', response_message = $2, responded_at = NOW()
                 WHERE counter_offer_id = $1`,
                [counter_offer_id, message]
            );

            const newCo = await client.query(
                `INSERT INTO counter_offers 
                 (bid_id, request_id, offered_by_type, offered_by_id, proposed_amount, message, round_number)
                 VALUES ($1, $2, 'customer', $3, $4, $5, $6)
                 RETURNING counter_offer_id`,
                [co.bid_id, co.request_id, customerId, counter_amount, message, co.round_number + 1]
            );

            await client.query('COMMIT');

            const io = (global as any).io;
            io.to(`garage_${co.garage_id}`).emit('counter_offer_received', {
                counter_offer_id: newCo.rows[0].counter_offer_id,
                bid_id: co.bid_id,
                proposed_amount: counter_amount,
                round: co.round_number + 1,
                notification: `💰 Customer counter-offered ${counter_amount} QAR`
            });

            res.json({
                message: 'Counter-offer sent',
                counter_offer_id: newCo.rows[0].counter_offer_id,
                round: co.round_number + 1
            });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get negotiation history for a bid
export const getNegotiationHistory = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        // Verify access
        const bidResult = await pool.query(
            `SELECT b.garage_id, pr.customer_id FROM bids b 
             JOIN part_requests pr ON b.request_id = pr.request_id 
             WHERE b.bid_id = $1`,
            [bid_id]
        );

        if (bidResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }

        const bid = bidResult.rows[0];
        if (userType === 'customer' && bid.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (userType === 'garage' && bid.garage_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT * FROM counter_offers 
             WHERE bid_id = $1 
             ORDER BY created_at ASC`,
            [bid_id]
        );

        res.json({
            negotiations: result.rows,
            max_rounds: MAX_NEGOTIATION_ROUNDS,
            current_round: result.rows.length
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get pending counter-offers for a garage (offers awaiting their response)
export const getPendingCounterOffers = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT co.*, b.bid_amount as original_amount, 
                    CONCAT(pr.car_make, ' ', pr.car_model) as car_summary,
                    pr.part_description
             FROM counter_offers co
             JOIN bids b ON co.bid_id = b.bid_id
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.garage_id = $1 
               AND co.status = 'pending' 
               AND co.offered_by_type = 'customer'
             ORDER BY co.created_at DESC`,
            [garageId]
        );

        res.json({ pending_offers: result.rows });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * Accept garage's last counter-offer (even after negotiation ended)
 * This allows customer to accept the final price offered by garage
 */
export const acceptLastGarageOffer = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get the bid and last garage counter-offer
        const bidResult = await client.query(
            `SELECT b.*, pr.customer_id, pr.request_id,
                    (SELECT co.proposed_amount 
                     FROM counter_offers co 
                     WHERE co.bid_id = b.bid_id 
                       AND co.offered_by_type = 'garage'
                     ORDER BY co.created_at DESC LIMIT 1) as last_garage_offer
             FROM bids b 
             JOIN part_requests pr ON b.request_id = pr.request_id 
             WHERE b.bid_id = $1`,
            [bid_id]
        );

        if (bidResult.rows.length === 0) {
            throw new Error('Bid not found');
        }

        const bid = bidResult.rows[0];

        // Verify customer owns the request
        if (bid.customer_id !== customerId) {
            throw new Error('Access denied');
        }

        // Check bid is still pending
        if (bid.status !== 'pending') {
            throw new Error('Bid is no longer available');
        }

        // Get the last garage offer amount (or use original bid if no counter-offers)
        const finalAmount = bid.last_garage_offer || bid.bid_amount;

        // Update bid amount to the last garage offer
        await client.query(
            `UPDATE bids SET bid_amount = $1, updated_at = NOW() WHERE bid_id = $2`,
            [finalAmount, bid_id]
        );

        // Mark any pending counter-offers as expired
        await client.query(
            `UPDATE counter_offers SET status = 'accepted', responded_at = NOW()
             WHERE bid_id = $1 AND status = 'pending'`,
            [bid_id]
        );

        await client.query('COMMIT');

        // Notify garage
        const io = (global as any).io;
        io.to(`garage_${bid.garage_id}`).emit('bid_accepted_at_final_price', {
            bid_id: bid_id,
            final_amount: finalAmount,
            notification: `✅ Customer accepted your final price: ${finalAmount} QAR`
        });

        res.json({
            message: 'Accepted at garage\'s final price',
            final_amount: finalAmount,
            bid_id: bid_id
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};
