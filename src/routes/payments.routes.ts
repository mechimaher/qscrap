// QScrap Payment API Routes
// Secure endpoints with rate limiting and validation

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { paymentService } from '../services/payments';
import { getPaymentService } from '../services/payment/payment.service';
import { getWritePool } from '../config/db';

const router = express.Router();

// Deposit payment service (Stripe integration)
const depositService = getPaymentService(getWritePool());

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

// ============================================================================
// STRIPE DEPOSIT ROUTES (Delivery Fee Upfront Model)
// ============================================================================

/**
 * POST /api/payments/deposit/:orderId
 * Create deposit intent for delivery fee payment
 */
router.post('/deposit/:orderId',
    authenticate,
    paymentLimiter,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const { orderId } = req.params;

            // Get order details to get delivery fee
            const pool = getWritePool();
            const orderResult = await pool.query(
                'SELECT delivery_fee, customer_id, order_status FROM orders WHERE order_id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }

            const order = orderResult.rows[0];

            // Verify ownership
            if (order.customer_id !== userId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            const deliveryFee = parseFloat(order.delivery_fee) || 0;
            if (deliveryFee <= 0) {
                return res.status(400).json({ success: false, error: 'No delivery fee to pay' });
            }

            const result = await depositService.createDeliveryFeeDeposit(
                orderId,
                userId,
                deliveryFee,
                'QAR'
            );

            res.json({
                success: true,
                intent: {
                    id: result.intentId,
                    clientSecret: result.clientSecret,
                    amount: result.amount,
                    currency: result.currency
                }
            });
        } catch (error: any) {
            console.error('[Payment API] Deposit error:', error);
            res.status(500).json({ success: false, error: error.message || 'Deposit creation failed' });
        }
    }
);

/**
 * POST /api/payments/full/:orderId
 * Create full payment intent (Part Price + Delivery Fee)
 * Scenario B: Customer pays everything upfront, no COD at delivery
 */
router.post('/full/:orderId',
    authenticate,
    paymentLimiter,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const { orderId } = req.params;

            // Get order details with full pricing
            const pool = getWritePool();
            const orderResult = await pool.query(
                'SELECT part_price, delivery_fee, customer_id, order_status FROM orders WHERE order_id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }

            const order = orderResult.rows[0];

            // Verify ownership
            if (order.customer_id !== userId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            const partPrice = parseFloat(order.part_price) || 0;
            const deliveryFee = parseFloat(order.delivery_fee) || 0;
            const totalAmount = partPrice + deliveryFee;

            if (totalAmount <= 0) {
                return res.status(400).json({ success: false, error: 'No amount to pay' });
            }

            const result = await depositService.createFullPaymentIntent(
                orderId,
                userId,
                totalAmount,
                partPrice,
                deliveryFee,
                'QAR'
            );

            res.json({
                success: true,
                intent: {
                    id: result.intentId,
                    clientSecret: result.clientSecret,
                    amount: result.amount,
                    currency: result.currency
                },
                breakdown: {
                    partPrice,
                    deliveryFee,
                    total: totalAmount
                }
            });
        } catch (error: any) {
            console.error('[Payment API] Full payment error:', error);
            res.status(500).json({ success: false, error: error.message || 'Full payment creation failed' });
        }
    }
);

/**
 * POST /api/payments/deposit/confirm/:intentId
 * Confirm deposit payment was successful
 */
router.post('/deposit/confirm/:intentId',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const { intentId } = req.params;
            const success = await depositService.confirmDepositPayment(intentId);

            if (success) {
                res.json({ success: true, message: 'Deposit payment confirmed' });
            } else {
                res.status(400).json({ success: false, message: 'Payment not completed' });
            }
        } catch (error: any) {
            console.error('[Payment API] Confirm deposit error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * GET /api/payments/order/:orderId/status
 * Get payment status for an order
 */
router.get('/order/:orderId/status',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            const userId = (req as any).user.userId;

            // Verify ownership
            const pool = getWritePool();
            const orderResult = await pool.query(
                'SELECT customer_id FROM orders WHERE order_id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }

            if (orderResult.rows[0].customer_id !== userId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            const status = await depositService.getOrderPaymentStatus(orderId);
            res.json({ success: true, ...status });
        } catch (error: any) {
            console.error('[Payment API] Get status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * POST /api/payments/methods
 * Save a payment method (card)
 */
router.post('/methods',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const { paymentMethodId } = req.body;

            if (!paymentMethodId) {
                return res.status(400).json({ success: false, error: 'paymentMethodId required' });
            }

            const method = await depositService.savePaymentMethod(userId, paymentMethodId);
            res.json({ success: true, method });
        } catch (error: any) {
            console.error('[Payment API] Save method error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * GET /api/payments/methods
 * Get saved payment methods
 */
router.get('/methods',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const methods = await depositService.getPaymentMethods(userId);
            res.json({ success: true, methods });
        } catch (error: any) {
            console.error('[Payment API] Get methods error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * DELETE /api/payments/methods/:methodId
 * Remove a saved payment method
 */
router.delete('/methods/:methodId',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const { methodId } = req.params;

            await depositService.removePaymentMethod(userId, methodId);
            res.json({ success: true, message: 'Payment method removed' });
        } catch (error: any) {
            console.error('[Payment API] Remove method error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;
