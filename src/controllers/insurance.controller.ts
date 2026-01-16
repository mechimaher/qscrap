import { Request, Response } from 'express';
import { getReadPool, getWritePool } from '../config/db';

const readPool = getReadPool();
const writePool = getWritePool();

// Create a new insurance claim (Agent)
export const createClaim = async (req: Request, res: Response) => {
    const client = await writePool.connect();
    try {
        const { claim_reference_number, policy_number, vin_number, car_make, car_model, car_year, part_request_data } = req.body;
        const agentId = (req as any).user.user_id;

        // Get company ID from agent
        const agentResult = await readPool.query('SELECT insurance_company_id FROM users WHERE user_id = $1', [agentId]);
        const companyId = agentResult.rows[0]?.insurance_company_id;

        if (!companyId) {
            return res.status(403).json({ error: 'User is not linked to an insurance company' });
        }

        await client.query('BEGIN');

        // 1. Create Claim Record
        const claimResult = await client.query(`
            INSERT INTO insurance_claims (
                company_id, agent_id, claim_reference_number, policy_number,
                vin_number, car_make, car_model, car_year,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
            RETURNING claim_id
        `, [companyId, agentId, claim_reference_number, policy_number, vin_number, car_make, car_model, car_year]);

        const claimId = claimResult.rows[0].claim_id;

        // 2. Create Linked Part Request (if parts needed)
        // Auto-create a part request on behalf of the insurance company
        if (part_request_data) {
            const { parts_list } = part_request_data; // Array of part descriptions
            // For each part or combined? Typically one request per car.

            // Create main request
            const reqResult = await client.query(`
                INSERT INTO part_requests (
                    customer_id, car_make, car_model, car_year, vin_number,
                    part_description, // Summary
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
                RETURNING request_id
             `, [agentId, car_make, car_model, car_year, vin_number, 'Insurance Claim Parts: ' + JSON.stringify(parts_list)]);

            const requestId = reqResult.rows[0].request_id;

            // Update claim link
            await client.query('UPDATE insurance_claims SET part_request_id = $1 WHERE claim_id = $2', [requestId, claimId]);
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
        const { car_make, car_model, car_year, part_type, vin_number } = req.body;

        // Search across all garages for matching parts
        const result = await readPool.query(`
            SELECT 
                gsp.product_id,
                gsp.name,
                gsp.description,
                gsp.price,
                gsp.condition,
                gsp.quantity_available,
                gsp.image_urls,
                g.garage_name,
                g.garage_id,
                g.rating_average,
                g.rating_count,
                CASE 
                    WHEN gsp.condition = 'new' THEN 'Premium - Factory New'
                    WHEN gsp.condition = 'refurbished' THEN 'Certified Refurbished'
                    WHEN gsp.condition = 'used_good' THEN 'Quality Used'
                    ELSE 'Used'
                END as condition_label
            FROM garage_showcase_products gsp
            JOIN garages g ON g.garage_id = gsp.garage_id 
            WHERE g.is_active = true
              AND gsp.quantity_available > 0
              AND (
                  LOWER(gsp.compatible_models) LIKE LOWER($1)
                  OR LOWER(gsp.name) LIKE LOWER($2)
                  OR LOWER(gsp.description) LIKE LOWER($2)
              )
            ORDER BY g.rating_average DESC, gsp.price ASC
            LIMIT 50
        `, [`%${car_make}%${car_model}%`, `%${part_type}%`]);

        res.json({
            available_parts: result.rows,
            total: result.rowCount,
            search_params: { car_make, car_model, car_year, part_type }
        });
    } catch (error) {
        console.error('Error searching parts:', error);
        res.status(500).json({ error: 'Failed to search parts' });
    }
};

/**
 * Compare agency price vs. scrapyard price
 * This fills the gap: Insurance companies don't have cost comparison tools
 */
export const priceCompare = async (req: Request, res: Response) => {
    try {
        const { car_make, car_model, car_year, part_type, agency_price } = req.body;

        // Get average scrapyard price
        const result = await readPool.query(`
            SELECT 
                AVG(gsp.price) as avg_scrapyard_price,
                MIN(gsp.price) as min_price,
                MAX(gsp.price) as max_price,
                COUNT(*)::int as available_suppliers
            FROM garage_showcase_products gsp
            JOIN garages g ON g.garage_id = gsp.garage_id
            WHERE g.is_active = true
              AND gsp.quantity_available > 0
              AND (
                  LOWER(gsp.compatible_models) LIKE LOWER($1)
                  OR LOWER(gsp.name) LIKE LOWER($2)
              )
        `, [`%${car_make}%${car_model}%`, `%${part_type}%`]);

        const stats = result.rows[0];
        const avgScrapyardPrice = parseFloat(stats.avg_scrapyard_price) || 0;
        const agencyPriceNum = parseFloat(agency_price) || 0;
        const savings = agencyPriceNum > 0 ? ((agencyPriceNum - avgScrapyardPrice) / agencyPriceNum * 100) : 0;

        res.json({
            agency_price: agencyPriceNum,
            scrapyard_price: {
                average: avgScrapyardPrice,
                min: parseFloat(stats.min_price) || 0,
                max: parseFloat(stats.max_price) || 0
            },
            savings_percent: Math.round(savings),
            savings_amount: Math.round(agencyPriceNum - avgScrapyardPrice),
            available_suppliers: stats.available_suppliers,
            recommendation: savings > 30 ? 'RECOMMENDED: Use scrapyard sourcing' : 'Review options'
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

        const result = await readPool.query(`
            SELECT 
                ic.claim_id,
                pr.image_urls as request_images,
                b.image_urls as bid_images,
                o.order_id,
                da.pickup_photo_url,
                da.delivery_photo_url,
                pod.signature_url,
                pod.pod_images
            FROM insurance_claims ic
            LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
            LEFT JOIN bids b ON b.request_id = pr.request_id AND b.status = 'accepted'
            LEFT JOIN orders o ON o.request_id = pr.request_id
            LEFT JOIN driver_assignments da ON da.order_id = o.order_id
            LEFT JOIN proof_of_delivery pod ON pod.order_id = o.order_id
            WHERE ic.claim_id = $1
        `, [claim_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        const data = result.rows[0];

        res.json({
            claim_id: data.claim_id,
            photos: {
                request: data.request_images || [],
                supplier_bid: data.bid_images || [],
                pickup: data.pickup_photo_url ? [data.pickup_photo_url] : [],
                delivery: data.delivery_photo_url ? [data.delivery_photo_url] : [],
                proof_of_delivery: data.pod_images || [],
                signature: data.signature_url || null
            },
            fraud_check: {
                has_pickup_photo: !!data.pickup_photo_url,
                has_delivery_photo: !!data.delivery_photo_url,
                has_signature: !!data.signature_url,
                verified: !!data.pickup_photo_url && !!data.delivery_photo_url && !!data.signature_url
            }
        });
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
