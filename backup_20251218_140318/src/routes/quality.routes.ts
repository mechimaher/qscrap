import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getInspectionCriteria,
    getReadyForCollection,
    getPendingInspections,
    startInspection,
    submitInspection,
    getInspectionHistory,
    getQCStats,
    getQCPassedOrders,
    createReturnAssignment,
    getInspectionReport
} from '../controllers/quality.controller';

const router = Router();

// All QC routes require authentication AND operations authorization
router.use(authenticate);
router.use(authorizeOperations);

// Inspection criteria (checklist items)
router.get('/criteria', getInspectionCriteria);

// Dashboard stats
router.get('/stats', getQCStats);

// Orders ready for collection from garages (ready_for_pickup status)
router.get('/ready-for-collection', getReadyForCollection);

// Pending inspections (collected status, awaiting QC)
router.get('/pending', getPendingInspections);

// Orders that passed QC (ready for driver assignment)
router.get('/passed', getQCPassedOrders);

// Inspection history
router.get('/history', getInspectionHistory);

// Get inspection report for an order
router.get('/report/:order_id', getInspectionReport);

// Start inspection for an order
router.post('/inspect/:order_id/start', startInspection);

// Submit inspection results (pass/fail)
router.post('/inspect/:order_id/submit', submitInspection);

// Create return assignment for QC-failed order
router.post('/return/:order_id', createReturnAssignment);

export default router;
