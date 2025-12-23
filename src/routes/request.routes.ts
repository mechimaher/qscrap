import { Router, Request, Response, NextFunction } from 'express';
import { createRequest, getActiveRequests, getMyRequests, getRequestDetails, ignoreRequest, getIgnoredRequests } from '../controllers/request.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload } from '../middleware/file.middleware';

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

// Customer creates request
router.post('/', authenticate, requireRole('customer'), handleMulterError(upload.array('images', 5)), createRequest);

// Customer views their requests
router.get('/my', authenticate, requireRole('customer'), getMyRequests);

// Garage views active requests
router.get('/pending', authenticate, requireRole('garage'), getActiveRequests);

// Details (Shared but with logic inside)
router.get('/:request_id', authenticate, getRequestDetails);

// Garage: Ignore a request (per-garage, request still visible to others)
router.post('/:request_id/ignore', authenticate, requireRole('garage'), ignoreRequest);

// Garage: Get list of ignored request IDs
router.get('/ignored/list', authenticate, requireRole('garage'), getIgnoredRequests);

export default router;
