/**
 * Quick Services Routes - Refactored
 * Delegates business logic to QuickServiceService
 */

import { Request, Response, Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth.middleware';
import { getIO } from '../utils/socketIO';
import { QuickServiceService, SERVICE_PRICING, VALID_SERVICE_TYPES } from '../services/quickservices';

const router = Router();

// Initialize service with lazy io access
// Note: getIO() returns null during tests but the service handles this gracefully
const quickServiceService = new QuickServiceService(pool, getIO());

// ============================================
// CUSTOMER ENDPOINTS
// ============================================

/**
 * Create Quick Service Request
 */
router.post('/request', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const result = await quickServiceService.createRequest(userId, req.body);

        res.json({
            success: true,
            request: {
                request_id: result.request_id,
                status: result.status,
                assigned_garage: result.assignment.garage || null
            },
            message: result.assignment.success
                ? 'Service provider assigned!'
                : 'Looking for available service provider...'
        });
    } catch (error: any) {
        console.error('[QuickService] Create request error:', error);
        if (error.message?.includes('already have an active')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message?.includes('Invalid')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Failed to create request' });
    }
});

/**
 * Get Customer's Quick Service Requests
 */
router.get('/my-requests', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const requests = await quickServiceService.getCustomerRequests(userId);
        res.json({ success: true, requests });
    } catch (error) {
        console.error('[QuickService] Get requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});

/**
 * Customer accepts price quote
 */
router.post('/:requestId/accept-quote', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;

        const requestCheck = await pool.query(`
            SELECT * FROM quick_service_requests
            WHERE request_id = $1 AND customer_id = $2
        `, [requestId, userId]);

        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        const request = requestCheck.rows[0];
        if (request.status !== 'quoted') {
            return res.status(400).json({ success: false, error: 'No quote to accept' });
        }

        await pool.query(`
            UPDATE quick_service_requests SET status = 'accepted', final_price = quoted_price
            WHERE request_id = $1
        `, [requestId]);

        io.to(`garage_${request.assigned_garage_id}`).emit('quote_accepted', {
            request_id: requestId,
            final_price: request.quoted_price
        });

        res.json({ success: true, message: 'Quote accepted! Service provider is on the way.' });
    } catch (error) {
        console.error('[QuickService] Accept quote error:', error);
        res.status(500).json({ success: false, error: 'Failed to accept quote' });
    }
});

/**
 * Customer rejects price quote
 */
router.post('/:requestId/reject-quote', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;
        const { find_another } = req.body;

        const requestCheck = await pool.query(`
            SELECT * FROM quick_service_requests WHERE request_id = $1 AND customer_id = $2
        `, [requestId, userId]);

        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        const request = requestCheck.rows[0];
        const rejectedGarageId = request.assigned_garage_id;

        io.to(`garage_${rejectedGarageId}`).emit('quote_rejected', { request_id: requestId });

        if (find_another) {
            const currentRejected = request.rejected_garages || [];
            const updatedRejected = [...currentRejected, rejectedGarageId].filter(Boolean);

            await pool.query(`
                UPDATE quick_service_requests SET
                    status = 'pending', assigned_garage_id = NULL, quoted_price = NULL, assigned_at = NULL
                WHERE request_id = $1
            `, [requestId]);

            const assignment = await quickServiceService.assignQuickService(
                requestId, request.service_type,
                parseFloat(request.location_lat), parseFloat(request.location_lng),
                updatedRejected
            );

            if (assignment.success) {
                res.json({ success: true, message: 'Finding another service provider...', new_garage: assignment.garage });
            } else {
                await pool.query(`UPDATE quick_service_requests SET status = 'cancelled' WHERE request_id = $1`, [requestId]);
                res.json({ success: false, message: 'No other providers available in your area. Request cancelled.' });
            }
        } else {
            await pool.query(`UPDATE quick_service_requests SET status = 'cancelled' WHERE request_id = $1`, [requestId]);
            res.json({ success: true, message: 'Request cancelled' });
        }
    } catch (error) {
        console.error('[QuickService] Reject quote error:', error);
        res.status(500).json({ success: false, error: 'Failed to reject quote' });
    }
});

/**
 * Customer cancels request
 */
router.post('/:requestId/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;

        await quickServiceService.cancelRequest(requestId, userId);
        res.json({ success: true, message: 'Request cancelled' });
    } catch (error: any) {
        console.error('[QuickService] Cancel error:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to cancel' });
    }
});

// ============================================
// GARAGE ENDPOINTS
// ============================================

/**
 * Get Garage's Quick Service Settings
 */
router.get('/garage/settings', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const result = await pool.query(`
            SELECT gs.provides_quick_services, gs.quick_services_offered, gs.mobile_service_radius_km,
                   g.location_lat, g.location_lng
            FROM garages g
            LEFT JOIN garage_settings gs ON g.garage_id = gs.garage_id
            WHERE g.garage_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Garage not found' });
        }

        res.json({ success: true, settings: result.rows[0] });
    } catch (error) {
        console.error('[QuickService] Get settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

/**
 * Save Garage's Quick Service Settings
 */
router.post('/garage/settings', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { provides_quick_services, quick_services_offered, mobile_service_radius_km } = req.body;

        await pool.query(`
            INSERT INTO garage_settings (garage_id, provides_quick_services, quick_services_offered, mobile_service_radius_km)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (garage_id) DO UPDATE SET
                provides_quick_services = EXCLUDED.provides_quick_services,
                quick_services_offered = EXCLUDED.quick_services_offered,
                mobile_service_radius_km = EXCLUDED.mobile_service_radius_km,
                updated_at = NOW()
        `, [userId, provides_quick_services || false, quick_services_offered || [], mobile_service_radius_km || 15]);

        res.json({ success: true, message: 'Quick Services settings saved' });
    } catch (error) {
        console.error('[QuickService] Save settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
});

/**
 * Get Garage's Quick Service Requests
 */
router.get('/garage/requests', authenticate, async (req: Request, res: Response) => {
    try {
        const garageId = (req as any).user.userId;
        const requests = await quickServiceService.getGarageRequests(garageId);
        res.json({ success: true, requests });
    } catch (error) {
        console.error('[QuickService] Get garage requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});

/**
 * Garage Accept Quick Service
 */
router.post('/:requestId/accept', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const garageId = (req as any).user.userId;
        const { estimated_arrival_minutes } = req.body;

        await pool.query(`
            UPDATE quick_service_requests SET status = 'accepted', accepted_at = NOW(),
                estimated_arrival = NOW() + INTERVAL '${estimated_arrival_minutes || 30} minutes'
            WHERE request_id = $1 AND assigned_garage_id = $2
        `, [requestId, garageId]);

        const requestResult = await pool.query(
            'SELECT customer_id FROM quick_service_requests WHERE request_id = $1', [requestId]
        );

        if (requestResult.rows.length > 0) {
            io.to(`user_${requestResult.rows[0].customer_id}`).emit('service_accepted', {
                request_id: requestId, garage_id: garageId,
                estimated_arrival_minutes: estimated_arrival_minutes || 30,
                message: 'Service provider is on the way!'
            });
        }

        res.json({ success: true, message: 'Service accepted successfully' });
    } catch (error) {
        console.error('[QuickService] Accept error:', error);
        res.status(500).json({ success: false, error: 'Failed to accept service' });
    }
});

/**
 * Garage Decline Quick Service
 */
router.post('/:requestId/decline', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;

        await pool.query(`
            UPDATE quick_service_requests SET status = 'pending', assigned_garage_id = NULL, assigned_at = NULL
            WHERE request_id = $1
        `, [requestId]);

        const requestData = await pool.query(
            'SELECT service_type, location_lat, location_lng FROM quick_service_requests WHERE request_id = $1',
            [requestId]
        );

        if (requestData.rows.length > 0) {
            const { service_type, location_lat, location_lng } = requestData.rows[0];
            await quickServiceService.assignQuickService(requestId, service_type, location_lat, location_lng);
        }

        res.json({ success: true, message: 'Service declined, reassigning...' });
    } catch (error) {
        console.error('[QuickService] Decline error:', error);
        res.status(500).json({ success: false, error: 'Failed to decline service' });
    }
});

/**
 * Dispatch Technician (en_route)
 */
router.post('/:requestId/dispatch', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const garageId = (req as any).user.userId;

        await quickServiceService.updateStatus(requestId, garageId, 'en_route', {
            message: 'Technician is on the way to your location!'
        });

        res.json({ success: true, message: 'Technician dispatched' });
    } catch (error: any) {
        console.error('[QuickService] Dispatch error:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to dispatch' });
    }
});

/**
 * Mark Arrived (in_progress)
 */
router.post('/:requestId/arrived', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const garageId = (req as any).user.userId;

        await quickServiceService.updateStatus(requestId, garageId, 'in_progress', {
            message: 'Technician has arrived! Service starting...'
        });

        res.json({ success: true, message: 'Marked as arrived, service in progress' });
    } catch (error: any) {
        console.error('[QuickService] Arrived error:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to update status' });
    }
});

/**
 * Complete Service
 */
router.post('/:requestId/complete', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const { final_price, notes } = req.body;

        await quickServiceService.completeService(requestId, final_price, notes);
        res.json({ success: true, message: 'Service completed successfully' });
    } catch (error) {
        console.error('[QuickService] Complete error:', error);
        res.status(500).json({ success: false, error: 'Failed to complete service' });
    }
});

/**
 * Garage submits price quote
 */
router.post('/:requestId/quote', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const garageId = (req as any).user.userId;
        const { quoted_price, notes } = req.body;

        await quickServiceService.submitQuote(requestId, garageId, quoted_price, notes);
        res.json({ success: true, message: 'Quote submitted successfully' });
    } catch (error: any) {
        console.error('[QuickService] Quote error:', error);
        res.status(400).json({ success: false, error: error.message || 'Failed to submit quote' });
    }
});

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * Get Pricing Info
 */
router.get('/pricing', async (_req: Request, res: Response) => {
    res.json({ success: true, pricing: SERVICE_PRICING });
});

/**
 * Get Request Status (for tracking screen)
 */
router.get('/:requestId/status', authenticate, async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = (req as any).user.userId;

        const result = await pool.query(`
            SELECT qsr.*, g.garage_name, g.phone_number as garage_phone, g.location_lat as garage_lat, g.location_lng as garage_lng
            FROM quick_service_requests qsr
            LEFT JOIN garages g ON qsr.assigned_garage_id = g.garage_id
            WHERE qsr.request_id = $1 AND (qsr.customer_id = $2 OR qsr.assigned_garage_id = $2)
        `, [requestId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        res.json({ success: true, request: result.rows[0] });
    } catch (error) {
        console.error('[QuickService] Status error:', error);
        res.status(500).json({ success: false, error: 'Failed to get status' });
    }
});

export default router;
