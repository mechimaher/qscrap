/**
 * ShowcaseManagementService - Garage Part CRUD
 * Handles garage's showcase inventory management
 */

import { Pool, PoolClient } from 'pg';
import { CreatePartData, UpdatePartData, PartDetail } from './types';
import {
    PartNotFoundError,
    UnauthorizedPartAccessError,
    NoShowcaseAccessError
} from './errors';

export class ShowcaseManagementService {
    constructor(private pool: Pool) { }

    /**
     * Get garage's own showcase parts
     */
    async getMyShowcaseParts(garageId: string, status?: string): Promise<PartDetail[]> {
        // Verify showcase access
        await this.verifyShowcaseAccess(garageId);

        let query = `
            SELECT gp.*, 
                   (SELECT COUNT(*) FROM orders WHERE bid_id IN 
                       (SELECT bid_id FROM bids WHERE request_id IN 
                           (SELECT request_id FROM part_requests WHERE part_id = gp.part_id))) as orders_count
            FROM garage_parts gp
            WHERE gp.garage_id = $1
        `;
        const params: any[] = [garageId];

        if (status) {
            query += ` AND gp.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY gp.created_at DESC`;

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Add new showcase part
     */
    async addGaragePart(garageId: string, partData: CreatePartData): Promise<PartDetail> {
        // Verify showcase access
        await this.verifyShowcaseAccess(garageId);

        const {
            title,
            part_description,
            car_make,
            car_model,
            car_year,
            price,
            quantity,
            is_negotiable,
            image_urls
        } = partData;

        const result = await this.pool.query(`
            INSERT INTO garage_parts 
            (garage_id, title, part_description, car_make, car_model, car_year, 
             price, quantity, is_negotiable, image_urls, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            RETURNING *
        `, [
            garageId, title, part_description, car_make, car_model, car_year,
            price, quantity, is_negotiable, image_urls || []
        ]);

        return result.rows[0];
    }

    /**
     * Update showcase part
     */
    async updateGaragePart(
        partId: string,
        garageId: string,
        updates: UpdatePartData
    ): Promise<PartDetail> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify ownership
            const check = await client.query(
                'SELECT * FROM garage_parts WHERE part_id = $1 AND garage_id = $2 FOR UPDATE',
                [partId, garageId]
            );

            if (check.rows.length === 0) {
                throw new UnauthorizedPartAccessError(partId, garageId);
            }

            const currentPart = check.rows[0];

            // Handle image removal
            let newImageUrls = currentPart.image_urls || [];
            if (updates.images_to_remove && updates.images_to_remove.length > 0) {
                newImageUrls = newImageUrls.filter(
                    (url: string) => !updates.images_to_remove!.includes(url)
                );
            }

            // Build update query
            const setClauses: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (updates.title) {
                setClauses.push(`title = $${paramIndex++}`);
                params.push(updates.title);
            }
            if (updates.part_description) {
                setClauses.push(`part_description = $${paramIndex++}`);
                params.push(updates.part_description);
            }
            if (updates.car_make) {
                setClauses.push(`car_make = $${paramIndex++}`);
                params.push(updates.car_make);
            }
            if (updates.car_model) {
                setClauses.push(`car_model = $${paramIndex++}`);
                params.push(updates.car_model);
            }
            if (updates.car_year) {
                setClauses.push(`car_year = $${paramIndex++}`);
                params.push(updates.car_year);
            }
            if (updates.price !== undefined) {
                setClauses.push(`price = $${paramIndex++}`);
                params.push(updates.price);
            }
            if (updates.quantity !== undefined) {
                setClauses.push(`quantity = $${paramIndex++}`);
                params.push(updates.quantity);
            }
            if (updates.is_negotiable !== undefined) {
                setClauses.push(`is_negotiable = $${paramIndex++}`);
                params.push(updates.is_negotiable);
            }

            // Always update image_urls if images were removed
            setClauses.push(`image_urls = $${paramIndex++}`);
            params.push(newImageUrls);

            setClauses.push(`updated_at = NOW()`);
            params.push(partId);

            const result = await client.query(`
                UPDATE garage_parts
                SET ${setClauses.join(', ')}
                WHERE part_id = $${paramIndex}
                RETURNING *
            `, params);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Delete showcase part
     */
    async deleteGaragePart(partId: string, garageId: string): Promise<void> {
        const result = await this.pool.query(
            'DELETE FROM garage_parts WHERE part_id = $1 AND garage_id = $2',
            [partId, garageId]
        );

        if (result.rowCount === 0) {
            throw new UnauthorizedPartAccessError(partId, garageId);
        }
    }

    /**
     * Toggle part status (active/hidden)
     */
    async togglePartStatus(partId: string, garageId: string): Promise<PartDetail> {
        const result = await this.pool.query(`
            UPDATE garage_parts
            SET status = CASE WHEN status = 'active' THEN 'hidden' ELSE 'active' END,
                updated_at = NOW()
            WHERE part_id = $1 AND garage_id = $2
            RETURNING *
        `, [partId, garageId]);

        if (result.rows.length === 0) {
            throw new UnauthorizedPartAccessError(partId, garageId);
        }

        return result.rows[0];
    }

    /**
     * Verify garage has showcase feature access
     */
    private async verifyShowcaseAccess(garageId: string): Promise<void> {
        const result = await this.pool.query(`
            SELECT COALESCE(sp.plan_code, 'starter') as plan_code,
                   COALESCE(sp.features, '{}') as features
            FROM garages g
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE g.garage_id = $1
        `, [garageId]);

        if (result.rows.length === 0) {
            throw new Error('Garage not found');
        }

        const { plan_code, features } = result.rows[0];
        const hasShowcase = features?.showcase === true || features?.featured === true || plan_code === 'enterprise';

        if (!hasShowcase) {
            throw new NoShowcaseAccessError(garageId);
        }
    }
}
