import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// ============================================
// ADDRESS CONTROLLER
// ============================================

export const getAddresses = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
            [userId]
        );
        res.json({ addresses: result.rows });
    } catch (err) {
        console.error('[ADDRESS] Get addresses error:', err);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

export const addAddress = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { label, address_text, latitude, longitude, is_default } = req.body;

    if (!label || !address_text) {
        return res.status(400).json({ error: 'Label and address text are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // If this is the first address, make it default automatically
        const countResult = await client.query('SELECT COUNT(*) FROM user_addresses WHERE user_id = $1', [userId]);
        const isFirst = parseInt(countResult.rows[0].count) === 0;
        const shouldBeDefault = is_default || isFirst;

        // If setting as default, unset others first
        if (shouldBeDefault) {
            await client.query(
                `UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1`,
                [userId]
            );
        }

        const result = await client.query(
            `INSERT INTO user_addresses 
             (user_id, label, address_text, latitude, longitude, is_default)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, label, address_text, latitude || null, longitude || null, shouldBeDefault]
        );

        await client.query('COMMIT');
        res.status(201).json({ address: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ADDRESS] Add address error:', err);
        res.status(500).json({ error: 'Failed to add address' });
    } finally {
        client.release();
    }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { address_id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM user_addresses WHERE address_id = $1 AND user_id = $2 RETURNING *`,
            [address_id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Address not found' });
        }

        res.json({ message: 'Address deleted' });
    } catch (err) {
        console.error('[ADDRESS] Delete address error:', err);
        res.status(500).json({ error: 'Failed to delete address' });
    }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { address_id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validate own address
        const check = await client.query(
            'SELECT 1 FROM user_addresses WHERE address_id = $1 AND user_id = $2',
            [address_id, userId]
        );
        if (check.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Address not found' });
        }

        // Unset all
        await client.query(
            `UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1`,
            [userId]
        );

        // Set new default
        await client.query(
            `UPDATE user_addresses SET is_default = TRUE WHERE address_id = $1`,
            [address_id]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ADDRESS] Set default error:', err);
        res.status(500).json({ error: 'Failed to update default address' });
    } finally {
        client.release();
    }
};
