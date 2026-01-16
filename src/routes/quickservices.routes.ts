import { Request, Response, Router } from 'express';
import pool from '../config/db';
import { authenticateToken } from '../middleware/auth.middleware';
import { io } from '../server';

const router = Router();

/**
 * Quick Service Assignment Logic
 * Finds nearest capable garage and notifies them
 */
async function assignQuickService(requestId: string, serviceType: string, lat: number, lng: number) {
    try {
        // Find nearby garages with quick service capability
        const garagesQuery = await pool.query(`
            SELECT 
                garage_id,
                garage_name,
                phone,
                ST_Distance(
                    location,
                    ST_SetSRID(ST_Point($1, $2), 4326)::geography
                ) / 1000 as distance_km
            FROM garages
            WHERE 
                approval_status = 'approved'
                AND provides_quick_services = true
                AND $3 = ANY(quick_services_offered)
                AND ST_DWithin(
                    location,
                    ST_SetSRID(ST_Point($1, $2), 4326)::geography,
                    mobile_service_radius_km * 1000
                )
            ORDER BY distance_km ASC
            LIMIT 5
        `, [lng, lat, serviceType]);

        if (garagesQuery.rows.length === 0) {
            console.log('[QuickService] No nearby garages found for', serviceType);
            return { success: false, error: 'No service providers available in your area' };
        }

        // Assign to closest garage
        const assignedGarage = garagesQuery.rows[0];

        await pool.query(`
            UPDATE quick_service_requests
            SET 
                assigned_garage_id = $1,
                status = 'assigned',
                assigned_at = NOW()
            WHERE request_id = $2
        `, [assignedGarage.garage_id, requestId]);

        // Get full request details for notification
        const requestDetails = await pool.query(`
            SELECT 
                qsr.*,
                u.full_name as customer_name,
                u.phone as customer_phone
            FROM quick_service_requests qsr
            JOIN users u ON qsr.customer_id = u.user_id
            WHERE qsr.request_id = $1
        `, [requestId]);

        const request = requestDetails.rows[0];

        // Send WebSocket notification to garage
        io.to(`garage_${assignedGarage.garage_id}`).emit('new_quick_service', {
            request_id: requestId,
            service_type: serviceType,
            customer_name: request.customer_name,
            customer_phone: request.customer_phone,
            vehicle: `${request.vehicle_make} ${request.vehicle_model} ${request.vehicle_year}`,
            location: {
                address: request.location_address,
                lat: request.location_lat,
                lng: request.location_lng
            },
            distance_km: assignedGarage.distance_km.toFixed(1),
            estimated_price: request.estimated_price || 'TBD',
            notes: request.notes,
            created_at: request.created_at
        });

        console.log(`[QuickService] Assigned ${requestId} to garage ${assignedGarage.garage_id}`);

        return {
            success: true,
            garage: {
                garage_id: assignedGarage.garage_id,
                name: assignedGarage.garage_name,
                distance_km: assignedGarage.distance_km
            }
        };
    } catch (error) {
        console.error('[QuickService] Assignment error:', error);
        return { success: false, error: 'Failed to assign service provider' };
    }
}

/**
 * Create Quick Service Request
 */
router.post('/request', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const {
            service_type,
            location_lat,
            location_lng,
            location_address,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            notes,
            payment_method
        } = req.body;

        // Validate service type
        const validTypes = ['battery', 'oil', 'wash', 'tire', 'ac', 'breakdown'];
        if (!validTypes.includes(service_type)) {
            return res.status(400).json({ success: false, error: 'Invalid service type' });
        }

        // Create request
        const result = await pool.query(`
            INSERT INTO quick_service_requests (
                customer_id,
                service_type,
                location_lat,
                location_lng,
                location_address,
                vehicle_make,
                vehicle_model,
                vehicle_year,
                notes,
                payment_method,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            RETURNING request_id, created_at
        `, [
            userId,
            service_type,
            location_lat,
            location_lng,
            location_address,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            notes || null,
            payment_method || 'cash'
        ]);

        const request = result.rows[0];

        // Immediately try to assign to nearby garage
        const assignment = await assignQuickService(
            request.request_id,
            service_type,
            location_lat,
            location_lng
        );

        res.json({
            success: true,
            request: {
                request_id: request.request_id,
                status: assignment.success ? 'assigned' : 'pending',
                created_at: request.created_at,
                assigned_garage: assignment.garage || null
            },
            message: assignment.success
                ? 'Service provider assigned!'
                : 'Looking for available service provider...'
        });
    } catch (error) {
        console.error('[QuickService] Create request error:', error);
        res.status(500).json({ success: false, error: 'Failed to create request' });
    }
});

/**
 * Get Customer's Quick Service Requests
 */
router.get('/my-requests', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const result = await pool.query(`
            SELECT 
                qsr.*,
                g.garage_name,
                g.phone as garage_phone
            FROM quick_service_requests qsr
            LEFT JOIN garages g ON qsr.assigned_garage_id = g.garage_id
            WHERE qsr.customer_id = $1
            ORDER BY qsr.created_at DESC
            LIMIT 50
        `, [userId]);

        res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('[QuickService] Get requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});

/**
 * Get Garage's Quick Service Requests
 */
router.get('/garage/requests', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        // Get garage_id for this user
        const garageResult = await pool.query(
            'SELECT garage_id FROM garages WHERE owner_id = $1',
            [userId]
        );

        if (garageResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Garage not found' });
        }

        const garageId = garageResult.rows[0].garage_id;

        const result = await pool.query(`
            SELECT 
                qsr.*,
                u.full_name as customer_name,
                u.phone as customer_phone
            FROM quick_service_requests qsr
            JOIN users u ON qsr.customer_id = u.user_id
            WHERE qsr.assigned_garage_id = $1
            ORDER BY 
                CASE qsr.status
                    WHEN 'assigned' THEN 1
                    WHEN 'accepted' THEN 2
                    WHEN 'en_route' THEN 3
                    WHEN 'in_progress' THEN 4
                    ELSE 5
                END,
                qsr.created_at DESC
        `, [garageId]);

        res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('[QuickService] Get garage requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});

/**
 * Garage Accept Quick Service
 */
router.post('/:requestId/accept', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;
        const { estimated_arrival_minutes } = req.body;

        // Get garage_id
        const garageResult = await pool.query(
            'SELECT garage_id FROM garages WHERE owner_id = $1',
            [userId]
        );

        if (garageResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Garage not found' });
        }

        const garageId = garageResult.rows[0].garage_id;

        // Update request
        await pool.query(`
            UPDATE quick_service_requests
            SET 
                status = 'accepted',
                accepted_at = NOW(),
                estimated_arrival = NOW() + INTERVAL '${estimated_arrival_minutes || 30} minutes'
            WHERE request_id = $1 AND assigned_garage_id = $2
        `, [requestId, garageId]);

        // Get customer_id to notify
        const requestResult = await pool.query(
            'SELECT customer_id FROM quick_service_requests WHERE request_id = $1',
            [requestId]
        );

        if (requestResult.rows.length > 0) {
            const customerId = requestResult.rows[0].customer_id;

            // Notify customer via WebSocket
            io.to(`user_${customerId}`).emit('service_accepted', {
                request_id: requestId,
                garage_id: garageId,
                estimated_arrival_minutes: estimated_arrival_minutes || 30,
                message: 'Service provider is on the way!'
            });
        }

        res.json({
            success: true,
            message: 'Service accepted successfully'
        });
    } catch (error) {
        console.error('[QuickService] Accept error:', error);
        res.status(500).json({ success: false, error: 'Failed to accept service' });
    }
});

/**
 * Garage Decline Quick Service
 */
router.post('/:requestId/decline', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;

        // Update to pending and clear assignment
        await pool.query(`
            UPDATE quick_service_requests
            SET 
                status = 'pending',
                assigned_garage_id = NULL,
                assigned_at = NULL
            WHERE request_id = $1
        `, [requestId]);

        // Try to reassign to another garage
        const requestData = await pool.query(
            'SELECT service_type, location_lat, location_lng FROM quick_service_requests WHERE request_id = $1',
            [requestId]
        );

        if (requestData.rows.length > 0) {
            const { service_type, location_lat, location_lng } = requestData.rows[0];
            await assignQuickService(requestId, service_type, location_lat, location_lng);
        }

        res.json({
            success: true,
            message: 'Service declined, reassigning...'
        });
    } catch (error) {
        console.error('[QuickService] Decline error:', error);
        res.status(500).json({ success: false, error: 'Failed to decline service' });
    }
});

/**
 * Complete Service
 */
router.post('/:requestId/complete', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const { final_price, notes } = req.body;

        await pool.query(`
            UPDATE quick_service_requests
            SET 
                status = 'completed',
                final_price = $1,
                completion_notes = $2,
                completed_at = NOW()
            WHERE request_id = $3
        `, [final_price, notes, requestId]);

        res.json({
            success: true,
            message: 'Service completed successfully'
        });
    } catch (error) {
        console.error('[QuickService] Complete error:', error);
        res.status(500).json({ success: false, error: 'Failed to complete service' });
    }
});

/**
 * Get Pricing Info
 */
router.get('/pricing', async (req: Request, res: Response) => {
    const pricing = {
        battery: { min: 150, max: 250, currency: 'QAR', duration: '30 mins' },
        oil: { min: 120, max: 200, currency: 'QAR', duration: '30 mins' },
        wash: { min: 80, max: 120, currency: 'QAR', duration: '45 mins' },
        tire: { min: 50, max: 150, currency: 'QAR', duration: '20 mins' },
        ac: { min: 200, max: 300, currency: 'QAR', duration: '45 mins' },
        breakdown: { min: 0, max: 0, currency: 'QAR', duration: 'ASAP', note: 'Free diagnosis' }
    };

    res.json({ success: true, pricing });
});

export default router;
