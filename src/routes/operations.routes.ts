import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getDashboardStats,
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    collectOrder,
    getDisputes,
    getDisputeDetails,
    resolveDispute,
    getEscalations,
    resolveEscalation,
    getUsers,
    cancelOrderByOperations,
    getOrphanOrders,
    triggerAutoComplete
} from '../controllers/operations.controller';

const router = Router();

// All operations routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperations);

// Dashboard & Analytics
router.get('/dashboard/stats', getDashboardStats);
router.get('/stats', getDashboardStats); // Alias for compatibility
// router.get('/analytics', getAnalytics); // TODO: Implement getAnalytics

// Orders
router.get('/orders', getOrders);
router.get('/orders/orphan', getOrphanOrders); // Get stuck/orphan orders
router.get('/orders/:order_id', getOrderDetails);
router.patch('/orders/:order_id/status', updateOrderStatus);
router.post('/orders/:order_id/collect', collectOrder);
router.post('/orders/:order_id/cancel', cancelOrderByOperations); // Cancel order (admin cleanup)

// Disputes
router.get('/disputes', getDisputes);
router.get('/disputes/:dispute_id', getDisputeDetails);
router.post('/disputes/:dispute_id/resolve', resolveDispute);

// Support Escalations (from Support Dashboard)
router.get('/escalations', getEscalations);
router.post('/escalations/:escalation_id/resolve', resolveEscalation);

// Return Assignments
router.get('/returns', async (req, res) => {
    try {
        const { getReturnService } = await import('../services/cancellation/return.service');
        const pool = (global as any).pool;
        const returnService = getReturnService(pool);
        const returns = await returnService.getPendingReturns();
        res.json({ returns });
    } catch (error) {
        logger.error('Get returns error', { error });
        res.json({ returns: [] });
    }
});

// Approve return request (BRAIN v3.0)
router.post('/returns/:return_id/approve', async (req, res) => {
    try {
        const { return_id } = req.params;
        const { notes } = req.body;
        const operatorId = (req as any).user?.userId;

        const { getReturnService } = await import('../services/cancellation/return.service');
        const pool = (global as any).pool;
        const returnService = getReturnService(pool);
        const result = await returnService.approveReturn(return_id, operatorId, notes);

        res.json(result);
    } catch (error: any) {
        logger.error('Approve return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to approve return' });
    }
});

// Reject return request
router.post('/returns/:return_id/reject', async (req, res) => {
    try {
        const { return_id } = req.params;
        const { reason } = req.body;
        const operatorId = (req as any).user?.userId;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }

        const { getReturnService } = await import('../services/cancellation/return.service');
        const pool = (global as any).pool;
        const returnService = getReturnService(pool);
        const result = await returnService.rejectReturn(return_id, operatorId, reason);

        res.json(result);
    } catch (error: any) {
        logger.error('Reject return error', { error });
        res.status(400).json({ success: false, message: error.message || 'Failed to reject return' });
    }
});
// router.get('/returns/stats', getReturnStats); // TODO: Implement getReturnStats
// router.post('/returns/:assignment_id/assign-driver', assignDriverToReturn); // TODO: Implement assignDriverToReturn

// Users
router.get('/users', getUsers);
// router.get('/users/stats', getUserStats); // TODO: Implement getUserStats
// router.get('/users/:user_id', getUserDetails); // TODO: Implement getUserDetails
// router.post('/users/:user_id/suspend', suspendUser); // TODO: Implement suspendUser
// router.post('/users/:user_id/activate', activateUser); // TODO: Implement activateUser

// Jobs (Manual Triggers for Testing)
router.post('/jobs/auto-complete', triggerAutoComplete); // Manually trigger 48h auto-complete

// Garages
// router.get('/garages', getGarages); // TODO: Implement getGarages

export default router;

