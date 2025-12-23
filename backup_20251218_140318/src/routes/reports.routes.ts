import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    getOrdersReport,
    getRevenueReport,
    getDisputesReport,
    getDeliveriesReport,
    getGaragesReport
} from '../controllers/reports.controller';

const router = express.Router();

// All reports require authentication and operations role
router.use(authenticate, requireRole('operations'));

// Report endpoints
router.get('/orders', getOrdersReport);
router.get('/revenue', getRevenueReport);
router.get('/disputes', getDisputesReport);
router.get('/deliveries', getDeliveriesReport);
router.get('/garages', getGaragesReport);

export default router;
