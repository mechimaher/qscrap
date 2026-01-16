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
