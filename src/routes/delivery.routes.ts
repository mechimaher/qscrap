import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getDrivers,
    getDriverDetails,
    createDriver,
    updateDriver,
    getOrdersForDelivery,
    getOrdersReadyForCollection,
    getOrdersReadyForDelivery,
    collectOrder,
    assignDriver,
    reassignDriver,
    updateDeliveryStatus,
    getDeliveryStats,
    updateDriverLocation,
    getActiveDeliveries
} from '../controllers/delivery.controller';

const router = Router();

// All delivery routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperations);

// Dashboard stats
router.get('/stats', getDeliveryStats);

// Active deliveries with live positions
router.get('/active', getActiveDeliveries);

// Drivers
router.get('/drivers', getDrivers);
router.get('/drivers/:driver_id', getDriverDetails);
router.post('/drivers', createDriver);
router.patch('/drivers/:driver_id', updateDriver);

// Orders - Collection from garages
router.get('/collection/pending', getOrdersReadyForCollection);
router.post('/collect/:order_id', collectOrder);

// Orders - Delivery to customers  
router.get('/delivery/pending', getOrdersReadyForDelivery);

// Legacy combined orders endpoint
router.get('/orders', getOrdersForDelivery);

// Assignments
router.post('/assign/:order_id', assignDriver);
router.post('/reassign/:assignment_id', reassignDriver);  // Emergency driver reassignment
router.patch('/assignment/:assignment_id/status', updateDeliveryStatus);
router.post('/assignment/:assignment_id/location', updateDriverLocation);

export default router;

