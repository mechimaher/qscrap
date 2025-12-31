/**
 * Showcase Controller - Enterprise Parts Marketplace
 * Allows Enterprise-tier garages to showcase parts for direct purchase.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Helper: Get garage's plan features (reused from analytics.controller.ts pattern)
async function getGaragePlanFeatures(garageId: string): Promise<{
    plan_code: string;
    features: any;
    has_showcase: boolean;
}> {
    const result = await pool.query(
        `SELECT COALESCE(sp.plan_code, 'starter') as plan_code,
                COALESCE(sp.features, '{}') as features
         FROM garages g
         LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
         LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
         WHERE g.garage_id = $1`,
        [garageId]
    );

    if (result.rows.length === 0) {
        return { plan_code: 'starter', features: {}, has_showcase: false };
    }

    const { plan_code, features } = result.rows[0];
    const hasShowcase = features?.showcase === true || features?.featured === true || plan_code === 'enterprise';

    return { plan_code, features, has_showcase: hasShowcase };
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/showcase/parts - Browse active showcase parts
 */
export const getShowcaseParts = async (req: AuthRequest, res: Response) => {
    try {
        const { car_make, car_model, search, limit = '20', offset = '0' } = req.query;

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
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await pool.query(query, params);

        res.json({ parts: result.rows });
    } catch (err: any) {
        console.error('getShowcaseParts error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/showcase/parts/featured - Get featured parts for home carousel
 */
export const getFeaturedParts = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT gp.*, g.garage_name, g.rating_average, g.rating_count,
                   COALESCE(sp.plan_code, 'enterprise') as plan_code
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.status = 'active' 
              AND gp.quantity > 0
              AND sp.plan_code = 'enterprise'
            ORDER BY gp.created_at DESC, gp.view_count DESC
            LIMIT 10
        `);

        res.json({ parts: result.rows });
    } catch (err: any) {
        console.error('getFeaturedParts error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/showcase/parts/:id - Get part detail and track view
 */
export const getPartDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const customerId = req.user?.userId;

        const result = await pool.query(`
            SELECT gp.*, g.garage_name, g.rating_average, g.rating_count, g.address,
                   COALESCE(sp.plan_code, 'starter') as plan_code
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.part_id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Part not found' });
        }

        // Increment view count
        await pool.query(
            'UPDATE garage_parts SET view_count = view_count + 1 WHERE part_id = $1',
            [id]
        );

        res.json({ part: result.rows[0] });
    } catch (err: any) {
        console.error('getPartDetail error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// GARAGE ENDPOINTS (Enterprise Only)
// ============================================

/**
 * GET /api/garage/showcase - Get garage's own parts
 */
export const getMyShowcaseParts = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        if (!planInfo.has_showcase) {
            return res.status(403).json({
                error: 'Parts Showcase requires Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['enterprise'],
                upgrade_available: true
            });
        }

        const result = await pool.query(`
            SELECT * FROM garage_parts 
            WHERE garage_id = $1 
            ORDER BY created_at DESC
        `, [garageId]);

        // Get analytics summary
        const analytics = await pool.query(`
            SELECT 
                COUNT(*) as total_parts,
                COUNT(*) FILTER (WHERE status = 'active') as active_parts,
                COUNT(*) FILTER (WHERE status = 'sold') as sold_parts,
                SUM(view_count) as total_views,
                SUM(order_count) as total_orders
            FROM garage_parts WHERE garage_id = $1
        `, [garageId]);

        res.json({
            parts: result.rows,
            analytics: analytics.rows[0]
        });
    } catch (err: any) {
        console.error('getMyShowcaseParts error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/garage/showcase - Add new part (multipart/form-data)
 */
export const addGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const planInfo = await getGaragePlanFeatures(garageId);

        if (!planInfo.has_showcase) {
            return res.status(403).json({
                error: 'Parts Showcase requires Enterprise plan',
                current_plan: planInfo.plan_code,
                required_plans: ['enterprise']
            });
        }

        const {
            title,
            part_description,
            part_number,
            car_make,
            car_model,
            car_year_from,
            car_year_to,
            part_condition,
            price,
            price_type,
            warranty_days,
            quantity
        } = req.body;

        // Handle uploaded images
        const files = req.files as Express.Multer.File[];
        const image_urls = files ? files.map(file => `/uploads/${file.filename}`) : [];

        if (!title || !car_make || !part_condition || !price) {
            return res.status(400).json({ error: 'Title, car make, condition, and price are required' });
        }

        const result = await pool.query(`
            INSERT INTO garage_parts (
                garage_id, title, part_description, part_number,
                car_make, car_model, car_year_from, car_year_to,
                part_condition, price, price_type, warranty_days,
                quantity, image_urls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            garageId, title, part_description, part_number,
            car_make, car_model, car_year_from || null, car_year_to || null,
            part_condition, price, price_type || 'fixed', warranty_days || 0,
            quantity || 1, image_urls
        ]);

        res.status(201).json({
            message: 'Part added to showcase',
            part: result.rows[0]
        });
    } catch (err: any) {
        console.error('addGaragePart error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * PUT /api/garage/showcase/:id - Update part
 */
export const updateGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { id } = req.params;

    try {
        // Verify ownership
        const existing = await pool.query(
            'SELECT part_id FROM garage_parts WHERE part_id = $1 AND garage_id = $2',
            [id, garageId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Part not found or not yours' });
        }

        const {
            title,
            part_description,
            part_number,
            car_make,
            car_model,
            car_year_from,
            car_year_to,
            part_condition,
            price,
            price_type,
            warranty_days,
            quantity,
            status
        } = req.body;

        // Handle new images if uploaded
        const files = req.files as Express.Multer.File[];
        let image_urls_update = '';
        const params: any[] = [];
        let paramIndex = 1;

        if (files && files.length > 0) {
            const new_image_urls = files.map(file => `/uploads/${file.filename}`);
            image_urls_update = `, image_urls = $${paramIndex++}`;
            params.push(new_image_urls);
        }

        const result = await pool.query(`
            UPDATE garage_parts SET
                title = COALESCE($${paramIndex++}, title),
                part_description = COALESCE($${paramIndex++}, part_description),
                part_number = COALESCE($${paramIndex++}, part_number),
                car_make = COALESCE($${paramIndex++}, car_make),
                car_model = COALESCE($${paramIndex++}, car_model),
                car_year_from = COALESCE($${paramIndex++}, car_year_from),
                car_year_to = COALESCE($${paramIndex++}, car_year_to),
                part_condition = COALESCE($${paramIndex++}, part_condition),
                price = COALESCE($${paramIndex++}, price),
                price_type = COALESCE($${paramIndex++}, price_type),
                warranty_days = COALESCE($${paramIndex++}, warranty_days),
                quantity = COALESCE($${paramIndex++}, quantity),
                status = COALESCE($${paramIndex++}, status),
                updated_at = CURRENT_TIMESTAMP
                ${image_urls_update}
            WHERE part_id = $${paramIndex++} AND garage_id = $${paramIndex}
            RETURNING *
        `, [
            ...params,
            title, part_description, part_number, car_make, car_model,
            car_year_from, car_year_to, part_condition, price, price_type,
            warranty_days, quantity, status, id, garageId
        ]);

        res.json({ message: 'Part updated', part: result.rows[0] });
    } catch (err: any) {
        console.error('updateGaragePart error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * DELETE /api/garage/showcase/:id - Remove part
 */
export const deleteGaragePart = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM garage_parts WHERE part_id = $1 AND garage_id = $2 RETURNING part_id',
            [id, garageId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Part not found or not yours' });
        }

        res.json({ message: 'Part removed from showcase' });
    } catch (err: any) {
        console.error('deleteGaragePart error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/garage/showcase/:id/toggle - Toggle active/hidden
 */
export const togglePartStatus = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE garage_parts 
            SET status = CASE WHEN status = 'active' THEN 'hidden' ELSE 'active' END,
                updated_at = CURRENT_TIMESTAMP
            WHERE part_id = $1 AND garage_id = $2
            RETURNING part_id, status
        `, [id, garageId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Part not found or not yours' });
        }

        res.json({ message: 'Status toggled', status: result.rows[0].status });
    } catch (err: any) {
        console.error('togglePartStatus error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// CUSTOMER ORDER ENDPOINTS
// ============================================

/**
 * POST /api/showcase/quick-order - Order part directly (fixed price)
 */
export const quickOrderFromShowcase = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const client = await pool.connect();

    try {
        const { part_id, delivery_address_id } = req.body;

        if (!part_id) {
            return res.status(400).json({ error: 'Part ID is required' });
        }

        await client.query('BEGIN');

        // Get part details
        const partResult = await client.query(`
            SELECT gp.*, g.garage_id, g.garage_name,
                   COALESCE(sp.commission_rate, 0.15) as commission_rate
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE gp.part_id = $1 AND gp.status = 'active' AND gp.quantity > 0
            FOR UPDATE
        `, [part_id]);

        if (partResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Part not available' });
        }

        const part = partResult.rows[0];

        // Check price type
        if (part.price_type === 'negotiable') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'This part requires a quote request',
                action: 'request_quote'
            });
        }

        // Get delivery address
        let deliveryAddress = null;
        if (delivery_address_id) {
            const addrResult = await client.query(
                'SELECT address_text, latitude, longitude FROM addresses WHERE address_id = $1 AND user_id = $2',
                [delivery_address_id, customerId]
            );
            if (addrResult.rows.length > 0) {
                deliveryAddress = addrResult.rows[0];
            }
        }

        // Calculate fees
        const partPrice = parseFloat(part.price);
        const platformFee = Math.round(partPrice * part.commission_rate * 100) / 100;
        const deliveryFee = 25; // Standard delivery fee
        const totalAmount = partPrice + deliveryFee;
        const garagePayoutAmount = partPrice - platformFee;

        // Create order directly
        const orderResult = await client.query(`
            INSERT INTO orders (
                customer_id, garage_id, 
                part_price, platform_fee, delivery_fee, total_amount, garage_payout_amount,
                order_status, payment_method, payment_status,
                delivery_address, delivery_lat, delivery_lng,
                order_source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', 'cash', 'pending', $8, $9, $10, 'showcase')
            RETURNING *
        `, [
            customerId, part.garage_id,
            partPrice, platformFee, deliveryFee, totalAmount, garagePayoutAmount,
            deliveryAddress?.address_text || null,
            deliveryAddress?.latitude || null,
            deliveryAddress?.longitude || null
        ]);

        // Update part quantity and order count
        await client.query(`
            UPDATE garage_parts 
            SET quantity = quantity - 1, 
                order_count = order_count + 1,
                status = CASE WHEN quantity - 1 <= 0 THEN 'sold' ELSE status END
            WHERE part_id = $1
        `, [part_id]);

        await client.query('COMMIT');

        // TODO: Send notification to garage via Socket.IO

        res.status(201).json({
            message: 'Order created successfully',
            order: orderResult.rows[0],
            part: {
                title: part.title,
                garage_name: part.garage_name
            }
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('quickOrderFromShowcase error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * POST /api/showcase/request-quote - Request quote for negotiable part
 * Creates a part_request pre-filled and auto-bid from the showcase garage
 */
export const requestQuoteFromShowcase = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const client = await pool.connect();

    try {
        const { part_id, delivery_address_id, notes } = req.body;

        if (!part_id) {
            return res.status(400).json({ error: 'Part ID is required' });
        }

        await client.query('BEGIN');

        // Get part details
        const partResult = await client.query(`
            SELECT gp.*, g.garage_id, g.garage_name
            FROM garage_parts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            WHERE gp.part_id = $1 AND gp.status = 'active'
        `, [part_id]);

        if (partResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Part not found' });
        }

        const part = partResult.rows[0];

        // Get delivery address
        let deliveryAddress = { address_text: null, latitude: null, longitude: null };
        if (delivery_address_id) {
            const addrResult = await client.query(
                'SELECT address_text, latitude, longitude FROM addresses WHERE address_id = $1 AND user_id = $2',
                [delivery_address_id, customerId]
            );
            if (addrResult.rows.length > 0) {
                deliveryAddress = addrResult.rows[0];
            }
        }

        // Create part request
        const requestResult = await client.query(`
            INSERT INTO part_requests (
                customer_id, car_make, car_model, car_year,
                part_description, condition_required, image_urls,
                delivery_address_text, delivery_lat, delivery_lng, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            RETURNING *
        `, [
            customerId, part.car_make, part.car_model || 'Any',
            part.car_year_from || new Date().getFullYear(),
            `${part.title} - ${part.part_description || ''}`.trim(),
            part.part_condition === 'new' ? 'new' : 'any',
            part.image_urls,
            deliveryAddress.address_text,
            deliveryAddress.latitude,
            deliveryAddress.longitude
        ]);

        const request = requestResult.rows[0];

        // Auto-create bid from showcase garage
        await client.query(`
            INSERT INTO bids (
                request_id, garage_id, bid_amount, part_condition,
                warranty_days, image_urls, notes, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        `, [
            request.request_id, part.garage_id, part.price, part.part_condition,
            part.warranty_days, part.image_urls,
            `Showcase part: ${part.title}` + (notes ? ` - Customer note: ${notes}` : '')
        ]);

        // Update bid count
        await client.query(
            'UPDATE part_requests SET bid_count = 1 WHERE request_id = $1',
            [request.request_id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Quote request created. Garage bid pre-filled, other garages can also bid.',
            request: request,
            source_part: {
                title: part.title,
                garage_name: part.garage_name,
                asking_price: part.price
            }
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('requestQuoteFromShowcase error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};
