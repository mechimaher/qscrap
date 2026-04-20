"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductDetails = exports.searchCatalog = exports.getCatalogStats = exports.toggleFeatured = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProducts = void 0;
const db_1 = __importDefault(require("../config/db"));
// ============================================
// PLAN LIMITS
// ============================================
const PLAN_LIMITS = {
    starter: 0, // No catalog access
    professional: 50, // 50 products max
    enterprise: -1 // Unlimited (-1)
};
// Helper: Get garage's plan and product count
async function getGaragePlanAndCount(garageId) {
    const result = await db_1.default.query(`SELECT 
            COALESCE(sp.plan_code, 'starter') as plan_code,
            (SELECT COUNT(*) FROM garage_products WHERE garage_id = $1 AND status != 'archived') as product_count
         FROM garages g
         LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
         LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
         WHERE g.garage_id = $1`, [garageId]);
    if (result.rows.length === 0) {
        return { plan_code: 'starter', product_count: 0, limit: 0, can_feature: false };
    }
    const { plan_code, product_count } = result.rows[0];
    const limit = PLAN_LIMITS[plan_code] ?? 0;
    const can_feature = plan_code === 'enterprise';
    return { plan_code, product_count: parseInt(product_count), limit, can_feature };
}
// ============================================
// CATALOG CONTROLLERS
// ============================================
// GET /api/garage/catalog - List garage's products
const getProducts = async (req, res) => {
    const garageId = req.user.userId;
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    try {
        const planInfo = await getGaragePlanAndCount(garageId);
        if (planInfo.plan_code === 'starter') {
            return res.status(403).json({
                error: 'Catalog requires Professional or Enterprise plan',
                current_plan: 'starter',
                upgrade_available: true
            });
        }
        let whereClause = 'WHERE garage_id = $1';
        const params = [garageId];
        if (status !== 'all') {
            whereClause += ` AND status = $2`;
            params.push(status);
        }
        // Get products
        const result = await db_1.default.query(`SELECT * FROM garage_products 
             ${whereClause}
             ORDER BY 
                 CASE WHEN is_featured THEN 0 ELSE 1 END,
                 created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
        // Get total count
        const countResult = await db_1.default.query(`SELECT COUNT(*) FROM garage_products ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);
        res.json({
            products: result.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            plan: {
                code: planInfo.plan_code,
                product_count: planInfo.product_count,
                limit: planInfo.limit,
                can_feature: planInfo.can_feature,
                remaining: planInfo.limit === -1 ? 'unlimited' : planInfo.limit - planInfo.product_count
            }
        });
    }
    catch (err) {
        console.error('getProducts error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getProducts = getProducts;
// POST /api/garage/catalog - Create product
const createProduct = async (req, res) => {
    const garageId = req.user.userId;
    const { title, description, part_number, brand, category, condition, warranty_days, price, original_price, quantity, compatible_makes, compatible_models, year_from, year_to, status } = req.body;
    try {
        const planInfo = await getGaragePlanAndCount(garageId);
        if (planInfo.plan_code === 'starter') {
            return res.status(403).json({
                error: 'Catalog requires Professional or Enterprise plan',
                upgrade_available: true
            });
        }
        // Check limit
        if (planInfo.limit !== -1 && planInfo.product_count >= planInfo.limit) {
            return res.status(403).json({
                error: `Product limit reached (${planInfo.limit})`,
                current_count: planInfo.product_count,
                limit: planInfo.limit,
                upgrade_available: planInfo.plan_code === 'professional'
            });
        }
        // Validate required fields
        if (!title || !price || !condition) {
            return res.status(400).json({
                error: 'Missing required fields: title, price, condition'
            });
        }
        // Handle uploaded images
        const files = req.files;
        const image_urls = files ? files.map(f => '/' + f.path.replace(/\\/g, '/')) : [];
        const result = await db_1.default.query(`INSERT INTO garage_products (
                garage_id, title, description, part_number, brand, category,
                condition, warranty_days, price, original_price, quantity,
                compatible_makes, compatible_models, year_from, year_to,
                image_urls, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING *`, [
            garageId, title, description || null, part_number || null, brand || null, category || null,
            condition, warranty_days || 0, price, original_price || null, quantity || 1,
            compatible_makes || [], compatible_models || [], year_from || null, year_to || null,
            image_urls, status || 'draft'
        ]);
        res.status(201).json({
            message: 'Product created',
            product: result.rows[0],
            plan: {
                product_count: planInfo.product_count + 1,
                limit: planInfo.limit,
                remaining: planInfo.limit === -1 ? 'unlimited' : planInfo.limit - planInfo.product_count - 1
            }
        });
    }
    catch (err) {
        console.error('createProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.createProduct = createProduct;
// PUT /api/garage/catalog/:id - Update product
const updateProduct = async (req, res) => {
    const garageId = req.user.userId;
    const { id } = req.params;
    const updates = req.body;
    try {
        // Verify ownership
        const existing = await db_1.default.query('SELECT * FROM garage_products WHERE product_id = $1 AND garage_id = $2', [id, garageId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // Build dynamic update query
        const allowedFields = [
            'title', 'description', 'part_number', 'brand', 'category',
            'condition', 'warranty_days', 'price', 'original_price', 'quantity',
            'compatible_makes', 'compatible_models', 'year_from', 'year_to',
            'status'
        ];
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = $${paramIndex++}`);
                values.push(updates[field]);
            }
        }
        // Handle new images if uploaded
        const files = req.files;
        if (files && files.length > 0) {
            const new_urls = files.map(f => '/' + f.path.replace(/\\/g, '/'));
            const combined = [...(existing.rows[0].image_urls || []), ...new_urls];
            setClauses.push(`image_urls = $${paramIndex++}`);
            values.push(combined);
        }
        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(id, garageId);
        const result = await db_1.default.query(`UPDATE garage_products 
             SET ${setClauses.join(', ')}
             WHERE product_id = $${paramIndex++} AND garage_id = $${paramIndex}
             RETURNING *`, values);
        res.json({ message: 'Product updated', product: result.rows[0] });
    }
    catch (err) {
        console.error('updateProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.updateProduct = updateProduct;
// DELETE /api/garage/catalog/:id - Delete product
const deleteProduct = async (req, res) => {
    const garageId = req.user.userId;
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM garage_products WHERE product_id = $1 AND garage_id = $2 RETURNING product_id, title', [id, garageId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted', deleted: result.rows[0] });
    }
    catch (err) {
        console.error('deleteProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.deleteProduct = deleteProduct;
// POST /api/garage/catalog/:id/feature - Toggle featured (Enterprise only)
const toggleFeatured = async (req, res) => {
    const garageId = req.user.userId;
    const { id } = req.params;
    try {
        const planInfo = await getGaragePlanAndCount(garageId);
        if (!planInfo.can_feature) {
            return res.status(403).json({
                error: 'Featured products requires Enterprise plan',
                current_plan: planInfo.plan_code
            });
        }
        const result = await db_1.default.query(`UPDATE garage_products 
             SET is_featured = NOT is_featured, updated_at = NOW()
             WHERE product_id = $1 AND garage_id = $2
             RETURNING product_id, title, is_featured`, [id, garageId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({
            message: result.rows[0].is_featured ? 'Product featured' : 'Product unfeatured',
            product: result.rows[0]
        });
    }
    catch (err) {
        console.error('toggleFeatured error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.toggleFeatured = toggleFeatured;
// GET /api/garage/catalog/stats - Catalog analytics
const getCatalogStats = async (req, res) => {
    const garageId = req.user.userId;
    try {
        const planInfo = await getGaragePlanAndCount(garageId);
        if (planInfo.plan_code === 'starter') {
            return res.status(403).json({
                error: 'Catalog requires Professional or Enterprise plan'
            });
        }
        const stats = await db_1.default.query(`SELECT 
                COUNT(*) FILTER (WHERE status = 'active') as active_products,
                COUNT(*) FILTER (WHERE status = 'draft') as draft_products,
                COUNT(*) FILTER (WHERE status = 'sold') as sold_products,
                SUM(view_count) as total_views,
                SUM(inquiry_count) as total_inquiries,
                SUM(purchase_count) as total_purchases,
                AVG(price) as avg_price
             FROM garage_products
             WHERE garage_id = $1 AND status != 'archived'`, [garageId]);
        // Top performing products
        const topProducts = await db_1.default.query(`SELECT product_id, title, view_count, inquiry_count, price
             FROM garage_products
             WHERE garage_id = $1 AND status = 'active'
             ORDER BY inquiry_count DESC, view_count DESC
             LIMIT 5`, [garageId]);
        res.json({
            summary: {
                active: parseInt(stats.rows[0].active_products) || 0,
                drafts: parseInt(stats.rows[0].draft_products) || 0,
                sold: parseInt(stats.rows[0].sold_products) || 0,
                total_views: parseInt(stats.rows[0].total_views) || 0,
                total_inquiries: parseInt(stats.rows[0].total_inquiries) || 0,
                total_purchases: parseInt(stats.rows[0].total_purchases) || 0,
                avg_price: parseFloat(stats.rows[0].avg_price) || 0
            },
            top_products: topProducts.rows,
            plan: planInfo
        });
    }
    catch (err) {
        console.error('getCatalogStats error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getCatalogStats = getCatalogStats;
// GET /api/catalog/search - Customer search (public)
const searchCatalog = async (req, res) => {
    const { q, make, model, year, category, condition, minPrice, maxPrice } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    try {
        let whereClause = "WHERE gp.status = 'active'";
        const params = [];
        let paramIndex = 1;
        // Text search
        if (q) {
            whereClause += ` AND (gp.title ILIKE $${paramIndex} OR gp.description ILIKE $${paramIndex} OR gp.part_number ILIKE $${paramIndex})`;
            params.push(`%${q}%`);
            paramIndex++;
        }
        // Vehicle compatibility
        if (make) {
            whereClause += ` AND $${paramIndex} = ANY(gp.compatible_makes)`;
            params.push(make);
            paramIndex++;
        }
        if (model) {
            whereClause += ` AND $${paramIndex} = ANY(gp.compatible_models)`;
            params.push(model);
            paramIndex++;
        }
        if (year) {
            const yearNum = parseInt(year);
            whereClause += ` AND (gp.year_from IS NULL OR gp.year_from <= $${paramIndex}) AND (gp.year_to IS NULL OR gp.year_to >= $${paramIndex})`;
            params.push(yearNum);
            paramIndex++;
        }
        // Filters
        if (category) {
            whereClause += ` AND gp.category = $${paramIndex++}`;
            params.push(category);
        }
        if (condition) {
            whereClause += ` AND gp.condition = $${paramIndex++}`;
            params.push(condition);
        }
        if (minPrice) {
            whereClause += ` AND gp.price >= $${paramIndex++}`;
            params.push(parseFloat(minPrice));
        }
        if (maxPrice) {
            whereClause += ` AND gp.price <= $${paramIndex++}`;
            params.push(parseFloat(maxPrice));
        }
        const result = await db_1.default.query(`SELECT gp.*, g.garage_name, g.rating_average, g.rating_count,
                    COALESCE(sp.plan_code, 'starter') as seller_plan
             FROM garage_products gp
             JOIN garages g ON gp.garage_id = g.garage_id
             LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             ${whereClause}
             ORDER BY 
                 gp.is_featured DESC,
                 CASE sp.plan_code WHEN 'enterprise' THEN 0 WHEN 'professional' THEN 1 ELSE 2 END,
                 gp.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...params, limit, offset]);
        const countResult = await db_1.default.query(`SELECT COUNT(*) FROM garage_products gp ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);
        res.json({
            products: result.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    }
    catch (err) {
        console.error('searchCatalog error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.searchCatalog = searchCatalog;
// GET /api/catalog/:id - Product details (increments view count)
const getProductDetails = async (req, res) => {
    const { id } = req.params;
    try {
        // Increment view count
        const result = await db_1.default.query(`UPDATE garage_products 
             SET view_count = view_count + 1
             WHERE product_id = $1 AND status = 'active'
             RETURNING *`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // Get seller info
        const seller = await db_1.default.query(`SELECT g.garage_name, g.rating_average, g.rating_count, g.total_transactions,
                    COALESCE(sp.plan_code, 'starter') as plan_code
             FROM garages g
             LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status = 'active'
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE g.garage_id = $1`, [result.rows[0].garage_id]);
        res.json({
            product: result.rows[0],
            seller: seller.rows[0] || null
        });
    }
    catch (err) {
        console.error('getProductDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getProductDetails = getProductDetails;
