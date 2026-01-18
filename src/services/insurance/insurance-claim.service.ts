/**
 * Insurance Claim Service
 * Handles claim creation, approval workflow, and tracking
 */
import { Pool, PoolClient } from 'pg';
import { CreateClaimParams, GarageClaimSubmission } from './types';
import { ClaimNotFoundError } from './errors';

export class InsuranceClaimService {
    constructor(private readPool: Pool, private writePool: Pool) { }

    /**
     * Create a new insurance claim (Agent)
     */
    async createClaim(params: CreateClaimParams): Promise<{ claim_id: string }> {
        const client = await this.writePool.connect();
        try {
            const {
                agentId,
                companyId,
                claimReferenceNumber,
                policyNumber,
                vinNumber,
                customerName,
                vehicleMake,
                vehicleModel,
                vehicleYear,
                partName,
                notes
            } = params;

            await client.query('BEGIN');

            // Create claim record
            const claimResult = await client.query(`
                INSERT INTO insurance_claims (
                    company_id, agent_id, claim_reference_number, policy_number,
                    vin_number, car_make, car_model, car_year,
                    customer_name, vehicle_make, vehicle_model, vehicle_year,
                    part_name, notes, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
                RETURNING claim_id
            `, [
                companyId, agentId, claimReferenceNumber || `CLM-${Date.now()}`, policyNumber,
                vinNumber, vehicleMake, vehicleModel, vehicleYear,
                customerName, vehicleMake, vehicleModel, vehicleYear,
                partName, notes
            ]);

            const claimId = claimResult.rows[0].claim_id;

            // Auto-create part request if part_name is provided
            if (partName) {
                const reqResult = await client.query(`
                    INSERT INTO part_requests (
                        customer_id, car_make, car_model, car_year, vin_number,
                        part_description, status, priority
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'active', 'high')
                    RETURNING request_id
                `, [agentId, vehicleMake, vehicleModel, vehicleYear, vinNumber || null,
                    `Insurance Claim: ${partName}${notes ? ' - ' + notes : ''}`]);

                const requestId = reqResult.rows[0].request_id;

                // Link request to claim
                await client.query(
                    'UPDATE insurance_claims SET part_request_id = $1, status = $2 WHERE claim_id = $3',
                    [requestId, 'processing', claimId]
                );
            }

            await client.query('COMMIT');
            return { claim_id: claimId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get my claims (agent/company)
     */
    async getMyClaims(agentId: string): Promise<any[]> {
        // Fetch agent's company_id
        const userRes = await this.readPool.query(
            'SELECT insurance_company_id FROM users WHERE user_id = $1',
            [agentId]
        );
        const companyId = userRes.rows[0]?.insurance_company_id;

        // Query claims - by company if available, otherwise by agent
        let result;
        if (companyId) {
            result = await this.readPool.query(`
                SELECT * FROM insurance_claims
                WHERE company_id = $1
                ORDER BY created_at DESC
            `, [companyId]);
        } else {
            result = await this.readPool.query(`
                SELECT * FROM insurance_claims
                WHERE agent_id = $1
                ORDER BY created_at DESC
            `, [agentId]);
        }

        return result.rows;
    }

    /**
     * Get pending approvals (Insurance Agent)
     */
    async getPendingApprovals(agentId: string): Promise<any[]> {
        const agentResult = await this.readPool.query(
            'SELECT insurance_company_id FROM users WHERE user_id = $1',
            [agentId]
        );
        const companyId = agentResult.rows[0]?.insurance_company_id;

        const result = await this.readPool.query(`
            SELECT 
                ic.*,
                g.garage_name,
                g.rating_average,
                g.phone as garage_phone,
                pr.part_description,
                pr.image_urls as request_images,
                pr.bid_count
            FROM insurance_claims ic
            LEFT JOIN garages g ON ic.submitted_by_garage_id = g.garage_id
            LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
            WHERE ic.approval_status = 'pending'
              AND ($1::uuid IS NULL OR ic.company_id = $1)
            ORDER BY ic.created_at DESC
        `, [companyId]);

        return result.rows.map(row => ({
            claim_id: row.claim_id,
            claim_reference: row.claim_reference_number,
            customer_name: row.customer_name,
            vehicle: `${row.vehicle_make || ''} ${row.vehicle_model || ''} ${row.vehicle_year || ''}`.trim(),
            vin: row.vin_number,
            part_needed: row.part_name || row.part_description || 'Not specified',
            damage_description: row.damage_description,
            damage_photos: row.damage_photos || row.request_images || [],
            garage: {
                name: row.garage_name || 'Direct Submission',
                rating: row.rating_average,
                phone: row.garage_phone
            },
            estimates: {
                agency: row.agency_estimate || 0,
                scrapyard: row.scrapyard_estimate || 0,
                savings: row.agency_estimate && row.scrapyard_estimate
                    ? Math.round(row.agency_estimate - row.scrapyard_estimate)
                    : 0,
                savings_percent: row.agency_estimate && row.scrapyard_estimate
                    ? Math.round((1 - row.scrapyard_estimate / row.agency_estimate) * 100)
                    : 0
            },
            submitted_at: row.created_at,
            bid_count: row.bid_count || 0
        }));
    }

    /**
     * Approve a claim (Insurance Agent)
     */
    async approveClaim(claimId: string, agentId: string, notes?: string, approvedSource?: string): Promise<any> {
        const result = await this.writePool.query(`
            UPDATE insurance_claims 
            SET approval_status = 'approved',
                approved_by = $1,
                approved_at = NOW(),
                notes = COALESCE(notes || ' | ', '') || $2,
                status = 'approved'
            WHERE claim_id = $3
            RETURNING claim_id, claim_reference_number
        `, [agentId, notes || `Approved for ${approvedSource || 'scrapyard'} sourcing`, claimId]);

        if (result.rowCount === 0) {
            throw new ClaimNotFoundError(claimId);
        }

        return {
            message: 'Claim approved successfully',
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        };
    }

    /**
     * Reject a claim (Insurance Agent)
     */
    async rejectClaim(claimId: string, agentId: string, reason: string): Promise<any> {
        if (!reason) {
            throw new Error('Rejection reason is required');
        }

        const result = await this.writePool.query(`
            UPDATE insurance_claims 
            SET approval_status = 'rejected',
                approved_by = $1,
                approved_at = NOW(),
                rejection_reason = $2,
                status = 'rejected'
            WHERE claim_id = $3
            RETURNING claim_id, claim_reference_number
        `, [agentId, reason, claimId]);

        if (result.rowCount === 0) {
            throw new ClaimNotFoundError(claimId);
        }

        return {
            message: 'Claim rejected',
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        };
    }

    /**
     * Get approved orders for tracking (Insurance Agent)
     */
    async getApprovedOrders(agentId: string): Promise<any[]> {
        const agentResult = await this.readPool.query(
            'SELECT insurance_company_id FROM users WHERE user_id = $1',
            [agentId]
        );
        const companyId = agentResult.rows[0]?.insurance_company_id;

        const result = await this.readPool.query(`
            SELECT 
                ic.*,
                g.garage_name,
                o.order_number,
                o.order_status,
                o.total_amount,
                da.status as delivery_status
            FROM insurance_claims ic
            LEFT JOIN garages g ON ic.submitted_by_garage_id = g.garage_id
            LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
            LEFT JOIN orders o ON o.request_id = pr.request_id
            LEFT JOIN delivery_assignments da ON da.order_id = o.order_id
            WHERE ic.approval_status = 'approved'
              AND ($1::uuid IS NULL OR ic.company_id = $1)
            ORDER BY ic.approved_at DESC
        `, [companyId]);

        return result.rows.map(row => ({
            claim_id: row.claim_id,
            claim_reference: row.claim_reference_number,
            customer_name: row.customer_name,
            vehicle: `${row.vehicle_make || ''} ${row.vehicle_model || ''}`.trim(),
            part: row.part_name,
            garage: row.garage_name,
            order: row.order_number ? {
                number: row.order_number,
                status: row.order_status,
                amount: row.total_amount,
                delivery_status: row.delivery_status
            } : null,
            approved_at: row.approved_at,
            status: row.status
        }));
    }

    /**
     * Submit claim from garage
     */
    async submitToInsurance(params: GarageClaimSubmission): Promise<{ claim_id: string; claim_reference: string }> {
        const {
            insuranceCompanyId,
            customerName,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            vinNumber,
            damageDescription,
            damagePhotos,
            partName,
            agencyEstimate,
            scrapyardEstimate,
            policeReportNumber,
            garageId
        } = params;

        if (!insuranceCompanyId || !customerName || !partName) {
            throw new Error('Insurance company, customer name, and part required');
        }

        const result = await this.writePool.query(`
            INSERT INTO insurance_claims (
                company_id, submitted_by_garage_id,
                customer_name, vehicle_make, vehicle_model, vehicle_year, vin_number,
                damage_description, damage_photos, part_name,
                agency_estimate, scrapyard_estimate,
                claim_reference_number,
                approval_status, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', 'pending_approval')
            RETURNING claim_id, claim_reference_number
        `, [
            insuranceCompanyId, garageId,
            customerName, vehicleMake, vehicleModel, vehicleYear, vinNumber,
            damageDescription, damagePhotos || [], partName,
            agencyEstimate || 0, scrapyardEstimate || 0,
            `CLM-${Date.now()}-${policeReportNumber || 'NA'}`
        ]);

        return {
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        };
    }
}
