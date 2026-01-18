/**
 * Insurance Analytics Service
 * Handles part search, price comparison, claim tracking, and photo verification
 */
import { Pool } from 'pg';
import { SearchPartsParams, PriceCompareParams } from './types';

export class InsuranceAnalyticsService {
    constructor(private readPool: Pool) { }

    /**
     * Search available parts from all scrapyards
     */
    async searchParts(params: SearchPartsParams): Promise<any> {
        const { partName, partType, vehicleMake, carMake, carModel } = params;

        const searchPart = partName || partType || '';
        const searchMake = vehicleMake || carMake || '';

        const result = await this.readPool.query(`
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

        return {
            parts: result.rows.map(row => ({
                ...row,
                agency_price: Math.round(row.price * 2.5) // Estimated agency price
            })),
            total: result.rowCount
        };
    }

    /**
     * Compare agency price vs. scrapyard price
     */
    async priceCompare(params: PriceCompareParams): Promise<any> {
        const { partName, partType, vehicleMake, carMake, carModel } = params;
        const searchPart = partName || partType || '';
        const searchMake = vehicleMake || carMake || '';

        const result = await this.readPool.query(`
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

        return {
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
        };
    }

    /**
     * Track claim order in real-time
     */
    async trackClaim(claimId: string): Promise<any> {
        const claimCheck = await this.readPool.query(
            'SELECT claim_id, status, customer_name, vehicle_make, vehicle_model, part_name, created_at FROM insurance_claims WHERE claim_id = $1',
            [claimId]
        );

        if (claimCheck.rowCount === 0) {
            return {
                tracking: {
                    order_number: claimId.slice(0, 8).toUpperCase(),
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
            };
        }

        const claim = claimCheck.rows[0];

        const trackingSteps = {
            order_placed: claim.created_at ? new Date(claim.created_at).toLocaleString() : null,
            collected: claim.status === 'parts_ordered' || claim.status === 'in_transit' || claim.status === 'delivered' ? 'Collected' : null,
            in_transit: claim.status === 'in_transit' || claim.status === 'delivered' ? 'In Transit' : null,
            delivered: claim.status === 'delivered' || claim.status === 'completed' ? 'Delivered' : null
        };

        return {
            tracking: {
                order_number: claimId.slice(0, 8).toUpperCase(),
                part_name: claim.part_name || 'Part',
                vehicle: `${claim.vehicle_make || ''} ${claim.vehicle_model || ''}`.trim() || 'Vehicle',
                status: claim.status || 'draft',
                steps: trackingSteps,
                driver: null,
                eta: claim.status === 'in_transit' ? '2-4 hours' : null
            }
        };
    }

    /**
     * Get verification photos for fraud prevention
     */
    async getClaimPhotos(claimId: string): Promise<any> {
        const claimCheck = await this.readPool.query(
            'SELECT claim_id FROM insurance_claims WHERE claim_id = $1',
            [claimId]
        );

        if (claimCheck.rowCount === 0) {
            return {
                photos: [],
                message: 'No photos available for this claim'
            };
        }

        const result = await this.readPool.query(`
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
        `, [claimId]);

        const data = result.rows[0] || {};

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

        return { photos };
    }

    /**
     * Generate Certified History Report (monetization)
     */
    async getHistoryReport(vinNumber: string): Promise<any> {
        if (!vinNumber || vinNumber.length !== 17) {
            throw new Error('Invalid VIN. Must be exactly 17 characters.');
        }

        const result = await this.readPool.query(`
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
        `, [vinNumber]);

        const historyCount = result.rowCount || 0;

        return {
            report: {
                vin_number: vinNumber,
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
        };
    }
}
