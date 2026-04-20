"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_middleware_1 = require("../middleware/rateLimiter.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const driver_schema_1 = require("../schemas/driver.schema");
const driver_controller_1 = require("../controllers/driver.controller");
const router = (0, express_1.Router)();
// All routes require driver authentication
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.requireRole)('driver'));
// ============================================================================
// DRIVER PROFILE & STATS
// ============================================================================
// Get driver's own profile
router.get('/me', driver_controller_1.getMyProfile);
// Get driver's statistics
router.get('/stats', driver_controller_1.getMyStats);
// Toggle availability (available/offline)
router.post('/availability', (0, validation_middleware_1.validate)(driver_schema_1.toggleAvailabilitySchema), driver_controller_1.toggleAvailability);
// ============================================================================
// ASSIGNMENTS
// ============================================================================
// Get driver's assignments (active by default)
router.get('/assignments', driver_controller_1.getMyAssignments);
// Get specific assignment details
router.get('/assignments/:assignment_id', driver_controller_1.getAssignmentDetails);
// Update assignment status (picked_up, in_transit, delivered, failed)
router.patch('/assignments/:assignment_id/status', (0, validation_middleware_1.validate)(driver_schema_1.updateStatusSchema), driver_controller_1.updateAssignmentStatus);
// Upload proof of delivery
router.post('/assignments/:assignment_id/proof', (0, validation_middleware_1.validate)(driver_schema_1.uploadProofSchema), driver_controller_1.uploadDeliveryProof);
// ============================================================================
// LOCATION TRACKING (Rate Limited)
// ============================================================================
// Update driver's current location - RATE LIMITED: 1 per 5 seconds
router.post('/location', rateLimiter_middleware_1.driverLocationLimiter, (0, validation_middleware_1.validate)(driver_schema_1.updateLocationSchema), driver_controller_1.updateMyLocation);
exports.default = router;
