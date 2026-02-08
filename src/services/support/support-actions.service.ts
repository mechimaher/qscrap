/**
 * SupportActionsService
 * 
 * Handles support quick actions with PROPER integration with:
 * - PayoutService (cancel/reversal for garage payouts)
 * - PaymentGateway (customer refunds)
 * - 7-day warranty validation
 * - BRAIN v3.0 stage-based refund calculation
 * - Complete audit trail
 * 
 * This replaces the broken executeQuickAction() in support.service.ts
 */

import { Pool, PoolClient } from 'pg';
import { createNotification } from '../notification.service';
import {
    calculateRefundableAmount,
    determineRefundStage,
    getRefundReasonOptions,
    RefundCalculation
} from '../finance/refund-calculator.service';

import logger from '../../utils/logger';
import { getIO } from '../../utils/socketIO';
// Constants
const WARRANTY_DAYS = 7;
const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'processing', 'awaiting_pickup'];
const REFUNDABLE_STATUSES = ['delivered', 'completed'];

interface ActionContext {
    order: any;
    customer: any;
    payout: any;
    warrantyDaysRemaining: number;
    isWithinWarranty: boolean;
}

interface ActionResult {
    success: boolean;
    action: string;
    orderId?: string;
    message: string;
    payoutAction?: { action: string; payout_id?: string; reversal_id?: string };
    refundAction?: { refund_id?: string; amount: number };
    refundId?: string;
    status?: string;
    error?: string;
}

export class SupportActionsService {
    constructor(private pool: Pool) { }

    /**
     * Get full context for an order before taking action
     * Shows payout status, warranty status, payment info
     */
    async getActionContext(orderId: string): Promise<ActionContext> {
        const result = await this.pool.query(`
            SELECT 
                o.order_id, o.order_number, o.order_status, o.payment_status,
                o.total_amount, o.part_price, o.delivery_fee, o.platform_fee,
                o.garage_payout_amount, o.customer_id, o.garage_id, o.driver_id,
                o.completed_at, o.delivered_at, o.created_at,
                o.deposit_intent_id, o.final_payment_intent_id,
                EXTRACT(DAY FROM NOW() - COALESCE(o.delivered_at, o.completed_at, NOW())) as days_since_completion,
                u.full_name as customer_name, u.phone_number as customer_phone,
                g.garage_name,
                gp.payout_id, gp.payout_status, gp.net_amount as payout_amount,
                gp.sent_at as payout_sent_at, gp.confirmed_at as payout_confirmed_at
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
            WHERE o.order_id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            throw new Error(`Order ${orderId} not found`);
        }

        const order = result.rows[0];
        const daysSinceCompletion = parseFloat(order.days_since_completion) || 0;

        return {
            order,
            customer: {
                id: order.customer_id,
                name: order.customer_name,
                phone: order.customer_phone
            },
            payout: order.payout_id ? {
                payout_id: order.payout_id,
                status: order.payout_status,
                amount: order.payout_amount,
                sent_at: order.payout_sent_at,
                confirmed_at: order.payout_confirmed_at
            } : null,
            warrantyDaysRemaining: Math.max(0, WARRANTY_DAYS - daysSinceCompletion),
            isWithinWarranty: daysSinceCompletion <= WARRANTY_DAYS
        };
    }

    /**
     * REQUEST Refund (Support → Finance Approval Required)
     * 
     * CRITICAL: Support agents can ONLY REQUEST refunds.
     * The refund is NOT processed immediately - creates a pending
     * record that Finance team must approve.
     * 
     * Workflow:
     * 1. Support submits refund request → Creates 'pending' refund record
     * 2. Finance team sees it in their Pending Refunds queue
     * 3. Finance approves → Stripe refund executed, order marked 'refunded'
     * 4. Finance rejects → Request denied, order status unchanged
     */
    async executeFullRefund(params: {
        orderId: string;
        customerId: string;
        agentId: string;
        reason: string;
    }): Promise<ActionResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get context and validate
            const context = await this.getActionContextInternal(params.orderId, client);

            // Validate: Order must be paid to request a refund
            if (context.order.payment_status !== 'paid') {
                throw new Error(
                    `Cannot request refund: Order payment status is '${context.order.payment_status}'. ` +
                    `Only fully paid orders can be refunded.`
                );
            }

            // Validate: Order must be delivered/completed for post-delivery refunds
            const refundableStatuses = ['delivered', 'completed'];
            if (!refundableStatuses.includes(context.order.order_status)) {
                throw new Error(
                    `Cannot request refund: Order status is '${context.order.order_status}'. ` +
                    `For orders not yet delivered, use 'Cancel Order' instead.`
                );
            }

            // Validate warranty period
            if (!context.isWithinWarranty) {
                throw new Error(
                    `Order past ${WARRANTY_DAYS}-day warranty period. ` +
                    `Days since completion: ${Math.ceil(WARRANTY_DAYS - context.warrantyDaysRemaining)}. ` +
                    `Please escalate to operations manager.`
                );
            }

            // Check for payment intent (warn if missing but don't block - legacy orders may not have it)
            const paymentIntentId = context.order.final_payment_intent_id || context.order.deposit_intent_id;
            if (!paymentIntentId) {
                logger.warn('Order missing payment intent', { orderNumber: context.order.order_number });
            }

            // Check for existing pending refund request
            const existingRefund = await client.query(`
                SELECT refund_id, refund_status FROM refunds 
                WHERE order_id = $1 AND refund_status = 'pending'
            `, [params.orderId]);

            if (existingRefund.rows.length > 0) {
                throw new Error(
                    `A refund request is already pending for this order. ` +
                    `Please wait for Finance team to review.`
                );
            }

            // 2. Calculate refundable amount using BRAIN v3.0 stage-based fees
            const refundCalc = calculateRefundableAmount({
                orderStatus: context.order.order_status,
                paymentStatus: context.order.payment_status,
                totalAmount: parseFloat(context.order.total_amount),
                deliveryFee: parseFloat(context.order.delivery_fee || '0'),
                deliveredAt: context.order.delivered_at,
                isDefectiveItem: params.reason.toLowerCase().includes('defective'),
                isWrongItem: params.reason.toLowerCase().includes('wrong')
            });

            logger.info('BRAIN v3.0 Refund Calculation', {
                order: context.order.order_number,
                stage: refundCalc.stage,
                stageName: refundCalc.stageName,
                original: refundCalc.originalAmount,
                feePercentage: refundCalc.feePercentage,
                platformFee: refundCalc.platformFee,
                deliveryRetained: refundCalc.deliveryFeeRetained,
                refundable: refundCalc.refundableAmount
            });

            // Create PENDING refund request (Finance must approve)
            const idempotencyKey = `support_refund_req_${params.orderId}_${Date.now()}`;
            const refundResult = await client.query(`
                INSERT INTO refunds 
                (order_id, customer_id, original_amount, refund_amount, fee_retained, delivery_fee_retained,
                 refund_reason, refund_status, initiated_by, refund_type, idempotency_key, payment_intent_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'support', 'support_refund_request', $8, $9)
                RETURNING refund_id
            `, [
                params.orderId,
                params.customerId,
                refundCalc.originalAmount,
                refundCalc.refundableAmount, // Stage-adjusted amount
                refundCalc.platformFee,
                refundCalc.deliveryFeeRetained,
                `${params.reason} [Stage ${refundCalc.stage}: ${refundCalc.stageName}]`,
                idempotencyKey,
                paymentIntentId
            ]);

            const refundId = refundResult.rows[0]?.refund_id;

            // 3. DO NOT change order status to 'refunded' - Finance will do that
            // Only log the request in resolution logs

            // 4. Log resolution (as REQUEST, not completed action)
            await this.logResolution({
                orderId: params.orderId,
                customerId: params.customerId,
                agentId: params.agentId,
                actionType: 'refund_request',
                actionDetails: {
                    refund_id: refundId,
                    original_amount: refundCalc.originalAmount,
                    refundable_amount: refundCalc.refundableAmount,
                    stage: refundCalc.stage,
                    stage_name: refundCalc.stageName,
                    fee_percentage: refundCalc.feePercentage,
                    platform_fee: refundCalc.platformFee,
                    delivery_fee_retained: refundCalc.deliveryFeeRetained,
                    status: 'pending_finance_approval',
                    warranty_days_remaining: context.warrantyDaysRemaining
                },
                notes: params.reason
            }, client);

            await client.query('COMMIT');

            // Notify Finance team about pending refund request
            try {
                await createNotification({
                    userId: 'finance_team', // Special ID for team notifications
                    target_role: 'operations',
                    type: 'refund_request_pending',
                    title: 'New Refund Request',
                    message: `Order #${context.order.order_number}: ${refundCalc.refundableAmount.toFixed(2)} QAR refund requested. Reason: ${params.reason}`,
                    data: {
                        order_id: params.orderId,
                        order_number: context.order.order_number,
                        refund_id: refundId,
                        amount: refundCalc.refundableAmount,
                        stage: refundCalc.stage,
                        reason: params.reason
                    }
                });
                logger.info('Finance notification sent', { refundId });
            } catch (notifyErr) {
                logger.warn('Failed to notify Finance team', { error: (notifyErr as Error).message });
                // Don't fail the request if notification fails
            }

            // Build user-friendly message with breakdown
            let message = `Refund request submitted for order #${context.order.order_number}.\n`;
            if (refundCalc.feePercentage > 0 || refundCalc.deliveryFeeRetained > 0) {
                message += `\n📊 BRAIN v3.0 Stage ${refundCalc.stage} Fees Applied:\n`;
                message += `• Original Amount: ${refundCalc.originalAmount.toFixed(2)} QAR\n`;
                if (refundCalc.platformFee > 0) {
                    message += `• Platform Fee (${refundCalc.feePercentage}%): -${refundCalc.platformFee.toFixed(2)} QAR\n`;
                }
                if (refundCalc.deliveryFeeRetained > 0) {
                    message += `• Delivery Fee Retained: -${refundCalc.deliveryFeeRetained.toFixed(2)} QAR\n`;
                }
                message += `• Refundable Amount: ${refundCalc.refundableAmount.toFixed(2)} QAR\n`;
            } else {
                message += `\nAmount: ${refundCalc.refundableAmount.toFixed(2)} QAR (Full refund - defective/wrong part)\n`;
            }
            message += `\nAwaiting Finance team approval.`;

            logger.info('Refund request submitted', { orderNumber: context.order.order_number, amount: refundCalc.refundableAmount, stage: refundCalc.stage });

            return {
                success: true,
                action: 'refund_request',
                orderId: params.orderId,
                message,
                refundId,
                status: 'pending_finance_approval'
            };

        } catch (err: any) {
            await client.query('ROLLBACK');
            logger.error('Refund request error', { error: err.message });
            return {
                success: false,
                action: 'refund_request',
                orderId: params.orderId,
                message: 'Refund request failed',
                error: err.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Cancel Order (before delivery)
     * Can only cancel orders not yet delivered
     */
    async executeCancelOrder(params: {
        orderId: string;
        customerId: string;
        agentId: string;
        reason: string;
    }): Promise<ActionResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const context = await this.getActionContextInternal(params.orderId, client);

            // Validate cancellation is allowed
            if (!CANCELLABLE_STATUSES.includes(context.order.order_status)) {
                if (REFUNDABLE_STATUSES.includes(context.order.order_status)) {
                    throw new Error(
                        `Order already ${context.order.order_status}. Use "Full Refund" instead of cancel.`
                    );
                }
                throw new Error(
                    `Cannot cancel order with status "${context.order.order_status}"`
                );
            }

            let payoutAction: any = null;
            let refundAction: any = null;

            // Cancel any pending payout
            if (context.payout && ['pending', 'held', 'processing'].includes(context.payout.status)) {
                await client.query(`
                    UPDATE garage_payouts 
                    SET payout_status = 'cancelled',
                        cancellation_reason = $2,
                        cancelled_at = NOW(),
                        updated_at = NOW()
                    WHERE payout_id = $1
                `, [context.payout.payout_id, `Order cancelled: ${params.reason}`]);

                payoutAction = { action: 'cancelled', payout_id: context.payout.payout_id };
            }

            // Refund customer if they paid
            if (context.order.payment_status === 'paid') {
                refundAction = await this.processCustomerRefund(
                    context.order,
                    context.order.total_amount,
                    `Order cancelled: ${params.reason}`,
                    client
                );
            }

            // Cancel driver assignment if exists
            if (context.order.driver_id) {
                await client.query(`
                    UPDATE delivery_assignments 
                    SET status = 'cancelled', 
                        cancellation_reason = $2,
                        updated_at = NOW()
                    WHERE order_id = $1 AND status NOT IN ('delivered', 'cancelled')
                `, [params.orderId, params.reason]);
            }

            // Update order status
            await client.query(`
                UPDATE orders SET 
                    order_status = 'cancelled_by_ops',
                    updated_at = NOW()
                WHERE order_id = $1
            `, [params.orderId]);

            // Record history
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by, changed_by_type, reason)
                VALUES ($1, $2, 'cancelled_by_ops', $3, 'support', $4)
            `, [params.orderId, context.order.order_status, params.agentId, params.reason]);

            // Log resolution
            await this.logResolution({
                orderId: params.orderId,
                customerId: params.customerId,
                agentId: params.agentId,
                actionType: 'cancel_order',
                actionDetails: { payout_action: payoutAction, refund_action: refundAction },
                notes: params.reason
            }, client);

            // Notify garage
            await this.notifyGarageCancellation(context, params.reason);

            await client.query('COMMIT');

            return {
                success: true,
                action: 'cancel_order',
                orderId: params.orderId,
                message: `Order ${context.order.order_number} cancelled`,
                payoutAction,
                refundAction
            };

        } catch (err: any) {
            await client.query('ROLLBACK');
            logger.error('Cancel order error', { error: err.message });
            return {
                success: false,
                action: 'cancel_order',
                orderId: params.orderId,
                message: 'Cancellation failed',
                error: err.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Reassign Driver
     * Clears current driver so operations can assign a new one
     */
    async executeReassignDriver(params: {
        orderId: string;
        customerId: string;
        agentId: string;
        reason: string;
    }): Promise<ActionResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const context = await this.getActionContextInternal(params.orderId, client);

            if (!context.order.driver_id) {
                throw new Error('No driver assigned to this order');
            }

            // Cancel current assignment
            await client.query(`
                UPDATE delivery_assignments 
                SET status = 'reassignment_pending', 
                    reassignment_reason = $2,
                    updated_at = NOW()
                WHERE order_id = $1 AND status NOT IN ('delivered', 'cancelled')
            `, [params.orderId, params.reason]);

            // Clear driver from order
            await client.query(`
                UPDATE orders SET 
                    driver_id = NULL,
                    updated_at = NOW()
                WHERE order_id = $1
            `, [params.orderId]);

            // Log
            await this.logResolution({
                orderId: params.orderId,
                customerId: params.customerId,
                agentId: params.agentId,
                actionType: 'reassign_driver',
                actionDetails: { previous_driver_id: context.order.driver_id },
                notes: params.reason
            }, client);

            // Notify ops team via socket
            const io = getIO();
            if (io) {
                io.to('operations').emit('driver_reassignment_needed', {
                    order_id: params.orderId,
                    order_number: context.order.order_number,
                    reason: params.reason,
                    requested_by: 'support'
                });
            }

            await client.query('COMMIT');

            return {
                success: true,
                action: 'reassign_driver',
                orderId: params.orderId,
                message: `Driver reassignment requested for order ${context.order.order_number}. Operations team notified.`
            };

        } catch (err: any) {
            await client.query('ROLLBACK');
            return {
                success: false,
                action: 'reassign_driver',
                orderId: params.orderId,
                message: 'Reassignment failed',
                error: err.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Escalate to Operations
     * Creates a visible item in ops dashboard
     */
    async executeEscalateToOps(params: {
        orderId: string;
        customerId: string;
        agentId: string;
        reason: string;
        ticketId?: string;
        priority?: 'normal' | 'high' | 'urgent';
    }): Promise<ActionResult> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const context = await this.getActionContextInternal(params.orderId, client);

            // Create escalation record with optional ticket link
            await client.query(`
                INSERT INTO support_escalations 
                (order_id, customer_id, escalated_by, reason, priority, status, ticket_id)
                VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            `, [
                params.orderId,
                params.customerId,
                params.agentId,
                params.reason,
                params.priority || 'normal',
                params.ticketId || null
            ]);

            // Log
            await this.logResolution({
                orderId: params.orderId,
                customerId: params.customerId,
                agentId: params.agentId,
                actionType: 'escalate_to_ops',
                actionDetails: { priority: params.priority || 'normal' },
                notes: params.reason
            }, client);

            // Notify ops via socket
            const io = getIO();
            if (io) {
                io.to('operations').emit('support_escalation', {
                    order_id: params.orderId,
                    order_number: context.order.order_number,
                    reason: params.reason,
                    priority: params.priority || 'normal',
                    customer_name: context.customer.name,
                    escalated_by: 'support'
                });
            }

            await client.query('COMMIT');

            return {
                success: true,
                action: 'escalate_to_ops',
                orderId: params.orderId,
                message: `Order ${context.order.order_number} escalated to operations team`
            };

        } catch (err: any) {
            await client.query('ROLLBACK');
            return {
                success: false,
                action: 'escalate_to_ops',
                orderId: params.orderId,
                message: 'Escalation failed',
                error: err.message
            };
        } finally {
            client.release();
        }
    }

    // ============================================
    // Private Helpers
    // ============================================

    private async getActionContextInternal(orderId: string, client: PoolClient): Promise<ActionContext> {
        const result = await client.query(`
            SELECT 
                o.order_id, o.order_number, o.order_status, o.payment_status,
                o.total_amount, o.part_price, o.delivery_fee, o.platform_fee,
                o.garage_payout_amount, o.customer_id, o.garage_id, o.driver_id,
                o.completed_at, o.delivered_at, o.created_at,
                o.deposit_intent_id, o.final_payment_intent_id,
                EXTRACT(DAY FROM NOW() - COALESCE(o.delivered_at, o.completed_at, NOW())) as days_since_completion,
                u.full_name as customer_name, u.phone_number as customer_phone,
                g.garage_name,
                gp.payout_id, gp.payout_status, gp.net_amount as payout_amount,
                gp.sent_at as payout_sent_at, gp.confirmed_at as payout_confirmed_at
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            LEFT JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
            WHERE o.order_id = $1
            FOR UPDATE OF o
        `, [orderId]);

        if (result.rows.length === 0) {
            throw new Error(`Order ${orderId} not found`);
        }

        const order = result.rows[0];
        const daysSinceCompletion = parseFloat(order.days_since_completion) || 0;

        return {
            order,
            customer: {
                id: order.customer_id,
                name: order.customer_name,
                phone: order.customer_phone
            },
            payout: order.payout_id ? {
                payout_id: order.payout_id,
                status: order.payout_status,
                amount: order.payout_amount,
                sent_at: order.payout_sent_at,
                confirmed_at: order.payout_confirmed_at
            } : null,
            warrantyDaysRemaining: Math.max(0, WARRANTY_DAYS - daysSinceCompletion),
            isWithinWarranty: daysSinceCompletion <= WARRANTY_DAYS
        };
    }

    private async handlePayoutForRefund(
        payout: any,
        garageId: string,
        reason: string,
        client: PoolClient
    ): Promise<{ action: string; payout_id: string; reversal_id?: string }> {

        const cancellableStatuses = ['pending', 'held', 'processing', 'awaiting_confirmation'];

        if (cancellableStatuses.includes(payout.status)) {
            // Cancel the payout
            await client.query(`
                UPDATE garage_payouts 
                SET payout_status = 'cancelled',
                    cancellation_reason = $2,
                    cancelled_at = NOW(),
                    updated_at = NOW()
                WHERE payout_id = $1
            `, [payout.payout_id, `Refund: ${reason}`]);

            logger.info('Cancelled payout', { payoutId: payout.payout_id });
            return { action: 'cancelled', payout_id: payout.payout_id };

        } else if (payout.status === 'confirmed' || payout.status === 'completed') {
            // Payout already sent - create a reversal
            const reversalResult = await client.query(`
                INSERT INTO payout_reversals 
                (garage_id, original_payout_id, amount, reason, status)
                VALUES ($1, $2, $3, $4, 'pending')
                RETURNING reversal_id
            `, [garageId, payout.payout_id, payout.amount, `Refund: ${reason}`]);

            const reversalId = reversalResult.rows[0].reversal_id;
            logger.info('Created reversal for payout', { payoutId: payout.payout_id });

            // Notify garage about the pending deduction
            try {
                await createNotification({
                    userId: garageId,
                    type: 'payout_reversal',
                    title: '⚠️ Payout Deduction Pending',
                    message: `${payout.amount} QAR will be deducted from your next payout. Reason: ${reason}`,
                    data: { reversal_id: reversalId, original_payout_id: payout.payout_id, amount: payout.amount },
                    target_role: 'garage'
                });

                // Socket.IO notification to garage portal
                const io = getIO();
                if (io) {
                    io.to(`garage_${garageId}`).emit('payout_reversal', {
                        reversal_id: reversalId,
                        amount: payout.amount,
                        reason: reason,
                        type: 'deduction_pending'
                    });
                }
            } catch (notifyErr) {
                logger.error('Failed to notify garage about reversal', { error: (notifyErr as Error).message });
            }

            return {
                action: 'reversal_created',
                payout_id: payout.payout_id,
                reversal_id: reversalId
            };
        }

        return { action: 'no_action', payout_id: payout.payout_id };
    }

    private async processCustomerRefund(
        order: any,
        amount: number,
        reason: string,
        client: PoolClient
    ): Promise<{ refund_id: string; amount: number; stripe_refund_id?: string }> {
        // G-02 FIX: Generate idempotency key for this refund
        const idempotencyKey = `support_refund_${order.order_id}_${Date.now()}`;

        // Record the refund in our database using the same schema as RefundService
        const refundResult = await client.query(`
            INSERT INTO refunds 
            (order_id, customer_id, original_amount, refund_amount, refund_reason, 
             refund_status, initiated_by, refund_type, idempotency_key)
            VALUES ($1, $2, $3, $4, $5, 'pending', 'support', 'support_refund', $6)
            ON CONFLICT (order_id, refund_type) DO NOTHING
            RETURNING refund_id
        `, [order.order_id, order.customer_id, order.total_amount, amount, reason, idempotencyKey]);

        // Handle duplicate refund attempt
        if (refundResult.rows.length === 0) {
            throw new Error(`Refund already exists for order ${order.order_number}. Cannot process duplicate.`);
        }

        const refundId = refundResult.rows[0].refund_id;
        let stripeRefundId: string | undefined;

        // G-02 FIX: Execute actual Stripe refund
        const paymentIntentId = order.final_payment_intent_id || order.deposit_intent_id;

        if (paymentIntentId && order.payment_status === 'paid') {
            try {
                const Stripe = require('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                    apiVersion: '2025-12-15.clover'
                });

                const stripeRefund = await stripe.refunds.create({
                    payment_intent: paymentIntentId,
                    amount: Math.round(amount * 100), // cents
                    metadata: {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        reason: 'support_refund',
                        refund_id: refundId
                    }
                }, {
                    idempotencyKey: idempotencyKey // G-04 FIX: Stripe-level idempotency
                });

                stripeRefundId = stripeRefund.id;
                logger.info('Stripe refund executed', { stripeRefundId, amount });

                // Mark refund as completed
                await client.query(`
                    UPDATE refunds SET 
                        refund_status = 'completed',
                        stripe_refund_id = $2,
                        processed_at = NOW()
                    WHERE refund_id = $1
                `, [refundId, stripeRefundId]);

                // Update order payment status
                await client.query(`
                    UPDATE orders SET payment_status = 'refunded', updated_at = NOW() WHERE order_id = $1
                `, [order.order_id]);

            } catch (stripeError: any) {
                logger.error('Stripe refund failed', { orderNumber: order.order_number, error: stripeError.message });

                // Mark refund as failed but don't throw - let transaction complete
                await client.query(`
                    UPDATE refunds SET 
                        refund_status = 'failed',
                        refund_reason = refund_reason || ' [Stripe Error: ' || $2 || ']'
                    WHERE refund_id = $1
                `, [refundId, stripeError.message]);

                // Still mark order as needing attention
                await client.query(`
                    UPDATE orders SET payment_status = 'refund_failed', updated_at = NOW() WHERE order_id = $1
                `, [order.order_id]);
            }
        } else {
            // No payment intent - mark for manual processing
            logger.warn('No payment intent found - manual processing required', { orderNumber: order.order_number });

            await client.query(`
                UPDATE refunds SET 
                    refund_status = 'pending',
                    refund_reason = refund_reason || ' [Manual processing required - no payment intent]'
                WHERE refund_id = $1
            `, [refundId]);
        }

        return {
            refund_id: refundId,
            amount,
            stripe_refund_id: stripeRefundId
        };
    }

    private async logResolution(params: {
        orderId: string | null;
        customerId: string;
        agentId: string;
        actionType: string;
        actionDetails: any;
        notes: string;
    }, client: PoolClient): Promise<void> {
        await client.query(`
            INSERT INTO resolution_logs 
            (order_id, customer_id, agent_id, action_type, action_details, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            params.orderId,
            params.customerId,
            params.agentId,
            params.actionType,
            JSON.stringify(params.actionDetails),
            params.notes
        ]);
    }

    private async notifyRefund(context: ActionContext, reason: string): Promise<void> {
        const io = getIO();

        // Notify customer
        try {
            await createNotification({
                userId: context.customer.id,
                title: 'Refund Processed',
                message: `Your refund of ${context.order.total_amount} QAR for order ${context.order.order_number} has been processed.`,
                type: 'refund',
                data: { order_id: context.order.order_id },
                target_role: 'customer'
            });
        } catch (e) {
            logger.error('Failed to notify customer', { error: (e as Error).message });
        }

        // Notify garage via socket
        if (io && context.order.garage_id) {
            io.to(`garage_${context.order.garage_id}`).emit('order_refunded', {
                order_id: context.order.order_id,
                order_number: context.order.order_number,
                reason
            });
        }
    }

    private async notifyGarageCancellation(context: ActionContext, reason: string): Promise<void> {
        const io = getIO();

        if (io && context.order.garage_id) {
            io.to(`garage_${context.order.garage_id}`).emit('order_cancelled', {
                order_id: context.order.order_id,
                order_number: context.order.order_number,
                reason,
                cancelled_by: 'support'
            });
        }
    }
}
