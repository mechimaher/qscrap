/**
 * ShowcaseQueryService - Public Browsing & Part Discovery
 * Handles public part browsing, featured parts, and part details
 */

import { Pool } from 'pg';
import { ShowcaseFilters, PartDetail } from './types';
import logger from '../../utils/logger';

export class ShowcaseQueryService {
    constructor(private pool: Pool) { }

    /**
     * Browse active showcase parts with filters
     */
    async getShowcaseParts(filters: ShowcaseFilters): Promise<PartDetail[]> {
        const { car_make, car_model, search, limit = 20, offset = 0 } = filters;

        let query = `
            SELECT gp.*, g.garage_name, g.rating_average, g.rating_count,
                   COALESCE(sp.plan_code, 'starter') as plan_code
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.status = 'active' AND gp.quantity > 0
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (car_make) {
            query += ` AND LOWER(gp.car_make) = LOWER($${paramIndex++})`;
            params.push(car_make);
        }

        if (car_model) {
            query += ` AND LOWER(gp.car_model) = LOWER($${paramIndex++})`;
            params.push(car_model);
        }

        if (search) {
            query += ` AND (gp.title ILIKE $${paramIndex} OR gp.part_description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY gp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Get featured parts for home carousel
     */
    async getFeaturedParts(limit: number = 10): Promise<PartDetail[]> {
        const result = await this.pool.query(`
            SELECT gp.*, g.garage_name, g.rating_average, g.rating_count,
                   COALESCE(sp.plan_code, 'enterprise') as plan_code
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.status = 'active' 
              AND gp.quantity > 0
              AND (sp.features->>'featured' = 'true' OR sp.plan_code = 'enterprise')
            ORDER BY gp.view_count DESC, gp.created_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }

    /**
     * Get part detail and track view
     */
    async getPartDetail(partId: string, userId?: string): Promise<PartDetail> {
        const result = await this.pool.query(`
            SELECT gp.*, g.garage_name, g.rating_average, g.rating_count,
                   g.phone_number as garage_phone,
                   COALESCE(sp.plan_code, 'starter') as plan_code
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.part_id = $1
        `, [partId]);

        if (result.rows.length === 0) {
            throw new Error(`Part ${partId} not found`);
        }

        // Track view (async, best effort)
        if (userId) {
            this.trackPartView(partId, userId).catch(err =>
                logger.error('Failed to track showcase view', { partId, userId, error: err })
            );
        }

        return result.rows[0];
    }

    /**
     * Track part view for analytics
     */
    private async trackPartView(partId: string, userId: string): Promise<void> {
        await this.pool.query(`
            UPDATE garage_parts 
            SET view_count = view_count + 1, updated_at = NOW()
            WHERE part_id = $1
        `, [partId]);
    }
}
