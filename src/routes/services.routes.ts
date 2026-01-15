import { Router } from 'express';
import {
    getServiceDefinitions,
    createServiceRequest,
    getMyServiceRequests,
    getNearbyRequests,
    bidOnServiceRequest
} from '../controllers/services.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload, optimizeFiles } from '../middleware/file.middleware';

const router = Router();

// Definitions (Public or Auth)
router.get('/definitions', authenticate, getServiceDefinitions);

// Customer: Create Request
router.post('/requests', authenticate, requireRole('customer'), upload.array('images', 5), optimizeFiles, createServiceRequest);

// Customer: My Requests
router.get('/requests/my', authenticate, requireRole('customer'), getMyServiceRequests);

// Provider: Nearby Requests
// Note: 'garage' role checks might need to be expanded to allow 'mobile_mechanic' if that's a new separate role or subtype
router.get('/requests/nearby', authenticate, requireRole('garage'), getNearbyRequests);

// Provider: Bid
router.post('/requests/:request_id/bids', authenticate, requireRole('garage'), bidOnServiceRequest);

export default router;
