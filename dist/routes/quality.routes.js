"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorize_middleware_1 = require("../middleware/authorize.middleware");
const quality_controller_1 = require("../controllers/quality.controller");
const router = (0, express_1.Router)();
// All QC routes require authentication AND operations authorization
router.use(auth_middleware_1.authenticate);
router.use(authorize_middleware_1.authorizeOperations);
// Inspection criteria (checklist items)
router.get('/criteria', quality_controller_1.getInspectionCriteria);
// Dashboard stats
router.get('/stats', quality_controller_1.getQCStats);
// Orders ready for collection from garages (ready_for_pickup status)
router.get('/ready-for-collection', quality_controller_1.getReadyForCollection);
// Pending inspections (collected status, awaiting QC)
router.get('/pending', quality_controller_1.getPendingInspections);
// Orders that passed QC (ready for driver assignment)
router.get('/passed', quality_controller_1.getQCPassedOrders);
// Inspection history
router.get('/history', quality_controller_1.getInspectionHistory);
// Get inspection report for an order
router.get('/report/:order_id', quality_controller_1.getInspectionReport);
// Start inspection for an order
router.post('/inspect/:order_id/start', quality_controller_1.startInspection);
// Submit inspection results (pass/fail)
router.post('/inspect/:order_id/submit', quality_controller_1.submitInspection);
// Create return assignment for QC-failed order
router.post('/return/:order_id', quality_controller_1.createReturnAssignment);
exports.default = router;
