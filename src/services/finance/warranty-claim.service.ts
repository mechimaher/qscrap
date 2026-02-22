import { Pool, PoolClient } from 'pg';
import {
    WarrantyClaim,
    WarrantyClaimListItem,
    WarrantyClaimStatus,
    ApproveWarrantyClaimDto,
    RejectWarrantyClaimDto
} from './types';
import {
    WarrantyClaimNotFoundError,
    InvalidWarrantyClaimStatusError,
    OrderNotFoundError
} from './errors';
import { RefundService } from './refund.service';
import logger from '../../utils/logger';

export class WarrantyClaimService {
    private refundService: RefundService;

    constructor(private pool: Pool) {
        this.refundService = new RefundService(pool);
    }

    /**
     * Get pending warranty claims
     */
    async getPendingClaims(): Promise<WarrantyClaimListItem[]> {
        const result = await this.pool.query(`
            SELECT 
                wc.claim_id,
                wc.order_id,
                wc.customer_id,
                o.garage_id,
                wc.defect_description,
                wc.claim_status,
                wc.evidence_urls,
                wc.created_at,
                o.order_number,
                u.full_name as customer_name,
                g.garage_name
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN users u ON u.user_id = wc.customer_id
            INNER JOIN garages g ON g.garage_id = o.garage_id
            WHERE wc.claim_status = 'pending_finance_review'
            ORDER BY wc.created_at DESC
        `);

        return result.rows as unknown as WarrantyClaimListItem[];
    }

    /**
     * Get claim history (approved/rejected)
     */
    async getClaimHistory(limit = 50, offset = 0): Promise<WarrantyClaimListItem[]> {
        const result = await this.pool.query(`
            SELECT 
                wc.claim_id,
                wc.order_id,
                wc.customer_id,
                o.garage_id,
                wc.defect_description,
                wc.claim_status,
                wc.evidence_urls,
                wc.created_at,
                wc.resolved_at,
                o.order_number,
                u.full_name as customer_name,
                g.garage_name
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN users u ON u.user_id = wc.customer_id
            INNER JOIN garages g ON g.garage_id = o.garage_id
            WHERE wc.claim_status != 'pending_finance_review'
            ORDER BY wc.resolved_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return result.rows as unknown as WarrantyClaimListItem[];
    }

    /**
     * Get a single warranty claim by ID
     */
    async getClaimById(claimId: string): Promise<WarrantyClaimListItem> {
        const result = await this.pool.query(`
            SELECT 
                wc.claim_id,
                wc.order_id,
                wc.customer_id,
                o.garage_id,
                wc.defect_description,
                wc.claim_status,
                wc.evidence_urls,
                wc.created_at,
                o.order_number,
                u.full_name as customer_name,
                g.garage_name
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN users u ON u.user_id = wc.customer_id
            INNER JOIN garages g ON g.garage_id = o.garage_id
            WHERE wc.claim_id = $1
        `, [claimId]);

        if (result.rows.length === 0) {
            throw new WarrantyClaimNotFoundError(claimId);
        }

        return result.rows[0] as unknown as WarrantyClaimListItem;
    }

    /**
     * Approve a warranty claim
     * This will change the claim status and potentially trigger a refund
     */
    async approveClaim(claimId: string, dto: ApproveWarrantyClaimDto, adminUserId: string): Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get claim details with lock
            const claimResult = await client.query(`
                SELECT * FROM warranty_claims
                WHERE claim_id = $1
                FOR UPDATE
            `, [claimId]);

            if (claimResult.rows.length === 0) {
                throw new WarrantyClaimNotFoundError(claimId);
            }

            const claim = claimResult.rows[0];

            if (claim.claim_status !== 'pending_finance_review') {
                throw new InvalidWarrantyClaimStatusError(claimId, claim.claim_status, 'pending_finance_review');
            }

            // 2. Update claim status
            await client.query(`
                UPDATE warranty_claims
                SET 
                    claim_status = 'approved',
                    resolved_at = NOW(),
                    resolved_by = $2,
                    resolution_notes = $3,
                    refund_amount = $4,
                    resolution_type = 'refund'
                WHERE claim_id = $1
            `, [claimId, adminUserId, dto.resolution_notes || dto.admin_notes, dto.refund_amount_override || claim.refund_amount]);

            // 3. Fetch order details to check total amount
            const orderResult = await client.query(`
                SELECT order_id, total_amount, order_status FROM orders
                WHERE order_id = $1
            `, [claim.order_id]);

            if (orderResult.rows.length === 0) {
                throw new OrderNotFoundError(claim.order_id);
            }

            const order = orderResult.rows[0];

            // 4. Trigger refund via RefundService
            // Note: Warranty claims usually mean the part is faulty, so full refund is typical
            const refundAmount = dto.refund_amount_override || order.total_amount;

            await this.refundService.createRefund({
                order_id: claim.order_id,
                refund_amount: refundAmount,
                refund_reason: `Warranty Claim Approved: ${claim.defect_description}`,
                initiated_by: adminUserId,
                refund_type: 'wrong_part' // Closest matching type for faulty part
            });

            await client.query('COMMIT');

            logger.info(`[WarrantyClaimService] Approved claim ${claimId} and created refund for order ${claim.order_id}`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a warranty claim
     */
    async rejectClaim(claimId: string, dto: RejectWarrantyClaimDto, adminUserId: string): Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get claim details with lock
            const claimResult = await client.query(`
                SELECT * FROM warranty_claims
                WHERE claim_id = $1
                FOR UPDATE
            `, [claimId]);

            if (claimResult.rows.length === 0) {
                throw new WarrantyClaimNotFoundError(claimId);
            }

            const claim = claimResult.rows[0];

            if (claim.claim_status !== 'pending_finance_review') {
                throw new InvalidWarrantyClaimStatusError(claimId, claim.claim_status, 'pending_finance_review');
            }

            // 2. Update claim status
            await client.query(`
                UPDATE warranty_claims
                SET 
                    claim_status = 'rejected',
                    resolved_at = NOW(),
                    resolved_by = $3,
                    resolution_notes = $2
                WHERE claim_id = $1
            `, [claimId, dto.rejection_reason, adminUserId]);

            await client.query('COMMIT');

            logger.info(`[WarrantyClaimService] Rejected claim ${claimId}. Reason: ${dto.rejection_reason}`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get warranty claims for a specific customer (for Customer 360)
     */
    async getClaimsByCustomer(customerId: string): Promise<WarrantyClaimListItem[]> {
        const result = await this.pool.query(`
            SELECT 
                wc.claim_id,
                wc.order_id,
                wc.customer_id,
                o.garage_id,
                wc.defect_description,
                wc.claim_status,
                wc.evidence_urls,
                wc.created_at,
                o.order_number,
                g.garage_name
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN garages g ON g.garage_id = o.garage_id
            WHERE wc.customer_id = $1
            ORDER BY wc.created_at DESC
        `, [customerId]);

        return result.rows as unknown as WarrantyClaimListItem[];
    }
}
