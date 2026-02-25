import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperationsDashboard } from '../middleware/authorize.middleware';
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
    triggerAutoComplete,
    getAnalytics,
    getReturnStats,
    getUserStats,
    getUserDetails,
    suspendUser,
    activateUser,
    getGarages,
    bulkOrderAction
} from '../controllers/operations.controller';
import {
    getReturns,
    approveReturn,
    rejectReturn,
    assignReturnDriver
} from '../controllers/operations-returns.controller';

const router = Router();

// All operations routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperationsDashboard);

// Dashboard & Analytics
router.get('/dashboard/stats', getDashboardStats);
router.get('/stats', getDashboardStats); // Alias for compatibility
router.get('/analytics', getAnalytics);

// Orders
router.get('/orders', getOrders);
router.get('/orders/orphan', getOrphanOrders); // Get stuck/orphan orders
router.get('/orders/:order_id', getOrderDetails);
router.patch('/orders/:order_id/status', updateOrderStatus);
router.post('/orders/:order_id/collect', collectOrder);
router.post('/orders/:order_id/cancel', cancelOrderByOperations); // Cancel order (admin cleanup)
router.post('/orders/bulk', bulkOrderAction); // Bulk order operations (NEW)

// Disputes
router.get('/disputes', getDisputes);
router.get('/disputes/:dispute_id', getDisputeDetails);
router.post('/disputes/:dispute_id/resolve', resolveDispute);

// Support Escalations (from Support Dashboard)
router.get('/escalations', getEscalations);
router.post('/escalations/:escalation_id/resolve', resolveEscalation);

// Return Assignments
router.get('/returns', getReturns);
router.post('/returns/:return_id/assign-driver', assignReturnDriver); // Assign driver to return part

// Approve return request (BRAIN v3.0)
router.post('/returns/:return_id/approve', approveReturn);

// Reject return request
router.post('/returns/:return_id/reject', rejectReturn);
router.get('/returns/stats', getReturnStats);

// Users
router.get('/users', getUsers);
router.get('/users/stats', getUserStats);
router.get('/users/:user_id', getUserDetails);
router.post('/users/:user_id/suspend', suspendUser);
router.post('/users/:user_id/activate', activateUser);

// Jobs (Manual Triggers for Testing)
router.post('/jobs/auto-complete', triggerAutoComplete); // Manually trigger 48h auto-complete

// Garages
router.get('/garages', getGarages);

export default router;
