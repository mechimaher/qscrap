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

    async getAddresses(userId: string) {
        const result = await this.pool.query(`SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`, [userId]);
        return result.rows;
    }

    async addAddress(userId: string, data: AddressData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const countResult = await client.query('SELECT COUNT(*) FROM user_addresses WHERE user_id = $1', [userId]);
            const isFirst = parseInt(countResult.rows[0].count) === 0;
            const shouldBeDefault = data.is_default || isFirst;
            if (shouldBeDefault) {await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1`, [userId]);}
            const result = await client.query(`INSERT INTO user_addresses (user_id, label, address_text, latitude, longitude, is_default) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [userId, data.label, data.address_text, data.latitude || null, data.longitude || null, shouldBeDefault]);
            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async updateAddress(userId: string, addressId: string, data: AddressData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const check = await client.query('SELECT 1 FROM user_addresses WHERE address_id = $1 AND user_id = $2', [addressId, userId]);
            if (check.rowCount === 0) { await client.query('ROLLBACK'); return null; }
            if (data.is_default) {await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1`, [userId]);}
            const result = await client.query(`UPDATE user_addresses SET label = $1, address_text = $2, latitude = $3, longitude = $4, is_default = COALESCE($5, is_default), updated_at = NOW() WHERE address_id = $6 AND user_id = $7 RETURNING *`, [data.label, data.address_text, data.latitude || null, data.longitude || null, data.is_default, addressId, userId]);
            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async deleteAddress(userId: string, addressId: string) {
        const result = await this.pool.query(`DELETE FROM user_addresses WHERE address_id = $1 AND user_id = $2 RETURNING *`, [addressId, userId]);
        return result.rowCount! > 0;
    }

    async setDefaultAddress(userId: string, addressId: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const check = await client.query('SELECT 1 FROM user_addresses WHERE address_id = $1 AND user_id = $2', [addressId, userId]);
            if (check.rowCount === 0) { await client.query('ROLLBACK'); return false; }
            await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1`, [userId]);
            await client.query(`UPDATE user_addresses SET is_default = TRUE WHERE address_id = $1`, [addressId]);
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
