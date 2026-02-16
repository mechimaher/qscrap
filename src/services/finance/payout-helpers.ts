/**
 * Payout Helpers - Shared utilities for payout operations
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import { createNotification } from '../notification.service';
import { emitToGarage, emitToOperations } from '../../utils/socketIO';
import {
    Payout,
    SendPaymentDto,
    ConfirmPaymentDto,
    DisputeDto,
    PayoutStatus
} from './types';
import {
    PayoutNotFoundError,
    InvalidPayoutStatusError
} from './errors';

export class PayoutHelpers {
    constructor(private pool: Pool) { }

    async getPayoutForUpdate(payoutId: string, client: PoolClient): Promise<Payout> {
        const result = await client.query(
            `SELECT gp.*, g.garage_name, o.order_number
             FROM garage_payouts gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN orders o ON gp.order_id = o.order_id
             WHERE gp.payout_id = $1
             FOR UPDATE OF gp`,
            [payoutId]
        );

        if (result.rows.length === 0) {
            throw new PayoutNotFoundError(payoutId);
        }

        return result.rows[0];
    }

    validatePayoutStatus(payout: Payout, requiredStatuses: PayoutStatus[]): void {
        if (!requiredStatuses.includes(payout.payout_status)) {
            throw new InvalidPayoutStatusError(
                payout.payout_id,
                payout.payout_status,
                requiredStatuses
            );
        }
    }

    async markAsSent(
        payout: Payout,
        details: SendPaymentDto,
        client: PoolClient
    ): Promise<Payout> {
        const result = await client.query(
            `UPDATE garage_payouts 
             SET payout_status = 'awaiting_confirmation',
                 payout_method = $1,
                 payout_reference = $2,
                 sent_at = COALESCE($3, NOW()),
                 notes = $4,
                 updated_at = NOW()
             WHERE payout_id = $5
             RETURNING *`,
            [
                details.payout_method,
                details.payout_reference,
                details.sent_at,
                details.notes,
                payout.payout_id
            ]
        );

        return result.rows[0];
    }

    async markAsConfirmed(
        payout: Payout,
        details: ConfirmPaymentDto,
        client: PoolClient
    ): Promise<Payout> {
        const result = await client.query(
            `UPDATE garage_payouts 
             SET payout_status = 'confirmed',
                 confirmed_at = COALESCE($1, NOW()),
                 received_amount = $2,
                 confirmation_notes = $3,
                 updated_at = NOW()
             WHERE payout_id = $4
             RETURNING *`,
            [
                details.received_at,
                details.received_amount,
                details.confirmation_notes,
                payout.payout_id
            ]
        );

        return result.rows[0];
    }

    async markAsDisputed(
        payout: Payout,
        dispute: DisputeDto,
        client: PoolClient
    ): Promise<Payout> {
        const result = await client.query(
            `UPDATE garage_payouts 
             SET payout_status = 'disputed',
                 dispute_reason = $1,
                 dispute_description = $2,
                 disputed_at = NOW(),
                 updated_at = NOW()
             WHERE payout_id = $3
             RETURNING *`,
            [
                dispute.issue_type,
                dispute.issue_description,
                payout.payout_id
            ]
        );

        return result.rows[0];
    }

    async markAsCancelled(
        payout: Payout,
        reason: string,
        client: PoolClient
    ): Promise<Payout> {
        const result = await client.query(
            `UPDATE garage_payouts 
             SET payout_status = 'cancelled',
                 cancellation_reason = $1,
                 cancelled_at = NOW(),
                 updated_at = NOW()
             WHERE payout_id = $2
             RETURNING *`,
            [reason, payout.payout_id]
        );

        return result.rows[0];
    }

    async createPaymentNotification(payout: Payout, type: string): Promise<void> {
        const notificationMap = {
            sent: {
                title: 'Payment Sent 💰',
                message: `Payment of ${payout.net_amount} QAR sent via ${payout.payout_method}. Please confirm receipt within 7 days.`,
                target: payout.garage_id,
                event: 'payment_sent'
            },
            confirmed: {
                title: 'Payment Confirmed ✅',
                message: `Garage confirmed receipt of ${payout.net_amount} QAR`,
                target: 'operations',
                event: 'payment_confirmed'
            },
            disputed: {
                title: 'Payment Disputed ⚠️',
                message: `Garage reported issue with payout ${payout.payout_id}`,
                target: 'operations',
                event: 'payment_disputed'
            },
            dispute_resolved: {
                title: 'Dispute Resolved',
                message: `Payout dispute has been resolved`,
                target: payout.garage_id,
                event: 'dispute_resolved'
            }
        };

        const config = notificationMap[type as keyof typeof notificationMap];
        if (!config) {return;}

        if (config.target === 'operations') {
            emitToOperations(config.event, { payout_id: payout.payout_id, payout });
        } else {
            emitToGarage(config.target, config.event, { payout_id: payout.payout_id, payout });
            await createNotification({
                userId: config.target,
                type: config.event,
                title: config.title,
                message: config.message,
                data: { payout_id: payout.payout_id },
                target_role: 'garage'
            });
        }
    }

    async verifyGaragePassword(garageId: string, password: string): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT u.password_hash 
             FROM users u 
             JOIN garages g ON u.user_id = g.owner_id
             WHERE g.garage_id = $1`,
            [garageId]
        );

        if (result.rows.length === 0) {return false;}
        return bcrypt.compare(password, result.rows[0].password_hash);
    }
}
