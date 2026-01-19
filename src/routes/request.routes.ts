import { Router, Request, Response, NextFunction } from 'express';
import { createRequest, getActiveRequests, getMyRequests, getRequestDetails, ignoreRequest, unignoreRequest, getIgnoredRequests, cancelRequest, deleteRequest } from '../controllers/request.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload, optimizeFiles } from '../middleware/file.middleware';
import { validateParams, requestIdParamSchema } from '../middleware/validation.middleware';
import { requestWriteLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Error handling wrapper for multer
const handleMulterError = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, (err: any) => {
        if (err) {
            console.error('Multer error:', err.message);
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: 'Unexpected file field. Please use "images" for photo uploads.' });
            }
            return res.status(400).json({ error: err.message || 'File upload error' });
        }
        next();
    });
};

// Customer creates request (with compressed images) - rate limited
// Accept: images[] (up to 5), car_front_image (1), car_rear_image (1)
// Note: Body validation is handled inside RequestService (complex multipart form)
router.post('/', authenticate, requireRole('customer'), requestWriteLimiter, handleMulterError(upload.fields([
    { name: 'images', maxCount: 5 },             // Part damage photos
    { name: 'car_front_image', maxCount: 1 },    // Vehicle front view
    { name: 'car_rear_image', maxCount: 1 }      // Vehicle rear view
])), optimizeFiles, createRequest);

// Customer views their requests
router.get('/my', authenticate, requireRole('customer'), getMyRequests);

// Garage views active requests
router.get('/pending', authenticate, requireRole('garage'), getActiveRequests);

// Garage: Get list of ignored request IDs (must be before /:request_id to avoid conflict)
router.get('/ignored/list', authenticate, requireRole('garage'), getIgnoredRequests);

// Details (Shared but with logic inside) - With param validation
router.get('/:request_id', authenticate, validateParams(requestIdParamSchema), getRequestDetails);

// Customer: Cancel their own request (soft - changes status to cancelled)
router.post('/:request_id/cancel', authenticate, requireRole('customer'), validateParams(requestIdParamSchema), cancelRequest);

// Customer: Delete their own request (hard - removes from database, only if no orders)
router.delete('/:request_id', authenticate, requireRole('customer'), validateParams(requestIdParamSchema), deleteRequest);

// Garage: Ignore a request (per-garage, request still visible to others)
router.post('/:request_id/ignore', authenticate, requireRole('garage'), validateParams(requestIdParamSchema), ignoreRequest);

// Garage: Undo ignore (for 5-second undo feature)
router.delete('/:request_id/ignore', authenticate, requireRole('garage'), validateParams(requestIdParamSchema), unignoreRequest);
export default router;
