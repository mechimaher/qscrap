import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { LoyaltyService } from '../services/loyalty.service';
import { getErrorMessage } from '../types';

/**
 * GET /api/customer/loyalty/summary
 * Get customer's rewards summary
 */
export const getRewardsSummary = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;

    try {
        const summary = await LoyaltyService.getCustomerSummary(customerId);

        if (!summary) {
            return res.status(404).json({ error: 'Rewards account not found' });
        }

        res.json({
            success: true,
            data: summary
        });
    } catch (err) {
        console.error('getRewardsSummary error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/customer/loyalty/transactions
 * Get transaction history
 */
export const getTransactionHistory = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        const transactions = await LoyaltyService.getTransactionHistory(customerId, limit);

        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (err) {
        console.error('getTransactionHistory error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/customer/loyalty/redeem
 * Redeem points for discount
 */
export const redeemPoints = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { points } = req.body;

    try {
        if (!points || points <= 0) {
            return res.status(400).json({ error: 'Invalid points amount' });
        }

        if (points < 100) {
            return res.status(400).json({
                error: 'Minimum redemption is 100 points',
                minimum: 100
            });
        }

        if (points % 100 !== 0) {
            return res.status(400).json({
                error: 'Points must be in multiples of 100',
                valid_amounts: [100, 200, 300, 500, 1000]
            });
        }

        const result = await LoyaltyService.redeemPoints(customerId, points);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                current_balance: result.new_balance
            });
        }

        res.json({
            success: true,
            discount_amount: parseFloat(result.discount_amount),
            new_balance: result.new_balance,
            message: result.message
        });
    } catch (err) {
        console.error('redeemPoints error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/customer/loyalty/tiers
 * Get all tier benefits
 */
export const getTierBenefits = async (req: AuthRequest, res: Response) => {
    try {
        const tiers = await LoyaltyService.getTierBenefits();

        res.json({
            success: true,
            data: tiers
        });
    } catch (err) {
        console.error('getTierBenefits error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/customer/loyalty/calculate
 * Calculate points/discount from amount
 */
export const calculateRewards = async (req: AuthRequest, res: Response) => {
    const amount = parseFloat(req.query.amount as string);

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        const points = LoyaltyService.calculatePointsFromAmount(amount);

        res.json({
            success: true,
            amount_qar: amount,
            points_earned: points,
            qar_per_point: 10
        });
    } catch (err) {
        console.error('calculateRewards error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * POST /api/admin/loyalty/bonus
 * Award bonus points (admin only)
 */
export const awardBonusPoints = async (req: AuthRequest, res: Response) => {
    const { customer_id, points, reason } = req.body;

    try {
        if (!customer_id || !points || !reason) {
            return res.status(400).json({
                error: 'Missing required fields: customer_id, points, reason'
            });
        }

        if (points <= 0 || points > 10000) {
            return res.status(400).json({
                error: 'Points must be between 1 and 10000'
            });
        }

        const result = await LoyaltyService.awardBonusPoints(
            customer_id,
            points,
            reason
        );

        res.json({
            success: true,
            new_balance: result.new_balance,
            new_tier: result.new_tier,
            message: `Awarded ${points} bonus points`
        });
    } catch (err) {
        console.error('awardBonusPoints error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

/**
 * GET /api/admin/loyalty/stats
 * Get loyalty program statistics (admin only)
 */
export const getLoyaltyStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await LoyaltyService.getLoyaltyStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('getLoyaltyStats error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
