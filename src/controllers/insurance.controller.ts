import { Request, Response } from 'express';
import { getReadPool, getWritePool } from '../config/db';

const readPool = getReadPool();
const writePool = getWritePool();

// Create a new insurance claim (Agent)
export const createClaim = async (req: Request, res: Response) => {
    const client = await writePool.connect();
    try {
        // Accept both old and new field formats
        const {
            claim_reference_number,
            policy_number,
            vin_number,
            // New frontend format fields
            customer_name,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            part_name,
            notes,
            // Old format fields (backward compatible)
            car_make,
            car_model,
            car_year
        } = req.body;

        const agentId = (req as any).user.user_id;

        // Get company ID from agent (optional - allow agents without company)
        const agentResult = await readPool.query('SELECT insurance_company_id FROM users WHERE user_id = $1', [agentId]);
        const companyId = agentResult.rows[0]?.insurance_company_id || null;

        // Use new fields or fall back to old ones
        const finalMake = vehicle_make || car_make || '';
        const finalModel = vehicle_model || car_model || '';
        const finalYear = vehicle_year || car_year || null;

        await client.query('BEGIN');

        // 1. Create Claim Record with all new fields
        const claimResult = await client.query(`
            INSERT INTO insurance_claims (
                company_id, agent_id, claim_reference_number, policy_number,
                vin_number, car_make, car_model, car_year,
                customer_name, vehicle_make, vehicle_model, vehicle_year,
                part_name, notes, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
            RETURNING claim_id
        `, [
            companyId, agentId, claim_reference_number || `CLM-${Date.now()}`, policy_number,
            vin_number, finalMake, finalModel, finalYear,
            customer_name, finalMake, finalModel, finalYear,
            part_name, notes
        ]);

        const claimId = claimResult.rows[0].claim_id;

        // 2. Auto-create Part Request if part_name is provided
        if (part_name) {
            const reqResult = await client.query(`
                INSERT INTO part_requests (
                    customer_id, car_make, car_model, car_year, vin_number,
                    part_description, status, priority
                ) VALUES ($1, $2, $3, $4, $5, $6, 'active', 'high')
                RETURNING request_id
            `, [agentId, finalMake, finalModel, finalYear, vin_number || null,
                `Insurance Claim: ${part_name}${notes ? ' - ' + notes : ''}`]);

            const requestId = reqResult.rows[0].request_id;

            // Link request to claim
            await client.query('UPDATE insurance_claims SET part_request_id = $1, status = $2 WHERE claim_id = $3',
                [requestId, 'processing', claimId]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Claim created successfully',
            claim_id: claimId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating claim:', error);
        res.status(500).json({ error: 'Failed to create claim' });
    } finally {
        client.release();
    }
};

// Get Claims Dashboard
export const getMyClaims = async (req: Request, res: Response) => {
    try {
        const agentId = (req as any).user.user_id;

        // Fetch agent's company_id
        const userRes = await readPool.query('SELECT insurance_company_id FROM users WHERE user_id = $1', [agentId]);
        const companyId = userRes.rows[0]?.insurance_company_id;

        // Query claims - by company if available, otherwise by agent
        let result;
        if (companyId) {
            result = await readPool.query(`
                SELECT * FROM insurance_claims
                WHERE company_id = $1
                ORDER BY created_at DESC
            `, [companyId]);
        } else {
            // Agent without company - show their own claims
            result = await readPool.query(`
                SELECT * FROM insurance_claims
                WHERE agent_id = $1
                ORDER BY created_at DESC
            `, [agentId]);
        }

        res.json({ claims: result.rows });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ==========================================
// GAP-FILLING ENDPOINTS FOR INSURANCE COMPANIES
// ==========================================

/**
 * Search available parts from all scrapyards
 * This fills the gap: Insurance companies can't access real-time inventory
 */
export const searchParts = async (req: Request, res: Response) => {
    try {
        // Accept both frontend and legacy field names
        const {
            part_name, part_type,
            vehicle_make, car_make,
            car_model, car_year,
            vin_number, condition
        } = req.body;

        const searchPart = part_name || part_type || '';
        const searchMake = vehicle_make || car_make || '';

        // Search across all garages for matching parts
        const result = await readPool.query(`
            SELECT 
                gsp.product_id as part_id,
                gsp.name as part_name,
                gsp.description,
                gsp.price,
                gsp.condition,
                gsp.quantity_available,
                gsp.image_urls,
                g.garage_name,
                g.garage_id,
                g.rating_average,
                g.rating_count,
                g.address as location
            FROM garage_showcase_products gsp
            JOIN garages g ON g.garage_id = gsp.garage_id 
            WHERE g.is_active = true
              AND gsp.quantity_available > 0
              AND (
                  LOWER(gsp.name) LIKE LOWER($1)
                  OR LOWER(gsp.description) LIKE LOWER($1)
                  OR LOWER(gsp.compatible_models) LIKE LOWER($2)
              )
            ORDER BY g.rating_average DESC, gsp.price ASC
            LIMIT 50
        `, [`%${searchPart}%`, `%${searchMake}%`]);

        // Return format matching frontend expectations
        res.json({
            parts: result.rows.map(row => ({
                ...row,
                agency_price: Math.round(row.price * 2.5) // Estimated agency price
            })),
            total: result.rowCount
        });
    } catch (error) {
        console.error('Error searching parts:', error);
        res.status(500).json({ error: 'Failed to search parts' });
    }
};;

/**
 * Compare agency price vs. scrapyard price
 * This fills the gap: Insurance companies don't have cost comparison tools
 */
export const priceCompare = async (req: Request, res: Response) => {
    try {
        // Accept both frontend and legacy field names
        const { part_name, part_type, vehicle_make, car_make, car_model } = req.body;
        const searchPart = part_name || part_type || '';
        const searchMake = vehicle_make || car_make || '';

        // Get average scrapyard price
        const result = await readPool.query(`
            SELECT 
                AVG(gsp.price) as avg_scrapyard_price,
                MIN(gsp.price) as min_price,
                MAX(gsp.price) as max_price,
                COUNT(*)::int as available_suppliers,
                COUNT(DISTINCT g.garage_id)::int as garage_count
            FROM garage_showcase_products gsp
            JOIN garages g ON g.garage_id = gsp.garage_id
            WHERE g.is_active = true
              AND gsp.quantity_available > 0
              AND (
                  LOWER(gsp.name) LIKE LOWER($1)
                  OR LOWER(gsp.compatible_models) LIKE LOWER($2)
              )
        `, [`%${searchPart}%`, `%${searchMake}%`]);

        const stats = result.rows[0];
        const avgScrapyardPrice = parseFloat(stats.avg_scrapyard_price) || 0;

        // Return format matching frontend comparison display
        res.json({
            comparison: {
                avg_price: avgScrapyardPrice,
                agency_avg: Math.round(avgScrapyardPrice * 2.5),
                scrapyard_avg: avgScrapyardPrice,
                savings: Math.round(avgScrapyardPrice * 1.5),
                savings_percent: 60,
                total_listings: stats.available_suppliers,
                garage_count: stats.garage_count || 0,
                min_price: parseFloat(stats.min_price) || 0,
                max_price: parseFloat(stats.max_price) || 0
            }
        });
    } catch (error) {
        console.error('Error comparing prices:', error);
        res.status(500).json({ error: 'Failed to compare prices' });
    }
};

/**
 * Track claim order in real-time
 * This fills the gap: Insurance companies can't track parts through our network
 */
export const trackClaim = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;

        // First check if claim exists
        const claimCheck = await readPool.query(
            'SELECT claim_id, status, customer_name, vehicle_make, vehicle_model, part_name, created_at FROM insurance_claims WHERE claim_id = $1',
            [claim_id]
        );

        if (claimCheck.rowCount === 0) {
            // Return mock tracking for demo purposes
            return res.json({
                tracking: {
                    order_number: claim_id.slice(0, 8).toUpperCase(),
                    part_name: 'Part',
                    vehicle: 'Vehicle',
                    status: 'pending',
                    steps: {
                        order_placed: new Date().toLocaleString(),
                        collected: null,
                        in_transit: null,
                        delivered: null
                    },
                    driver: null,
                    eta: 'Pending order creation'
                }
            });
        }

        const claim = claimCheck.rows[0];

        // Return tracking based on claim status
        const trackingSteps = {
            order_placed: claim.created_at ? new Date(claim.created_at).toLocaleString() : null,
            collected: claim.status === 'parts_ordered' || claim.status === 'in_transit' || claim.status === 'delivered' ? 'Collected' : null,
            in_transit: claim.status === 'in_transit' || claim.status === 'delivered' ? 'In Transit' : null,
            delivered: claim.status === 'delivered' || claim.status === 'completed' ? 'Delivered' : null
        };

        res.json({
            tracking: {
                order_number: claim_id.slice(0, 8).toUpperCase(),
                part_name: claim.part_name || 'Part',
                vehicle: `${claim.vehicle_make || ''} ${claim.vehicle_model || ''}`.trim() || 'Vehicle',
                status: claim.status || 'draft',
                steps: trackingSteps,
                driver: null, // Would be populated from actual delivery assignment
                eta: claim.status === 'in_transit' ? '2-4 hours' : null
            }
        });
    } catch (error) {
        console.error('Error tracking claim:', error);
        res.status(500).json({ error: 'Failed to track claim' });
    }
};

/**
 * Get verification photos for fraud prevention
 * This fills the gap: Insurance companies need photo proof
 */
export const getClaimPhotos = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;

        // First check if claim exists
        const claimCheck = await readPool.query(
            'SELECT claim_id FROM insurance_claims WHERE claim_id = $1',
            [claim_id]
        );

        if (claimCheck.rowCount === 0) {
            // Return empty photos for non-existent claims
            return res.json({
                photos: [],
                message: 'No photos available for this claim'
            });
        }

        // Try to get photos from linked orders
        const result = await readPool.query(`
            SELECT 
                ic.claim_id,
                pr.image_urls as request_images,
                b.image_urls as bid_images,
                o.order_id,
                da.pickup_photo_url,
                da.delivery_photo_url
            FROM insurance_claims ic
            LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
            LEFT JOIN bids b ON b.request_id = pr.request_id AND b.status = 'accepted'
            LEFT JOIN orders o ON o.request_id = pr.request_id
            LEFT JOIN delivery_assignments da ON da.order_id = o.order_id
            WHERE ic.claim_id = $1
        `, [claim_id]);

        const data = result.rows[0] || {};

        // Build photos array for frontend
        const photos = [];
        if (data.request_images) {
            const imgs = Array.isArray(data.request_images) ? data.request_images : [];
            imgs.forEach((url: string) => photos.push({ url, type: 'supplier', timestamp: 'Request submitted' }));
        }
        if (data.bid_images) {
            const imgs = Array.isArray(data.bid_images) ? data.bid_images : [];
            imgs.forEach((url: string) => photos.push({ url, type: 'qc', timestamp: 'Bid submitted' }));
        }
        if (data.pickup_photo_url) {
            photos.push({ url: data.pickup_photo_url, type: 'pickup', timestamp: 'Pickup verified' });
        }
        if (data.delivery_photo_url) {
            photos.push({ url: data.delivery_photo_url, type: 'pod', timestamp: 'Delivery verified' });
        }

        res.json({ photos });
    } catch (error) {
        console.error('Error getting claim photos:', error);
        res.status(500).json({ error: 'Failed to get photos' });
    }
};

/**
 * Generate Certified History Report (monetization)
 * This fills the gap: No verified repair history in Qatar
 */
export const getHistoryReport = async (req: Request, res: Response) => {
    try {
        const { vin_number } = req.params;

        if (!vin_number || vin_number.length !== 17) {
            return res.status(400).json({ error: 'Invalid VIN. Must be exactly 17 characters.' });
        }

        // Get all orders/repairs for this VIN
        const result = await readPool.query(`
            SELECT 
                o.order_number,
                o.order_status,
                o.total_amount,
                o.created_at,
                o.completed_at,
                pr.part_description,
                g.garage_name,
                g.rating_average,
                ic.claim_reference_number
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN insurance_claims ic ON ic.part_request_id = pr.request_id
            WHERE UPPER(pr.vin_number) = UPPER($1)
               OR UPPER(ic.vin_number) = UPPER($1)
            ORDER BY o.created_at DESC
        `, [vin_number]);

        const historyCount = result.rowCount || 0;

        // Return report object with history array (can be empty)
        res.json({
            report: {
                vin_number,
                report_generated: new Date().toISOString(),
                total_repairs: historyCount,
                parts_replaced: historyCount,
                certified_repairs: historyCount,
                history: result.rows.map(r => ({
                    date: new Date(r.created_at).toLocaleDateString('en-QA'),
                    part_name: r.part_description,
                    garage_name: r.garage_name,
                    certification: 'MOTAR_CERTIFIED'
                })),
                certification: {
                    status: 'MOTAR_CERTIFIED',
                    verified_by: 'Motar Technologies W.L.L.',
                    report_id: `MCR-${Date.now()}`
                }
            }
        });
    } catch (error) {
        console.error('Error generating history report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// ==========================================
// QATAR WORKFLOW: GARAGE → INSURANCE APPROVAL
// ==========================================

/**
 * Get pending claims awaiting approval (Insurance Agent)
 * Qatar Workflow: Garages submit, insurance reviews
 */
export const getPendingApprovals = async (req: Request, res: Response) => {
    try {
        const agentId = (req as any).user.user_id;

        // Get agent's company
        const agentResult = await readPool.query('SELECT insurance_company_id FROM users WHERE user_id = $1', [agentId]);
        const companyId = agentResult.rows[0]?.insurance_company_id;

        // Get pending claims for this company (or all if no company assigned)
        const result = await readPool.query(`
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

        res.json({
            pending: result.rows.map(row => ({
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
            })),
            total: result.rowCount || 0
        });
    } catch (error) {
        console.error('Error getting pending approvals:', error);
        res.status(500).json({ error: 'Failed to get pending approvals' });
    }
};

/**
 * Approve a claim (Insurance Agent)
 * Qatar Workflow: After review, approve parts sourcing
 */
export const approveClaim = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;
        const { notes, approved_source } = req.body; // 'agency' or 'scrapyard'
        const agentId = (req as any).user.user_id;

        const result = await writePool.query(`
            UPDATE insurance_claims 
            SET approval_status = 'approved',
                approved_by = $1,
                approved_at = NOW(),
                notes = COALESCE(notes || ' | ', '') || $2,
                status = 'approved'
            WHERE claim_id = $3
            RETURNING claim_id, claim_reference_number
        `, [agentId, notes || `Approved for ${approved_source || 'scrapyard'} sourcing`, claim_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        res.json({
            message: 'Claim approved successfully',
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        });
    } catch (error) {
        console.error('Error approving claim:', error);
        res.status(500).json({ error: 'Failed to approve claim' });
    }
};

/**
 * Reject a claim (Insurance Agent)
 * Qatar Workflow: Reject with documented reason
 */
export const rejectClaim = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;
        const { reason } = req.body;
        const agentId = (req as any).user.user_id;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const result = await writePool.query(`
            UPDATE insurance_claims 
            SET approval_status = 'rejected',
                approved_by = $1,
                approved_at = NOW(),
                rejection_reason = $2,
                status = 'rejected'
            WHERE claim_id = $3
            RETURNING claim_id, claim_reference_number
        `, [agentId, reason, claim_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        res.json({
            message: 'Claim rejected',
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        });
    } catch (error) {
        console.error('Error rejecting claim:', error);
        res.status(500).json({ error: 'Failed to reject claim' });
    }
};

/**
 * Get approved orders for tracking (Insurance Agent)
 * Qatar Workflow: Monitor parts delivery for approved claims
 */
export const getApprovedOrders = async (req: Request, res: Response) => {
    try {
        const agentId = (req as any).user.user_id;

        // Get agent's company
        const agentResult = await readPool.query('SELECT insurance_company_id FROM users WHERE user_id = $1', [agentId]);
        const companyId = agentResult.rows[0]?.insurance_company_id;

        const result = await readPool.query(`
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

        res.json({
            approved: result.rows.map(row => ({
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
            })),
            total: result.rowCount || 0
        });
    } catch (error) {
        console.error('Error getting approved orders:', error);
        res.status(500).json({ error: 'Failed to get approved orders' });
    }
};

/**
 * Garage submits claim to insurance (Called from Garage Dashboard)
 * Qatar Workflow: Garage initiates the claim after customer arrives
 */
export const submitToInsurance = async (req: Request, res: Response) => {
    try {
        const {
            insurance_company_id,
            customer_name,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            vin_number,
            damage_description,
            damage_photos,
            part_name,
            agency_estimate,
            scrapyard_estimate,
            police_report_number
        } = req.body;
        const garageId = (req as any).user.garage_id;

        if (!garageId) {
            return res.status(403).json({ error: 'Only garages can submit insurance claims' });
        }

        if (!insurance_company_id || !customer_name || !part_name) {
            return res.status(400).json({ error: 'Insurance company, customer name, and part required' });
        }

        const result = await writePool.query(`
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
            insurance_company_id, garageId,
            customer_name, vehicle_make, vehicle_model, vehicle_year, vin_number,
            damage_description, damage_photos || [], part_name,
            agency_estimate || 0, scrapyard_estimate || 0,
            `CLM-${Date.now()}-${police_report_number || 'NA'}`
        ]);

        res.status(201).json({
            message: 'Claim submitted to insurance for approval',
            claim_id: result.rows[0].claim_id,
            claim_reference: result.rows[0].claim_reference_number
        });
    } catch (error) {
        console.error('Error submitting to insurance:', error);
        res.status(500).json({ error: 'Failed to submit claim' });
    }
};

/**
 * Get list of insurance companies (for garage dropdown)
 */
export const getInsuranceCompanies = async (req: Request, res: Response) => {
    try {
        const result = await readPool.query(`
            SELECT company_id, name, company_code
            FROM insurance_companies
            WHERE is_active = true
            ORDER BY name
        `);

        res.json({ companies: result.rows });
    } catch (error) {
        console.error('Error getting insurance companies:', error);
        res.status(500).json({ error: 'Failed to get companies' });
    }
};

// ============================================
// MOI ACCIDENT REPORT ENDPOINTS
// ============================================

/**
 * Upload MOI accident report for a claim
 */
export const uploadMOIReport = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;
        const {
            report_number,
            accident_date,
            police_station,
            vehicle_vin,
            vehicle_registration,
            driver_name,
            driver_id_number,
            report_document_url,
            parsed_data
        } = req.body;

        const userId = (req as any).user.user_id;

        // Verify claim exists and user has access
        const claimCheck = await readPool.query(
            'SELECT claim_id FROM insurance_claims WHERE claim_id = $1',
            [claim_id]
        );

        if (claimCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        const result = await writePool.query(`
            INSERT INTO moi_accident_reports (
                claim_id, report_number, accident_date, police_station,
                vehicle_vin, vehicle_registration, driver_name, driver_id_number,
                report_document_url, parsed_data, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            claim_id, report_number, accident_date, police_station,
            vehicle_vin, vehicle_registration, driver_name, driver_id_number,
            report_document_url, parsed_data ? JSON.stringify(parsed_data) : null,
            userId
        ]);

        // Update claim to indicate MOI report attached
        await writePool.query(
            'UPDATE insurance_claims SET has_moi_report = true WHERE claim_id = $1',
            [claim_id]
        );

        res.json({
            message: 'MOI report uploaded successfully',
            report: result.rows[0]
        });
    } catch (error) {
        console.error('Error uploading MOI report:', error);
        res.status(500).json({ error: 'Failed to upload MOI report' });
    }
};

/**
 * Get MOI report for a claim
 */
export const getMOIReport = async (req: Request, res: Response) => {
    try {
        const { claim_id } = req.params;

        const result = await readPool.query(`
            SELECT * FROM moi_accident_reports
            WHERE claim_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [claim_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No MOI report found for this claim' });
        }

        res.json({ report: result.rows[0] });
    } catch (error) {
        console.error('Error getting MOI report:', error);
        res.status(500).json({ error: 'Failed to get MOI report' });
    }
};

/**
 * Verify/reject MOI report (insurance adjuster)
 */
export const verifyMOIReport = async (req: Request, res: Response) => {
    try {
        const { report_id } = req.params;
        const { verification_status, verification_notes } = req.body;
        const userId = (req as any).user.user_id;

        if (!['verified', 'rejected'].includes(verification_status)) {
            return res.status(400).json({ error: 'Invalid verification status' });
        }

        const result = await writePool.query(`
            UPDATE moi_accident_reports
            SET 
                verification_status = $1,
                verification_notes = $2,
                verified_by = $3,
                verified_at = NOW(),
                updated_at = NOW()
            WHERE report_id = $4
            RETURNING *
        `, [verification_status, verification_notes, userId, report_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'MOI report not found' });
        }

        res.json({
            message: `MOI report ${verification_status}`,
            report: result.rows[0]
        });
    } catch (error) {
        console.error('Error verifying MOI report:', error);
        res.status(500).json({ error: 'Failed to verify MOI report' });
    }
};

// ============================================
// ESCROW PAYMENT ENDPOINTS
// ============================================

/**
 * Create escrow hold when claim is approved
 */
export const holdEscrow = async (req: Request, res: Response) => {
    const client = await writePool.connect();
    try {
        const { claim_id } = req.params;
        const { approved_amount } = req.body;
        const userId = (req as any).user.user_id;

        await client.query('BEGIN');

        // Get claim details
        const claimResult = await client.query(`
            SELECT 
                ic.claim_id,
                ic.company_id,
                ic.status,
                u.user_id as garage_id
            FROM insurance_claims ic
            LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
            LEFT JOIN users u ON pr.user_id = u.user_id
            WHERE ic.claim_id = $1
        `, [claim_id]);

        if (claimResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Claim not found' });
        }

        const claim = claimResult.rows[0];

        // Create escrow payment
        const escrowResult = await client.query(`
            INSERT INTO escrow_payments (
                claim_id, insurance_company_id, garage_id,
                approved_amount, held_amount, status,
                hold_date, expiry_date
            ) VALUES ($1, $2, $3, $4, $5, 'held', NOW(), NOW() + INTERVAL '30 days')
            RETURNING *
        `, [claim_id, claim.company_id, claim.garage_id, approved_amount, approved_amount]);

        // Update claim with escrow reference
        await client.query(`
            UPDATE insurance_claims
            SET escrow_id = $1, payment_status = 'held'
            WHERE claim_id = $2
        `, [escrowResult.rows[0].escrow_id, claim_id]);

        await client.query('COMMIT');

        res.json({
            message: 'Escrow payment held successfully',
            escrow: escrowResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error holding escrow:', error);
        res.status(500).json({ error: 'Failed to hold escrow payment' });
    } finally {
        client.release();
    }
};

/**
 * Release escrow payment after work verification
 */
export const releaseEscrow = async (req: Request, res: Response) => {
    const client = await writePool.connect();
    try {
        const { claim_id } = req.params;
        const { release_notes, completion_photos } = req.body;
        const userId = (req as any).user.user_id;

        await client.query('BEGIN');

        // Get escrow details
        const escrowResult = await client.query(`
            SELECT * FROM escrow_payments
            WHERE claim_id = $1 AND status = 'held'
        `, [claim_id]);

        if (escrowResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No active escrow found for this claim' });
        }

        const escrow = escrowResult.rows[0];

        // Release payment
        await client.query(`
            UPDATE escrow_payments
            SET 
                status = 'released',
                released_amount = held_amount,
                release_date = NOW(),
                release_approved_by = $1,
                release_notes = $2,
                completion_photos = $3,
                completion_verified_by = $1,
                work_completed_at = NOW()
            WHERE escrow_id = $4
        `, [userId, release_notes, completion_photos ? JSON.stringify(completion_photos) : null, escrow.escrow_id]);

        // Update claim payment status
        await client.query(`
            UPDATE insurance_claims
            SET payment_status = 'released'
            WHERE claim_id = $1
        `, [claim_id]);

        await client.query('COMMIT');

        res.json({
            message: 'Escrow payment released successfully',
            released_amount: escrow.held_amount
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error releasing escrow:', error);
        res.status(500).json({ error: 'Failed to release escrow payment' });
    } finally {
        client.release();
    }
};

/**
 * Get escrow status
 */
export const getEscrowStatus = async (req: Request, res: Response) => {
    try {
        const { escrow_id } = req.params;

        const result = await readPool.query(`
            SELECT 
                ep.*,
                ic.claim_reference_number,
                u.full_name as garage_name
            FROM escrow_payments ep
            LEFT JOIN insurance_claims ic ON ep.claim_id = ic.claim_id
            LEFT JOIN users u ON ep.garage_id = u.user_id
            WHERE ep.escrow_id = $1
        `, [escrow_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Escrow not found' });
        }

        // Get activity log
        const logResult = await readPool.query(`
            SELECT * FROM escrow_activity_log
            WHERE escrow_id = $1
            ORDER BY created_at DESC
        `, [escrow_id]);

        res.json({
            escrow: result.rows[0],
            activity_log: logResult.rows
        });
    } catch (error) {
        console.error('Error getting escrow status:', error);
        res.status(500).json({ error: 'Failed to get escrow status' });
    }
};
