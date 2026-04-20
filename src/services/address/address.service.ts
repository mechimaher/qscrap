/**
 * Address Service
 * Handles user address CRUD operations
 */
import { Pool } from 'pg';

export interface AddressData {
    label: string;
    address_text: string;
    latitude?: number;
    longitude?: number;
    is_default?: boolean;
}

export class AddressService {
    constructor(private pool: Pool) { }

    async getAddresses(customerId: string) {
        const result = await this.pool.query(
            `SELECT address_id, label, address_line, area, city, location_lat, location_lng, delivery_notes, is_default, created_at, updated_at 
             FROM customer_addresses 
             WHERE customer_id = $1 
             ORDER BY is_default DESC, created_at DESC`, 
            [customerId]
        );
        return result.rows;
    }

    async addAddress(customerId: string, data: AddressData & { area?: string; city?: string; delivery_notes?: string }) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const countResult = await client.query('SELECT COUNT(*) FROM customer_addresses WHERE customer_id = $1', [customerId]);
            const isFirst = parseInt(countResult.rows[0].count) === 0;
            const shouldBeDefault = data.is_default || isFirst;
            if (shouldBeDefault) {
                await client.query(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
            }

            const result = await client.query(
                `INSERT INTO customer_addresses (customer_id, label, address_line, area, city, location_lat, location_lng, delivery_notes, is_default) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                 RETURNING *`, 
                [
                    customerId, 
                    data.label, 
                    data.address_text, 
                    data.area || null, 
                    data.city || 'Doha', 
                    data.latitude || null, 
                    data.longitude || null, 
                    data.delivery_notes || null, 
                    shouldBeDefault
                ]
            );
            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async updateAddress(customerId: string, addressId: string, data: Partial<AddressData & { area?: string; city?: string; delivery_notes?: string }>) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const check = await client.query('SELECT 1 FROM customer_addresses WHERE address_id = $1 AND customer_id = $2', [addressId, customerId]);
            if (check.rowCount === 0) { 
                await client.query('ROLLBACK'); 
                return null; 
            }

            if (data.is_default) {
                await client.query(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
            }

            const result = await client.query(
                `UPDATE customer_addresses 
                 SET label = COALESCE($1, label), 
                     address_line = COALESCE($2, address_line), 
                     area = COALESCE($3, area),
                     city = COALESCE($4, city),
                     location_lat = COALESCE($5, location_lat), 
                     location_lng = COALESCE($6, location_lng), 
                     delivery_notes = COALESCE($7, delivery_notes),
                     is_default = COALESCE($8, is_default), 
                     updated_at = NOW() 
                 WHERE address_id = $9 AND customer_id = $10 
                 RETURNING *`, 
                [
                    data.label, 
                    data.address_text, 
                    data.area,
                    data.city,
                    data.latitude, 
                    data.longitude, 
                    data.delivery_notes,
                    data.is_default, 
                    addressId, 
                    customerId
                ]
            );
            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async deleteAddress(customerId: string, addressId: string) {
        const result = await this.pool.query(
            `DELETE FROM customer_addresses WHERE address_id = $1 AND customer_id = $2 RETURNING *`, 
            [addressId, customerId]
        );
        return (result.rowCount || 0) > 0;
    }

    async setDefaultAddress(customerId: string, addressId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const check = await client.query('SELECT 1 FROM customer_addresses WHERE address_id = $1 AND customer_id = $2', [addressId, customerId]);
            if (check.rowCount === 0) { 
                await client.query('ROLLBACK'); 
                return false; 
            }
            await client.query(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
            await client.query(`UPDATE customer_addresses SET is_default = TRUE WHERE address_id = $1`, [addressId]);
            await client.query('COMMIT');
            return true;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
