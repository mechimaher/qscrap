// QScrap Payment API Routes
// Secure endpoints with rate limiting and validation

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { paymentService } from '../services/payments';

const router = express.Router();

// ============================================================================
// RATE LIMITERS
// ============================================================================

// Payment processing: strict limit to prevent abuse
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 payment attempts per 15 min
    message: { success: false, error: 'Too many payment attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test'
});

// Refund processing: moderate limit
const refundLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 refund requests per hour
    message: { success: false, error: 'Too many refund requests. Please contact support.' },
    skip: (req) => process.env.NODE_ENV === 'test'
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/payments/process
 * Process a payment transaction
 */
router.post('/process',
    authenticate,
    paymentLimiter,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const { orderId, amount, paymentMethod, idempotencyKey, metadata } = req.body;

            // Validation
            if (!orderId) {
                return res.status(400).json({ success: false, error: 'Order ID is required' });
            }
            if (!amount || amount <= 0) {
                return res.status(400).json({ success: false, error: 'Valid amount is required' });
            }
            if (!paymentMethod || !paymentMethod.type) {
                return res.status(400).json({ success: false, error: 'Payment method is required' });
            }

            // For card payments, validate card details
            if (paymentMethod.type === 'mock_card') {
                if (!paymentMethod.cardNumber || !paymentMethod.cardExpiry || !paymentMethod.cardCVV) {
                    return res.status(400).json({
                        success: false,
                        error: 'Card number, expiry, and CVV are required'
                    });
                }
            }

            // Extract request metadata
            const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Process payment
            const result = await paymentService.processPayment({
                orderId,
                userId,
                amount: parseFloat(amount),
                paymentMethod,
                idempotencyKey,
                metadata
            }, ipAddress, userAgent);

            // Return appropriate status code
            const statusCode = result.success ? 200 : 402; // 402 = Payment Required
            res.status(statusCode).json(result);

        } catch (error: any) {
            console.error('[Payment API] Process error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Payment processing failed'
            });
        }
    }
);

/**
 * POST /api/payments/:transactionId/refund
 * Refund a payment transaction
 */
router.post('/:transactionId/refund',
    authenticate,
    refundLimiter,
    async (req: Request, res: Response) => {
        try {
            const { transactionId } = req.params;
            const { amount, reason } = req.body;

            if (!reason) {
                return res.status(400).json({ success: false, error: 'Refund reason is required' });
            }

            // Process refund
            const result = await paymentService.refundPayment(
                transactionId,
                reason,
                amount ? parseFloat(amount) : undefined
            );

            res.json(result);

        } catch (error: any) {
            console.error('[Payment API] Refund error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Refund processing failed'
            });
        }
    }
);

/**
 * GET /api/payments/:transactionId
 * Get transaction details
 */
router.get('/:transactionId',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const { transactionId } = req.params;
            const userId = (req as any).user.userId;

            const transaction = await paymentService.getTransaction(transactionId);

            if (!transaction) {
                return res.status(404).json({ success: false, error: 'Transaction not found' });
            }

            // Security: ensure user owns this transaction
            if (transaction.user_id !== userId) {
                return res.status(403).json({ success: false, error: 'Unauthorized' });
            }

            res.json({ success: true, transaction });

        } catch (error: any) {
            console.error('[Payment API] Get transaction error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to retrieve transaction'
            });
        }
    }
);

/**
 * GET /api/payments/my
 * Get user's payment history
 */
router.get('/my',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const limit = parseInt(req.query.limit as string) || 50;

            const transactions = await paymentService.getUserPayments(userId, limit);

            res.json({ success: true, transactions });

        } catch (error: any) {
            console.error('[Payment API] Get history error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to retrieve payment history'
            });
        }
    }
);

/**
 * GET /api/payments/test-cards
 * Get list of test card numbers (mock provider only)
 */
router.get('/test-cards', (req: Request, res: Response) => {
    // Only expose in development/test environments
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, error: 'Not found' });
    }

    res.json({
        success: true,
        testCards: {
            success: '4242 4242 4242 4242',
            declined: '4000 0000 0000 0002',
            insufficient_funds: '4000 0000 0000 0341',
            card_expired: '4000 0000 0000 0069',
            invalid_cvc: '4000 0000 0000 0127',
            requires_3ds: '4000 0025 0000 3155',
            mastercard: '5555 5555 5555 4444',
            amex: '3782 822463 10005',
            discover: '6011 1111 1111 1117'
        },
        note: 'Use any future expiry date (e.g., 12/25) and any 3-digit CVV (e.g., 123)'
    });
});

export default router;
