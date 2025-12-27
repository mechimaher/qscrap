import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getOrdersReport,
    getRevenueReport,
    getDisputesReport,
    getDeliveriesReport,
    getGaragesReport
} from '../controllers/reports.controller';

const router = express.Router();

// All reports require authentication and operations/admin role
router.use(authenticate);
router.use(authorizeOperations);

// Report endpoints
router.get('/orders', getOrdersReport);
router.get('/revenue', getRevenueReport);
router.get('/disputes', getDisputesReport);
router.get('/deliveries', getDeliveriesReport);
router.get('/garages', getGaragesReport);

export default router;
