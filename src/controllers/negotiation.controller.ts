/**
 * Negotiation Controller - Refactored
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { NegotiationService, isNegotiationError, getHttpStatusForError } from '../services/negotiation';
import logger from '../utils/logger';

const negotiationService = new NegotiationService(pool);

export const createCounterOffer = async (req: AuthRequest, res: Response) => {
    try {
        const { bid_id } = req.params;
        const { proposed_amount, message } = req.body;
        const result = await negotiationService.createCounterOffer(req.user!.userId, bid_id, proposed_amount, message);
        res.status(201).json({ message: 'Counter-offer sent', ...result, max_rounds: 3 });
    } catch (err) {
        if (isNegotiationError(err)) {return res.status(getHttpStatusForError(err)).json({ error: (err as Error).message });}
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const respondToCounterOffer = async (req: AuthRequest, res: Response) => {
    try {
        const { counter_offer_id } = req.params;
        // Accept both proposed_amount and counter_amount for frontend compatibility
        const { action, proposed_amount, counter_amount, notes } = req.body;
        const counterPrice = proposed_amount || counter_amount;
        await negotiationService.respondToCounterOffer(req.user!.userId, counter_offer_id, { action, counter_price: counterPrice, notes });
        res.json({ message: `Counter-offer ${action}ed` });
    } catch (err) {
        logger.error('respondToCounterOffer error', { error: err });
        if (isNegotiationError(err)) {return res.status(getHttpStatusForError(err)).json({ error: (err as Error).message });}
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const customerRespondToCounter = async (req: AuthRequest, res: Response) => {
    try {
        const { counter_offer_id } = req.params;
        // Accept both proposed_amount and counter_amount for frontend compatibility
        const { action, proposed_amount, counter_amount, notes } = req.body;
        const counterPrice = proposed_amount || counter_amount;
        await negotiationService.customerRespondToCounter(req.user!.userId, counter_offer_id, { action, counter_price: counterPrice, notes });
        res.json({ message: `Counter-offer ${action}ed` });
    } catch (err) {
        if (isNegotiationError(err)) {return res.status(getHttpStatusForError(err)).json({ error: (err as Error).message });}
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getNegotiationHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { bid_id } = req.params;
        const history = await negotiationService.getNegotiationHistory(bid_id);
        // Calculate current round from history
        const currentRound = history.length > 0
            ? Math.max(...history.map((h: any) => h.round_number || 0))
            : 0;
        // Return both 'negotiations' (legacy) and 'history' + 'current_round' (mobile app)
        res.json({ negotiations: history, history, current_round: currentRound });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};


export const getPendingCounterOffers = async (req: AuthRequest, res: Response) => {
    try {
        const offers = await negotiationService.getPendingCounterOffers(req.user!.userId);
        res.json({ pending_offers: offers });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const acceptLastGarageOffer = async (req: AuthRequest, res: Response) => {
    try {
        const { bid_id } = req.params;
        await negotiationService.acceptLastGarageOffer(req.user!.userId, bid_id);
        res.json({ message: 'Offer accepted successfully' });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};
