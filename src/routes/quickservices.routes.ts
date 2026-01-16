import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/services/quick/request
 * Create a quick service request (battery, wash, oil, etc)
 */
router.post('/quick/request', authenticateToken, async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const {
        service_type, // battery, wash, oil, tire, ac, breakdown
        location_lat,
        location_lng,
        location_address,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        notes
    } = req.body;

    try {
        // Validate service type
        const validTypes = ['battery', 'wash', 'oil', 'tire', 'ac', 'breakdown'];
        if (!validTypes.includes(service_type)) {
            return res.status(400).json({ error: 'Invalid service type' });
        }

        // Create request
        const result = await pool.query(
            `INSERT INTO quick_service_requests (
                customer_id, service_type, location_lat, location_lng, 
                location_address, vehicle_make, vehicle_model, vehicle_year, 
                notes, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            RETURNING *`,
            [
                customerId, service_type, location_lat, location_lng,
                location_address, vehicle_make, vehicle_model, vehicle_year,
                notes, 'pending'
            ]
        );

        const request = result.rows[0];

        res.json({
            success: true,
            message: 'Quick service request created successfully',
            request: {
                request_id: request.request_id,
                service_type: request.service_type,
                status: request.status,
                created_at: request.created_at
            }
        });
    } catch (error) {
        console.error('Error creating quick service request:', error);
        res.status(500).json({ error: 'Failed to create service request' });
    }
});

/**
 * GET /api/services/quick/my-requests
 * Get customer's quick service requests
 */
router.get('/quick/my-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT 
                qsr.*,
                u.full_name as customer_name,
                u.phone as customer_phone
            FROM quick_service_requests qsr
            JOIN users u ON qsr.customer_id = u.user_id
            WHERE qsr.customer_id = $1
            ORDER BY qsr.created_at DESC
            LIMIT 50`,
            [customerId]
        );

        res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('Error fetching quick service requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

/**
 * GET /api/services/quick/pricing
 * Get pricing information for quick services
 */
router.get('/quick/pricing', async (req: Request, res: Response) => {
    const pricing = {
        battery: { min: 150, max: 250, currency: 'QAR', duration: 30 },
        wash: { min: 80, max: 120, currency: 'QAR', duration: 45 },
        oil: { min: 120, max: 200, currency: 'QAR', duration: 30 },
        tire: { min: 50, max: 150, currency: 'QAR', duration: 20 },
        ac: { min: 200, max: 300, currency: 'QAR', duration: 45 },
        breakdown: { min: 0, max: 0, currency: 'QAR', duration: 30, note: 'Free diagnosis' }
    };

    res.json({ success: true, pricing });
});

export default router;
