import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
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
    getUsers,
    cancelOrderByOperations,
    getOrphanOrders
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

// Return Assignments
router.get('/returns', (req, res) => res.json({ returns: [] })); // Stub endpoint - returns empty array
// router.get('/returns/stats', getReturnStats); // TODO: Implement getReturnStats
// router.post('/returns/:assignment_id/assign-driver', assignDriverToReturn); // TODO: Implement assignDriverToReturn

// Users
router.get('/users', getUsers);
// router.get('/users/stats', getUserStats); // TODO: Implement getUserStats
// router.get('/users/:user_id', getUserDetails); // TODO: Implement getUserDetails
// router.post('/users/:user_id/suspend', suspendUser); // TODO: Implement suspendUser
// router.post('/users/:user_id/activate', activateUser); // TODO: Implement activateUser

// Garages
// router.get('/garages', getGarages); // TODO: Implement getGarages

export default router;
