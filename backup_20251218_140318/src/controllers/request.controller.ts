import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import fs from 'fs/promises';

// ============================================
// VALIDATION HELPERS
// ============================================

const validateCarYear = (year: any): { valid: boolean; value: number; message?: string } => {
    const currentYear = new Date().getFullYear();
    const numYear = parseInt(year, 10);

    if (isNaN(numYear)) {
        return { valid: false, value: 0, message: 'Car year must be a number' };
    }
    if (numYear < 1900) {
        return { valid: false, value: 0, message: 'Car year must be 1900 or later' };
    }
    if (numYear > currentYear + 2) {
        return { valid: false, value: 0, message: `Car year cannot be more than ${currentYear + 2}` };
    }
    return { valid: true, value: numYear };
};

const validateVIN = (vin: string | undefined): { valid: boolean; message?: string } => {
    if (!vin || vin.trim() === '') {
        return { valid: true }; // VIN is optional
    }
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
        return { valid: false, message: 'VIN number must be exactly 17 characters' };
    }
    // Basic VIN format check (alphanumeric, no I, O, Q)
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
        return { valid: false, message: 'Invalid VIN format' };
    }
    return { valid: true };
};

const validateConditionRequired = (condition: string | undefined): { valid: boolean; message?: string } => {
    const validConditions = ['new', 'used', 'any'];
    const cond = (condition || 'any').toLowerCase();

    if (!validConditions.includes(cond)) {
        return { valid: false, message: `Condition must be one of: ${validConditions.join(', ')}` };
    }
    return { valid: true };
};

const validateStringLength = (value: string, fieldName: string, maxLength: number): { valid: boolean; message?: string } => {
    if (value && value.length > maxLength) {
        return { valid: false, message: `${fieldName} cannot exceed ${maxLength} characters` };
    }
    return { valid: true };
};

export const createRequest = async (req: AuthRequest, res: Response) => {
    const {
        car_make,
        car_model,
        car_year,
        vin_number,
        part_description,
        part_number,
        part_category,
        condition_required,
        delivery_address_text
    } = req.body;
    const userId = req.user!.userId;

    // ============================================
    // INPUT VALIDATION
    // ============================================

    // Required fields
    if (!car_make || !car_model || !car_year || !part_description) {
        return res.status(400).json({
            error: 'Missing required fields: car_make, car_model, car_year, part_description'
        });
    }

    // Validate car_year
    const yearCheck = validateCarYear(car_year);
    if (!yearCheck.valid) {
        return res.status(400).json({ error: yearCheck.message });
    }

    // Validate VIN if provided
    const vinCheck = validateVIN(vin_number);
    if (!vinCheck.valid) {
        return res.status(400).json({ error: vinCheck.message });
    }

    // Validate condition_required
    const conditionCheck = validateConditionRequired(condition_required);
    if (!conditionCheck.valid) {
        return res.status(400).json({ error: conditionCheck.message });
    }

    // String length validations
    const descCheck = validateStringLength(part_description, 'Part description', 1000);
    if (!descCheck.valid) {
        return res.status(400).json({ error: descCheck.message });
    }

    const makeCheck = validateStringLength(car_make, 'Car make', 100);
    if (!makeCheck.valid) {
        return res.status(400).json({ error: makeCheck.message });
    }

    const modelCheck = validateStringLength(car_model, 'Car model', 100);
    if (!modelCheck.valid) {
        return res.status(400).json({ error: modelCheck.message });
    }

    // Handle files - normalize paths to /uploads/filename format
    const files = req.files as Express.Multer.File[];
    const image_urls = files ? files.map(f => '/' + f.path.replace(/\\/g, '/')) : [];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO part_requests
      (customer_id, car_make, car_model, car_year, vin_number, part_description, part_number, condition_required, image_urls, delivery_address_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING request_id, created_at`,
            [userId, car_make, car_model, yearCheck.value, vin_number || null, part_description, part_number || null, condition_required || 'any', image_urls, delivery_address_text]
        );

        const request = result.rows[0];
        await client.query('COMMIT');

        // Notify Garages - broadcast to all connected garage sockets with complete request data
        try {
            (global as any).io?.emit('new_request', {
                request_id: request.request_id,
                car_make,
                car_model,
                car_year: yearCheck.value,
                vin_number: vin_number || null,
                part_description,
                part_number: part_number || null,
                part_category: part_category || null,
                condition_required: condition_required || 'any',
                image_urls: image_urls,
                delivery_address_text: delivery_address_text || null,
                status: 'active',
                created_at: request.created_at,
                bid_count: 0
            });
        } catch (socketErr) {
            console.error('[REQUEST] Socket.IO emit failed:', socketErr);
            // Don't fail the request creation if socket fails
        }

        res.status(201).json({ message: 'Request created', request_id: request.request_id });
    } catch (err: any) {
        await client.query('ROLLBACK');

        // Cleanup uploaded files on error
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    await fs.unlink(file.path);
                    console.log(`[REQUEST] Cleaned up file: ${file.path}`);
                } catch (unlinkErr) {
                    console.error('[REQUEST] File cleanup error:', unlinkErr);
                }
            }
        }

        console.error('[REQUEST] Create request error:', err);
        res.status(500).json({ error: 'Failed to create request. Please try again.' });
    } finally {
        client.release();
    }
};

export const getActiveRequests = async (req: AuthRequest, res: Response) => {
    // For Garages
    try {
        const result = await pool.query(
            `SELECT * FROM part_requests 
       WHERE status = 'active' 
       ORDER BY created_at DESC LIMIT 50`
        );
        res.json({ requests: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const getMyRequests = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    try {
        const result = await pool.query(
            `SELECT * FROM part_requests WHERE customer_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        res.json({ requests: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const getRequestDetails = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const requestResult = await pool.query(
            'SELECT * FROM part_requests WHERE request_id = $1',
            [request_id]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requestResult.rows[0];

        // Access Check
        if (userType === 'customer' && request.customer_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get Bids with latest counter-offer info
        const bidsResult = await pool.query(
            `SELECT b.*, g.garage_name, g.rating_average as garage_rating, g.rating_count as garage_review_count, g.total_transactions,
                    (SELECT co.proposed_amount 
                     FROM counter_offers co 
                     WHERE co.bid_id = b.bid_id 
                       AND co.offered_by_type = 'garage' 
                       AND co.status = 'pending'
                     ORDER BY co.created_at DESC LIMIT 1) as garage_counter_amount,
                    (SELECT co.message 
                     FROM counter_offers co 
                     WHERE co.bid_id = b.bid_id 
                       AND co.offered_by_type = 'garage' 
                       AND co.status = 'pending'
                     ORDER BY co.created_at DESC LIMIT 1) as garage_counter_message,
                    (SELECT co.counter_offer_id 
                     FROM counter_offers co 
                     WHERE co.bid_id = b.bid_id 
                       AND co.offered_by_type = 'garage' 
                       AND co.status = 'pending'
                     ORDER BY co.created_at DESC LIMIT 1) as garage_counter_id
             FROM bids b
             JOIN garages g ON b.garage_id = g.garage_id
             WHERE b.request_id = $1 AND b.status = 'pending'
             ORDER BY b.created_at ASC`,
            [request_id]
        );

        let bids = bidsResult.rows;
        // Anonymize for customer (keep garage_id for reviews, anonymize name)
        if (userType === 'customer') {
            bids = bids.map((bid: any, i: number) => ({
                ...bid,
                garage_name: `Garage ${i + 1}`,
                // Keep garage_id for reviews modal
                garage_rating: bid.garage_rating,
                garage_review_count: bid.garage_review_count,
                total_transactions: bid.total_transactions
            }));
        }

        res.json({ request, bids });
    } catch (err: any) {
        console.error('[REQUEST] Get request details error:', err);
        res.status(500).json({ error: 'Failed to fetch request details' });
    }
};
