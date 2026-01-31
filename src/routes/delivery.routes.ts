import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations, authorizeAdmin } from '../middleware/authorize.middleware';
import {
    getDrivers,
    getDriverDetails,
    createDriver,
    updateDriver,
    getOrdersForDelivery,
    getOrdersReadyForCollection,
    getOrdersReadyForDelivery,
    collectOrder,
    assignCollectionDriver,
    assignDriver,
    reassignDriver,
    updateDeliveryStatus,
    getDeliveryStats,
    updateDriverLocation,
    completeWithPOD,
    getActiveDeliveries,
    calculateDeliveryFee,
    getDeliveryZones,
    updateZoneFee,
    getRankedDriversForOrder
} from '../controllers/delivery.controller';

const router = Router();

// Zone routes - Public (for customer fee preview) or authenticated
router.get('/zones', authenticate, getDeliveryZones);
router.post('/calculate-fee', authenticate, calculateDeliveryFee);

// Admin-only zone management
router.patch('/zones/:zone_id', authenticate, authorizeAdmin, updateZoneFee);

// CRITICAL: Driver POD endpoint MUST be accessible to drivers
// Moving BEFORE authorizeOperations middleware
router.post('/complete-with-pod', authenticate, completeWithPOD);

// All other delivery routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperations);

// Dashboard stats
router.get('/stats', getDeliveryStats);

// Active deliveries with live positions
router.get('/active', getActiveDeliveries);

// Drivers
router.get('/drivers', getDrivers);
router.get('/drivers/ranked/:order_id', getRankedDriversForOrder); // NEW: Drivers ranked by distance to order's garage
router.get('/drivers/:driver_id', getDriverDetails);
router.post('/drivers', createDriver);
router.patch('/drivers/:driver_id', updateDriver);

// Orders - Collection from garages
router.get('/collection/pending', getOrdersReadyForCollection);
router.post('/assign-collection/:order_id', assignCollectionDriver);  // NEW: Assign driver, order stays ready_for_pickup
router.post('/collect/:order_id', collectOrder);  // DEPRECATED: Use assign-collection + driver pickup

// Orders - Delivery to customers  
router.get('/delivery/pending', getOrdersReadyForDelivery);

// Legacy combined orders endpoint
router.get('/orders', getOrdersForDelivery);

// Assignments
router.post('/assign/:order_id', assignDriver);
router.post('/reassign/:assignment_id', reassignDriver);  // Emergency driver reassignment
router.patch('/assignment/:assignment_id/status', updateDeliveryStatus);
router.post('/drivers/:driver_id/location', updateDriverLocation);  // Update driver GPS location

export default router;

