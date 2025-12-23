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
    getUserDetails,
    suspendUser,
    activateUser,
    getAnalytics,
    getQualityStats,
    getUserStats,
    getGarages
} from '../controllers/operations.controller';

const router = Router();

// All operations routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperations);

// Dashboard & Analytics
router.get('/dashboard/stats', getDashboardStats);
router.get('/analytics', getAnalytics);

// Quality Control
router.get('/quality/stats', getQualityStats);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:order_id', getOrderDetails);
router.patch('/orders/:order_id/status', updateOrderStatus);
router.post('/orders/:order_id/collect', collectOrder);

// Disputes
router.get('/disputes', getDisputes);
router.get('/disputes/:dispute_id', getDisputeDetails);
router.post('/disputes/:dispute_id/resolve', resolveDispute);

// Users
router.get('/users', getUsers);
router.get('/users/stats', getUserStats);
router.get('/users/:user_id', getUserDetails);
router.post('/users/:user_id/suspend', suspendUser);
router.post('/users/:user_id/activate', activateUser);

// Garages
router.get('/garages', getGarages);

export default router;
