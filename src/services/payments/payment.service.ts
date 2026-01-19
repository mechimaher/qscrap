// QScrap Payment Service
// Main business logic layer for payment processing
// Handles: transactions, idempotency, audit logging, database persistence

import pool from '../../config/db';
import crypto from 'crypto';
import {
    PaymentProvider,
    PaymentRequest,
    PaymentResponse,
    RefundRequest,
    RefundResponse,
    PaymentTransaction,
    PaymentStatus,
    TransactionAction
} from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';

// ============================================================================
// DTO TYPES
// ============================================================================

export interface ProcessPaymentDTO {
    orderId: string;
    userId: string;
    amount: number;
    paymentMethod: PaymentRequest['paymentMethod'];
    idempotencyKey?: string;
    metadata?: Record<string, any>;
}

export interface PaymentResult {
    success: boolean;
    transactionId: string;
    status: PaymentStatus;
    message?: string;
    errorCode?: string;
}

// ============================================================================
// PAYMENT SERVICE CLASS
// ============================================================================

export class PaymentService {
    private provider: PaymentProvider;

    constructor() {
        // 🔥 EASY SWAP: Just change this line when QPAY arrives!
        this.provider = new MockPaymentProvider();
        // Future: this.provider = new QPAYPaymentProvider();
    }

    /**
     * Process a payment with full transaction safety and idempotency
     */
    async processPayment(data: ProcessPaymentDTO, ipAddress?: string, userAgent?: string): Promise<PaymentResult> {
        const client = await pool.connect();
        const startTime = Date.now();

        try {
            await client.query('BEGIN');

            // 1. Generate idempotency key if not provided
            const idempotencyKey = data.idempotencyKey || this.generateIdempotencyKey(data);

            // 2. Check if this payment was already processed (idempotency)
            const existing = await this.checkIdempotency(client, idempotencyKey);
            if (existing) {
                await client.query('COMMIT');
                console.log('[Payment] Idempotent request detected, returning cached result');
                return existing;
            }

            // 3. Validate order exists and amount matches
            await this.validateOrder(client, data.orderId, data.userId, data.amount);

            // 4. Create initial transaction record
            const transaction = await this.createTransaction(client, data, idempotencyKey);

            // 5. Log audit: initiated
            await this.createAuditLog(client, transaction.transaction_id, 'initiated', ipAddress, userAgent, {
                amount: data.amount,
                payment_method: data.paymentMethod.type
            });

            // 6. Process payment with provider
            const providerRequest: PaymentRequest = {
                orderId: data.orderId,
                userId: data.userId,
                amount: data.amount,
                currency: 'QAR',
                paymentMethod: data.paymentMethod,
                idempotencyKey,
                metadata: data.metadata
            };

            const providerResponse = await this.provider.processPayment(providerRequest);

            // 7. Update transaction with provider response
            await this.updateTransaction(client, transaction.transaction_id, providerResponse);

            // 8. Log audit: completed or failed
            const auditAction: TransactionAction = providerResponse.success ? 'completed' : 'failed';
            await this.createAuditLog(client, transaction.transaction_id, auditAction, ipAddress, userAgent, null, providerResponse);

            // 9. Store in idempotency cache
            const result: PaymentResult = {
                success: providerResponse.success,
                transactionId: providerResponse.transactionId,
                status: providerResponse.status,
                message: providerResponse.message,
                errorCode: providerResponse.errorCode
            };
            await this.storeIdempotency(client, idempotencyKey, transaction.transaction_id, result, data.userId);

            // 10. Update order status if payment successful
            if (providerResponse.success && providerResponse.status === 'success') {
                await this.markOrderAsPaid(client, data.orderId);
            }

            await client.query('COMMIT');

            const processingTime = Date.now() - startTime;
            console.log(`[Payment] Transaction ${transaction.transaction_id} completed in ${processingTime}ms`);

            return result;

        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('[Payment] Transaction failed:', error);
            throw new Error(`Payment processing failed: ${error.message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Process a refund
     */
    async refundPayment(transactionId: string, reason: string, amount?: number): Promise<RefundResponse> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Fetch transaction
            const txResult = await client.query(
                'SELECT * FROM payment_transactions WHERE transaction_id = $1',
                [transactionId]
            );

            if (txResult.rows.length === 0) {
                throw new Error('Transaction not found');
            }

            const transaction: PaymentTransaction = txResult.rows[0];

            // 2. Validate refund is possible
            if (transaction.status !== 'success') {
                throw new Error('Can only refund successful transactions');
            }

            const refundAmount = amount || transaction.amount;
            if (refundAmount > (transaction.amount - transaction.refund_amount)) {
                throw new Error('Refund amount exceeds available balance');
            }

            // 3. Process refund with provider
            const refundResult = await this.provider.refundPayment({
                transactionId,
                amount: refundAmount,
                reason
            });

            // 4. Update transaction
            await client.query(`
                UPDATE payment_transactions
                SET 
                    status = CASE WHEN (refund_amount + $1) >= amount THEN 'refunded' ELSE status END,
                    refund_amount = refund_amount + $1,
                    refund_reason = $2,
                    refunded_at = CURRENT_TIMESTAMP
                WHERE transaction_id = $3
            `, [refundAmount, reason, transactionId]);

            // 5. Audit log
            await this.createAuditLog(client, transactionId, 'refunded', null, null, { amount: refundAmount, reason });

            await client.query('COMMIT');

            return refundResult;

        } catch (error: any) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get transaction details
     */
    async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
        const result = await pool.query(
            'SELECT * FROM payment_transactions WHERE transaction_id = $1',
            [transactionId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get user's payment history
     */
    async getUserPayments(userId: string, limit: number = 50): Promise<PaymentTransaction[]> {
        const result = await pool.query(`
            SELECT * FROM payment_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);
        return result.rows;
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    private generateIdempotencyKey(data: ProcessPaymentDTO): string {
        const hash = crypto.createHash('sha256')
            .update(`${data.orderId}-${data.userId}-${data.amount}-${Date.now()}`)
            .digest('hex');
        return `idem_${hash.substring(0, 32)}`;
    }

    private async checkIdempotency(client: any, key: string): Promise<PaymentResult | null> {
        const result = await client.query(
            'SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP',
            [key]
        );
        return result.rows[0]?.response || null;
    }

    private async validateOrder(client: any, orderId: string, userId: string, amount: number): Promise<void> {
        const result = await client.query(
            'SELECT order_id, customer_id, total_amount FROM orders WHERE order_id = $1',
            [orderId]
        );

        if (result.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = result.rows[0];

        if (order.customer_id !== userId) {
            throw new Error('Unauthorized: Order does not belong to user');
        }

        if (Math.abs(order.total_amount - amount) > 0.01) {
            throw new Error(`Amount mismatch: expected ${order.total_amount}, got ${amount}`);
        }
    }

    private async createTransaction(client: any, data: ProcessPaymentDTO, idempotencyKey: string): Promise<PaymentTransaction> {
        const cardLast4 = data.paymentMethod.cardNumber?.slice(-4);
        const cardBrand = this.detectCardBrand(data.paymentMethod.cardNumber);
        const [expiryMonth, expiryYear] = this.parseExpiry(data.paymentMethod.cardExpiry);

        const result = await client.query(`
            INSERT INTO payment_transactions (
                order_id, user_id, amount, currency, payment_method,
                card_last4, card_brand, card_expiry_month, card_expiry_year,
                idempotency_key, metadata, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            data.orderId,
            data.userId,
            data.amount,
            'QAR',
            data.paymentMethod.type,
            cardLast4,
            cardBrand,
            expiryMonth,
            expiryYear,
            idempotencyKey,
            JSON.stringify(data.metadata || {}),
            'pending'
        ]);

        return result.rows[0];
    }

    private async updateTransaction(client: any, transactionId: string, response: PaymentResponse): Promise<void> {
        await client.query(`
            UPDATE payment_transactions
            SET 
                status = $1,
                provider_transaction_id = $2,
                provider_response = $3,
                completed_at = CASE WHEN $1 = 'success' THEN CURRENT_TIMESTAMP ELSE NULL END,
                failed_at = CASE WHEN $1 = 'failed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                failure_reason = $4,
                error_code = $5
            WHERE transaction_id = $6
        `, [
            response.status,
            response.providerTransactionId,
            JSON.stringify(response),
            response.message,
            response.errorCode,
            transactionId
        ]);
    }

    private async storeIdempotency(client: any, key: string, transactionId: string, response: PaymentResult, userId: string): Promise<void> {
        await client.query(`
            INSERT INTO idempotency_keys (key, transaction_id, response, user_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (key) DO NOTHING
        `, [key, transactionId, JSON.stringify(response), userId]);
    }

    private async createAuditLog(
        client: any,
        transactionId: string,
        action: TransactionAction,
        ipAddress?: string | null,
        userAgent?: string | null,
        requestData?: any,
        responseData?: any
    ): Promise<void> {
        await client.query(`
            INSERT INTO payment_audit_logs (
                transaction_id, action, ip_address, user_agent, request_data, response_data
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            transactionId,
            action,
            ipAddress,
            userAgent,
            requestData ? JSON.stringify(requestData) : null,
            responseData ? JSON.stringify(responseData) : null
        ]);
    }

    private async markOrderAsPaid(client: any, orderId: string): Promise<void> {
        await client.query(`
            UPDATE orders
            SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
        `, [orderId]);
    }

    private detectCardBrand(cardNumber?: string): string | null {
        if (!cardNumber) return null;
        const cleaned = cardNumber.replace(/\D/g, '');
        if (/^4/.test(cleaned)) return 'visa';
        if (/^5[1-5]/.test(cleaned)) return 'mastercard';
        if (/^3[47]/.test(cleaned)) return 'amex';
        if (/^6(?:011|5)/.test(cleaned)) return 'discover';
        return null;
    }

    private parseExpiry(expiry?: string): [number | null, number | null] {
        if (!expiry) return [null, null];
        const [month, year] = expiry.split('/').map(Number);
        return [month || null, year ? 2000 + year : null];
    }
}

// Singleton export
export const paymentService = new PaymentService();
