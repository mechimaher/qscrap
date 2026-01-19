/**
 * Escrow Service
 * Manages payment escrow for buyer protection
 * Holds funds until buyer confirmation or inspection window expires
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface EscrowTransaction {
    escrow_id: string;
    order_id: string;
    customer_id: string;
    seller_id: string;
    amount: number;
    platform_fee: number;
    seller_payout: number;
    delivery_fee: number;
    status: 'held' | 'released' | 'refunded' | 'disputed' | 'partial_release';
    inspection_window_hours: number;
    inspection_expires_at: Date;
    buyer_confirmed_at?: Date;
    released_at?: Date;
    dispute_raised_at?: Date;
    created_at: Date;
}

export interface ProofOfCondition {
    proof_id: string;
    escrow_id: string;
    order_id: string;
    capture_type: 'pickup_from_garage' | 'delivery_handoff' | 'customer_inspection' | 'dispute_evidence';
    image_urls: string[];
    video_url?: string;
    captured_by: string;
    captured_at: Date;
    location_lat?: number;
    location_lng?: number;
    hash_signature?: string;
    notes?: string;
}

export class EscrowService {
    constructor(private pool: Pool) { }

    /**
     * Create escrow for an order
     */
    async createEscrow(params: {
        orderId: string;
        customerId: string;
        sellerId: string;
        amount: number;
        platformFeePercent?: number;
        deliveryFee?: number;
        inspectionWindowHours?: number;
    }): Promise<EscrowTransaction> {
        const {
            orderId,
            customerId,
            sellerId,
            amount,
            platformFeePercent = 15,
            deliveryFee = 0,
            inspectionWindowHours = 48
        } = params;

        const platformFee = amount * (platformFeePercent / 100);
        const sellerPayout = amount - platformFee;

        const result = await this.pool.query(`
            INSERT INTO escrow_transactions (
                order_id, customer_id, seller_id, amount, platform_fee,
                seller_payout, delivery_fee, inspection_window_hours
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [orderId, customerId, sellerId, amount, platformFee, sellerPayout, deliveryFee, inspectionWindowHours]);

        logger.info('[Escrow] Created escrow', {
            escrow_id: result.rows[0].escrow_id,
            order_id: orderId,
            amount,
            expires_at: result.rows[0].inspection_expires_at
        });

        return result.rows[0];
    }

    /**
     * Get escrow by order ID
     */
    async getEscrowByOrder(orderId: string): Promise<EscrowTransaction | null> {
        const result = await this.pool.query(
            'SELECT * FROM escrow_transactions WHERE order_id = $1',
            [orderId]
        );
        return result.rows[0] || null;
    }

    /**
     * Buyer confirms receipt and satisfaction
     */
    async buyerConfirm(escrowId: string, userId: string): Promise<EscrowTransaction> {
        const result = await this.pool.query(`
            UPDATE escrow_transactions
            SET 
                status = 'released',
                buyer_confirmed_at = NOW(),
                released_at = NOW(),
                released_by = $2,
                release_reason = 'buyer_confirmation',
                updated_at = NOW()
            WHERE escrow_id = $1 AND status = 'held'
            RETURNING *
        `, [escrowId, userId]);

        if (result.rows.length === 0) {
            throw new Error('Escrow not found or not in held status');
        }

        const escrow = result.rows[0];

        logger.info('[Escrow] Buyer confirmed, funds released', {
            escrow_id: escrowId,
            released_at: escrow.released_at
        });

        // 🔥 NEW: Notify customer of escrow release
        const { createNotification } = await import('./notification.service');
        await createNotification({
            userId: escrow.customer_id,
            type: 'escrow_released',
            title: '💰 Payment Released',
            message: `QAR ${escrow.seller_payout} released to garage. Transaction complete!`,
            data: { escrow_id: escrowId, order_id: escrow.order_id, amount: escrow.seller_payout },
            target_role: 'customer'
        });

        return escrow;
    }

    /**
     * Raise a dispute
     */
    async raiseDispute(escrowId: string, userId: string, reason: string): Promise<EscrowTransaction> {
        const result = await this.pool.query(`
            UPDATE escrow_transactions
            SET 
                status = 'disputed',
                dispute_raised_at = NOW(),
                dispute_reason = $2,
                updated_at = NOW()
            WHERE escrow_id = $1 AND status = 'held' AND customer_id = $3
            RETURNING *
        `, [escrowId, reason, userId]);

        if (result.rows.length === 0) {
            throw new Error('Escrow not found, not in held status, or user not authorized');
        }

        logger.info('[Escrow] Dispute raised', {
            escrow_id: escrowId,
            reason
        });

        return result.rows[0];
    }

    /**
     * Resolve dispute (admin only)
     */
    async resolveDispute(
        escrowId: string,
        resolution: 'refund_buyer' | 'release_seller' | 'split',
        adminId: string,
        notes: string,
        splitPercent: number = 50
    ): Promise<EscrowTransaction> {
        let status: string;
        let sellerAmount: number | null = null;

        const escrow = await this.pool.query(
            'SELECT * FROM escrow_transactions WHERE escrow_id = $1',
            [escrowId]
        );

        if (escrow.rows.length === 0) {
            throw new Error('Escrow not found');
        }

        switch (resolution) {
            case 'refund_buyer':
                status = 'refunded';
                break;
            case 'release_seller':
                status = 'released';
                break;
            case 'split':
                status = 'partial_release';
                sellerAmount = escrow.rows[0].seller_payout * (splitPercent / 100);
                break;
            default:
                throw new Error('Invalid resolution type');
        }

        const result = await this.pool.query(`
            UPDATE escrow_transactions
            SET 
                status = $2,
                dispute_resolved_at = NOW(),
                dispute_resolution = $3,
                released_at = NOW(),
                released_by = $4,
                updated_at = NOW()
            WHERE escrow_id = $1
            RETURNING *
        `, [escrowId, status, notes, adminId]);

        logger.info('[Escrow] Dispute resolved', {
            escrow_id: escrowId,
            resolution,
            notes
        });

        return result.rows[0];
    }

    /**
     * Add proof of condition
     */
    async addProofOfCondition(params: {
        escrowId: string;
        orderId: string;
        captureType: ProofOfCondition['capture_type'];
        imageUrls: string[];
        videoUrl?: string;
        capturedBy: string;
        locationLat?: number;
        locationLng?: number;
        notes?: string;
    }): Promise<ProofOfCondition> {
        const result = await this.pool.query(`
            INSERT INTO proof_of_condition (
                escrow_id, order_id, capture_type, image_urls, video_url,
                captured_by, location_lat, location_lng, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            params.escrowId,
            params.orderId,
            params.captureType,
            params.imageUrls,
            params.videoUrl,
            params.capturedBy,
            params.locationLat,
            params.locationLng,
            params.notes
        ]);

        logger.info('[Escrow] Proof of condition captured', {
            proof_id: result.rows[0].proof_id,
            escrow_id: params.escrowId,
            type: params.captureType
        });

        return result.rows[0];
    }

    /**
     * Get proofs for escrow
     */
    async getProofsForEscrow(escrowId: string): Promise<ProofOfCondition[]> {
        const result = await this.pool.query(
            'SELECT * FROM proof_of_condition WHERE escrow_id = $1 ORDER BY captured_at',
            [escrowId]
        );
        return result.rows;
    }

    /**
     * Auto-release expired escrows (called by cron job)
     */
    async autoReleaseExpired(): Promise<number> {
        const result = await this.pool.query('SELECT auto_release_expired_escrow()');
        const count = result.rows[0].auto_release_expired_escrow;

        if (count > 0) {
            logger.info('[Escrow] Auto-released expired escrows', { count });
        }

        return count;
    }

    /**
     * Get pending escrows for customer (for dashboard)
     */
    async getPendingEscrowsForCustomer(customerId: string): Promise<EscrowTransaction[]> {
        const result = await this.pool.query(`
            SELECT e.*, o.order_number, o.total_amount
            FROM escrow_transactions e
            JOIN orders o ON e.order_id = o.order_id
            WHERE e.customer_id = $1 AND e.status = 'held'
            ORDER BY e.created_at DESC
        `, [customerId]);
        return result.rows;
    }

    /**
     * Get escrow statistics
     */
    async getStats(): Promise<{
        total_held: number;
        total_released: number;
        total_disputes: number;
        avg_release_time_hours: number;
    }> {
        const result = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'held') as total_held,
                COUNT(*) FILTER (WHERE status = 'released') as total_released,
                COUNT(*) FILTER (WHERE status = 'disputed') as total_disputes,
                COALESCE(
                    AVG(EXTRACT(EPOCH FROM (released_at - created_at)) / 3600) 
                    FILTER (WHERE released_at IS NOT NULL),
                    0
                ) as avg_release_time_hours
            FROM escrow_transactions
        `);
        return result.rows[0];
    }
}
