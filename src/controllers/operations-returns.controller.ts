import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';

/**
 * Operations Returns Controller
 * Handles return request management for Operations Dashboard
 */

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

/**
 * GET /returns
 * Get pending return requests
 */
export const getReturns = async (req: Request, res: Response): Promise<void> => {
    try {
        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const returns = await returnService.getPendingReturns();
        res.json({ returns });
    } catch (error) {
        logger.error('Get returns error', { error });
        res.json({ returns: [] });
    }
};

/**
 * POST /returns/:return_id/assign-driver
 * Assign a driver to return a part to garage
 */
export const assignReturnDriver = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { driver_id } = req.body;
        const operatorId = getUserId(req);

        if (!operatorId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!driver_id) {
            res.status(400).json({ error: 'driver_id is required' });
            return;
        }

        const { default: pool } = await import('../config/db');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get return assignment details
            const returnResult = await client.query(`
                SELECT da.order_id, da.assignment_id, o.order_number, g.garage_name, g.address as garage_address
                FROM delivery_assignments da
                JOIN orders o ON da.order_id = o.order_id
                JOIN garages g ON o.garage_id = g.garage_id
                WHERE da.assignment_id = $1 AND da.assignment_type = 'return_to_garage'
            `, [return_id]);

            if (returnResult.rows.length === 0) {
                res.status(404).json({ error: 'Return assignment not found' });
                return;
            }

            const returnAssignment = returnResult.rows[0];

            // Update delivery assignment with driver
            await client.query(`
                UPDATE delivery_assignments
                SET driver_id = $1,
                    status = 'assigned',
                    pickup_address = $2,
                    delivery_address = $3,
                    updated_at = NOW()
                WHERE assignment_id = $4
            `, [driver_id, returnAssignment.garage_address, returnAssignment.garage_address, return_id]);

            // Notify driver via socket
            try {
                const { getIO } = await import('../utils/socketIO');
                const io = getIO();
                if (io) {
                    io.to(`driver_${driver_id}`).emit('return_assignment_created', {
                        assignment_id: return_id,
                        order_number: returnAssignment.order_number,
                        notification: `New return assignment: Order #${returnAssignment.order_number}`
                    });
                }
            } catch (socketErr) {
                logger.error('Failed to notify driver', { error: socketErr });
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Driver assigned to return',
                assignment_id: return_id,
                driver_id,
                order_number: returnAssignment.order_number
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Assign return driver error', { error });
        res.status(400).json({ error: error.message || 'Failed to assign driver' });
    }
};

/**
 * POST /returns/:return_id/approve
 * Approve return request (BRAIN v3.0)
 */
export const approveReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { notes } = req.body;
        const operatorId = (req as any).user?.userId;

        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const result = await returnService.approveReturn(return_id, operatorId, notes);

        res.json(result);
    } catch (error: any) {
        logger.error('Approve return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to approve return' });
    }
};

/**
 * POST /returns/:return_id/reject
 * Reject return request
 */
export const rejectReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { reason } = req.body;
        const operatorId = (req as any).user?.userId;

        if (!reason) {
            res.status(400).json({ success: false, message: 'Rejection reason is required' });
            return;
        }

        const { getReturnService } = await import('../services/cancellation/return.service');
        const { default: pool } = await import('../config/db');
        const returnService = getReturnService(pool);
        const result = await returnService.rejectReturn(return_id, operatorId, reason);

        res.json(result);
    } catch (error: any) {
        logger.error('Reject return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to reject return' });
    }
};
